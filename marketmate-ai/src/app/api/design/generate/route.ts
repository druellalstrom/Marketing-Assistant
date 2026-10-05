import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { buildImagePrompt, designBriefSchema, uploadsBelongToUser } from "@/lib/design/brief";
import { getImageProvider } from "@/lib/design/provider";
import { getPrimaryBusiness } from "@/lib/data/business";
import { designImageUrls, removeDesignImageIfUnused, saveGeneratedImage } from "@/lib/data/designs";

// Image models can take a while.
export const maxDuration = 150;

/**
 * Saves a design brief and asks the configured image provider for an image.
 * A generated image is stored in the user's private storage folder. With no
 * provider connected this honestly returns 501 "not_connected" and never
 * produces or pretends to produce an image.
 */
export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { designId, ...rawBrief } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (designId !== undefined && !z.uuid().safeParse(designId).success) {
    return NextResponse.json({ error: "Invalid design." }, { status: 400 });
  }
  const parsed = designBriefSchema.safeParse(rawBrief);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }
  const brief = parsed.data;
  if (!uploadsBelongToUser(brief, auth.user.id)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }

  const provider = getImageProvider();
  const prompt = buildImagePrompt(brief, { includeUploads: provider.usesUploads });
  const generated = await provider.generate(prompt, brief);

  let outputPath: string | null = null;
  let result: { status: "completed" | "failed" | "not_connected"; provider: string | null; error?: string; message?: string };
  if (generated.status === "completed") {
    outputPath = await saveGeneratedImage(auth.supabase, auth.user.id, generated.image);
    result = outputPath
      ? { status: "completed", provider: generated.provider }
      : { status: "failed", provider: generated.provider, error: "The image was generated but couldn't be saved. Please try again." };
  } else {
    result = generated;
  }

  // A new image replaces the old file; a failed attempt keeps the previous image.
  let previousPath: string | null = null;
  if (designId) {
    const { data } = await auth.supabase.from("designs").select("output_path").eq("id", designId as string).maybeSingle();
    previousPath = data?.output_path ?? null;
  }

  const row = {
    title: brief.title || `${brief.productName} — ${brief.designType}`,
    design_type: brief.designType,
    brief: { ...brief, prompt },
    upload_paths: Object.values(brief.uploads).filter(Boolean),
    status: result.status,
    provider: result.provider,
    output_path: outputPath ?? previousPath,
    error: result.status === "failed" ? result.error : null,
  };

  let savedId: string | null = null;
  if (designId) {
    const { data, error } = await auth.supabase.from("designs").update(row).eq("id", designId as string).select("id");
    if (!error && data?.length) savedId = data[0].id;
  } else {
    const business = await getPrimaryBusiness(auth.supabase);
    const { data, error } = await auth.supabase
      .from("designs")
      .insert({ ...row, business_id: business?.id ?? null })
      .select("id")
      .single();
    if (!error) savedId = data.id;
  }
  if (!savedId) {
    await removeDesignImageIfUnused(auth.supabase, outputPath); // don't leave an orphaned file
    return NextResponse.json({ error: "Could not save the design brief." }, { status: 500 });
  }

  if (outputPath && previousPath && previousPath !== outputPath) await removeDesignImageIfUnused(auth.supabase, previousPath);

  const urls = outputPath ? await designImageUrls(auth.supabase, outputPath, row.title) : null;

  // 501 Not Implemented is the honest status while no provider is connected.
  const status = result.status === "not_connected" ? 501 : result.status === "failed" ? 502 : 200;
  return NextResponse.json({ ...result, ...urls, designId: savedId, prompt }, { status });
}

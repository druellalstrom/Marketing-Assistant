import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { buildImagePrompt, designBriefSchema, uploadsBelongToUser } from "@/lib/design/brief";
import { getImageProvider } from "@/lib/design/provider";
import { getPrimaryBusiness } from "@/lib/data/business";

/**
 * Saves a design brief and asks the configured image provider for an image.
 * With no provider connected this honestly returns 501 "not_connected" and
 * never produces or pretends to produce an image.
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

  const prompt = buildImagePrompt(brief);
  const result = await getImageProvider().generate(prompt, brief);

  const row = {
    title: brief.title || `${brief.productName} — ${brief.designType}`,
    design_type: brief.designType,
    brief: { ...brief, prompt },
    upload_paths: Object.values(brief.uploads).filter(Boolean),
    status: result.status,
    provider: result.provider,
    output_path: result.status === "completed" ? result.imageUrl : null,
    error: result.status === "failed" ? result.error : null,
  };

  let savedId: string;
  if (designId) {
    const { data, error } = await auth.supabase.from("designs").update(row).eq("id", designId as string).select("id");
    if (error || !data?.length) return NextResponse.json({ error: "Could not save the design brief." }, { status: 500 });
    savedId = data[0].id;
  } else {
    const business = await getPrimaryBusiness(auth.supabase);
    const { data, error } = await auth.supabase
      .from("designs")
      .insert({ ...row, business_id: business?.id ?? null })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Could not save the design brief." }, { status: 500 });
    savedId = data.id;
  }

  // 501 Not Implemented is the honest status while no provider is connected.
  const status = result.status === "not_connected" ? 501 : result.status === "failed" ? 502 : 200;
  return NextResponse.json({ ...result, designId: savedId, prompt }, { status });
}

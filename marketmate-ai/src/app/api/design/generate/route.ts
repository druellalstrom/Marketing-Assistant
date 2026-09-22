import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/server";
import { buildImagePrompt, designBriefSchema, uploadsBelongToUser } from "@/lib/design/brief";
import { getImageProvider } from "@/lib/design/provider";
import { getPrimaryBusiness } from "@/lib/data/business";

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = designBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }
  const brief = parsed.data;
  if (!uploadsBelongToUser(brief, auth.user.id)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }

  const prompt = buildImagePrompt(brief);
  const provider = getImageProvider();
  const result = await provider.generate(prompt, brief);
  const business = await getPrimaryBusiness(auth.supabase);

  const { data, error } = await auth.supabase
    .from("designs")
    .insert({
      business_id: business?.id ?? null,
      title: brief.title || `${brief.productName} — ${brief.designType}`,
      design_type: brief.designType,
      brief: { ...brief, prompt },
      upload_paths: Object.values(brief.uploads).filter(Boolean),
      status: result.status,
      provider: result.provider,
      output_path: result.status === "completed" ? result.imageUrl : null,
      error: result.status === "failed" ? result.error : null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not save the design brief." }, { status: 500 });
  }

  // 501 Not Implemented is the honest status while no provider is connected.
  const status = result.status === "not_connected" ? 501 : result.status === "failed" ? 502 : 200;
  return NextResponse.json({ ...result, designId: data.id, prompt }, { status });
}

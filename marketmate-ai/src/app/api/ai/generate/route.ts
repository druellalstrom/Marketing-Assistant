import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/server";
import {
  AiGenerationError,
  AiNotConfiguredError,
  generateMarketingText,
  isAnthropicConfigured,
} from "@/lib/ai/anthropic";
import { buildUserPrompt, titleFor } from "@/lib/ai/prompts";
import { getTool } from "@/lib/ai/tool-definitions";
import { validateGenerateRequest } from "@/lib/ai/validation";
import { getBusinessContext } from "@/lib/data/business";

// Long-form generations (blog posts, 90-day plans) can take a while.
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Please sign in to use AI tools." }, { status: 401 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      { error: "AI is not connected: ANTHROPIC_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateGenerateRequest(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { toolId, input } = validated;
  const tool = getTool(toolId);
  const { supabase } = auth;

  try {
    const { business, context } = await getBusinessContext(supabase);
    const result = await generateMarketingText(buildUserPrompt(toolId, input, context));
    const title = titleFor(tool.title, input);

    // Save under RLS as the signed-in user (user_id defaults to auth.uid()).
    let savedId: string | null = null;
    let saveError: string | null = null;
    const insert =
      tool.storage.table === "social_content"
        ? supabase
            .from("social_content")
            .insert({
              business_id: business?.id ?? null,
              content_type: tool.storage.contentType,
              platform: tool.platformField ? (input[tool.platformField] ?? null) : null,
              title,
              body: result.text,
              input,
              ai_model: result.model,
            })
            .select("id")
            .single()
        : supabase
            .from("marketing_plans")
            .insert({
              business_id: business?.id ?? null,
              plan_type: tool.storage.planType,
              title,
              body: result.text,
              input,
              ai_model: result.model,
            })
            .select("id")
            .single();
    const { data, error } = await insert;
    if (error) saveError = "Generated, but saving to your history failed.";
    else savedId = data.id;

    return NextResponse.json({
      text: result.text,
      model: result.model,
      savedId,
      saveError,
      usedBusinessProfile: Boolean(context),
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiGenerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("AI generation failed", err);
    return NextResponse.json({ error: "Something went wrong generating content." }, { status: 500 });
  }
}

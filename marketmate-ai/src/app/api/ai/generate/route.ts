import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/supabase/server";
import { AiGenerationError, AiNotConfiguredError } from "@/lib/ai/errors";
import { generateMarketingText, isAiConfigured } from "@/lib/ai/provider";
import { buildUserPrompt, titleFor } from "@/lib/ai/prompts";
import { getTool } from "@/lib/ai/tool-definitions";
import { validateGenerateRequest } from "@/lib/ai/validation";
import { getBusinessContext } from "@/lib/data/business";
import { saveGeneration } from "@/lib/data/generations";

// Long-form generations (blog posts, 90-day plans) can take a while.
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Please sign in to use AI tools." }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not connected: set GEMINI_API_KEY on the server." },
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

    // Save under RLS as the signed-in user (user_id defaults to auth.uid()),
    // so work is never lost on refresh.
    const saved = await saveGeneration(supabase, {
      tool,
      input,
      title,
      body: result.text,
      model: result.model,
      businessId: business?.id ?? null,
    });

    return NextResponse.json({
      text: result.text,
      title,
      model: result.model,
      savedId: saved.id,
      savedTable: saved.table,
      saveError: saved.error,
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

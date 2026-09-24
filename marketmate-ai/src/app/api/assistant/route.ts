import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthContext } from "@/lib/supabase/server";
import { AiGenerationError, AiNotConfiguredError } from "@/lib/ai/errors";
import { isAiConfigured } from "@/lib/ai/provider";
import { executePricingTool, runAssistantTurn, type ToolHandler } from "@/lib/ai/assistant";
import { businessSchema } from "@/lib/business/schema";
import { getBusinessContext, getPrimaryBusiness } from "@/lib/data/business";

export const maxDuration = 120;

const HISTORY_LIMIT = 30;
const bodySchema = z.object({ message: z.string().trim().min(1, "Type a message first.").max(4000, "Keep messages under 4,000 characters.") });

const PROFILE_FIELDS = ["name", "industry", "description", "products", "target_audience", "location", "phone", "email", "website"] as const;

/** update_business_profile: validated with the same rules as the profile form, saved under RLS. */
function profileTool(supabase: SupabaseClient) {
  return async (input: unknown) => {
    if (!input || typeof input !== "object") return { content: "No profile fields given.", isError: true };
    const provided = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(
        ([k, v]) => (PROFILE_FIELDS as readonly string[]).includes(k) && typeof v === "string" && v.trim(),
      ),
    ) as Record<string, string>;
    if (!Object.keys(provided).length) return { content: "No valid profile fields given.", isError: true };

    const existing = await getPrimaryBusiness(supabase);
    const parsed = businessSchema.safeParse({ name: provided.name ?? existing?.name ?? "", ...provided });
    if (!parsed.success) {
      return {
        content: existing || provided.name
          ? `Not saved: ${parsed.error.issues.map((i) => i.message).join(" ")}`
          : "Not saved: ask the user for their business name first — a profile needs a name.",
        isError: true,
      };
    }
    const update = Object.fromEntries(PROFILE_FIELDS.filter((k) => k in provided).map((k) => [k, parsed.data[k]]));
    const { error } = existing
      ? await supabase.from("businesses").update(update).eq("id", existing.id)
      : await supabase.from("businesses").insert({ ...update, is_primary: true });
    if (error) return { content: "Saving the profile failed on the server.", isError: true };
    return { content: `Saved to the business profile: ${Object.keys(update).join(", ")}.` };
  };
}

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data, error } = await auth.supabase
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: "Couldn't load your conversation." }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Please sign in to use the assistant." }, { status: 401 });
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "AI is not connected: set GEMINI_API_KEY on the server." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { supabase } = auth;
  const { data: historyDesc } = await supabase
    .from("assistant_messages")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = ((historyDesc ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  // The API requires the conversation to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();

  const saveProfile = profileTool(supabase);
  const executeTool: ToolHandler = async (name, input) => {
    if (name === "calculate_pricing") return executePricingTool(input);
    if (name === "update_business_profile") return saveProfile(input);
    return { content: `Unknown tool ${name}.`, isError: true };
  };

  try {
    const { context } = await getBusinessContext(supabase);
    const turn = await runAssistantTurn({ history, userMessage: parsed.data.message, business: context, executeTool });

    const { error } = await supabase.from("assistant_messages").insert([
      { role: "user", content: parsed.data.message },
      { role: "assistant", content: turn.text },
    ]);
    return NextResponse.json({
      reply: turn.text,
      toolsUsed: turn.toolsUsed,
      profileUpdated: turn.toolsUsed.includes("update_business_profile"),
      saveError: error ? "Reply generated, but saving the conversation failed." : null,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    if (err instanceof AiGenerationError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Assistant failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { error } = await auth.supabase.from("assistant_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return NextResponse.json({ error: "Couldn't clear the conversation." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

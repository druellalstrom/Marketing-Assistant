import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveContentType, resolvePlatform, type ToolDefinition } from "@/lib/ai/tool-definitions";

export type SavedTable = "social_content" | "marketing_plans" | "campaigns";

export interface SaveGenerationArgs {
  tool: ToolDefinition;
  input: Record<string, string>;
  title: string;
  body: string;
  model: string;
  businessId: string | null;
}

/** Persists an AI generation to the table its tool stores into. Runs under RLS. */
export async function saveGeneration(
  supabase: SupabaseClient,
  { tool, input, title, body, model, businessId }: SaveGenerationArgs,
): Promise<{ id: string | null; table: SavedTable; error: string | null }> {
  const storage = tool.storage;
  const base = { business_id: businessId, input, ai_model: model };
  let query;
  if (storage.table === "social_content") {
    query = supabase.from("social_content").insert({
      ...base,
      content_type: resolveContentType(tool, input),
      platform: resolvePlatform(tool, input),
      title,
      body,
    });
  } else if (storage.table === "marketing_plans") {
    query = supabase.from("marketing_plans").insert({ ...base, plan_type: storage.planType, title, body });
  } else {
    const from = storage.campaignTypeFrom;
    query = supabase.from("campaigns").insert({
      ...base,
      name: title,
      campaign_type: from.map[input[from.field]] ?? "other",
      objective: input.objective || null,
      body,
    });
  }
  const { data, error } = await query.select("id").single();
  return error
    ? { id: null, table: storage.table, error: "Generated, but saving to your library failed." }
    : { id: data.id as string, table: storage.table, error: null };
}

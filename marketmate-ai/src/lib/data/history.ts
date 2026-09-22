import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageTarget } from "@/lib/ai/tool-definitions";

export interface HistoryItem {
  id: string;
  title: string | null;
  body: string;
  platform?: string | null;
  created_at: string;
  updated_at: string;
}

/** Recent saved generations for one tool (RLS limits results to the caller). */
export async function getToolHistory(
  supabase: SupabaseClient,
  storage: StorageTarget,
  limit = 10,
): Promise<HistoryItem[]> {
  let query;
  if (storage.table === "social_content") {
    const types = storage.contentTypeFrom
      ? [...new Set(Object.values(storage.contentTypeFrom.map))]
      : [storage.contentType];
    query = supabase
      .from("social_content")
      .select("id, title, body, platform, created_at, updated_at")
      .in("content_type", types);
  } else if (storage.table === "marketing_plans") {
    query = supabase
      .from("marketing_plans")
      .select("id, title, body, created_at, updated_at")
      .eq("plan_type", storage.planType);
  } else {
    query = supabase.from("campaigns").select("id, title:name, body, created_at, updated_at");
  }
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as HistoryItem[];
}

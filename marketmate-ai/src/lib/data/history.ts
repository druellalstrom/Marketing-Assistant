import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageTarget } from "@/lib/ai/tool-definitions";

export interface HistoryItem {
  id: string;
  title: string | null;
  body: string;
  platform?: string | null;
  created_at: string;
}

/** Recent saved generations for one tool (RLS limits results to the caller). */
export async function getToolHistory(
  supabase: SupabaseClient,
  storage: StorageTarget,
  limit = 10,
): Promise<HistoryItem[]> {
  const query =
    storage.table === "social_content"
      ? supabase
          .from("social_content")
          .select("id, title, body, platform, created_at")
          .eq("content_type", storage.contentType)
      : supabase
          .from("marketing_plans")
          .select("id, title, body, created_at")
          .eq("plan_type", storage.planType);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as HistoryItem[];
}

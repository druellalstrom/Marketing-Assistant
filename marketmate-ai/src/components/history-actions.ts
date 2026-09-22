"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";

const TABLES = ["social_content", "marketing_plans", "campaigns"] as const;
type Table = (typeof TABLES)[number];
const TITLE_COLUMN: Record<Table, string> = { social_content: "title", marketing_plans: "title", campaigns: "name" };

function revalidateAll(path?: string) {
  if (path?.startsWith("/")) revalidatePath(path);
  revalidatePath("/dashboard");
  revalidatePath("/library");
}

const editSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300),
  body: z.string().trim().min(1, "Content can't be empty.").max(50000),
});

/** Saves edits to a generated item (RLS limits it to the caller's rows). */
export async function updateGenerated(
  table: Table,
  id: string,
  values: { title: string; body: string },
  path?: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Please sign in." };
  if (!TABLES.includes(table) || !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid item." };
  const parsed = editSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { data, error } = await auth.supabase
    .from(table)
    .update({ [TITLE_COLUMN[table]]: parsed.data.title, body: parsed.data.body })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Could not save changes." };
  revalidateAll(path);
  return { ok: true };
}

export async function deleteGenerated(table: Table, id: string, path?: string): Promise<{ ok: boolean }> {
  const auth = await getAuthContext();
  if (!auth || !TABLES.includes(table) || !z.uuid().safeParse(id).success) return { ok: false };
  const { error } = await auth.supabase.from(table).delete().eq("id", id);
  revalidateAll(path);
  return { ok: !error };
}

/** Form-action wrapper for delete buttons in server-rendered lists. */
export async function deleteHistoryItem(table: Table, id: string, path: string) {
  await deleteGenerated(table, id, path);
}

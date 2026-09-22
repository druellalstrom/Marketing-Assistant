"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { isLibraryKind, LIBRARY_KINDS, libraryHref, type LibraryKind } from "@/lib/library";

// Columns copied when duplicating (never id, user_id or timestamps).
const COPY_COLUMNS: Record<LibraryKind, string> = {
  content: "business_id, project_id, content_type, platform, title, body, input, ai_model",
  plans: "business_id, plan_type, title, body, input, ai_model",
  campaigns: "business_id, name, campaign_type, objective, start_date, end_date, status, body, input, ai_model",
  pricing: "business_id, product_name, inputs, results, cost_per_unit, suggested_retail_price, suggested_wholesale_price",
  designs: "business_id, project_id, title, design_type, brief, upload_paths, status, provider, output_path, error",
};

function revalidate() {
  revalidatePath("/library", "layout");
  revalidatePath("/dashboard");
}

function valid(kind: unknown, id: unknown): kind is LibraryKind {
  return isLibraryKind(kind) && z.uuid().safeParse(id).success;
}

export async function renameItem(kind: LibraryKind, id: string, title: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Please sign in." };
  if (!valid(kind, id)) return { ok: false, error: "Invalid item." };
  const name = z.string().trim().min(1, "Name can't be empty.").max(200).safeParse(title);
  if (!name.success) return { ok: false, error: name.error.issues[0].message };
  const { table, titleColumn } = LIBRARY_KINDS[kind];
  const { data, error } = await auth.supabase.from(table).update({ [titleColumn]: name.data }).eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: "Could not rename." };
  revalidate();
  return { ok: true };
}

/** Copies an item (RLS: only the caller's own rows are readable) and opens the copy. */
export async function duplicateItem(kind: LibraryKind, id: string) {
  const auth = await getAuthContext();
  if (!auth || !valid(kind, id)) return;
  const { table, titleColumn } = LIBRARY_KINDS[kind];
  const { data } = await auth.supabase.from(table).select(COPY_COLUMNS[kind]).eq("id", id).maybeSingle();
  if (!data) return;
  const row = data as unknown as Record<string, unknown>;
  const copy = { ...row, [titleColumn]: `${String(row[titleColumn] ?? "Untitled")} (copy)`.slice(0, 200) };
  const { data: created } = await auth.supabase.from(table).insert(copy).select("id").single();
  revalidate();
  if (created) redirect(libraryHref(table, created.id));
}

export async function deleteItem(kind: LibraryKind, id: string, redirectTo?: string) {
  const auth = await getAuthContext();
  if (!auth || !valid(kind, id)) return;
  await auth.supabase.from(LIBRARY_KINDS[kind].table).delete().eq("id", id);
  revalidate();
  if (redirectTo?.startsWith("/")) redirect(redirectTo);
}

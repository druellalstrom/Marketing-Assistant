"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";

const TABLES = ["social_content", "marketing_plans"] as const;

export async function deleteHistoryItem(table: (typeof TABLES)[number], id: string, path: string) {
  const auth = await getAuthContext();
  if (!auth || !TABLES.includes(table) || !z.uuid().safeParse(id).success) return;
  await auth.supabase.from(table).delete().eq("id", id); // RLS: only own rows
  if (path.startsWith("/")) revalidatePath(path);
  revalidatePath("/dashboard");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";

const campaignMeta = z
  .object({
    status: z.enum(["idea", "planned", "active", "completed"]),
    start_date: z.iso.date().nullable(),
    end_date: z.iso.date().nullable(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, "End date must be on or after the start date.");

export async function updateCampaignDetails(id: string, values: unknown): Promise<{ ok: boolean; error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Please sign in." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid campaign." };
  const parsed = campaignMeta.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await auth.supabase.from("campaigns").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: "Could not save campaign details." };
  revalidatePath("/library", "layout");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { getPrimaryBusiness } from "@/lib/data/business";
import { CALENDAR_STATUSES } from "@/lib/calendar/month";

const STATUSES = CALENDAR_STATUSES;

const entrySchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300),
  platform: z.string().trim().min(1, "Platform is required.").max(50),
  scheduled_for: z.iso.date("Pick a valid date."),
  status: z.enum(STATUSES),
  notes: z.string().trim().max(5000).optional(),
  social_content_id: z.uuid().optional().or(z.literal("")),
});

export interface CalendarFormState {
  error?: string;
  ok?: boolean;
}

export async function addCalendarEntry(_prev: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };

  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };

  const business = await getPrimaryBusiness(auth.supabase);
  const { social_content_id, notes, ...rest } = parsed.data;
  const { error } = await auth.supabase.from("content_calendar_entries").insert({
    ...rest,
    notes: notes || null,
    social_content_id: social_content_id || null,
    business_id: business?.id ?? null,
  });
  if (error) return { error: "Could not add the entry." };

  revalidatePath("/social/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCalendarStatus(id: string, formData: FormData) {
  const auth = await getAuthContext();
  const status = z.enum(STATUSES).safeParse(formData.get("status"));
  if (!auth || !status.success || !z.uuid().safeParse(id).success) return;
  await auth.supabase.from("content_calendar_entries").update({ status: status.data }).eq("id", id);
  revalidatePath("/social/calendar");
  revalidatePath("/dashboard");
}

export async function deleteCalendarEntry(id: string) {
  const auth = await getAuthContext();
  if (!auth || !z.uuid().safeParse(id).success) return;
  await auth.supabase.from("content_calendar_entries").delete().eq("id", id);
  revalidatePath("/social/calendar");
  revalidatePath("/dashboard");
}

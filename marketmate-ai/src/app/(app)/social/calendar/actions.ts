"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { getPrimaryBusiness } from "@/lib/data/business";
import { CALENDAR_CONTENT_TYPES, CALENDAR_STATUSES } from "@/lib/calendar/month";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const entrySchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1, "Title is required.").max(300),
  platform: z.string().trim().min(1, "Platform is required.").max(50),
  scheduled_for: z.iso.date("Pick a valid date."),
  status: z.enum(CALENDAR_STATUSES),
  content_type: z.enum(CALENDAR_CONTENT_TYPES, "Choose a content type."),
  topic: optional(500),
  caption: optional(5000),
  cta: optional(300),
  notes: optional(5000),
  social_content_id: z.uuid().optional().or(z.literal("")),
});

export interface CalendarFormState {
  error?: string;
  ok?: boolean;
  savedAt?: number;
}

function revalidate() {
  revalidatePath("/social/calendar");
  revalidatePath("/dashboard");
}

/** Creates a calendar entry, or updates one when the form includes its id. */
export async function saveCalendarEntry(_prev: CalendarFormState, formData: FormData): Promise<CalendarFormState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };

  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { id, social_content_id, ...fields } = parsed.data;
  const row = { ...fields, social_content_id: social_content_id || null };

  if (id) {
    const { data, error } = await auth.supabase.from("content_calendar_entries").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { error: "Could not update the entry." };
  } else {
    const business = await getPrimaryBusiness(auth.supabase);
    const { error } = await auth.supabase
      .from("content_calendar_entries")
      .insert({ ...row, business_id: business?.id ?? null });
    if (error) return { error: "Could not add the entry." };
  }
  revalidate();
  return { ok: true, savedAt: Date.now() };
}

export async function duplicateCalendarEntry(id: string) {
  const auth = await getAuthContext();
  if (!auth || !z.uuid().safeParse(id).success) return;
  const { data } = await auth.supabase
    .from("content_calendar_entries")
    .select("business_id, social_content_id, title, notes, platform, scheduled_for, content_type, topic, caption, cta")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  await auth.supabase
    .from("content_calendar_entries")
    .insert({ ...data, title: `${data.title} (copy)`.slice(0, 300), status: "planned" });
  revalidate();
}

export async function deleteCalendarEntry(id: string) {
  const auth = await getAuthContext();
  if (!auth || !z.uuid().safeParse(id).success) return;
  await auth.supabase.from("content_calendar_entries").delete().eq("id", id);
  revalidate();
}

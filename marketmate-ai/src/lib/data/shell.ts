import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { displayNameFor } from "@/lib/dashboard/account";
import { buildNotifications, type CalendarItem, type Notification } from "@/lib/dashboard/notifications";

export interface ShellData {
  account: { displayName: string; email: string | null; businessName: string | null };
  notifications: Notification[];
}

/** Data for the app header, all read under RLS as the signed-in user. */
export async function getShellData(supabase: SupabaseClient, user: User, today: string): Promise<ShellData> {
  const weekAhead = new Date(`${today}T00:00:00Z`);
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  const [{ data: profile }, { data: business }, { data: entries }] = await Promise.all([
    supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("name").order("is_primary", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("content_calendar_entries")
      .select("id, title, platform, scheduled_for, status")
      .neq("status", "posted")
      .lte("scheduled_for", weekAhead.toISOString().slice(0, 10))
      .order("scheduled_for")
      .limit(20),
  ]);
  return {
    account: {
      displayName: displayNameFor(profile?.full_name, user.email),
      email: user.email ?? null,
      businessName: business?.name ?? null,
    },
    notifications: buildNotifications({ today, entries: (entries ?? []) as CalendarItem[], hasBusiness: Boolean(business) }),
  };
}

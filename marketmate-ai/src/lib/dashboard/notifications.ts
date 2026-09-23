/** Builds header notifications from real calendar and setup data (pure, testable). */
export interface CalendarItem {
  id: string;
  title: string;
  platform: string;
  scheduled_for: string; // YYYY-MM-DD
  status: string;
}

export interface Notification {
  id: string;
  kind: "overdue" | "today" | "upcoming" | "setup";
  text: string;
  href: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildNotifications(opts: { today: string; entries: CalendarItem[]; hasBusiness: boolean }): Notification[] {
  const { today, entries, hasBusiness } = opts;
  const weekAhead = addDays(today, 7);
  const out: Notification[] = [];
  if (!hasBusiness) {
    out.push({ id: "setup-business", kind: "setup", text: "Add your business profile so every tool is tailored to you.", href: "/business" });
  }
  const open = entries.filter((e) => e.status !== "posted").sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  for (const e of open) {
    const month = `?month=${e.scheduled_for.slice(0, 7)}`;
    if (e.scheduled_for < today) {
      out.push({ id: e.id, kind: "overdue", text: `Overdue: “${e.title}” on ${e.platform} was due ${e.scheduled_for}.`, href: `/social/calendar${month}` });
    } else if (e.scheduled_for === today) {
      out.push({ id: e.id, kind: "today", text: `Today: post “${e.title}” on ${e.platform}.`, href: `/social/calendar${month}` });
    } else if (e.scheduled_for <= weekAhead) {
      out.push({ id: e.id, kind: "upcoming", text: `Coming up ${e.scheduled_for}: “${e.title}” on ${e.platform}.`, href: `/social/calendar${month}` });
    }
  }
  return out.slice(0, 8);
}

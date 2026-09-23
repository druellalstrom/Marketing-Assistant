/** Pure helpers for dashboard numbers — everything is derived from real rows. */

export interface WeekBucket {
  /** Monday of the week, YYYY-MM-DD (UTC). */
  weekStart: string;
  label: string;
  count: number;
}

function mondayOf(d: Date): Date {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shortLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Counts timestamps into the last `weeks` Monday-starting weeks (oldest first, current week last). */
export function weeklyCounts(timestamps: string[], now: Date, weeks = 8): WeekBucket[] {
  const current = mondayOf(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current);
    start.setUTCDate(start.getUTCDate() - i * 7);
    buckets.push({ weekStart: iso(start), label: shortLabel(start), count: 0 });
  }
  const first = buckets[0].weekStart;
  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const key = iso(mondayOf(d));
    if (key < first) continue;
    const b = buckets.find((x) => x.weekStart === key);
    if (b) b.count++;
  }
  return buckets;
}

export function startOfWeeksAgo(now: Date, weeks: number): string {
  const d = mondayOf(now);
  d.setUTCDate(d.getUTCDate() - (weeks - 1) * 7);
  return d.toISOString();
}

export function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface ProgressTask {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function progressTasks(flags: {
  hasBusiness: boolean;
  hasBrandKit: boolean;
  pricingCount: number;
  contentCount: number;
  calendarCount: number;
}): { tasks: ProgressTask[]; completed: number } {
  const tasks: ProgressTask[] = [
    { key: "business", label: "Add your business profile", hint: "Tell us about your business", href: "/business", done: flags.hasBusiness },
    { key: "brand", label: "Set up your brand kit", hint: "Add your logo, colours & fonts", href: "/brand-kit", done: flags.hasBrandKit },
    { key: "price", label: "Price a product", hint: "Calculate costs and profit margins", href: "/calculator", done: flags.pricingCount > 0 },
    { key: "content", label: "Generate your first content", hint: "Create a poster or social post", href: "/social/captions", done: flags.contentCount > 0 },
    { key: "calendar", label: "Plan a post in the calendar", hint: "Schedule your content", href: "/social/calendar", done: flags.calendarCount > 0 },
  ];
  return { tasks, completed: tasks.filter((t) => t.done).length };
}

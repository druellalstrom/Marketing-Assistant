/** Pure date helpers for the content calendar. Dates are "YYYY-MM-DD" strings (no time zones). */

export interface MonthRef {
  year: number;
  month: number; // 1–12
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parses "YYYY-MM"; falls back to `fallback` when missing or invalid. */
export function parseMonth(value: string | undefined | null, fallback: MonthRef): MonthRef {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return fallback;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 1970 || year > 9999) return fallback;
  return { year, month };
}

export function formatMonthParam({ year, month }: MonthRef): string {
  return `${year}-${pad(month)}`;
}

export function addMonths({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth({ year, month }: MonthRef): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last ISO dates of the month (inclusive). */
export function monthRange(ref: MonthRef): { start: string; end: string } {
  return {
    start: toIsoDate(ref.year, ref.month, 1),
    end: toIsoDate(ref.year, ref.month, daysInMonth(ref)),
  };
}

/**
 * Calendar grid for a month as weeks of 7 cells (Monday first). Cells outside
 * the month are null.
 */
export function monthGrid(ref: MonthRef): (string | null)[][] {
  const firstWeekday = new Date(Date.UTC(ref.year, ref.month - 1, 1)).getUTCDay(); // 0 = Sun
  const leading = (firstWeekday + 6) % 7; // Monday-first offset
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth(ref); d++) cells.push(toIsoDate(ref.year, ref.month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const CALENDAR_STATUSES = ["idea", "planned", "drafted", "scheduled", "posted"] as const;

export const CALENDAR_CONTENT_TYPES = ["Post", "Reel / short video", "Story", "Carousel", "Live", "Email", "Blog post", "Ad", "Other"] as const;

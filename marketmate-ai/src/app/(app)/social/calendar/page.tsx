import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { addMonths, CALENDAR_STATUSES as STATUSES, formatMonthParam, monthGrid, monthRange, parseMonth } from "@/lib/calendar/month";
import { requireAuth } from "@/lib/supabase/server";
import { deleteCalendarEntry, updateCalendarStatus } from "./actions";
import { EntryForm } from "./entry-form";

export const metadata: Metadata = { title: "Content calendar" };

interface Entry {
  id: string;
  title: string;
  platform: string;
  scheduled_for: string;
  status: string;
  notes: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  idea: "bg-slate-200 text-slate-800",
  planned: "bg-blue-100 text-blue-800",
  drafted: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-800",
  posted: "bg-green-100 text-green-800",
};

export default async function CalendarPage({ searchParams }: PageProps<"/social/calendar">) {
  const { supabase } = await requireAuth("/social/calendar");
  const { month: monthParam } = await searchParams;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const ref = parseMonth(typeof monthParam === "string" ? monthParam : null, {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  });
  const { start, end } = monthRange(ref);

  const [{ data: entryData }, { data: contentData }] = await Promise.all([
    supabase
      .from("content_calendar_entries")
      .select("id, title, platform, scheduled_for, status, notes")
      .gte("scheduled_for", start)
      .lte("scheduled_for", end)
      .order("scheduled_for"),
    supabase
      .from("social_content")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const entries = (entryData ?? []) as Entry[];
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) byDate.set(e.scheduled_for, [...(byDate.get(e.scheduled_for) ?? []), e]);

  const label = new Date(Date.UTC(ref.year, ref.month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const defaultDate = today >= start && today <= end ? today : start;

  return (
    <>
      <PageHeader title="Content calendar" description="Plan what goes out, where, and when." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <Link className="btn-secondary" href={`?month=${formatMonthParam(addMonths(ref, -1))}`}>← Prev</Link>
            <h2 className="text-lg font-semibold">{label}</h2>
            <Link className="btn-secondary" href={`?month=${formatMonthParam(addMonths(ref, 1))}`}>Next →</Link>
          </div>

          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <th key={d} className="p-2 text-left font-medium">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {monthGrid(ref).map((week, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {week.map((date, j) => (
                      <td key={j} className={`h-24 border-r border-border p-1.5 align-top last:border-r-0 ${date === today ? "bg-brand/5" : ""}`}>
                        {date && (
                          <>
                            <p className={`mb-1 ${date === today ? "font-bold text-brand" : "text-muted"}`}>{Number(date.slice(8))}</p>
                            <ul className="space-y-1">
                              {(byDate.get(date) ?? []).map((e) => (
                                <li key={e.id} className={`truncate rounded px-1 py-0.5 ${STATUS_STYLES[e.status]}`} title={`${e.title} · ${e.platform}`}>
                                  {e.title}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section>
            <h2 className="mb-3 font-semibold">Posts this month ({entries.length})</h2>
            {entries.length === 0 ? (
              <p className="text-sm text-muted">No posts planned for {label}.</p>
            ) : (
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="w-24 shrink-0 text-muted">{e.scheduled_for}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{e.title}</span>
                      <span className="text-muted"> · {e.platform}</span>
                      {e.notes && <span className="block truncate text-xs text-muted">{e.notes}</span>}
                    </span>
                    <form action={updateCalendarStatus.bind(null, e.id)} className="flex items-center gap-1">
                      <select name="status" defaultValue={e.status} className="input w-auto py-1" aria-label="Status">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="btn-secondary px-2 py-1">Update</button>
                    </form>
                    <form action={deleteCalendarEntry.bind(null, e.id)}>
                      <button className="text-red-600 hover:underline">Delete</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <EntryForm defaultDate={defaultDate} content={(contentData ?? []) as { id: string; title: string | null }[]} />
      </div>
    </>
  );
}

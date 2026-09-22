import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PLATFORMS } from "@/lib/ai/tool-definitions";
import { addMonths, CALENDAR_STATUSES, formatMonthParam, monthGrid, monthRange, parseMonth } from "@/lib/calendar/month";
import { requireAuth } from "@/lib/supabase/server";
import { EntryForm } from "./entry-form";
import { EntryRow } from "./entry-row";

export const metadata: Metadata = { title: "Content calendar" };

interface Entry {
  id: string;
  title: string;
  platform: string;
  scheduled_for: string;
  status: string;
  content_type: string | null;
  topic: string | null;
  caption: string | null;
  cta: string | null;
  notes: string | null;
  social_content_id: string | null;
}

const STATUS_DOT: Record<string, string> = {
  idea: "bg-slate-200 text-slate-800",
  planned: "bg-blue-100 text-blue-800",
  drafted: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-800",
  posted: "bg-green-100 text-green-800",
};

export default async function CalendarPage({ searchParams }: PageProps<"/social/calendar">) {
  const { supabase } = await requireAuth("/social/calendar");
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const platform = (PLATFORMS as readonly string[]).includes(str(sp.platform)) ? str(sp.platform) : "";
  const status = (CALENDAR_STATUSES as readonly string[]).includes(str(sp.status)) ? str(sp.status) : "";

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const ref = parseMonth(str(sp.month), { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  const { start, end } = monthRange(ref);

  let query = supabase
    .from("content_calendar_entries")
    .select("id, title, platform, scheduled_for, status, content_type, topic, caption, cta, notes, social_content_id")
    .gte("scheduled_for", start)
    .lte("scheduled_for", end)
    .order("scheduled_for")
    .order("created_at");
  if (platform) query = query.eq("platform", platform);
  if (status) query = query.eq("status", status);

  const [{ data: entryData, error }, { data: contentData }] = await Promise.all([
    query,
    supabase.from("social_content").select("id, title").order("created_at", { ascending: false }).limit(30),
  ]);
  const entries = (entryData ?? []) as Entry[];
  const content = (contentData ?? []) as { id: string; title: string | null }[];
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) byDate.set(e.scheduled_for, [...(byDate.get(e.scheduled_for) ?? []), e]);

  const label = new Date(Date.UTC(ref.year, ref.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const defaultDate = today >= start && today <= end ? today : start;
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ month: formatMonthParam(ref), platform, status, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Content calendar" description="Plan what goes out, where and when — with the caption and call to action ready to post." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link className="btn-secondary px-3" href={qs({ month: formatMonthParam(addMonths(ref, -1)) })} aria-label="Previous month">←</Link>
              <h2 className="min-w-40 text-center text-lg font-semibold">{label}</h2>
              <Link className="btn-secondary px-3" href={qs({ month: formatMonthParam(addMonths(ref, 1)) })} aria-label="Next month">→</Link>
            </div>
            <form className="flex flex-wrap items-center gap-2" method="get">
              <input type="hidden" name="month" value={formatMonthParam(ref)} />
              <select name="platform" defaultValue={platform} className="input w-auto" aria-label="Filter by platform">
                <option value="">All platforms</option>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <select name="status" defaultValue={status} className="input w-auto capitalize" aria-label="Filter by status">
                <option value="">All statuses</option>
                {CALENDAR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-secondary">Filter</button>
              {(platform || status) && <Link href={qs({ platform: "", status: "" })} className="text-sm text-brand hover:underline">Clear</Link>}
            </form>
          </div>

          {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">Couldn&apos;t load your calendar. Refresh to try again.</p>}

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
                                <li key={e.id} className={`truncate rounded px-1 py-0.5 ${STATUS_DOT[e.status]}`} title={`${e.title} · ${e.platform} · ${e.status}`}>{e.title}</li>
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
            <h2 className="mb-3 font-semibold">Posts in {label} ({entries.length}){platform || status ? " — filtered" : ""}</h2>
            {entries.length === 0 ? (
              <p className="card text-sm text-muted">No posts {platform || status ? "match these filters" : "planned yet"}. Add one with the form.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map((e) => <EntryRow key={e.id} entry={e} content={content} />)}
              </ul>
            )}
          </section>
        </div>
        <div className="card h-fit xl:sticky xl:top-6">
          <EntryForm defaults={{ scheduled_for: defaultDate }} content={content} heading="Add a post" />
        </div>
      </div>
    </>
  );
}

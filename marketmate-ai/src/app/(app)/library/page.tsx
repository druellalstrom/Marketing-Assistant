import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { LIBRARY_TABS, libraryHref, SOCIAL_CONTENT_TYPES, type LibraryKind, type LibraryTab } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";
import { deleteItem, duplicateItem } from "./actions";
import { RenameButton } from "./rename-button";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata: Metadata = { title: "Saved work" };

interface Row {
  id: string;
  title: string;
  subtitle: string;
  updated_at: string;
  table: string;
  kind: LibraryKind;
}

const socialList = `(${SOCIAL_CONTENT_TYPES.join(",")})`;
const humanize = (s: string) => s.replace(/_/g, " ");

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const { supabase } = await requireAuth("/library");
  const { tab: tabParam, q } = await searchParams;
  const tab: LibraryTab = LIBRARY_TABS.some((t) => t.id === tabParam) ? (tabParam as LibraryTab) : "designs";
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const like = search ? `%${search.replace(/[%_,()]/g, " ")}%` : null;

  const counts = await Promise.all([
    supabase.from("designs").select("id", { count: "exact", head: true }),
    supabase.from("social_content").select("id", { count: "exact", head: true }).in("content_type", [...SOCIAL_CONTENT_TYPES]),
    supabase.from("pricing_calculations").select("id", { count: "exact", head: true }),
    supabase.from("marketing_plans").select("id", { count: "exact", head: true }),
    supabase.from("campaigns").select("id", { count: "exact", head: true }),
    supabase.from("social_content").select("id", { count: "exact", head: true }).not("content_type", "in", socialList),
  ]);

  let rows: Row[] = [];
  let failed = false;
  if (tab === "designs") {
    let query = supabase.from("designs").select("id, title, design_type, status, updated_at");
    if (like) query = query.ilike("title", like);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(100);
    failed = Boolean(error);
    rows = (data ?? []).map((d) => ({ id: d.id, title: d.title, subtitle: `${d.design_type} · ${d.status === "not_connected" ? "image not generated (provider not connected)" : humanize(d.status)}`, updated_at: d.updated_at, table: "designs", kind: "designs" }));
  } else if (tab === "social" || tab === "content") {
    let query = supabase.from("social_content").select("id, title, content_type, platform, updated_at");
    query = tab === "social" ? query.in("content_type", [...SOCIAL_CONTENT_TYPES]) : query.not("content_type", "in", socialList);
    if (like) query = query.ilike("title", like);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(100);
    failed = Boolean(error);
    rows = (data ?? []).map((d) => ({ id: d.id, title: d.title ?? "Untitled", subtitle: [humanize(d.content_type), d.platform].filter(Boolean).join(" · "), updated_at: d.updated_at, table: "social_content", kind: "content" }));
  } else if (tab === "pricing") {
    let query = supabase.from("pricing_calculations").select("id, product_name, suggested_retail_price, cost_per_unit, updated_at");
    if (like) query = query.ilike("product_name", like);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(100);
    failed = Boolean(error);
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    rows = (data ?? []).map((d) => ({ id: d.id, title: d.product_name, subtitle: `Cost ${fmt.format(Number(d.cost_per_unit))} · retail ${fmt.format(Number(d.suggested_retail_price))}`, updated_at: d.updated_at, table: "pricing_calculations", kind: "pricing" }));
  } else if (tab === "plans") {
    let query = supabase.from("marketing_plans").select("id, title, plan_type, updated_at");
    if (like) query = query.ilike("title", like);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(100);
    failed = Boolean(error);
    rows = (data ?? []).map((d) => ({ id: d.id, title: d.title, subtitle: humanize(d.plan_type), updated_at: d.updated_at, table: "marketing_plans", kind: "plans" }));
  } else {
    let query = supabase.from("campaigns").select("id, name, campaign_type, status, updated_at");
    if (like) query = query.ilike("name", like);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(100);
    failed = Boolean(error);
    rows = (data ?? []).map((d) => ({ id: d.id, title: d.name, subtitle: `${humanize(d.campaign_type)} · ${d.status}`, updated_at: d.updated_at, table: "campaigns", kind: "campaigns" }));
  }

  const CREATE: Record<LibraryTab, [string, string]> = {
    designs: ["/design-studio", "Create a design"],
    social: ["/social/captions", "Write a caption"],
    pricing: ["/calculator", "Price a product"],
    plans: ["/strategy/plan", "Create a marketing plan"],
    campaigns: ["/strategy/campaigns", "Create a campaign"],
    content: ["/studio", "Generate content"],
  };

  return (
    <>
      <PageHeader title="Saved work" description="Everything you've created, in one place. Open, edit, duplicate, rename or delete." />
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-border" aria-label="Categories">
        {LIBRARY_TABS.map((t, i) => (
          <Link
            key={t.id}
            href={`/library?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${t.id === tab ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label} <span className="text-xs">({counts[i].count ?? 0})</span>
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="q" className="sr-only">Search by name</label>
          <input id="q" name="q" className="input w-56" defaultValue={search} placeholder="Search by name" />
          <button className="btn-secondary">Search</button>
        </form>
        <Link href={CREATE[tab][0]} className="btn-primary">{CREATE[tab][1]}</Link>
      </div>

      {failed && <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">Couldn&apos;t load this list. Refresh to try again.</p>}
      {rows.length === 0 && !failed ? (
        <div className="card py-10 text-center text-sm text-muted">
          {search ? `Nothing matches “${search}”.` : "Nothing saved here yet."}{" "}
          <Link href={CREATE[tab][0]} className="text-brand hover:underline">{CREATE[tab][1]}</Link>
        </div>
      ) : (
        <ul className="card divide-y divide-border p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={libraryHref(r.table, r.id)} className="block truncate font-medium hover:text-brand hover:underline">{r.title}</Link>
                <p className="truncate text-xs capitalize text-muted">{r.subtitle} · updated {new Date(r.updated_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={libraryHref(r.table, r.id)} className="text-brand hover:underline">Open</Link>
                <RenameButton kind={r.kind} id={r.id} title={r.title} />
                <form action={duplicateItem.bind(null, r.kind, r.id)}><button className="text-brand hover:underline">Duplicate</button></form>
                <form action={deleteItem.bind(null, r.kind, r.id, undefined)}><ConfirmButton message={`Delete “${r.title}”? This can't be undone.`} className="text-red-600 hover:underline">Delete</ConfirmButton></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

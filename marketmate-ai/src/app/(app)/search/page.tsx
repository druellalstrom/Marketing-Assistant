import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NAV_ITEMS } from "@/components/shell/nav";
import { TOOL_DEFINITIONS } from "@/lib/ai/tool-definitions";
import { libraryHref } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };

/** Features people search for, with synonyms so plain words work ("poster", "price"). */
const FEATURES: { title: string; href: string; keywords: string }[] = [
  ...NAV_ITEMS.map((n) => ({ title: n.label, href: n.href, keywords: n.label })),
  { title: "Create a poster / flyer", href: "/design-studio", keywords: "poster flyer banner business card graphic design image ad" },
  { title: "Price a product", href: "/calculator", keywords: "price pricing cost profit margin markup wholesale retail break-even calculator" },
  { title: TOOL_DEFINITIONS.caption.title, href: "/social/captions", keywords: "caption instagram facebook tiktok linkedin post" },
  { title: TOOL_DEFINITIONS.hashtags.title, href: "/social/hashtags", keywords: "hashtag tags" },
  { title: TOOL_DEFINITIONS.content_ideas.title, href: "/social/ideas", keywords: "ideas content posts inspiration" },
  { title: TOOL_DEFINITIONS.repurpose.title, href: "/social/repurpose", keywords: "repurpose reuse transform rewrite" },
  { title: TOOL_DEFINITIONS.audience_analysis.title, href: "/strategy/audience", keywords: "audience customers demographics" },
  { title: TOOL_DEFINITIONS.personas.title, href: "/strategy/personas", keywords: "persona customer profile" },
  { title: TOOL_DEFINITIONS.marketing_plan.title, href: "/strategy/plan", keywords: "marketing plan strategy kpi" },
  { title: TOOL_DEFINITIONS.campaigns.title, href: "/strategy/campaigns", keywords: "campaign promotion sale holiday launch" },
  { title: TOOL_DEFINITIONS.competitor_analysis.title, href: "/strategy/competitors", keywords: "competitor competition" },
  { title: "Write emails, ads and product descriptions", href: "/studio", keywords: "email ad advert product description website copy script announcement" },
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { supabase } = await requireAuth("/search");
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  const features = words.length
    ? FEATURES.filter((f) => words.some((w) => `${f.title} ${f.keywords}`.toLowerCase().includes(w))).filter(
        (f, i, all) => all.findIndex((x) => x.href === f.href && x.title === f.title) === i,
      )
    : [];

  let items: { id: string; table: string; title: string; type: string }[] = [];
  if (query) {
    const like = `%${query.replace(/[%_,()]/g, " ")}%`;
    const [c, p, cam, d, pr] = await Promise.all([
      supabase.from("social_content").select("id, title, content_type").ilike("title", like).limit(10),
      supabase.from("marketing_plans").select("id, title, plan_type").ilike("title", like).limit(10),
      supabase.from("campaigns").select("id, name").ilike("name", like).limit(10),
      supabase.from("designs").select("id, title").ilike("title", like).limit(10),
      supabase.from("pricing_calculations").select("id, product_name").ilike("product_name", like).limit(10),
    ]);
    const h = (s: string) => s.replace(/_/g, " ");
    items = [
      ...(c.data ?? []).map((r) => ({ id: r.id, table: "social_content", title: r.title ?? "Untitled", type: h(r.content_type) })),
      ...(p.data ?? []).map((r) => ({ id: r.id, table: "marketing_plans", title: r.title, type: h(r.plan_type) })),
      ...(cam.data ?? []).map((r) => ({ id: r.id, table: "campaigns", title: r.name, type: "campaign" })),
      ...(d.data ?? []).map((r) => ({ id: r.id, table: "designs", title: r.title, type: "design" })),
      ...(pr.data ?? []).map((r) => ({ id: r.id, table: "pricing_calculations", title: r.product_name, type: "pricing" })),
    ];
  }

  return (
    <>
      <PageHeader title={query ? `Results for “${query}”` : "Search"} description="Find tools and anything you've saved." />
      <form action="/search" method="get" className="mb-6 flex max-w-2xl gap-2" role="search">
        <label htmlFor="search-page-q" className="sr-only">Search</label>
        <input id="search-page-q" name="q" className="input" defaultValue={query} maxLength={100} placeholder="e.g. posters, pricing, campaigns" />
        <button className="btn-primary">Search</button>
      </form>

      {query && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="card" aria-labelledby="features-title">
            <h2 id="features-title" className="text-xl font-bold text-navy">Tools</h2>
            {features.length ? (
              <ul className="mt-3 divide-y divide-border">
                {features.map((f) => (
                  <li key={`${f.href}-${f.title}`}>
                    <Link href={f.href} className="flex min-h-12 items-center justify-between gap-3 py-2 text-base font-semibold hover:text-brand-strong">
                      {f.title} <ArrowRight aria-hidden className="h-5 w-5 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9375rem] text-muted">No tools match. Try “poster”, “price” or “caption”.</p>
            )}
          </section>
          <section className="card" aria-labelledby="saved-title">
            <h2 id="saved-title" className="text-xl font-bold text-navy">Your saved work</h2>
            {items.length ? (
              <ul className="mt-3 divide-y divide-border">
                {items.map((it) => (
                  <li key={`${it.table}-${it.id}`}>
                    <Link href={libraryHref(it.table, it.id)} className="flex min-h-12 items-center gap-3 py-2 hover:text-brand-strong">
                      <FolderOpen aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-base font-semibold">{it.title}</span>
                      <span className="shrink-0 text-sm capitalize text-muted">{it.type}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[0.9375rem] text-muted">Nothing you&apos;ve saved matches “{query}”.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

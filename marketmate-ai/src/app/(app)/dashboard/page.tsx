import type { Metadata } from "next";
import Link from "next/link";
import { Brush, Calculator, Megaphone, MessageSquareText, PenLine, Sparkles, Target, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { getImageProvider } from "@/lib/design/provider";
import { libraryHref } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS: [href: string, label: string, Icon: LucideIcon][] = [
  ["/design-studio", "Create Poster", Brush],
  ["/social/captions", "Write Caption", MessageSquareText],
  ["/calculator", "Price Product", Calculator],
  ["/strategy/plan", "Create Marketing Plan", Target],
  ["/studio", "Generate Content", PenLine],
  ["/strategy/campaigns", "Create Campaign", Megaphone],
];

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const humanize = (s: string) => s.replace(/_/g, " ");
const date = (s: string) => new Date(s).toLocaleDateString();

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-brand hover:underline">{linkLabel} →</Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="text-sm text-muted">
      {text} <Link href={href} className="text-brand hover:underline">{cta}</Link>
    </p>
  );
}

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth("/dashboard");
  const today = new Date().toISOString().slice(0, 10);
  const recent = (table: string, cols: string, n = 5) =>
    supabase.from(table).select(cols).order("updated_at", { ascending: false }).limit(n);

  const [business, content, designs, pricing, plans, campaigns, upcoming] = await Promise.all([
    getPrimaryBusiness(supabase),
    recent("social_content", "id, title, content_type, platform, updated_at"),
    recent("designs", "id, title, design_type, status, updated_at", 4),
    recent("pricing_calculations", "id, product_name, cost_per_unit, suggested_retail_price, suggested_wholesale_price, updated_at", 4),
    recent("marketing_plans", "id, title, plan_type, updated_at", 4),
    recent("campaigns", "id, name, campaign_type, status, updated_at", 4),
    supabase
      .from("content_calendar_entries")
      .select("id, title, platform, scheduled_for, status")
      .gte("scheduled_for", today)
      .order("scheduled_for")
      .limit(6),
  ]);
  const kit = business ? await getBrandKit(supabase, business.id) : null;

  type Row = Record<string, string>;
  const rows = (r: { data: unknown }) => (r.data ?? []) as Row[];
  const recentProjects = [
    ...rows(content).map((r) => ({ id: r.id, title: r.title ?? "Untitled", kind: humanize(r.content_type), at: r.updated_at, table: "social_content" })),
    ...rows(designs).map((r) => ({ id: r.id, title: r.title, kind: "design", at: r.updated_at, table: "designs" })),
    ...rows(pricing).map((r) => ({ id: r.id, title: r.product_name, kind: "pricing", at: r.updated_at, table: "pricing_calculations" })),
    ...rows(plans).map((r) => ({ id: r.id, title: r.title, kind: humanize(r.plan_type), at: r.updated_at, table: "marketing_plans" })),
    ...rows(campaigns).map((r) => ({ id: r.id, title: r.name, kind: "campaign", at: r.updated_at, table: "campaigns" })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  const aiReady = isAnthropicConfigured();
  const imagesReady = getImageProvider().connected;
  const checklist = [
    { done: Boolean(business), label: "Add your business profile", href: "/business" },
    { done: Boolean(kit), label: "Set up your brand kit", href: "/brand-kit" },
    { done: rows(pricing).length > 0, label: "Price a product", href: "/calculator" },
    { done: rows(content).length > 0, label: "Generate your first content", href: "/social/captions" },
    { done: rows(upcoming).length > 0, label: "Plan a post in the calendar", href: "/social/calendar" },
  ];
  const setupDone = checklist.every((c) => c.done);

  return (
    <>
      <PageHeader
        title={business ? `Welcome back, ${business.name}` : "Welcome to MarketMate AI"}
        description="Your AI Marketing Department — create, market, sell, grow."
      />

      <section aria-label="Quick actions" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map(([href, label, Icon]) => (
          <Link key={href} href={href} className="card flex flex-col items-start gap-2 p-4 transition hover:border-brand hover:shadow-md">
            <span className="rounded-lg bg-brand/10 p-2 text-brand"><Icon aria-hidden className="h-5 w-5" /></span>
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Business profile</h2>
            <Link href="/business" className="text-sm text-brand hover:underline">Edit →</Link>
          </div>
          {business ? (
            <div className="space-y-2 text-sm">
              <p className="text-base font-medium">{business.name}</p>
              {business.industry && <p className="text-muted">{business.industry}{business.location ? ` · ${business.location}` : ""}</p>}
              {business.target_audience && <p><span className="text-muted">Audience:</span> {business.target_audience}</p>}
              {kit && (
                <div className="flex items-center gap-2 pt-1">
                  {[kit.primary_color, kit.secondary_color, kit.accent_color].filter(Boolean).map((c) => (
                    <span key={c} className="h-5 w-5 rounded border border-border" style={{ background: c! }} title={c!} />
                  ))}
                  {kit.brand_voice && <span className="truncate text-xs text-muted">{kit.brand_voice}</span>}
                </div>
              )}
            </div>
          ) : (
            <Empty text="Tell MarketMate about your business so every tool is tailored to it." href="/business" cta="Add profile" />
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent projects</h2>
            <Link href="/library" className="text-sm text-brand hover:underline">Saved work →</Link>
          </div>
          {recentProjects.length ? (
            <ul className="divide-y divide-border text-sm">
              {recentProjects.map((p) => (
                <li key={`${p.table}-${p.id}`} className="flex items-center justify-between gap-3 py-2">
                  <Link href={libraryHref(p.table, p.id)} className="min-w-0 truncate hover:text-brand hover:underline">{p.title}</Link>
                  <span className="shrink-0 text-xs capitalize text-muted">{p.kind} · {date(p.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nothing yet — start with a quick action above, or" href="/assistant" cta="ask the AI Assistant." />
          )}
        </section>

        <Panel title="Content calendar" href="/social/calendar" linkLabel="Calendar">
          {rows(upcoming).length ? (
            <ul className="space-y-2 text-sm">
              {rows(upcoming).map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="truncate"><span className="font-medium">{e.title}</span> <span className="text-muted">· {e.platform}</span></span>
                  <span className="shrink-0 text-muted">{e.scheduled_for}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Nothing scheduled." href="/social/calendar" cta="Plan a post" />
          )}
        </Panel>

        <Panel title="Saved content" href="/library?tab=content" linkLabel="All content">
          {rows(content).length ? (
            <ul className="space-y-2 text-sm">
              {rows(content).map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link href={libraryHref("social_content", c.id)} className="truncate hover:text-brand hover:underline">{c.title ?? "Untitled"}</Link>
                  <span className="shrink-0 text-xs capitalize text-muted">{humanize(c.content_type)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No content yet." href="/studio" cta="Generate content" />
          )}
        </Panel>

        <Panel title="Recent designs" href="/library?tab=designs" linkLabel="All designs">
          {rows(designs).length ? (
            <ul className="space-y-2 text-sm">
              {rows(designs).map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <Link href={libraryHref("designs", d.id)} className="truncate hover:text-brand hover:underline">{d.title}</Link>
                  <span className="shrink-0 text-xs text-muted">{d.status === "not_connected" ? "brief saved" : humanize(d.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No designs yet." href="/design-studio" cta="Create a poster" />
          )}
        </Panel>

        <Panel title="Pricing calculations" href="/library?tab=pricing" linkLabel="All pricing">
          {rows(pricing).length ? (
            <ul className="space-y-2 text-sm">
              {rows(pricing).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={libraryHref("pricing_calculations", p.id)} className="truncate hover:text-brand hover:underline">{p.product_name}</Link>
                  <span className="shrink-0 tabular-nums text-muted">{fmt.format(Number(p.suggested_retail_price))} retail</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No saved calculations." href="/calculator" cta="Price a product" />
          )}
        </Panel>

        <Panel title="Marketing plans" href="/library?tab=plans" linkLabel="All plans">
          {rows(plans).length || rows(campaigns).length ? (
            <ul className="space-y-2 text-sm">
              {rows(plans).map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link href={libraryHref("marketing_plans", p.id)} className="truncate hover:text-brand hover:underline">{p.title}</Link>
                  <span className="shrink-0 text-xs capitalize text-muted">{humanize(p.plan_type)}</span>
                </li>
              ))}
              {rows(campaigns).map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <Link href={libraryHref("campaigns", c.id)} className="truncate hover:text-brand hover:underline">{c.name}</Link>
                  <span className="shrink-0 text-xs capitalize text-muted">campaign · {c.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No plans yet." href="/strategy/plan" cta="Create a marketing plan" />
          )}
        </Panel>

        <section className="card">
          <h2 className="mb-3 font-semibold">{setupDone ? "Connections" : "Getting started"}</h2>
          {!setupDone && (
            <ul className="mb-4 space-y-2 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${c.done ? "bg-green-600 text-white" : "border border-border"}`}>{c.done ? "✓" : ""}</span>
                  <Link href={c.href} className={c.done ? "text-muted line-through" : "hover:text-brand hover:underline"}>{c.label}</Link>
                  <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                </li>
              ))}
            </ul>
          )}
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between gap-2"><span>Database &amp; accounts</span><span className="font-medium text-green-700">Connected</span></li>
            <li className="flex justify-between gap-2"><span>AI writing</span><span className={`font-medium ${aiReady ? "text-green-700" : "text-amber-700"}`}>{aiReady ? "Connected" : "Not connected"}</span></li>
            <li className="flex justify-between gap-2"><span>Image generation</span><span className="font-medium text-amber-700">{imagesReady ? "Connected" : "Not connected yet"}</span></li>
          </ul>
          <Link href="/assistant" className="btn-secondary mt-4 w-full"><Sparkles aria-hidden className="h-4 w-4" /> Ask the AI Assistant</Link>
        </section>
      </div>
      <p className="mt-6 text-xs text-muted">Signed in as {user.email}</p>
    </>
  );
}

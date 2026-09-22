import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { getImageProvider } from "@/lib/design/provider";
import { requireAuth } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth("/dashboard");
  const today = new Date().toISOString().slice(0, 10);
  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });

  const [business, contentCount, planCount, calcCount, designCount, upcoming, recentContent, latestCalc] =
    await Promise.all([
      getPrimaryBusiness(supabase),
      count("social_content"),
      count("marketing_plans"),
      count("pricing_calculations"),
      count("designs"),
      supabase
        .from("content_calendar_entries")
        .select("id, title, platform, scheduled_for, status")
        .gte("scheduled_for", today)
        .order("scheduled_for")
        .limit(5),
      supabase
        .from("social_content")
        .select("id, title, content_type, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("pricing_calculations")
        .select("product_name, cost_per_unit, suggested_retail_price, suggested_wholesale_price")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const brandKit = business ? await getBrandKit(supabase, business.id) : null;
  const aiReady = isAnthropicConfigured();
  const imagesReady = getImageProvider().connected;
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  const checklist = [
    { done: Boolean(business), label: "Add your business profile", href: "/business" },
    { done: Boolean(brandKit), label: "Set up your brand kit", href: "/brand-kit" },
    { done: (calcCount.count ?? 0) > 0, label: "Price a product", href: "/calculator" },
    { done: (contentCount.count ?? 0) > 0, label: "Generate your first caption", href: "/social/captions" },
    { done: (upcoming.data?.length ?? 0) > 0, label: "Plan a post in the calendar", href: "/social/calendar" },
  ];
  const stats = [
    ["Content pieces", contentCount.count ?? 0, "/social"],
    ["Strategy docs", planCount.count ?? 0, "/strategy"],
    ["Price calculations", calcCount.count ?? 0, "/calculator"],
    ["Design briefs", designCount.count ?? 0, "/design-studio"],
  ] as const;

  return (
    <>
      <PageHeader
        title={business ? `Welcome back, ${business.name}` : "Welcome to MarketMate AI"}
        description={`Signed in as ${user.email}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, href]) => (
          <Link key={label} href={href} className="card transition hover:border-brand">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Getting started</h2>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${c.done ? "bg-green-600 text-white" : "border border-border"}`}>
                  {c.done ? "✓" : ""}
                </span>
                <Link href={c.href} className={c.done ? "text-muted line-through" : "hover:text-brand hover:underline"}>{c.label}</Link>
                <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Connections</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Database &amp; sign-in (Supabase)</span><span className="font-medium text-green-700">Connected</span></li>
            <li className="flex justify-between"><span>AI writing (Anthropic)</span>
              <span className={`font-medium ${aiReady ? "text-green-700" : "text-amber-700"}`}>{aiReady ? "Connected" : "Not connected — set ANTHROPIC_API_KEY"}</span>
            </li>
            <li className="flex justify-between"><span>Image generation (Design Studio)</span><span className="font-medium text-amber-700">{imagesReady ? "Connected" : "Not connected yet"}</span></li>
          </ul>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Upcoming posts</h2>
            <Link href="/social/calendar" className="text-sm text-brand hover:underline">Calendar →</Link>
          </div>
          {upcoming.data?.length ? (
            <ul className="space-y-2 text-sm">
              {upcoming.data.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="truncate"><span className="font-medium">{e.title}</span> <span className="text-muted">· {e.platform}</span></span>
                  <span className="shrink-0 text-muted">{e.scheduled_for}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Latest pricing</h2>
          {latestCalc.data ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="col-span-2 font-medium">{latestCalc.data.product_name}</dt>
              <dt className="text-muted">Cost / unit</dt><dd className="text-right">{fmt.format(Number(latestCalc.data.cost_per_unit))}</dd>
              <dt className="text-muted">Retail</dt><dd className="text-right">{fmt.format(Number(latestCalc.data.suggested_retail_price))}</dd>
              <dt className="text-muted">Wholesale</dt><dd className="text-right">{fmt.format(Number(latestCalc.data.suggested_wholesale_price))}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted">No saved calculations. <Link href="/calculator" className="text-brand hover:underline">Open the calculator</Link>.</p>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent content</h2>
          {recentContent.data?.length ? (
            <ul className="divide-y divide-border text-sm">
              {recentContent.data.map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{c.title ?? "Untitled"}</span>
                  <span className="shrink-0 text-muted">{c.content_type.replace("_", " ")} · {new Date(c.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No content yet. Try the <Link href="/social/captions" className="text-brand hover:underline">caption generator</Link>.</p>
          )}
        </section>
      </div>
    </>
  );
}

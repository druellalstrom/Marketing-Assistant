import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brush,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  ImageIcon,
  Megaphone,
  MessageCircleHeart,
  PenLine,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { HeroIllustration } from "@/components/dashboard/hero-illustration";
import { ProjectMenu } from "@/components/dashboard/project-menu";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { displayNameFor, firstNameOf } from "@/lib/dashboard/account";
import { getDashboardData, type RecentProject } from "@/lib/data/dashboard";
import { getImageProvider } from "@/lib/design/provider";
import { libraryHref } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

/** Accent per feature area: colour organises information, it isn't decoration. */
const QUICK_ACTIONS: { href: string; title: string; body: string; Icon: LucideIcon; tone: string; icon: string; arrow: string }[] = [
  { href: "/design-studio", title: "Create a Poster", body: "Design professional promotions for your business.", Icon: ImageIcon, tone: "bg-pink-50 border-pink-200 hover:border-pink-400", icon: "bg-pink text-white", arrow: "bg-pink" },
  { href: "/social/captions", title: "Create Social Content", body: "Write captions, hashtags and more for your social media.", Icon: MessageCircleHeart, tone: "bg-violet-50 border-violet-200 hover:border-violet-400", icon: "bg-purple text-white", arrow: "bg-purple" },
  { href: "/calculator", title: "Price My Product", body: "Calculate costs, profit margins and more.", Icon: Calculator, tone: "bg-orange-50 border-orange-200 hover:border-orange-400", icon: "bg-coral text-white", arrow: "bg-coral" },
  { href: "/strategy/plan", title: "Create Marketing Plan", body: "Get a complete marketing plan for your business.", Icon: BarChart3, tone: "bg-indigo-50 border-indigo-200 hover:border-indigo-400", icon: "bg-navy text-white", arrow: "bg-navy" },
  { href: "/studio", title: "Write Content", body: "Product descriptions, emails, ads and more.", Icon: PenLine, tone: "bg-rose-50 border-rose-200 hover:border-rose-400", icon: "bg-brand text-white", arrow: "bg-brand" },
  { href: "/social/calendar", title: "Plan My Calendar", body: "Schedule and organise your content.", Icon: CalendarDays, tone: "bg-sky-50 border-sky-200 hover:border-sky-400", icon: "bg-sky-600 text-white", arrow: "bg-sky-600" },
];

const PROJECT_ICON: Record<RecentProject["kind"], { Icon: LucideIcon; cls: string }> = {
  designs: { Icon: Brush, cls: "bg-pink-100 text-brand-strong" },
  content: { Icon: FileText, cls: "bg-violet-100 text-purple" },
  pricing: { Icon: Calculator, cls: "bg-orange-100 text-orange-700" },
  plans: { Icon: Target, cls: "bg-indigo-100 text-navy" },
  campaigns: { Icon: Megaphone, cls: "bg-amber-100 text-amber-800" },
};

const dateFmt = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function editHref(p: RecentProject): string {
  if (p.kind === "designs") return `/design-studio?load=${p.id}`;
  return libraryHref(p.table, p.id);
}

function Stat({ Icon, iconCls, title, value, sub, href }: { Icon: LucideIcon; iconCls: string; title: string; value: React.ReactNode; sub: string; href: string }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconCls}`}><Icon aria-hidden className="h-6 w-6" /></span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-3xl font-bold tabular-nums leading-tight text-navy">{value}</p>
        <p className="text-[0.9375rem] text-muted">{sub}</p>
        <Link href={href} className="mt-1 inline-flex min-h-8 items-center gap-1 text-[0.9375rem] font-semibold text-brand-strong hover:underline">
          View all <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth("/dashboard");
  const now = new Date();
  const [data, profile] = await Promise.all([
    getDashboardData(supabase, now),
    supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const firstName = firstNameOf(displayNameFor(profile.data?.full_name, user.email));
  const aiReady = isAnthropicConfigured();
  const imagesReady = getImageProvider().connected;
  const weeklyTotal = data.weekly.reduce((s, w) => s + w.count, 0);
  const pct = Math.round((data.progress.completed / data.progress.tasks.length) * 100);

  return (
    <div className="grid gap-6 [grid-template-areas:'top'_'side'_'bottom'] wide:grid-cols-[minmax(0,1fr)_340px] 3xl:grid-cols-[minmax(0,1fr)_400px] wide:[grid-template-areas:'top_side'_'bottom_side'] wide:grid-rows-[auto_1fr]">
      {/* ---------- top: hero + quick actions ---------- */}
      <div className="min-w-0 space-y-6 [grid-area:top]">
        <section className="relative overflow-hidden rounded-3xl border border-pink-100 bg-gradient-to-r from-white via-white to-pink-50 shadow-sm">
          <div className="grid items-center gap-4 p-6 sm:p-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:p-10">
            <div>
              <p className="text-lg text-navy">Welcome back, <strong>{firstName}</strong> <span aria-hidden>👋</span></p>
              <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-navy sm:text-[2.75rem] 3xl:text-6xl">
                Grow Your Business <span className="block text-pink">With AI</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-700">
                Create marketing content, price your products, plan campaigns, and reach more customers — all in one place.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/studio" className="btn-primary px-6 text-base">Start Creating <ArrowRight aria-hidden className="h-5 w-5" /></Link>
                <Link href="/assistant" className="btn-secondary px-6 text-base"><Sparkles aria-hidden className="h-5 w-5 text-brand" /> Ask the assistant</Link>
              </div>
            </div>
            <HeroIllustration className="mx-auto hidden h-auto w-full max-w-[35rem] sm:block" />
          </div>
        </section>

        <section className="card" aria-labelledby="qa-title" id="quick-actions">
          <div className="mb-5 flex items-start gap-3">
            <Zap aria-hidden className="mt-1 h-6 w-6 fill-gold text-gold" />
            <div>
              <h2 id="qa-title" className="text-2xl font-bold text-navy">Quick Actions</h2>
              <p className="text-base text-muted">Jump into the most important marketing tools.</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, title, body, Icon, tone, icon, arrow }) => (
              <li key={href}>
                <Link href={href} className={`group flex h-full flex-col rounded-2xl border-2 p-5 transition ${tone}`}>
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${icon}`}><Icon aria-hidden className="h-7 w-7" /></span>
                  <span className="mt-4 text-lg font-bold text-navy">{title}</span>
                  <span className="mt-1 flex-1 text-[0.9375rem] leading-snug text-slate-700">{body}</span>
                  <span className={`mt-4 flex h-10 w-10 items-center justify-center self-end rounded-full text-white transition group-hover:translate-x-0.5 ${arrow}`}>
                    <ArrowRight aria-hidden className="h-5 w-5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- side: progress, assistant, upcoming ---------- */}
      <aside className="grid content-start gap-6 [grid-area:side] md:grid-cols-2 wide:grid-cols-1" aria-label="Your progress and assistant">
        <section className="card" aria-labelledby="progress-title">
          <div className="flex items-center gap-3">
            <Target aria-hidden className="h-7 w-7 text-navy" />
            <h2 id="progress-title" className="text-xl font-bold text-navy">Your Progress</h2>
          </div>
          <h3 className="mt-5 text-lg font-semibold">Getting Started</h3>
          <p className="text-[0.9375rem] text-muted">{data.progress.completed} of {data.progress.tasks.length} completed</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Getting started progress">
            <div className="h-full rounded-full bg-gradient-to-r from-pink to-purple transition-all" style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <ul className="mt-4 divide-y divide-border">
            {data.progress.tasks.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex min-h-16 items-center gap-3 py-2 hover:bg-pink-50/60">
                  {t.done ? (
                    <CheckCircle2 aria-hidden className="h-6 w-6 shrink-0 fill-green-600 text-white" />
                  ) : (
                    <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.9375rem] font-semibold ${t.done ? "text-muted line-through" : "text-foreground"}`}>{t.label}</span>
                    <span className="block text-sm text-muted">{t.hint}</span>
                  </span>
                  <span className="sr-only">{t.done ? "(completed)" : "(not done yet)"}</span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
          {data.progress.completed === data.progress.tasks.length && (
            <p className="mt-3 rounded-xl bg-green-50 p-3 text-[0.9375rem] font-medium text-green-800">You&apos;re all set up. Nice work!</p>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 p-6" aria-labelledby="assistant-title">
          <Megaphone aria-hidden className="absolute -right-3 -top-3 h-24 w-24 -rotate-12 text-pink opacity-10" />
          <div className="relative flex items-start gap-3">
            <Sparkles aria-hidden className="mt-1 h-7 w-7 shrink-0 text-purple" />
            <div>
              <h2 id="assistant-title" className="text-xl font-bold text-navy">MarketMate AI Assistant</h2>
              <p className="text-[0.9375rem] text-muted">Your AI Marketing Department</p>
            </div>
          </div>
          <p className="relative mt-4 text-base leading-relaxed text-slate-800">
            Ask me to create a campaign, write content, price a product, or plan your next promotion.
          </p>
          <Link href="/assistant" className="btn-primary relative mt-5 w-full text-base">
            Ask MarketMate AI <ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
          {!aiReady && <p className="relative mt-2 text-sm text-amber-900">AI writing isn&apos;t connected yet — see Settings.</p>}
        </section>

        <section className="card md:col-span-2 wide:col-span-1" aria-labelledby="upcoming-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="upcoming-title" className="text-xl font-bold text-navy">Coming Up</h2>
            <Link href="/social/calendar" className="text-[0.9375rem] font-semibold text-brand-strong hover:underline">Calendar</Link>
          </div>
          {data.upcoming.length ? (
            <ul className="mt-3 space-y-2">
              {data.upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl bg-sky-50 p-3">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-center leading-none shadow-sm">
                    <span className="text-[0.6875rem] font-semibold uppercase text-brand-strong">{new Date(`${e.scheduled_for}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</span>
                    <span className="text-lg font-bold text-navy">{Number(e.scheduled_for.slice(8))}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold">{e.title}</span>
                    <span className="block text-sm capitalize text-muted">{e.platform} · {e.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[0.9375rem] text-muted">
              No posts scheduled yet. <Link href="/social/calendar" className="font-semibold text-brand-strong hover:underline">Plan your first post →</Link>
            </p>
          )}
          <p className="mt-5 text-center text-lg italic text-navy" style={{ fontFamily: "'Segoe Print', 'Bradley Hand', cursive" }}>
            Create · Market · Sell · Grow <span aria-hidden className="text-pink">♥</span>
          </p>
        </section>
      </aside>

      {/* ---------- bottom: stats, performance, connections, projects ---------- */}
      <div className="min-w-0 space-y-6 [grid-area:bottom]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Stat Icon={FileText} iconCls="bg-pink-100 text-brand-strong" title="Content Created" value={data.stats.contentThisMonth} sub={`This month · ${data.stats.contentTotal} in total`} href="/library?tab=content" />
            <Stat Icon={Megaphone} iconCls="bg-violet-100 text-purple" title="Campaigns" value={<>{data.stats.activeCampaigns} <span className="text-xl font-semibold">Active</span></>} sub={`${data.stats.campaignsTotal} campaign${data.stats.campaignsTotal === 1 ? "" : "s"} saved`} href="/library?tab=campaigns" />
            <Stat Icon={Calculator} iconCls="bg-green-100 text-green-800" title="Products Priced" value={data.stats.pricedThisMonth} sub={`This month · ${data.stats.pricedTotal} in total`} href="/library?tab=pricing" />
          </div>

        <div className="grid grid-cols-1 gap-6 3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="card" aria-labelledby="perf-title">
            <div className="flex items-start gap-3">
              <BarChart3 aria-hidden className="mt-1 h-6 w-6 text-brand" />
              <div>
                <h2 id="perf-title" className="text-xl font-bold text-navy">Marketing Performance</h2>
                <p className="text-[0.9375rem] text-muted">Marketing pieces you created each week</p>
              </div>
            </div>
            {weeklyTotal > 0 ? (
              <>
                <p className="mt-4 text-[0.9375rem]"><strong className="text-2xl text-navy">{weeklyTotal}</strong> <span className="text-muted">created in the last 8 weeks</span></p>
                <div className="mt-2"><WeeklyChart data={data.weekly} /></div>
              </>
            ) : (
              <div className="mt-6 flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 px-4 py-10 text-center">
                <BarChart3 aria-hidden className="h-10 w-10 text-slate-300" />
                <p className="mt-2 text-lg font-semibold">No data yet</p>
                <p className="text-[0.9375rem] text-muted">Your weekly activity will appear here once you start creating.</p>
                <Link href="/strategy/campaigns" className="btn-primary mt-4">Create your first campaign <ArrowRight aria-hidden className="h-4 w-4" /></Link>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="conn-title">
            <h2 id="conn-title" className="text-xl font-bold text-navy">Connection Status</h2>
            <p className="text-[0.9375rem] text-muted">Your integrations and tools</p>
            <ul className="mt-4 space-y-3">
              {[
                { label: "Database & accounts", Icon: Database, ok: true, iconCls: "bg-green-100 text-green-800" },
                { label: "AI writing", Icon: PenLine, ok: aiReady, iconCls: "bg-pink-100 text-brand-strong" },
                { label: "Image generation", Icon: ImageIcon, ok: imagesReady, iconCls: "bg-violet-100 text-purple" },
              ].map(({ label, Icon, ok, iconCls }) => (
                <li key={label} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconCls}`}><Icon aria-hidden className="h-5 w-5" /></span>
                  <span className="min-w-32 flex-1 text-[0.9375rem] font-semibold">{label}</span>
                  {ok ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                      Connected <CheckCircle2 aria-hidden className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Not connected</span>
                      <Link href="/settings#connections" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-soft">
                        Connect<span className="sr-only"> {label}</span>
                      </Link>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

          <section className="card" aria-labelledby="recent-title">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FolderOpen aria-hidden className="mt-1 h-6 w-6 fill-navy/10 text-navy" />
                <div>
                  <h2 id="recent-title" className="text-xl font-bold text-navy">Recent Projects</h2>
                  <p className="text-[0.9375rem] text-muted">Continue working on your latest projects</p>
                </div>
              </div>
              <Link href="/library" className="shrink-0 text-[0.9375rem] font-semibold text-brand-strong hover:underline">View all</Link>
            </div>
            {data.recent.length ? (
              <ul className="mt-4 divide-y divide-border">
                {data.recent.map((p) => {
                  const { Icon, cls } = PROJECT_ICON[p.kind];
                  return (
                    <li key={`${p.kind}-${p.id}`} className="flex items-center gap-3 py-2.5">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon aria-hidden className="h-5 w-5" /></span>
                      <Link href={libraryHref(p.table, p.id)} className="min-w-0 flex-1 hover:text-brand-strong">
                        <span className="block truncate text-[0.9375rem] font-semibold">{p.title}</span>
                        <span className="block text-sm text-muted sm:hidden">{p.typeLabel} · {dateFmt(p.updatedAt)}</span>
                      </Link>
                      <span className="hidden w-40 shrink-0 truncate text-[0.9375rem] text-muted sm:block">{p.typeLabel}</span>
                      <span className="hidden w-32 shrink-0 text-[0.9375rem] tabular-nums text-muted md:block">{dateFmt(p.updatedAt)}</span>
                      <ProjectMenu kind={p.kind} id={p.id} title={p.title} openHref={libraryHref(p.table, p.id)} editHref={editHref(p)} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-[0.9375rem] text-muted">
                Nothing saved yet. Everything you create is saved here automatically.{" "}
                <Link href="#quick-actions" className="font-semibold text-brand-strong hover:underline">Pick a quick action to start →</Link>
              </p>
            )}
          </section>
      </div>
    </div>
  );
}

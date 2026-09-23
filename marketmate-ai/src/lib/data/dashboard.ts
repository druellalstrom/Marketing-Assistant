import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrandKit, getPrimaryBusiness, type BrandKitRow, type BusinessRow } from "./business";
import { progressTasks, startOfMonth, startOfWeeksAgo, weeklyCounts, type ProgressTask, type WeekBucket } from "@/lib/dashboard/stats";
import type { LibraryKind } from "@/lib/library";

export interface RecentProject {
  id: string;
  kind: LibraryKind;
  table: string;
  title: string;
  typeLabel: string;
  updatedAt: string;
}

export interface UpcomingPost {
  id: string;
  title: string;
  platform: string;
  scheduled_for: string;
  status: string;
}

export interface DashboardData {
  business: BusinessRow | null;
  brandKit: BrandKitRow | null;
  progress: { tasks: ProgressTask[]; completed: number };
  weekly: WeekBucket[];
  stats: {
    contentThisMonth: number;
    contentTotal: number;
    activeCampaigns: number;
    campaignsTotal: number;
    pricedThisMonth: number;
    pricedTotal: number;
  };
  recent: RecentProject[];
  upcoming: UpcomingPost[];
}

const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Everything the dashboard shows, read under RLS as the signed-in user. */
export async function getDashboardData(supabase: SupabaseClient, now: Date): Promise<DashboardData> {
  const monthStart = startOfMonth(now);
  const windowStart = startOfWeeksAgo(now, 8);
  const today = now.toISOString().slice(0, 10);
  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });
  const since = (table: string, from: string) => count(table).gte("created_at", from);
  const createdIn = (table: string) => supabase.from(table).select("created_at").gte("created_at", windowStart).limit(2000);
  const recent = (table: string, cols: string) =>
    supabase.from(table).select(cols).order("updated_at", { ascending: false }).limit(6);

  const business = await getPrimaryBusiness(supabase);
  const [
    brandKit,
    contentTotal, plansTotal, campaignsTotal, designsTotal, pricingTotal, calendarTotal,
    contentMonth, plansMonth, campaignsMonth, designsMonth, pricedMonth,
    activeCampaigns,
    wContent, wPlans, wCampaigns, wDesigns,
    rContent, rPlans, rCampaigns, rDesigns, rPricing,
    upcoming,
  ] = await Promise.all([
    business ? getBrandKit(supabase, business.id) : Promise.resolve(null),
    count("social_content"), count("marketing_plans"), count("campaigns"), count("designs"), count("pricing_calculations"), count("content_calendar_entries"),
    since("social_content", monthStart), since("marketing_plans", monthStart), since("campaigns", monthStart), since("designs", monthStart), since("pricing_calculations", monthStart),
    count("campaigns").eq("status", "active"),
    createdIn("social_content"), createdIn("marketing_plans"), createdIn("campaigns"), createdIn("designs"),
    recent("social_content", "id, title, content_type, updated_at"),
    recent("marketing_plans", "id, title, plan_type, updated_at"),
    recent("campaigns", "id, name, updated_at"),
    recent("designs", "id, title, updated_at"),
    recent("pricing_calculations", "id, product_name, updated_at"),
    supabase
      .from("content_calendar_entries")
      .select("id, title, platform, scheduled_for, status")
      .gte("scheduled_for", today)
      .neq("status", "posted")
      .order("scheduled_for")
      .limit(4),
  ]);

  const n = (r: { count: number | null }) => r.count ?? 0;
  const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];
  type Row = Record<string, string>;

  const contentAll = n(contentTotal) + n(plansTotal) + n(campaignsTotal) + n(designsTotal);
  const timestamps = [wContent, wPlans, wCampaigns, wDesigns].flatMap((r) => rows<{ created_at: string }>(r).map((x) => x.created_at));

  const recentProjects: RecentProject[] = [
    ...rows<Row>(rContent).map((r) => ({ id: r.id, kind: "content" as const, table: "social_content", title: r.title ?? "Untitled", typeLabel: humanize(r.content_type), updatedAt: r.updated_at })),
    ...rows<Row>(rPlans).map((r) => ({ id: r.id, kind: "plans" as const, table: "marketing_plans", title: r.title, typeLabel: humanize(r.plan_type), updatedAt: r.updated_at })),
    ...rows<Row>(rCampaigns).map((r) => ({ id: r.id, kind: "campaigns" as const, table: "campaigns", title: r.name, typeLabel: "Campaign", updatedAt: r.updated_at })),
    ...rows<Row>(rDesigns).map((r) => ({ id: r.id, kind: "designs" as const, table: "designs", title: r.title, typeLabel: "Design", updatedAt: r.updated_at })),
    ...rows<Row>(rPricing).map((r) => ({ id: r.id, kind: "pricing" as const, table: "pricing_calculations", title: r.product_name, typeLabel: "Pricing", updatedAt: r.updated_at })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return {
    business,
    brandKit,
    progress: progressTasks({
      hasBusiness: Boolean(business),
      hasBrandKit: Boolean(brandKit),
      pricingCount: n(pricingTotal),
      contentCount: contentAll,
      calendarCount: n(calendarTotal),
    }),
    weekly: weeklyCounts(timestamps, now),
    stats: {
      contentThisMonth: n(contentMonth) + n(plansMonth) + n(campaignsMonth) + n(designsMonth),
      contentTotal: contentAll,
      activeCampaigns: n(activeCampaigns),
      campaignsTotal: n(campaignsTotal),
      pricedThisMonth: n(pricedMonth),
      pricedTotal: n(pricingTotal),
    },
    recent: recentProjects,
    upcoming: rows<UpcomingPost>(upcoming),
  };
}

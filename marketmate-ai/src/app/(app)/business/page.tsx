import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { requireAuth } from "@/lib/supabase/server";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "Business profile" };

export default async function BusinessPage() {
  const { supabase } = await requireAuth("/business");
  const business = await getPrimaryBusiness(supabase);
  const kit = business ? await getBrandKit(supabase, business.id) : null;
  const swatches = [kit?.primary_color, kit?.secondary_color, kit?.accent_color].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Business profile"
        description="Tell MarketMate about your business once. Every AI tool, the assistant and the Design Studio use it automatically."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <BusinessForm defaults={business} />
        <aside className="card h-fit space-y-3 text-sm">
          <h2 className="font-semibold">Logo, colours &amp; tone</h2>
          <p className="text-muted">These live in your Brand Kit so they stay consistent everywhere.</p>
          {kit ? (
            <>
              {swatches.length > 0 && (
                <div className="flex gap-2">
                  {swatches.map((c) => <span key={c} className="h-8 w-8 rounded-md border border-border" style={{ background: c }} title={c} />)}
                </div>
              )}
              {kit.brand_voice && <p><span className="text-muted">Tone:</span> {kit.brand_voice}</p>}
              <p><span className="text-muted">Logo:</span> {kit.logo_path ? "uploaded" : "not uploaded"}</p>
            </>
          ) : (
            <p className="text-muted">No brand kit yet.</p>
          )}
          <Link href="/brand-kit" className="btn-secondary w-full">{business ? "Edit brand kit" : "Save your profile first"}</Link>
        </aside>
      </div>
    </>
  );
}

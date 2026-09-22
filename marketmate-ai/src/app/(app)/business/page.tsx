import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getPrimaryBusiness } from "@/lib/data/business";
import { requireAuth } from "@/lib/supabase/server";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "Business profile" };

export default async function BusinessPage() {
  const { supabase } = await requireAuth("/business");
  const business = await getPrimaryBusiness(supabase);
  return (
    <>
      <PageHeader
        title="Business profile"
        description="Tell MarketMate about your business. Every AI tool uses this to tailor its writing."
      />
      <BusinessForm defaults={business} />
    </>
  );
}

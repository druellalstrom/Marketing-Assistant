import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { requireAuth } from "@/lib/supabase/server";
import { BrandKitForm } from "./brand-kit-form";

export const metadata: Metadata = { title: "Brand kit" };

export default async function BrandKitPage() {
  const { supabase, user } = await requireAuth("/brand-kit");
  const business = await getPrimaryBusiness(supabase);
  const kit = business ? await getBrandKit(supabase, business.id) : null;

  return (
    <>
      <PageHeader title="Brand kit" description="Logo, colours, fonts, tone, slogan and social handles. Used by every AI tool and the Design Studio." />
      {business ? (
        <BrandKitForm defaults={kit} userId={user.id} businessName={business.name} handles={business.social_handles ?? {}} />
      ) : (
        <p className="card text-sm">
          Create your <Link href="/business" className="text-brand underline">business profile</Link> first — the brand kit belongs to it.
        </p>
      )}
    </>
  );
}

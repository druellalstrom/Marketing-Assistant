import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessContext } from "@/lib/ai/prompts";

export interface BusinessRow {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  products: string | null;
  target_audience: string | null;
  location: string | null;
  website: string | null;
  social_handles: Record<string, string>;
  is_primary: boolean;
}

export interface BrandKitRow {
  id: string;
  business_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  logo_path: string | null;
  brand_voice: string | null;
  tagline: string | null;
  keywords: string[];
}

/**
 * The signed-in user's primary business (or their oldest, if none is marked
 * primary). RLS guarantees only the caller's rows are visible.
 */
export async function getPrimaryBusiness(supabase: SupabaseClient): Promise<BusinessRow | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessRow | null;
}

export async function getBrandKit(
  supabase: SupabaseClient,
  businessId: string,
): Promise<BrandKitRow | null> {
  const { data, error } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return data as BrandKitRow | null;
}

export async function getBusinessContext(
  supabase: SupabaseClient,
): Promise<{ business: BusinessRow | null; brandKit: BrandKitRow | null; context: BusinessContext | null }> {
  const business = await getPrimaryBusiness(supabase);
  if (!business) return { business: null, brandKit: null, context: null };
  const brandKit = await getBrandKit(supabase, business.id);
  return {
    business,
    brandKit,
    context: {
      name: business.name,
      industry: business.industry,
      description: business.description,
      products: business.products,
      target_audience: business.target_audience,
      location: business.location,
      brand_voice: brandKit?.brand_voice,
      tagline: brandKit?.tagline,
      keywords: brandKit?.keywords,
    },
  };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessContext } from "@/lib/ai/prompts";
import type { PrefillKey } from "@/lib/ai/tool-definitions";

export interface BusinessRow {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  products: string | null;
  target_audience: string | null;
  location: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
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
  return { business, brandKit, context: toBusinessContext(business, brandKit) };
}

export function toBusinessContext(business: BusinessRow, brandKit: BrandKitRow | null): BusinessContext {
  const colors = brandKit
    ? [brandKit.primary_color && `primary ${brandKit.primary_color}`, brandKit.secondary_color && `secondary ${brandKit.secondary_color}`, brandKit.accent_color && `accent ${brandKit.accent_color}`]
        .filter(Boolean)
        .join(", ")
    : "";
  const fonts = brandKit ? [brandKit.heading_font, brandKit.body_font].filter(Boolean).join(" / ") : "";
  return {
    name: business.name,
    industry: business.industry,
    description: business.description,
    products: business.products,
    target_audience: business.target_audience,
    location: business.location,
    phone: business.phone,
    email: business.email,
    website: business.website,
    social_handles: business.social_handles,
    brand_voice: brandKit?.brand_voice,
    tagline: brandKit?.tagline,
    keywords: brandKit?.keywords,
    colors: colors || null,
    fonts: fonts || null,
  };
}

const HANDLE_PLATFORMS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

/** Values used to pre-fill AI tool forms so users don't retype their profile. */
export function prefillFrom(business: BusinessRow | null, brandKit: BrandKitRow | null): Partial<Record<PrefillKey, string>> {
  if (!business) return {};
  const platforms = Object.entries(business.social_handles ?? {})
    .filter(([, v]) => v)
    .map(([k]) => HANDLE_PLATFORMS[k])
    .filter(Boolean);
  if (business.website) platforms.push("Website");
  return {
    businessName: business.name,
    industry: business.industry ?? "",
    products: business.products ?? "",
    location: business.location ?? "",
    targetAudience: business.target_audience ?? "",
    platforms: platforms.join(", "),
    brandTone: brandKit?.brand_voice ?? "",
  };
}

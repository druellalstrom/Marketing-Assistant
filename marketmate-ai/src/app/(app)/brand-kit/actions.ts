"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { getPrimaryBusiness } from "@/lib/data/business";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colours must be hex values like #FF8800.");
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const brandKitSchema = z.object({
  primary_color: hex,
  secondary_color: hex,
  accent_color: hex,
  heading_font: optional(100),
  body_font: optional(100),
  brand_voice: optional(2000),
  tagline: optional(200),
  keywords: z
    .string()
    .max(1000)
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  logo_path: z.string().max(500).optional().transform((v) => v || null),
});

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function saveBrandKit(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };
  const business = await getPrimaryBusiness(auth.supabase);
  if (!business) return { error: "Create your business profile first." };

  const parsed = brandKitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  if (parsed.data.logo_path && !parsed.data.logo_path.startsWith(`${auth.user.id}/`)) {
    return { error: "Invalid logo upload." };
  }

  const { error } = await auth.supabase
    .from("brand_kits")
    .upsert({ ...parsed.data, business_id: business.id }, { onConflict: "business_id" });
  if (error) return { error: "Could not save your brand kit." };

  revalidatePath("/", "layout");
  return { ok: true };
}

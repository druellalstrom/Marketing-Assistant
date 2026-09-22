"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { getPrimaryBusiness } from "@/lib/data/business";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const businessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(200),
  industry: optional(200),
  description: optional(3000),
  products: optional(3000),
  target_audience: optional(2000),
  location: optional(200),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), "Website must start with http:// or https://"),
  instagram: optional(100),
  tiktok: optional(100),
  facebook: optional(200),
});

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function saveBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { instagram, tiktok, facebook, ...fields } = parsed.data;
  const social_handles = Object.fromEntries(
    Object.entries({ instagram, tiktok, facebook }).filter(([, v]) => v),
  );
  const existing = await getPrimaryBusiness(auth.supabase);
  const { error } = existing
    ? await auth.supabase.from("businesses").update({ ...fields, social_handles }).eq("id", existing.id)
    : await auth.supabase.from("businesses").insert({ ...fields, social_handles, is_primary: true });
  if (error) return { error: "Could not save your business profile." };

  revalidatePath("/", "layout");
  return { ok: true };
}

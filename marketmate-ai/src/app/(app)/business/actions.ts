"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/supabase/server";
import { getPrimaryBusiness } from "@/lib/data/business";
import { businessSchema, SOCIAL_KEYS } from "@/lib/business/schema";

export interface FormState {
  error?: string;
  ok?: boolean;
}

export async function saveBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };

  const data = parsed.data;
  const social_handles = Object.fromEntries(SOCIAL_KEYS.filter((k) => data[k]).map((k) => [k, data[k]]));
  const fields = {
    name: data.name,
    industry: data.industry,
    description: data.description,
    products: data.products,
    target_audience: data.target_audience,
    location: data.location,
    phone: data.phone,
    email: data.email,
    website: data.website,
    social_handles,
  };
  const existing = await getPrimaryBusiness(auth.supabase);
  const { error } = existing
    ? await auth.supabase.from("businesses").update(fields).eq("id", existing.id)
    : await auth.supabase.from("businesses").insert({ ...fields, is_primary: true });
  if (error) return { error: "Could not save your business profile." };

  revalidatePath("/", "layout");
  return { ok: true };
}

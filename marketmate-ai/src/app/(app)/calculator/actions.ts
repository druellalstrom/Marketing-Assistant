"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { isKnownCurrency } from "@/lib/pricing/money";
import { runSmartCalculator } from "@/lib/pricing/smart";
import { smartInputSchema, summarize } from "@/lib/pricing/smart-schema";
import { getPrimaryBusiness } from "@/lib/data/business";

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Saves a Smart Pricing Calculator calculation. With `id`, updates it in
 * place; otherwise creates a new one. Results are recomputed on the server.
 */
export async function saveSmartCalculation(id: string | null, productName: string, rawInput: unknown): Promise<SaveResult> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Sign in to save calculations." };

  const name = z.string().trim().min(1).max(200).safeParse(productName);
  if (!name.success) return { ok: false, error: "Give your calculation a name (up to 200 characters)." };
  if (id !== null && !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid calculation." };
  const parsed = smartInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Some answers aren't valid. Check the numbers and try again." };

  const outcome = runSmartCalculator(parsed.data);
  if (!outcome.ok) return { ok: false, error: outcome.issues[0]?.message ?? "Finish the questions first." };
  const summary = summarize(outcome.result);
  if (summary.price > 9e9 || summary.cost > 9e7) return { ok: false, error: "These numbers are too large to save. Check them." };

  const row = {
    product_name: name.data,
    inputs: parsed.data,
    results: summary,
    cost_per_unit: summary.cost,
    suggested_retail_price: summary.price,
    suggested_wholesale_price: outcome.result.wholesale?.price ?? 0,
  };

  let savedId = id;
  if (id) {
    const { data, error } = await auth.supabase.from("pricing_calculations").update(row).eq("id", id).select("id");
    if (error || !data?.length) return { ok: false, error: "Could not update. Please try again." };
  } else {
    const business = await getPrimaryBusiness(auth.supabase);
    const { data, error } = await auth.supabase
      .from("pricing_calculations")
      .insert({ ...row, business_id: business?.id ?? null })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Could not save. Please try again." };
    savedId = data.id;
  }

  revalidatePath("/calculator");
  revalidatePath("/dashboard");
  revalidatePath("/library");
  return { ok: true, id: savedId ?? undefined };
}

/** Stores the user's main business currency on their account (no database change needed). */
export async function setBusinessCurrency(code: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Sign in first." };
  if (!isKnownCurrency(code)) return { ok: false, error: "Unknown currency." };
  const { error } = await auth.supabase.auth.updateUser({ data: { currency: code } });
  if (error) return { ok: false, error: "Couldn't save your currency. Please try again." };
  revalidatePath("/calculator");
  revalidatePath("/dashboard");
  return { ok: true };
}

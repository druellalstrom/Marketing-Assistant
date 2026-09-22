"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { PricingInputError, roundMoney, runPricingCalculator } from "@/lib/pricing/calculator";
import { pricingInputSchema } from "@/lib/pricing/schema";
import { getPrimaryBusiness } from "@/lib/data/business";

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Saves a calculation. With `id`, updates that saved calculation in place;
 * otherwise creates a new one. Results are always recomputed on the server.
 */
export async function saveCalculation(id: string | null, productName: string, rawInput: unknown): Promise<SaveResult> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Sign in to save calculations." };

  const name = z.string().trim().min(1).max(200).safeParse(productName);
  if (!name.success) return { ok: false, error: "Enter a product name (up to 200 characters)." };
  if (id !== null && !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid calculation." };
  const parsed = pricingInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Some inputs are invalid — check the highlighted fields." };

  let results;
  try {
    results = runPricingCalculator(parsed.data);
  } catch (e) {
    if (e instanceof PricingInputError) return { ok: false, error: e.message };
    throw e;
  }

  const row = {
    product_name: name.data,
    inputs: parsed.data,
    results,
    cost_per_unit: results.production.costPerUnit,
    suggested_retail_price: roundMoney(results.retail.price),
    suggested_wholesale_price: roundMoney(results.wholesale.price),
  };

  let savedId = id;
  if (id) {
    const { error } = await auth.supabase.from("pricing_calculations").update(row).eq("id", id);
    if (error) return { ok: false, error: "Could not update. Please try again." };
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

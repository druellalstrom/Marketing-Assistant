"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";
import { PricingInputError, roundMoney, runPricingCalculator } from "@/lib/pricing/calculator";
import { pricingInputSchema } from "@/lib/pricing/schema";
import { getPrimaryBusiness } from "@/lib/data/business";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveCalculation(productName: string, rawInput: unknown): Promise<SaveResult> {
  const auth = await getAuthContext();
  if (!auth) return { ok: false, error: "Sign in to save calculations." };

  const name = z.string().trim().min(1).max(200).safeParse(productName);
  if (!name.success) return { ok: false, error: "Give the product a name (up to 200 characters)." };
  const parsed = pricingInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Some inputs are invalid." };

  // Never trust results computed in the browser: recompute on the server.
  let results;
  try {
    results = runPricingCalculator(parsed.data);
  } catch (e) {
    if (e instanceof PricingInputError) return { ok: false, error: e.message };
    throw e;
  }

  const business = await getPrimaryBusiness(auth.supabase);
  const { error } = await auth.supabase.from("pricing_calculations").insert({
    business_id: business?.id ?? null,
    product_name: name.data,
    inputs: parsed.data,
    results,
    cost_per_unit: results.unitCost.costPerUnit,
    suggested_retail_price: roundMoney(results.suggestedRetailPrice),
    suggested_wholesale_price: roundMoney(results.suggestedWholesalePrice),
  });
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath("/calculator");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteCalculation(id: string): Promise<void> {
  const auth = await getAuthContext();
  if (!auth || !z.uuid().safeParse(id).success) return;
  await auth.supabase.from("pricing_calculations").delete().eq("id", id);
  revalidatePath("/calculator");
  revalidatePath("/dashboard");
}

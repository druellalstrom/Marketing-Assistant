import { z } from "zod";
import { COST_CATEGORIES } from "./calculator";

/** Validation for calculator inputs arriving from the browser or the AI assistant. */
const money = z.number().finite().min(0).max(1_000_000_000);
const pct = z.number().finite().min(0).lt(100);
const costLine = z.object({ amount: money, basis: z.enum(["total", "per_unit"]) }).strict();

export const pricingInputSchema = z
  .object({
    quantity: z.number().int().positive().max(100_000_000),
    costs: z
      .object(Object.fromEntries(COST_CATEGORIES.map((c) => [c, costLine])) as Record<(typeof COST_CATEGORIES)[number], typeof costLine>)
      .strict(),
    targetRetailMarginPct: pct,
    targetWholesaleMarginPct: pct,
    retailFees: z.object({ percentFee: pct, fixedFeePerSale: money }).strict(),
    actualRetailPrice: money.nullable().optional(),
  })
  .strict();

export type PricingInputSchema = z.infer<typeof pricingInputSchema>;

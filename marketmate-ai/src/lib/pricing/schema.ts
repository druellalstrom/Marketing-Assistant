import { z } from "zod";

/** Validation for calculator inputs arriving from the browser (used by the save action). */
const money = z.number().finite().min(0).max(1_000_000_000);
const pct = z.number().finite().min(0).lt(100);

export const pricingInputSchema = z
  .object({
    materialCostPerBatch: money,
    laborHoursPerBatch: z.number().finite().min(0).max(100_000),
    laborRatePerHour: money,
    otherCostPerBatch: money,
    unitsPerBatch: z.number().finite().gt(0).max(10_000_000),
    packagingCostPerUnit: money,
    monthlyFixedCosts: money,
    targetRetailMarginPct: pct,
    targetWholesaleMarginPct: pct,
    retailFees: z.object({ percentFee: pct, fixedFeePerSale: money }).strict(),
    actualRetailPrice: money.nullable().optional(),
  })
  .strict();

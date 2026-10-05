import { describe, expect, it } from "vitest";
import { runSmartCalculator, exampleSmartInput, emptySmartInput } from "./smart";
import { pricingRowView, smartFromV1, smartInputSchema, summarize } from "./smart-schema";

describe("smartInputSchema", () => {
  it("accepts the example and an empty form", () => {
    expect(smartInputSchema.safeParse(exampleSmartInput()).success).toBe(true);
    expect(smartInputSchema.safeParse(emptySmartInput("USD")).success).toBe(true);
  });
  it("rejects unknown currencies, negative money and oversized lists", () => {
    const bad = exampleSmartInput();
    expect(smartInputSchema.safeParse({ ...bad, currency: "XYZ" }).success).toBe(false);
    expect(smartInputSchema.safeParse({ ...bad, product: { ...bad.product, amountPaid: -1 } }).success).toBe(false);
    expect(smartInputSchema.safeParse({ ...bad, costs: Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, name: "x", amount: 1, currency: "BBD", appliesTo: "batch" })) }).success).toBe(false);
  });
});

describe("summaries", () => {
  it("summarizes the main selling unit for lists and the dashboard", () => {
    const out = runSmartCalculator(exampleSmartInput());
    if (!out.ok) throw new Error("example should calculate");
    const s = summarize(out.result);
    expect(s).toMatchObject({ version: 2, currency: "BBD", one: "bag", available: 25, cost: 1, price: 2, profit: 1, revenue: 50, totalSpent: 25, totalProfit: 25 });
    expect(pricingRowView({ results: s, cost_per_unit: 1, suggested_retail_price: 2 })).toMatchObject({ currency: "BBD", price: 2, totalProfit: 25 });
  });
  it("shows old calculations without a currency guess beyond the fallback", () => {
    expect(pricingRowView({ results: { production: {} }, cost_per_unit: "6.5", suggested_retail_price: "21.67" }, "USD")).toEqual({
      currency: "USD", emoji: "📦", one: "item", cost: 6.5, price: 21.67, profit: 21.67 - 6.5, totalProfit: null, available: null,
    });
  });
});

describe("smartFromV1", () => {
  it("opens an old calculation with the same costs and margin", () => {
    const v1 = {
      quantity: 100,
      costs: {
        materials: { amount: 300, basis: "total" as const },
        packaging: { amount: 0.5, basis: "per_unit" as const },
        labor: { amount: 200, basis: "total" as const },
        transportation: { amount: 30, basis: "total" as const },
        electricity: { amount: 20, basis: "total" as const },
        marketing: { amount: 50, basis: "total" as const },
        other: { amount: 0, basis: "total" as const },
      },
      targetRetailMarginPct: 70,
      targetWholesaleMarginPct: 40,
      retailFees: { percentFee: 0, fixedFeePerSale: 0 },
      actualRetailPrice: null,
    };
    const input = smartFromV1("Lavender candle", v1, "BBD");
    expect(smartInputSchema.safeParse(input).success).toBe(true);
    const out = runSmartCalculator(input);
    if (!out.ok) throw new Error(out.issues[0].message);
    expect(out.result.costPerUnit).toBe(6.5); // same as the old calculator
    expect(out.result.items!.price).toBe(21.67); // 6.50 ÷ 0.30, rounded up
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("./business", () => ({ getBrandKit: vi.fn(), getPrimaryBusiness: vi.fn() }));
const { pricingSummary } = await import("./dashboard");

const v2 = (currency: string, totalProfit: number) => ({ version: 2, currency, category: "food", one: "meal", many: "meals", available: 30, cost: 4.5, price: 8, profit: 3.5, revenue: 240, totalSpent: 135, totalProfit, packages: [] });

describe("pricingSummary", () => {
  it("totals potential profit per currency and never mixes currencies", () => {
    const s = pricingSummary([
      { id: "1", product_name: "Meals", results: v2("BBD", 105), cost_per_unit: 4.5, suggested_retail_price: 8 },
      { id: "2", product_name: "Shirts", results: v2("BBD", 240), cost_per_unit: 18, suggested_retail_price: 30 },
      { id: "3", product_name: "Online", results: v2("USD", 50), cost_per_unit: 1, suggested_retail_price: 2 },
      { id: "4", product_name: "Old", results: { production: {} }, cost_per_unit: 6.5, suggested_retail_price: 21.67 },
    ]);
    expect(s.potentialProfit).toEqual([{ currency: "BBD", amount: 345, products: 2 }, { currency: "USD", amount: 50, products: 1 }]);
    expect(s.latest.map((x) => x.name)).toEqual(["Meals", "Shirts", "Online"]);
  });
});

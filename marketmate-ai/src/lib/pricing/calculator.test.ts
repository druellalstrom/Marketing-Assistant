import { describe, expect, it } from "vitest";
import {
  breakEven,
  calculateProductionCost,
  marginToMarkup,
  markupPercent,
  markupToMargin,
  PricingInputError,
  priceForMarkup,
  priceForTargetMargin,
  profitMarginPercent,
  roundMoney,
  runPricingCalculator,
  unitEconomics,
  type PricingCalculatorInput,
  type ProductionCosts,
} from "./calculator";

// Worked example used across tests (verified by hand):
//   100 candles. Materials $300 (total) → $3.00/unit. Packaging $0.50/unit → $50 total.
//   Labour $200, transport $30, electricity $20, marketing $50, other $0 (all totals).
//   Total production cost = 300 + 50 + 200 + 30 + 20 + 50 = $650 → $6.50 per unit.
const candleCosts: ProductionCosts = {
  materials: { amount: 300, basis: "total" },
  packaging: { amount: 0.5, basis: "per_unit" },
  labor: { amount: 200, basis: "total" },
  transportation: { amount: 30, basis: "total" },
  electricity: { amount: 20, basis: "total" },
  marketing: { amount: 50, basis: "total" },
  other: { amount: 0, basis: "total" },
};

describe("roundMoney", () => {
  it("rounds half away from zero despite float noise", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(10)).toBe(10);
  });
});

describe("calculateProductionCost", () => {
  it("splits bulk costs per unit ($300 of materials over 100 units = $3)", () => {
    const r = calculateProductionCost(100, candleCosts);
    const line = (c: string) => r.lines.find((l) => l.category === c)!;
    expect(line("materials")).toMatchObject({ total: 300, perUnit: 3 });
    expect(line("packaging")).toMatchObject({ total: 50, perUnit: 0.5 });
    expect(line("labor").perUnit).toBeCloseTo(2, 10);
    expect(r.totalProductionCost).toBeCloseTo(650, 10);
    expect(r.costPerUnit).toBeCloseTo(6.5, 10);
    // Per-unit lines must add up to cost per unit.
    expect(r.lines.reduce((s, l) => s + l.perUnit, 0)).toBeCloseTo(r.costPerUnit, 10);
  });

  it("rejects zero, fractional or negative quantities and bad amounts", () => {
    expect(() => calculateProductionCost(0, candleCosts)).toThrow("Quantity produced must be greater than zero.");
    expect(() => calculateProductionCost(2.5, candleCosts)).toThrow(/whole number/);
    expect(() => calculateProductionCost(-5, candleCosts)).toThrow(/cannot be negative/);
    expect(() =>
      calculateProductionCost(100, { ...candleCosts, materials: { amount: -1, basis: "total" } }),
    ).toThrow("Material costs cannot be negative.");
    expect(() =>
      calculateProductionCost(100, { ...candleCosts, labor: { amount: Number.NaN, basis: "total" } }),
    ).toThrow("Labour costs must be a number.");
    expect(() =>
      calculateProductionCost(100, { ...candleCosts, other: { amount: Infinity, basis: "total" } }),
    ).toThrow(PricingInputError);
  });
});

describe("margin and markup", () => {
  it("computes margin and markup from price and cost", () => {
    expect(profitMarginPercent(10, 5)).toBeCloseTo(50, 10);
    expect(markupPercent(10, 5)).toBeCloseTo(100, 10);
    expect(profitMarginPercent(20, 15)).toBeCloseTo(25, 10);
    expect(markupPercent(20, 15)).toBeCloseTo(33.3333333, 6);
  });

  it("returns null where the ratio is undefined", () => {
    expect(profitMarginPercent(0, 5)).toBeNull();
    expect(markupPercent(10, 0)).toBeNull();
  });

  it("reports negative margin when selling below cost", () => {
    expect(profitMarginPercent(4, 5)).toBeCloseTo(-25, 10);
    expect(markupPercent(4, 5)).toBeCloseTo(-20, 10);
  });

  it("converts between margin and markup in both directions", () => {
    expect(marginToMarkup(50)).toBeCloseTo(100, 10);
    expect(marginToMarkup(25)).toBeCloseTo(33.3333333, 6);
    expect(markupToMargin(100)).toBeCloseTo(50, 10);
    expect(markupToMargin(300)).toBeCloseTo(75, 10);
    for (const m of [0, 10, 37.5, 60, 99]) {
      expect(markupToMargin(marginToMarkup(m))).toBeCloseTo(m, 8);
    }
    expect(() => marginToMarkup(100)).toThrow(/less than 100%/);
  });
});

describe("priceForTargetMargin", () => {
  it("hits the margin exactly with no fees", () => {
    expect(priceForTargetMargin(5, 50)).toBeCloseTo(10, 10);
    expect(priceForTargetMargin(6, 40)).toBeCloseTo(10, 10);
  });

  it("accounts for percentage and fixed fees", () => {
    // (5 + 0.30) / (1 − 0.60 − 0.03) = 5.30 / 0.37
    const price = priceForTargetMargin(5, 60, { percentFee: 3, fixedFeePerSale: 0.3 });
    expect(price).toBeCloseTo(14.3243243, 6);
    const econ = unitEconomics(price, 5, { percentFee: 3, fixedFeePerSale: 0.3 });
    expect(econ.profitMarginPct).toBeCloseTo(60, 8);
  });

  it("refuses impossible targets", () => {
    expect(() => priceForTargetMargin(5, 98, { percentFee: 3, fixedFeePerSale: 0 })).toThrow(
      /no price can achieve/,
    );
    expect(() => priceForTargetMargin(5, 100)).toThrow(PricingInputError);
  });
});

describe("priceForMarkup", () => {
  it("adds markup on top of cost", () => {
    expect(priceForMarkup(5, 100)).toBeCloseTo(10, 10);
    expect(priceForMarkup(8, 150)).toBeCloseTo(20, 10);
    expect(priceForMarkup(8, 0)).toBe(8);
  });
});

describe("unitEconomics", () => {
  it("computes fees, profit, margin and markup", () => {
    // $20 price, 2.9% + $0.30 fees = 0.58 + 0.30 = 0.88; profit = 20 − 0.88 − 5 = 14.12
    const e = unitEconomics(20, 5, { percentFee: 2.9, fixedFeePerSale: 0.3 });
    expect(e.feesPerUnit).toBeCloseTo(0.88, 10);
    expect(e.netRevenuePerUnit).toBeCloseTo(19.12, 10);
    expect(e.profitPerUnit).toBeCloseTo(14.12, 10);
    expect(e.profitMarginPct).toBeCloseTo(70.6, 10);
    expect(e.markupPct).toBeCloseTo(300, 10);
  });
});

describe("breakEven", () => {
  it("rounds up to whole units", () => {
    // $500 fixed, $10 price, $5 cost → $5 contribution → 100 units exactly
    expect(breakEven(500, 10, 5)).toMatchObject({ units: 100, revenue: 1000, exactRevenue: 1000 });
    // $501 fixed → 100.2 → 101 units
    expect(breakEven(501, 10, 5)).toMatchObject({ units: 101, revenue: 1010 });
  });

  it("does not over-round due to float noise", () => {
    // contribution = 1/3; 100 / (1/3) is 300.00000000000006 in floats — must be 300, not 301
    expect(breakEven(100, 1 / 3 + 1, 1).units).toBe(300);
  });

  it("includes fees in contribution", () => {
    // price 10, 10% fee → net 9, cost 5 → contribution 4 → 1000/4 = 250
    expect(breakEven(1000, 10, 5, { percentFee: 10, fixedFeePerSale: 0 }).units).toBe(250);
  });

  it("returns null when every sale loses or breaks even", () => {
    const loss = breakEven(500, 4, 5);
    expect(loss.units).toBeNull();
    expect(loss.revenue).toBeNull();
    expect(loss.reason).toMatch(/loses money/);
    expect(breakEven(500, 5, 5).reason).toMatch(/only covers its own cost/);
  });

  it("is zero with no fixed costs and a non-negative contribution", () => {
    expect(breakEven(0, 10, 5)).toMatchObject({ units: 0, revenue: 0 });
  });
});

describe("runPricingCalculator", () => {
  const input: PricingCalculatorInput = {
    quantity: 100,
    costs: candleCosts,
    targetRetailMarginPct: 75,
    targetWholesaleMarginPct: 50,
    retailFees: { percentFee: 0, fixedFeePerSale: 0 },
    actualRetailPrice: null,
  };

  it("produces a consistent end-to-end result", () => {
    const r = runPricingCalculator(input);
    expect(r.production.totalProductionCost).toBeCloseTo(650, 10);
    expect(r.production.costPerUnit).toBeCloseTo(6.5, 10);

    // Retail at 75% margin: 6.50 / 0.25 = $26.00, profit $19.50, markup 300%.
    expect(r.retail.price).toBeCloseTo(26, 10);
    expect(r.retail.profitPerUnit).toBeCloseTo(19.5, 10);
    expect(r.retail.profitMarginPct).toBeCloseTo(75, 10);
    expect(r.retail.markupPct).toBeCloseTo(300, 10);
    expect(r.retail.totalPotentialProfit).toBeCloseTo(1950, 8);
    expect(r.retail.totalPotentialRevenue).toBeCloseTo(2600, 8);
    // Break-even: $650 / $26 = 25 units → $650 revenue.
    expect(r.retail.breakEven).toMatchObject({ units: 25, revenue: 650 });

    // Wholesale at 50% margin: $13.00, profit $6.50, markup 100%.
    expect(r.wholesale.price).toBeCloseTo(13, 10);
    expect(r.wholesale.profitPerUnit).toBeCloseTo(6.5, 10);
    expect(r.wholesale.markupPct).toBeCloseTo(100, 10);
    expect(r.wholesale.totalPotentialProfit).toBeCloseTo(650, 8);
    expect(r.wholesale.breakEven).toMatchObject({ units: 50, revenue: 650 });

    expect(r.actual).toBeNull();
    expect(r.warnings).toHaveLength(0); // wholesale is exactly half of retail
  });

  it("includes sales fees in the retail price and break-even", () => {
    // (6.50 + 0.30) / (1 − 0.60 − 0.03) = 6.80 / 0.37 = 18.3784
    const r = runPricingCalculator({
      ...input,
      targetRetailMarginPct: 60,
      retailFees: { percentFee: 3, fixedFeePerSale: 0.3 },
    });
    expect(roundMoney(r.retail.price)).toBe(18.38);
    expect(r.retail.profitMarginPct).toBeCloseTo(60, 8);
    // Net per sale = 18.3784 − 0.5514 − 0.30 = 17.527 → 650 / 17.527 = 37.09 → 38 units
    expect(r.retail.breakEven.units).toBe(38);
    // Wholesale $13 is ~71% of retail → stockist warning.
    expect(r.warnings.some((w) => w.includes("more than 60% of retail"))).toBe(true);
  });

  it("evaluates the user's own price", () => {
    const r = runPricingCalculator({ ...input, actualRetailPrice: 20 });
    expect(r.actual?.profitPerUnit).toBeCloseTo(13.5, 10);
    expect(r.actual?.profitMarginPct).toBeCloseTo(67.5, 10);
    expect(r.actual?.breakEven.units).toBe(33); // 650 / 20 = 32.5 → 33
  });

  it("warns when the user's price loses money or can't recover the run", () => {
    const loss = runPricingCalculator({ ...input, actualRetailPrice: 5 });
    expect(loss.actual?.profitPerUnit).toBeCloseTo(-1.5, 10);
    expect(loss.warnings.some((w) => w.includes("every sale loses money"))).toBe(true);
    // $650 / $5 = 130 units > 100 produced.
    expect(loss.actual?.breakEven.units).toBe(130);
    expect(loss.warnings.some((w) => w.includes("only makes 100"))).toBe(true);
  });

  it("warns when wholesale is above retail", () => {
    const r = runPricingCalculator({ ...input, targetRetailMarginPct: 30, targetWholesaleMarginPct: 60 });
    expect(r.wholesale.price).toBeGreaterThan(r.retail.price);
    expect(r.warnings.some((w) => w.includes("higher than retail"))).toBe(true);
  });

  it("warns when labour is unpaid", () => {
    const r = runPricingCalculator({ ...input, costs: { ...candleCosts, labor: { amount: 0, basis: "total" } } });
    expect(r.warnings.some((w) => w.includes("Pay yourself"))).toBe(true);
  });

  it("points errors at the specific field", () => {
    expect(() => runPricingCalculator({ ...input, targetWholesaleMarginPct: 100 })).toThrow(
      "Target wholesale margin must be less than 100%.",
    );
    try {
      runPricingCalculator({ ...input, targetRetailMarginPct: 98, retailFees: { percentFee: 3, fixedFeePerSale: 0 } });
      expect.unreachable();
    } catch (e) {
      expect((e as PricingInputError).field).toBe("targetRetailMarginPct");
    }
    expect(() => runPricingCalculator({ ...input, actualRetailPrice: -1 })).toThrow("Price cannot be negative.");
  });
});

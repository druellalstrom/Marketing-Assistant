import { describe, expect, it } from "vitest";
import {
  breakEven,
  calculateUnitCost,
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
} from "./calculator";

// Worked example used across tests (verified by hand):
//   materials $40 + labour 2h × $20 = $40 + other $10  → $90 per batch of 20
//   = $4.50/unit, + $0.50 packaging = $5.00 per unit.
const candleBatch = {
  materialCostPerBatch: 40,
  laborHoursPerBatch: 2,
  laborRatePerHour: 20,
  otherCostPerBatch: 10,
  unitsPerBatch: 20,
  packagingCostPerUnit: 0.5,
};

describe("roundMoney", () => {
  it("rounds half away from zero despite float noise", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(10)).toBe(10);
  });
});

describe("calculateUnitCost", () => {
  it("computes the per-unit breakdown", () => {
    const r = calculateUnitCost(candleBatch);
    expect(r.materialPerUnit).toBeCloseTo(2, 10);
    expect(r.laborPerUnit).toBeCloseTo(2, 10);
    expect(r.otherPerUnit).toBeCloseTo(0.5, 10);
    expect(r.packagingPerUnit).toBe(0.5);
    expect(r.costPerUnit).toBeCloseTo(5, 10);
    expect(r.totalBatchCost).toBeCloseTo(100, 10);
    // Batch total and per-unit cost must agree.
    expect(r.totalBatchCost / candleBatch.unitsPerBatch).toBeCloseTo(r.costPerUnit, 10);
  });

  it("rejects zero units, negatives and NaN", () => {
    expect(() => calculateUnitCost({ ...candleBatch, unitsPerBatch: 0 })).toThrow(PricingInputError);
    expect(() => calculateUnitCost({ ...candleBatch, materialCostPerBatch: -1 })).toThrow(
      /cannot be negative/,
    );
    expect(() => calculateUnitCost({ ...candleBatch, laborRatePerHour: Number.NaN })).toThrow(
      /must be a number/,
    );
    expect(() => calculateUnitCost({ ...candleBatch, otherCostPerBatch: Infinity })).toThrow(
      PricingInputError,
    );
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
    ...candleBatch,
    monthlyFixedCosts: 500,
    targetRetailMarginPct: 60,
    targetWholesaleMarginPct: 50,
    retailFees: { percentFee: 3, fixedFeePerSale: 0.3 },
    actualRetailPrice: 12,
  };

  it("produces a consistent end-to-end result", () => {
    const r = runPricingCalculator(input);
    expect(r.unitCost.costPerUnit).toBeCloseTo(5, 10);

    expect(r.suggestedWholesalePrice).toBeCloseTo(10, 10);
    expect(r.wholesale.profitPerUnit).toBeCloseTo(5, 10);
    expect(r.wholesale.profitMarginPct).toBeCloseTo(50, 10);
    expect(r.wholesale.markupPct).toBeCloseTo(100, 10);
    expect(r.breakEvenWholesale.units).toBe(100);

    expect(roundMoney(r.suggestedRetailPrice)).toBe(14.32);
    expect(r.retail.profitMarginPct).toBeCloseTo(60, 8);
    // contribution = 0.6 × 14.3243… = 8.5946… → 500 / 8.5946 = 58.18 → 59 units
    expect(r.breakEvenRetail.units).toBe(59);

    // Actual $12: fees 0.36 + 0.30 = 0.66 → profit 12 − 0.66 − 5 = 6.34
    expect(r.actual?.profitPerUnit).toBeCloseTo(6.34, 10);
    expect(r.breakEvenActual?.units).toBe(79); // 500 / 6.34 = 78.86 → 79
    // Wholesale $10 is ~70% of retail $14.32 — stockists can't double it, so we warn.
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/more than 60% of retail/);
  });

  it("gives no warnings for a healthy keystone setup", () => {
    // 75% retail margin with no fees → $20 retail; 50% wholesale → $10 = exactly half.
    const r = runPricingCalculator({
      ...input,
      targetRetailMarginPct: 75,
      retailFees: { percentFee: 0, fixedFeePerSale: 0 },
    });
    expect(r.suggestedRetailPrice).toBeCloseTo(20, 10);
    expect(r.warnings).toHaveLength(0);
  });

  it("warns when the current price loses money", () => {
    const r = runPricingCalculator({ ...input, actualRetailPrice: 4 });
    expect(r.actual?.profitPerUnit).toBeLessThan(0);
    expect(r.breakEvenActual?.units).toBeNull();
    expect(r.warnings.some((w) => w.includes("loses money"))).toBe(true);
  });

  it("warns when wholesale margin exceeds retail margin", () => {
    const r = runPricingCalculator({
      ...input,
      targetRetailMarginPct: 30,
      targetWholesaleMarginPct: 60,
    });
    expect(r.suggestedWholesalePrice).toBeGreaterThan(r.suggestedRetailPrice);
    expect(r.warnings.some((w) => w.includes("higher than retail"))).toBe(true);
  });

  it("warns when labour is unpaid", () => {
    const r = runPricingCalculator({ ...input, laborRatePerHour: 0 });
    expect(r.warnings.some((w) => w.includes("Pay yourself"))).toBe(true);
  });

  it("omits actual-price results when none is supplied", () => {
    const r = runPricingCalculator({ ...input, actualRetailPrice: null });
    expect(r.actual).toBeNull();
    expect(r.breakEvenActual).toBeNull();
  });
});

describe("input errors", () => {
  it("name the field in plain language and expose the field key", () => {
    try {
      calculateUnitCost({ ...candleBatch, unitsPerBatch: 0 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(PricingInputError);
      expect((e as PricingInputError).field).toBe("unitsPerBatch");
      expect((e as Error).message).toBe("Units per batch must be greater than zero.");
    }
  });
});

describe("runPricingCalculator errors", () => {
  const base: PricingCalculatorInput = {
    ...candleBatch,
    monthlyFixedCosts: 0,
    targetRetailMarginPct: 60,
    targetWholesaleMarginPct: 50,
    retailFees: { percentFee: 3, fixedFeePerSale: 0 },
  };
  it("points at the specific margin field", () => {
    expect(() => runPricingCalculator({ ...base, targetWholesaleMarginPct: 100 })).toThrow(
      "Target wholesale margin must be less than 100%.",
    );
    try {
      runPricingCalculator({ ...base, targetRetailMarginPct: 98 });
    } catch (e) {
      expect((e as PricingInputError).field).toBe("targetRetailMarginPct");
    }
  });
});

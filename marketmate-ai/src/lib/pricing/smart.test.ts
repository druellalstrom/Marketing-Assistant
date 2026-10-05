import { describe, expect, it } from "vitest";
import {
  calculateBreakEven,
  calculateCostPerPackage,
  calculateCostPerUnit,
  calculateDiscountPrice,
  calculateMarkup,
  calculatePackages,
  calculateProfit,
  calculateProfitMargin,
  calculateSellingPrice,
  calculateTotalCost,
  calculateWholesalePrice,
  emptySmartInput,
  exampleSmartInput,
  previewCosts,
  runSmartCalculator,
  suggestRoundedPrices,
  type SmartInput,
  type SmartResult,
} from "./smart";
import { convertCurrency, convertMeasurement, fixedRate, formatMoney, MeasurementError } from "./money";
import { pluralize } from "./categories";

/** Builds an input from the empty defaults plus overrides. */
type Overrides = Partial<Omit<SmartInput, "product" | "pricing">> & { product?: Partial<SmartInput["product"]>; pricing?: Partial<SmartInput["pricing"]> };
function input(over: Overrides): SmartInput {
  const base = emptySmartInput(over.currency ?? "BBD");
  return {
    ...base,
    ...over,
    product: { ...base.product, ...(over.product ?? {}) },
    pricing: { ...base.pricing, ...(over.pricing ?? {}) },
  };
}
const cost = (name: string, amount: number | null, appliesTo: "batch" | "item" | "package" = "batch", currency = "BBD") => ({ id: name, name, amount, currency, appliesTo });

function ok(i: SmartInput): SmartResult {
  const out = runSmartCalculator(i);
  if (!out.ok) throw new Error(`Expected a result, got: ${out.issues.map((x) => x.message).join(" | ")}`);
  return out.result;
}
function issues(i: SmartInput): string[] {
  const out = runSmartCalculator(i);
  if (out.ok) throw new Error("Expected issues");
  return out.issues.map((x) => x.message);
}
/** Nothing the user sees may contain NaN, Infinity or undefined. */
function expectClean(r: SmartResult) {
  const text = JSON.stringify(r) + r.steps.join(" ") + r.warnings.join(" ");
  expect(text).not.toMatch(/NaN|Infinity|undefined/);
}

describe("formulas", () => {
  it("adds costs and ignores blanks", () => {
    expect(calculateTotalCost([200, 20, 15, 10])).toBe(245);
    expect(calculateTotalCost([200, Number.NaN, 5])).toBe(205);
  });
  it("cost per unit, packages, cost per package", () => {
    expect(calculateCostPerUnit(200, 20)).toBe(10);
    expect(calculateCostPerUnit(200, 20, 0.5)).toBe(10.5);
    expect(() => calculateCostPerUnit(200, 0)).toThrow();
    expect(calculatePackages(100, 4)).toEqual({ packages: 25, leftover: 0 });
    expect(calculatePackages(102, 4)).toEqual({ packages: 25, leftover: 2 });
    expect(calculatePackages(5000, 250)).toEqual({ packages: 20, leftover: 0 });
    expect(calculatePackages(10000, 500)).toEqual({ packages: 20, leftover: 0 });
    expect(calculatePackages(1, 0.1)).toEqual({ packages: 10, leftover: 0 }); // float-safe
    expect(() => calculatePackages(10, 0)).toThrow();
    expect(calculateCostPerPackage(0.25, 4)).toBe(1);
    expect(calculateCostPerPackage(0.25, 4, 0.1)).toBeCloseTo(1.1, 10);
  });
  it("three pricing methods", () => {
    expect(calculateSellingPrice(10, "profit_amount", 5)).toBe(15);
    expect(calculateSellingPrice(10, "markup", 50)).toBe(15);
    expect(calculateSellingPrice(10, "margin", 40)).toBe(16.67);
    expect(calculateSellingPrice(10, "margin", 100)).toBeNull();
  });
  it("prices include selling fees so the profit target is still met", () => {
    const fees = { percent: 3, fixed: 0.3 };
    const price = calculateSellingPrice(10, "profit_amount", 5, fees)!;
    expect(price).toBe(15.78); // (10 + 5 + 0.30) ÷ 0.97 = 15.773… → rounded up
    expect(calculateProfit(price, 10, fees)).toBeGreaterThanOrEqual(5);
    expect(calculateSellingPrice(10, "margin", 98, fees)).toBeNull();
  });
  it("profit, margin, markup", () => {
    expect(calculateProfit(20, 12.25)).toBe(7.75);
    expect(calculateProfitMargin(7.75, 20)).toBeCloseTo(38.75, 10);
    expect(calculateMarkup(5, 10)).toBe(50);
    expect(calculateProfitMargin(0, 0)).toBeNull();
    expect(calculateMarkup(5, 0)).toBeNull();
  });
  it("break-even", () => {
    expect(calculateBreakEven(500, 10)).toEqual({ units: 50, revenueNeeded: 500 });
    expect(calculateBreakEven(245, 20).units).toBe(13); // 12.25 → 13
    expect(calculateBreakEven(100, 0).units).toBeNull();
    expect(calculateBreakEven(0, 5).units).toBe(0);
  });
  it("discounts and wholesale", () => {
    expect(calculateDiscountPrice(20, 10)).toBe(18);
    expect(calculateDiscountPrice(20, 25)).toBe(15);
    expect(calculateDiscountPrice(20, 50)).toBe(10);
    expect(calculateWholesalePrice(20, 25)).toBe(15);
  });
  it("customer-friendly rounding suggestions", () => {
    expect(suggestRoundedPrices(19.73)).toEqual([19.99, 20, 21]);
    expect(suggestRoundedPrices(2)).toEqual([2, 2.5, 3]);
    expect(suggestRoundedPrices(1.1)).toEqual([1.25, 1.5, 2]);
    expect(suggestRoundedPrices(0)).toEqual([]);
  });
  it("measurement conversions", () => {
    expect(convertMeasurement(5, "kg", "g")).toBe(5000);
    expect(convertMeasurement(10, "l", "ml")).toBe(10000);
    expect(convertMeasurement(1, "lb", "oz")).toBeCloseTo(16, 10);
    expect(convertMeasurement(1, "yd", "m")).toBeCloseTo(0.9144, 10);
    expect(() => convertMeasurement(1, "kg", "l")).toThrow(MeasurementError);
    expect(() => convertMeasurement(1, "pieces", "bags")).toThrow(MeasurementError);
  });
  it("currency: formatting, fixed pegs, user rates only", () => {
    expect(formatMoney(25, "BBD")).toBe("BBD $25.00");
    expect(formatMoney(25, "USD")).toBe("USD $25.00");
    expect(formatMoney(25, "GBP")).toBe("GBP £25.00");
    expect(formatMoney(25, "EUR")).toBe("EUR €25.00");
    expect(formatMoney(1234.5, "BBD")).toBe("BBD $1,234.50");
    expect(formatMoney(-2, "BBD")).toBe("BBD -$2.00");
    expect(formatMoney(0.004, "BBD")).toBe("BBD $0.004");
    expect(formatMoney(Number.NaN, "BBD")).toBe("—");
    expect(fixedRate("USD", "BBD")).toBe(2);
    expect(fixedRate("BBD", "XCD")).toBeCloseTo(1.35, 10);
    expect(fixedRate("CAD", "BBD")).toBeNull();
    expect(convertCurrency(100, "USD", "BBD", { USD: 2 })).toBe(200);
    expect(() => convertCurrency(100, "USD", "BBD", {})).toThrow(/exchange rate/);
  });
  it("plurals", () => {
    expect(pluralize("worm")).toBe("worms");
    expect(pluralize("box")).toBe("boxes");
    expect(pluralize("berry")).toBe("berries");
    expect(pluralize("bag", 1)).toBe("bag");
  });
});

describe("scenario 1: clothing", () => {
  it("20 shirts for $200: 'You paid $10.00 for each'", () => {
    const r = ok(input({ category: "clothing", product: { name: "Women's T-Shirts", itemName: "T-shirt", quantity: 20, unit: "pieces", amountPaid: 200 }, pricing: { itemAmount: 5 } }));
    expect(r.costPerUnit).toBe(10);
    expect(r.purchaseEach).toBe(10);
    expect(r.steps).toContain("BBD $200.00 ÷ 20 = BBD $10.00 for each T-shirt.");
    expectClean(r);
  });

  it("20 shirts $300 + shipping $40 + packaging $20, $12 profit → sell for $30", () => {
    const r = ok(input({
      category: "clothing",
      product: { name: "Shirts", itemName: "shirt", quantity: 20, unit: "pieces", amountPaid: 300 },
      costs: [cost("Shipping", 40), cost("Packaging", 20)],
      pricing: { method: "profit_amount", itemAmount: 12 },
    }));
    expect(r.batchCost).toBe(360);
    expect(r.costPerUnit).toBe(18);
    const i = r.items!;
    expect(i.price).toBe(30);
    expect(i.profit).toBe(12);
    expect(i.sellAll).toEqual({ revenue: 600, totalCost: 360, profit: 240 });
    expectClean(r);
  });

  it("$245 of costs, sell for a chosen $20 → $7.75 profit, 38.75% margin", () => {
    const r = ok(input({
      category: "clothing",
      product: { name: "T-Shirts", itemName: "T-shirt", quantity: 20, unit: "pieces", amountPaid: 200 },
      costs: [cost("Packaging", 20), cost("Transportation", 15), cost("Labels", 10)],
      pricing: { method: "profit_amount", itemAmount: 7.5 },
      chosenPrices: { item: 20 },
    }));
    expect(r.costPerUnit).toBe(12.25);
    const i = r.items!;
    expect(i.calculatedPrice).toBe(19.75);
    expect(i.price).toBe(20);
    expect(i.priceChosen).toBe(true);
    expect(i.profit).toBe(7.75);
    expect(i.marginPct).toBeCloseTo(38.75, 10);
    expect(i.sellAll).toEqual({ revenue: 400, totalCost: 245, profit: 155 });
    expect(i.breakEven.units).toBe(13);
    expect(r.steps.join(" ")).toContain("You chose to charge BBD $20.00 instead of the calculated BBD $19.75.");
  });
});

describe("scenario 2: food", () => {
  it("30 meals from $135 of costs, $3.50 profit → $8", () => {
    const r = ok(input({
      category: "food",
      product: { name: "Chicken", itemName: "meal", quantity: 30, unit: "portions", amountPaid: 60 },
      costs: [cost("Rice", 30), cost("Vegetables", 20), cost("Containers", 15), cost("Gas", 10)],
      pricing: { itemAmount: 3.5 },
    }));
    expect(r.batchCost).toBe(135);
    expect(r.costPerUnit).toBe(4.5);
    expect(r.items!.price).toBe(8);
    expect(r.items!.sellAll).toEqual({ revenue: 240, totalCost: 135, profit: 105 });
    expectClean(r);
  });
});

describe("scenario 3: packages", () => {
  it("100 worms, 4 per bag, $25 total, $1 profit per bag → 25 bags at $2", () => {
    const r = ok(exampleSmartInput());
    const bag = r.packages[0];
    expect(r.items).toBeNull();
    expect(bag.available).toBe(25);
    expect(bag.cost).toBe(1);
    expect(bag.price).toBe(2);
    expect(bag.profit).toBe(1);
    expect(bag.sellAll).toEqual({ revenue: 50, totalCost: 25, profit: 25 });
    expect(bag.leftoverLabel).toBeNull();
    expect(r.steps).toEqual(expect.arrayContaining([
      "You spent BBD $20.00 on Fishing worms, BBD $5.00 on Packaging. That adds up to BBD $25.00.",
      "You have 100 worms.",
      "BBD $25.00 ÷ 100 = BBD $0.25 for each worm.",
      "You put 4 worms in each bag. 100 ÷ 4 = 25 bags.",
      "4 worms × BBD $0.25 = BBD $1.00, so each bag costs you BBD $1.00.",
      "You chose a BBD $1.00 profit. BBD $1.00 cost + BBD $1.00 profit = BBD $2.00 for each bag.",
    ]));
    expectClean(r);
  });

  it("leftovers and a cost for each bag", () => {
    const r = ok(input({
      product: { itemName: "worm", quantity: 102, unit: "items", amountPaid: 25.5 },
      costs: [cost("Bags", 0.1, "package")],
      sellAs: "packages",
      packages: [{ id: "b", name: "bag", size: 4, unit: "items", profitAmount: 1 }],
    }));
    const bag = r.packages[0];
    expect(bag.available).toBe(25);
    expect(bag.leftoverLabel).toBe("2 worms");
    expect(bag.cost).toBeCloseTo(4 * 0.25 + 0.1, 10); // 25.50 ÷ 102 = 0.25 each
    expect(bag.sellAll.totalCost).toBeCloseTo(25.5 + 2.5, 10);
    expect(r.warnings).toContain("2 worms will be left over after making 25 bags.");
  });

  it("both: single items and packages, several package sizes", () => {
    const r = ok(input({
      product: { itemName: "soap", quantity: 60, unit: "items", amountPaid: 90 },
      sellAs: "both",
      packages: [
        { id: "p3", name: "gift set", size: 3, unit: "items", profitAmount: 6 },
        { id: "p6", name: "box", size: 6, unit: "items", profitAmount: 10 },
      ],
      pricing: { itemAmount: 2.5 },
    }));
    expect(r.items!.price).toBe(4); // 1.50 + 2.50
    expect(r.packages.map((p) => [p.available, p.cost, p.price])).toEqual([[20, 4.5, 10.5], [10, 9, 19]]);
  });
});

describe("scenario 4: liquid", () => {
  it("5 L with 250 ml bottles → 20 bottles", () => {
    const r = ok(input({ category: "skincare", product: { quantity: 5, unit: "l", amountPaid: 40 }, sellAs: "packages", packages: [{ id: "b", name: "bottle", size: 250, unit: "ml", profitAmount: 2 }] }));
    expect(r.packages[0].available).toBe(20);
    expect(r.packages[0].cost).toBe(2);
  });
  it("10 L of juice, 500 ml bottles, $40, 50% margin → $2 cost, $4 price", () => {
    const r = ok(input({ category: "food", product: { name: "Juice", quantity: 10, unit: "l", amountPaid: 40 }, sellAs: "packages", packages: [{ id: "b", name: "bottle", size: 500, unit: "ml", profitAmount: null }], pricing: { method: "margin", percent: 50 } }));
    const b = r.packages[0];
    expect(b.available).toBe(20);
    expect(b.cost).toBe(2);
    expect(b.price).toBe(4);
    expect(b.marginPct).toBe(50);
    expect(r.steps).toContain("Each bottle holds 500 ml. 10 L makes 20 bottles.");
    expectClean(r);
  });
});

describe("scenario 5: weight", () => {
  it("5 kg with 250 g per package → 20 packages, no manual conversion", () => {
    const r = ok(input({ product: { quantity: 5, unit: "kg", amountPaid: 50 }, sellAs: "packages", packages: [{ id: "p", name: "package", size: 250, unit: "g", profitAmount: 1.5 }] }));
    expect(r.packages[0].available).toBe(20);
    expect(r.packages[0].cost).toBe(2.5);
    expect(r.packages[0].price).toBe(4);
    expect(r.costPerUnit).toBe(10); // per kg
  });
  it("selling by weight: price per kg", () => {
    const r = ok(input({ product: { quantity: 2.5, unit: "kg", amountPaid: 25 }, pricing: { method: "markup", percent: 100 } }));
    expect(r.items!.one).toBe("kilogram");
    expect(r.items!.cost).toBe(10);
    expect(r.items!.price).toBe(20);
    expect(r.items!.sellAll.revenue).toBe(50);
  });
});

describe("scenario 6: wholesale", () => {
  it("cost $10, retail $20, wholesale $15, minimum 10", () => {
    const r = ok(input({
      category: "wholesale",
      product: { quantity: 100, unit: "units", amountPaid: 1000 },
      pricing: { itemAmount: 10 },
      wholesale: { enabled: true, mode: "price", price: 15, discountPct: null, minOrder: 10 },
    }));
    expect(r.items!.price).toBe(20);
    expect(r.items!.profit).toBe(10);
    expect(r.wholesale).toMatchObject({ price: 15, profit: 5, minOrder: 10, orderRevenue: 150, orderProfit: 50, profitIfAllWholesale: 500, belowCost: false });
  });
  it("wholesale as a % off retail, and below-cost warning", () => {
    const r = ok(input({ product: { quantity: 10, unit: "items", amountPaid: 100 }, pricing: { itemAmount: 10 }, wholesale: { enabled: true, mode: "discount", price: null, discountPct: 60, minOrder: 5 } }));
    expect(r.wholesale!.price).toBe(8);
    expect(r.wholesale!.belowCost).toBe(true);
    expect(r.warnings.join(" ")).toContain("you'd lose BBD $2.00 on each one");
  });
});

describe("scenario 7: discounts", () => {
  it("10%, 25%, 50% off a $20 item that costs $10", () => {
    const r = ok(input({ product: { quantity: 10, unit: "items", amountPaid: 100 }, pricing: { itemAmount: 10 }, discounts: [10, 25, 50, 60] }));
    expect(r.discounts.map((d) => [d.pct, d.price, d.profit, d.belowCost])).toEqual([
      [10, 18, 8, false],
      [25, 15, 5, false],
      [50, 10, 0, false],
      [60, 8, -2, true],
    ]);
  });
});

describe("scenario 8: break-even with fixed and variable costs", () => {
  it("$500 of fixed costs, $25 price, $15 cost per item → 50 items", () => {
    const r = ok(input({ product: { quantity: 100, unit: "items", amountPaid: 1500 }, pricing: { itemAmount: 10 }, fixedCosts: 500 }));
    expect(r.items!.price).toBe(25);
    expect(r.fixedCostBreakEven).toEqual({ fixedCosts: 500, units: 50 });
  });
  it("getting back what you spent, with per-item (variable) costs", () => {
    const r = ok(input({ product: { quantity: 20, unit: "pieces", amountPaid: 200 }, costs: [cost("Labels", 0.5, "item")], pricing: { itemAmount: 9.5 } }));
    expect(r.costPerUnit).toBe(10.5);
    expect(r.items!.price).toBe(20);
    expect(r.items!.sellAll.totalCost).toBe(210);
    expect(r.items!.breakEven.units).toBe(11); // 210 ÷ 20 = 10.5 → 11
  });
  it("warns when you can't sell enough to get your money back", () => {
    const r = ok(input({ product: { quantity: 10, unit: "items", amountPaid: 100 }, pricing: { itemAmount: 0 }, chosenPrices: { item: 5 } }));
    expect(r.items!.profit).toBe(-5);
    expect(r.warnings.join(" ")).toMatch(/lose BBD \$5\.00 on every item.*need to sell 20 items, but you only have 10/);
  });
});

describe("scenario 9: multiple costs", () => {
  it("materials + packaging + labour + transport are totalled automatically", () => {
    const r = ok(input({
      category: "handmade",
      product: { name: "Material 1", quantity: 10, unit: "pieces", amountPaid: 50 },
      costs: [cost("Material 2", 25), cost("Material 3", 15), cost("Packaging", 10), cost("Labour", 20), cost("Transportation", 10), cost("Unused row", null)],
      pricing: { method: "markup", percent: 100 },
    }));
    expect(r.batchCost).toBe(130);
    expect(r.lines).toHaveLength(6);
    expect(r.costPerUnit).toBe(13);
    expect(r.items!.price).toBe(26);
  });
});

describe("scenario 10: currency", () => {
  it("BBD and USD results are labelled with their currency", () => {
    const bbd = ok(input({ product: { quantity: 10, unit: "items", amountPaid: 50 }, pricing: { itemAmount: 5 } }));
    expect(formatMoney(bbd.items!.price, bbd.currency)).toBe("BBD $10.00");
    const usd = ok(input({ currency: "USD", product: { quantity: 10, unit: "items", amountPaid: 50, paidCurrency: "USD" }, pricing: { itemAmount: 5 } }));
    expect(formatMoney(usd.items!.price, usd.currency)).toBe("USD $10.00");
  });
  it("converts a USD purchase to BBD only with a rate, and says so", () => {
    const missing = issues(input({ product: { quantity: 10, unit: "items", amountPaid: 100, paidCurrency: "USD" }, pricing: { itemAmount: 5 } }));
    expect(missing).toContain("Enter the exchange rate: 1 USD = how many BBD?");
    const r = ok(input({ rates: { USD: 2 }, product: { name: "Stock", quantity: 10, unit: "items", amountPaid: 100, paidCurrency: "USD" }, pricing: { itemAmount: 5 } }));
    expect(r.batchCost).toBe(200);
    expect(r.costPerUnit).toBe(20);
    expect(r.lines[0].conversion).toBe("USD $100.00 → BBD $200.00 (your rate: 1 USD = 2 BBD)");
    expect(r.steps[0]).toBe("Stock: you paid USD $100.00 → BBD $200.00 (your rate: 1 USD = 2 BBD).");
  });
});

describe("scenario 11: invalid input", () => {
  it("empty form explains what to enter (no errors thrown)", () => {
    const msgs = issues(emptySmartInput("BBD"));
    expect(msgs).toEqual(expect.arrayContaining(["Enter how many items you have.", "Enter how much you paid.", "Enter how much profit you'd like on each item."]));
  });
  it("zero, negative and fractional values", () => {
    expect(issues(input({ product: { quantity: 0, amountPaid: 10 }, pricing: { itemAmount: 1 } }))).toContain("The quantity must be more than 0.");
    expect(issues(input({ product: { quantity: 2.5, unit: "pieces", amountPaid: 10 }, pricing: { itemAmount: 1 } }))).toContain("The number of items must be a whole number.");
    expect(issues(input({ product: { quantity: 5, amountPaid: 10 }, costs: [cost("Gas", -3)], pricing: { itemAmount: 1 } }))).toContain("Gas can't be negative.");
    expect(issues(input({ product: { quantity: 5, amountPaid: 0 }, pricing: { itemAmount: 1 } }))).toContain("Enter what you spent. With no costs there's nothing to price.");
    expect(issues(input({ product: { quantity: 5, amountPaid: 10 }, pricing: { method: "margin", percent: 100 } }))).toContain("Your profit % plus selling fees must be under 100%. Try a smaller number.");
    expect(issues(input({ product: { quantity: 5, amountPaid: 10 }, sellAs: "packages", packages: [{ id: "p", name: "bag", size: 10, unit: "items", profitAmount: 1 }] }))).toContain("One bag needs more than you have in total. Check the bag size.");
    expect(issues(input({ product: { quantity: 5, unit: "kg", amountPaid: 10 }, sellAs: "packages", packages: [{ id: "p", name: "bottle", size: 250, unit: "ml", profitAmount: 1 }] }))[0]).toMatch(/must be in a unit like kg/);
    expect(issues(input({ product: { quantity: 5, amountPaid: 10 }, pricing: { itemAmount: 1 }, chosenPrices: { item: 0 } }))).toContain("A chosen price must be more than 0.");
  });
  it("very large quantities and tiny costs stay finite", () => {
    const r = ok(input({ product: { quantity: 1_000_000, unit: "items", amountPaid: 1500 }, pricing: { method: "markup", percent: 100 } }));
    expect(r.costPerUnit).toBe(0.0015);
    expect(r.items!.price).toBe(0.01); // rounded up to the cent
    expectClean(r);
    expect(issues(input({ product: { quantity: 1e12, amountPaid: 10 }, pricing: { itemAmount: 1 } }))).toContain("That quantity is too large to calculate. Check the number.");
  });
});

describe("tax", () => {
  it("shows what customers pay with tax, without changing profit", () => {
    const r = ok(input({ product: { quantity: 10, unit: "items", amountPaid: 100 }, pricing: { itemAmount: 10 }, taxPercent: 17.5 }));
    expect(r.items!.price).toBe(20);
    expect(r.items!.priceWithTax).toBe(23.5);
    expect(r.items!.profit).toBe(10);
  });
});

describe("previewCosts", () => {
  it("shows costs and packages before a profit is chosen", () => {
    const i = exampleSmartInput();
    i.packages[0].profitAmount = null;
    expect(runSmartCalculator(i).ok).toBe(false);
    const out = previewCosts(i);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.batchCost).toBe(25);
      expect(out.result.purchaseEach).toBe(0.2);
      expect(out.result.packages[0].available).toBe(25);
      expect(out.result.packages[0].cost).toBe(1);
    }
  });
});

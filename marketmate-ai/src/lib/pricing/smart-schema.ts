import { z } from "zod";
import { CATEGORIES } from "./categories";
import { CURRENCIES, DEFAULT_CURRENCY, UNITS } from "./money";
import type { PricingCalculatorInput } from "./calculator";
import { emptySmartInput, type SmartInput, type SmartResult } from "./smart";

/** Validates a Smart Pricing Calculator input before it's saved (never trust the browser). */
const money = z.number().finite().min(0).max(1e12).nullable();
const currency = z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]);
const unit = z.enum(UNITS.map((u) => u.id) as [string, ...string[]]);

export const smartInputSchema = z.object({
  version: z.literal(2),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  currency,
  rates: z.record(z.string().max(3), z.number().finite().positive().max(1e9).nullable()).refine((r) => Object.keys(r).length <= 20),
  product: z.object({
    name: z.string().max(200),
    itemName: z.string().max(60),
    quantity: z.number().finite().nullable(),
    unit,
    amountPaid: money,
    paidCurrency: currency,
  }),
  costs: z.array(z.object({ id: z.string().max(80), name: z.string().max(80), amount: money, currency, appliesTo: z.enum(["batch", "item", "package"]) })).max(50),
  sellAs: z.enum(["items", "packages", "both"]),
  packages: z.array(z.object({ id: z.string().max(80), name: z.string().max(40), size: z.number().finite().nullable(), unit, profitAmount: money })).max(6),
  pricing: z.object({ method: z.enum(["profit_amount", "markup", "margin"]), percent: z.number().finite().min(0).max(10000).nullable(), itemAmount: money }),
  chosenPrices: z.record(z.string().max(80), z.number().finite().positive().max(1e10).nullable()).refine((r) => Object.keys(r).length <= 10),
  fees: z.object({ percent: z.number().finite().min(0).max(99).nullable(), fixed: money }),
  taxPercent: z.number().finite().min(0).max(100).nullable(),
  wholesale: z.object({
    enabled: z.boolean(),
    mode: z.enum(["price", "discount"]),
    price: money,
    discountPct: z.number().finite().min(0).max(99.99).nullable(),
    minOrder: z.number().finite().min(0).max(1e9).nullable(),
  }),
  discounts: z.array(z.number().finite().gt(0).lt(100)).max(6),
  fixedCosts: money,
});

/** The compact summary stored in `results` and shown in lists and on the dashboard. */
export interface SmartSummary {
  version: 2;
  currency: string;
  category: string;
  /** What you sell mainly: "item" or a package. */
  one: string;
  many: string;
  available: number;
  cost: number;
  price: number;
  profit: number;
  revenue: number;
  totalSpent: number;
  totalProfit: number;
  packages: { one: string; size: string | null; available: number; cost: number; price: number; profit: number }[];
}

export function summarize(r: SmartResult): SmartSummary {
  const m = r.main;
  return {
    version: 2,
    currency: r.currency,
    category: r.category,
    one: m.one,
    many: m.many,
    available: m.available,
    cost: m.cost,
    price: m.price,
    profit: m.profit,
    revenue: m.sellAll.revenue,
    totalSpent: m.sellAll.totalCost,
    totalProfit: m.sellAll.profit,
    packages: r.packages.map((p) => ({ one: p.one, size: p.sizeLabel ?? null, available: p.available, cost: p.cost, price: p.price, profit: p.profit })),
  };
}

export function isSmartSummary(x: unknown): x is SmartSummary {
  return Boolean(x) && typeof x === "object" && (x as { version?: unknown }).version === 2;
}

const V1_NAMES: Record<string, string> = {
  materials: "Materials",
  packaging: "Packaging",
  labor: "Labour",
  transportation: "Transport / gas",
  electricity: "Electricity",
  marketing: "Advertising",
  other: "Other",
};

/**
 * Opens a calculation saved by the earlier calculator in the new one:
 * same costs and quantity, priced with the same margin.
 */
export function smartFromV1(name: string, v1: PricingCalculatorInput, currency = DEFAULT_CURRENCY): SmartInput {
  const base = emptySmartInput(currency);
  return {
    ...base,
    product: { ...base.product, name, quantity: v1.quantity, unit: "items", amountPaid: null },
    costs: Object.entries(v1.costs)
      .filter(([, c]) => c.amount > 0)
      .map(([k, c]) => ({ id: `v1-${k}`, name: V1_NAMES[k] ?? k, amount: c.amount, currency, appliesTo: c.basis === "per_unit" ? "item" : "batch" })),
    pricing: { method: "margin", percent: v1.targetRetailMarginPct, itemAmount: null },
    fees: { percent: v1.retailFees.percentFee || null, fixed: v1.retailFees.fixedFeePerSale || null },
    chosenPrices: v1.actualRetailPrice ? { item: v1.actualRetailPrice } : {},
  };
}

/** What lists, search and the dashboard show for any saved calculation, old or new. */
export interface PricingRowView {
  currency: string;
  emoji: string;
  one: string;
  cost: number;
  price: number;
  profit: number;
  totalProfit: number | null;
  available: number | null;
}

export function pricingRowView(
  row: { results: unknown; cost_per_unit: number | string; suggested_retail_price: number | string },
  fallbackCurrency = DEFAULT_CURRENCY,
): PricingRowView {
  if (isSmartSummary(row.results)) {
    const s = row.results;
    return {
      currency: s.currency,
      emoji: CATEGORIES.find((c) => c.id === s.category)?.emoji ?? "📦",
      one: s.one,
      cost: s.cost,
      price: s.price,
      profit: s.profit,
      totalProfit: s.totalProfit,
      available: s.available,
    };
  }
  const cost = Number(row.cost_per_unit);
  const price = Number(row.suggested_retail_price);
  return { currency: fallbackCurrency, emoji: "📦", one: "item", cost, price, profit: price - cost, totalProfit: null, available: null };
}

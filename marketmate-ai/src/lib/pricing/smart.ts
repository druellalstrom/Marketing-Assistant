/**
 * Smart Pricing Calculator: pure calculation functions, no I/O, shared by the
 * browser (live answers) and the server (recomputing before saving).
 *
 * Model, in plain words:
 *   - You bought or made a QUANTITY of something (20 shirts, 10 L of juice).
 *   - Costs are either for the WHOLE BATCH, for EACH ITEM, or for EACH PACKAGE.
 *   - True cost per item = whole-batch costs ÷ quantity + per-item costs.
 *   - A package holds a SIZE of the item (4 worms, 500 ml); its cost is
 *     size × cost per item + per-package costs (the bag, the bottle).
 *   - The selling price comes from a profit amount, a markup % or a margin %,
 *     after any selling fees, rounded UP to the cent so the profit target is met.
 */

import { categoryInfo, pluralize } from "./categories";
import {
  convertCurrency,
  convertMeasurement,
  CurrencyRateMissingError,
  formatMoney,
  formatNumber,
  isMeasured,
  MeasurementError,
  unitInfo,
} from "./money";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type AppliesTo = "batch" | "item" | "package";
export type PricingMethod = "profit_amount" | "markup" | "margin";
export type SellAs = "items" | "packages" | "both";

export interface CostRow {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  appliesTo: AppliesTo;
}

export interface PackageOption {
  id: string;
  /** What one package is called: "bag", "bottle", "basket". */
  name: string;
  /** How much of the item goes in one package. */
  size: number | null;
  /** Unit of `size`; only used when the quantity is measured (kg, L…). */
  unit: string;
  /** Desired profit per package when pricing by profit amount. */
  profitAmount: number | null;
}

export interface SmartInput {
  version: 2;
  category: string;
  /** The business (display) currency every result is shown in. */
  currency: string;
  /** User-entered exchange rates: rates[X] = how many `currency` for 1 X. */
  rates: Record<string, number | null>;
  product: {
    name: string;
    /** What one is called ("T-shirt", "worm"); blank uses the category's word. */
    itemName: string;
    quantity: number | null;
    unit: string;
    amountPaid: number | null;
    /** Original purchase currency. */
    paidCurrency: string;
  };
  costs: CostRow[];
  sellAs: SellAs;
  packages: PackageOption[];
  pricing: {
    method: PricingMethod;
    /** For markup / margin. */
    percent: number | null;
    /** Profit per item when pricing by profit amount. */
    itemAmount: number | null;
  };
  /** Prices the user picked (e.g. rounded); key "item" or a package id. */
  chosenPrices: Record<string, number | null>;
  fees: { percent: number | null; fixed: number | null };
  taxPercent: number | null;
  wholesale: { enabled: boolean; mode: "price" | "discount"; price: number | null; discountPct: number | null; minOrder: number | null };
  discounts: number[];
  /** Costs you pay no matter what (stall rent, equipment), for the break-even tool. */
  fixedCosts: number | null;
}

// ---------------------------------------------------------------------------
// Small reusable formulas (each one is exported and unit tested)
// ---------------------------------------------------------------------------

const EPS = 1e-9;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Rounds to the nearest cent (half away from zero), robust to float noise. */
export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(value) * 100 + 1e-7)) / 100;
}

/** Rounds UP to the next cent so a profit target is never missed by a fraction. */
export function ceilToCent(value: number): number {
  return Math.ceil(value * 100 - 1e-6) / 100;
}

export function calculateTotalCost(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + (isNum(a) ? a : 0), 0);
}

/** Batch costs spread over the quantity, plus anything paid per item. */
export function calculateCostPerUnit(batchCost: number, quantity: number, perUnitCost = 0): number {
  if (!(quantity > 0)) throw new RangeError("Quantity must be more than 0.");
  return batchCost / quantity + perUnitCost;
}

/** How many full packages a quantity makes, and what's left over (same unit as quantity). */
export function calculatePackages(quantity: number, sizePerPackage: number): { packages: number; leftover: number } {
  if (!(sizePerPackage > 0)) throw new RangeError("Package size must be more than 0.");
  const packages = Math.floor(quantity / sizePerPackage + EPS);
  const leftover = Math.max(0, quantity - packages * sizePerPackage);
  return { packages, leftover: Math.abs(leftover) < EPS ? 0 : leftover };
}

export function calculateCostPerPackage(costPerUnit: number, sizePerPackage: number, perPackageCost = 0): number {
  return costPerUnit * sizePerPackage + perPackageCost;
}

export function calculateFees(price: number, fees: { percent: number; fixed: number }): number {
  return price * (fees.percent / 100) + fees.fixed;
}

/**
 * Selling price for a cost, so that after fees you keep:
 *   profit_amount → that amount;  markup → cost × percent;  margin → percent of the price.
 * Rounded up to the cent. Returns null when no price can reach the target
 * (e.g. margin + fee % at or above 100%).
 */
export function calculateSellingPrice(
  cost: number,
  method: PricingMethod,
  value: number,
  fees: { percent: number; fixed: number } = { percent: 0, fixed: 0 },
): number | null {
  const keep = 1 - fees.percent / 100;
  if (!(keep > EPS)) return null;
  let raw: number;
  if (method === "profit_amount") raw = (cost + value + fees.fixed) / keep;
  else if (method === "markup") raw = (cost * (1 + value / 100) + fees.fixed) / keep;
  else {
    const denom = keep - value / 100;
    if (denom <= EPS) return null;
    raw = (cost + fees.fixed) / denom;
  }
  if (!Number.isFinite(raw) || raw < 0) return null;
  return ceilToCent(raw);
}

export function calculateProfit(price: number, cost: number, fees: { percent: number; fixed: number } = { percent: 0, fixed: 0 }): number {
  return price - calculateFees(price, fees) - cost;
}

/** Profit as a share of the price, in %. Null when the price is 0. */
export function calculateProfitMargin(profit: number, price: number): number | null {
  return price > 0 ? (profit / price) * 100 : null;
}

/** Profit as a share of the cost, in %. Null when the cost is 0. */
export function calculateMarkup(profit: number, cost: number): number | null {
  return cost > 0 ? (profit / cost) * 100 : null;
}

/**
 * How many sales recover `upfrontCosts`, when each sale brings in
 * `netPerSale` (price − fees − any cost paid per sale). Rounded up.
 */
export function calculateBreakEven(upfrontCosts: number, netPerSale: number): { units: number | null; revenueNeeded: number | null } {
  if (upfrontCosts <= 0) return { units: 0, revenueNeeded: 0 };
  if (!(netPerSale > EPS)) return { units: null, revenueNeeded: null };
  const units = Math.ceil(upfrontCosts / netPerSale - 1e-9);
  return { units, revenueNeeded: upfrontCosts };
}

export function calculateDiscountPrice(price: number, discountPct: number): number {
  return roundMoney(price * (1 - discountPct / 100));
}

export function calculateWholesalePrice(retailPrice: number, discountPct: number): number {
  return calculateDiscountPrice(retailPrice, discountPct);
}

/**
 * Customer-friendly prices near `price`, e.g. 19.73 → [19.99, 20.00, 21.00].
 * Small prices step in quarters. Never changes the price by itself.
 */
export function suggestRoundedPrices(price: number): number[] {
  if (!(price > 0) || !Number.isFinite(price)) return [];
  const up = (step: number) => roundMoney(Math.ceil(price / step - 1e-9) * step);
  const whole = up(1);
  const candidates = price < 5 ? [up(0.25), up(0.5), whole, whole + 0.5, whole + 1] : [whole - 0.01, whole, whole + 1];
  // Only prices that keep (almost) all of the calculated profit; at most three.
  return [...new Set(candidates.map(roundMoney))]
    .filter((p) => p > 0 && p >= roundMoney(price) - 0.01)
    .sort((a, b) => a - b)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface Issue {
  field: string;
  message: string;
}

export interface SellUnitResult {
  /** "item" or the package option id. */
  key: string;
  kind: "item" | "package";
  /** Singular / plural names for sentences. */
  one: string;
  many: string;
  /** How many you can sell. */
  available: number;
  /** For packages: how much goes in one, in words ("4 worms", "500 ml"). */
  sizeLabel?: string;
  /** For packages: how much goes in one, in the quantity's unit. */
  sizeInUnits?: number;
  /** For packages: what's left over, in words, or null. */
  leftoverLabel: string | null;
  cost: number;
  calculatedPrice: number;
  price: number;
  /** True when the user picked a price (e.g. rounded). */
  priceChosen: boolean;
  priceWithTax: number | null;
  feesPerSale: number;
  profit: number;
  marginPct: number | null;
  markupPct: number | null;
  roundingOptions: number[];
  sellAll: { revenue: number; totalCost: number; profit: number };
  breakEven: { units: number | null; enoughStock: boolean };
}

export interface CostLine {
  name: string;
  appliesTo: AppliesTo;
  originalAmount: number;
  originalCurrency: string;
  amount: number;
  /** Shown when converted: "USD $100.00 → BBD $200.00 (1 USD = 2 BBD)". */
  conversion: string | null;
}

export interface SmartResult {
  currency: string;
  category: string;
  productName: string;
  quantity: number;
  unit: string;
  quantityLabel: string;
  itemOne: string;
  itemMany: string;
  lines: CostLine[];
  batchCost: number;
  perItemCost: number;
  perPackageCost: number;
  /** What you paid for the purchase alone, per item ("You paid $10.00 for each T-shirt"). */
  purchaseEach: number | null;
  /** Total of everything you spend if you sell the main way. */
  totalSpent: number;
  costPerUnit: number;
  items: SellUnitResult | null;
  packages: SellUnitResult[];
  /** The result most results refer to: items, or the first package. */
  main: SellUnitResult;
  wholesale: { price: number; profit: number; minOrder: number; orderRevenue: number; orderProfit: number; profitIfAllWholesale: number; belowCost: boolean } | null;
  discounts: { pct: number; price: number; profit: number; totalProfit: number; belowCost: boolean }[];
  fixedCostBreakEven: { fixedCosts: number; units: number | null } | null;
  warnings: string[];
  steps: string[];
}

export type SmartOutcome = { ok: true; result: SmartResult } | { ok: false; issues: Issue[] };

const val = (v: number | null | undefined) => (isNum(v) ? v : null);

export function runSmartCalculator(input: SmartInput): SmartOutcome {
  const issues: Issue[] = [];
  const cur = input.currency;
  const money = (n: number) => formatMoney(n, cur);
  const cat = categoryInfo(input.category);
  const unit = unitInfo(input.product.unit);
  const measured = isMeasured(unit.id);
  const genericCount = ["pieces", "items", "units"].includes(unit.id);
  const itemOne = measured ? unit.singular : input.product.itemName.trim() || (genericCount ? cat.itemWord : unit.singular);
  const itemMany = measured ? `${unit.singular}s` : pluralize(itemOne);

  // --- quantity --------------------------------------------------------------
  const q = val(input.product.quantity);
  if (q === null) issues.push({ field: "quantity", message: measured ? `Enter how much you have (in ${unit.short}).` : `Enter how many ${itemMany} you have.` });
  else if (q <= 0) issues.push({ field: "quantity", message: "The quantity must be more than 0." });
  else if (!measured && !Number.isInteger(q)) issues.push({ field: "quantity", message: `The number of ${itemMany} must be a whole number.` });
  else if (q > 1e9) issues.push({ field: "quantity", message: "That quantity is too large to calculate. Check the number." });

  // --- costs → business currency --------------------------------------------
  const lines: CostLine[] = [];
  const addLine = (field: string, name: string, amount: number | null, currency: string, appliesTo: AppliesTo) => {
    if (amount === null) return;
    if (amount < 0) {
      issues.push({ field, message: `${name || "A cost"} can't be negative.` });
      return;
    }
    if (amount > 1e12) {
      issues.push({ field, message: `${name || "A cost"} is too large. Check the number.` });
      return;
    }
    try {
      const converted = convertCurrency(amount, currency, cur, input.rates);
      lines.push({
        name,
        appliesTo,
        originalAmount: amount,
        originalCurrency: currency,
        amount: converted,
        conversion: currency === cur ? null : `${formatMoney(amount, currency)} → ${money(converted)} (your rate: 1 ${currency} = ${formatNumber(input.rates[currency] ?? 0, 4)} ${cur})`,
      });
    } catch (e) {
      if (e instanceof CurrencyRateMissingError) issues.push({ field: `rate-${currency}`, message: e.message });
      else throw e;
    }
  };
  const paid = val(input.product.amountPaid);
  addLine("amountPaid", input.product.name.trim() || "What you bought", paid, input.product.paidCurrency, "batch");
  input.costs.forEach((c, i) => addLine(`cost-${c.id ?? i}`, c.name.trim() || `Cost ${i + 1}`, val(c.amount), c.currency, c.appliesTo));
  if (paid === null && !input.costs.some((c) => isNum(c.amount) && c.amount > 0)) {
    issues.push({ field: "amountPaid", message: "Enter how much you paid." });
  }

  const sum = (a: AppliesTo) => calculateTotalCost(lines.filter((l) => l.appliesTo === a).map((l) => l.amount));
  const batchCost = sum("batch");
  const perItemCost = sum("item");
  const perPackageCost = sum("package");
  if (!issues.length && batchCost + perItemCost + perPackageCost <= 0) {
    issues.push({ field: "amountPaid", message: "Enter what you spent. With no costs there's nothing to price." });
  }

  // --- what you sell -------------------------------------------------------------
  const sellItems = input.sellAs !== "packages";
  const sellPackages = input.sellAs !== "items";
  if (sellPackages && input.packages.length === 0) issues.push({ field: "packages", message: "Add a package size." });
  if (perPackageCost > 0 && !sellPackages) {
    issues.push({ field: "sellAs", message: "You added a cost for each package. Choose \"Packages\" or \"Both\", or change that cost to the whole batch." });
  }

  const fees = { percent: val(input.fees.percent) ?? 0, fixed: 0 };
  const fixedFeeRaw = val(input.fees.fixed) ?? 0;
  if (fees.percent < 0 || fees.percent >= 100) issues.push({ field: "feesPercent", message: "Selling fees must be between 0% and 99%." });
  if (fixedFeeRaw < 0) issues.push({ field: "feesFixed", message: "The fee per sale can't be negative." });
  fees.fixed = fixedFeeRaw;
  const tax = val(input.taxPercent);
  if (tax !== null && (tax < 0 || tax > 100)) issues.push({ field: "tax", message: "Tax must be between 0% and 100%." });

  const method = input.pricing.method;
  const percent = val(input.pricing.percent);
  if (method !== "profit_amount") {
    if (percent === null) issues.push({ field: "percent", message: method === "markup" ? "Enter how much % to add on top of your cost." : "Enter what % of the price you want as profit." });
    else if (percent < 0) issues.push({ field: "percent", message: "The percentage can't be negative." });
    else if (method === "margin" && percent + fees.percent >= 100) issues.push({ field: "percent", message: "Your profit % plus selling fees must be under 100%. Try a smaller number." });
  } else if (sellItems) {
    const a = val(input.pricing.itemAmount);
    if (a === null) issues.push({ field: "itemAmount", message: `Enter how much profit you'd like on each ${itemOne}.` });
    else if (a < 0) issues.push({ field: "itemAmount", message: "Your profit can't be negative." });
  }

  // Package sizes in the quantity's unit.
  const packageSizes: { opt: PackageOption; size: number; sizeLabel: string }[] = [];
  if (sellPackages) {
    input.packages.forEach((opt, i) => {
      const name = opt.name.trim() || cat.packageWord;
      const s = val(opt.size);
      const field = `package-${opt.id ?? i}`;
      if (s === null) return issues.push({ field, message: measured ? `Enter how much goes in one ${name}.` : `Enter how many ${itemMany} go in one ${name}.` });
      if (s <= 0) return issues.push({ field, message: `The amount in one ${name} must be more than 0.` });
      if (!measured && !Number.isInteger(s)) return issues.push({ field, message: `The number of ${itemMany} in one ${name} must be a whole number.` });
      let size = s;
      try {
        size = measured ? convertMeasurement(s, opt.unit || unit.id, unit.id) : s;
      } catch (e) {
        if (e instanceof MeasurementError) return issues.push({ field, message: `The ${name} size must be in a unit like ${unit.short}. ${e.message}` });
        throw e;
      }
      if (q !== null && q > 0 && size > q + EPS) return issues.push({ field, message: `One ${name} needs more than you have in total. Check the ${name} size.` });
      const sizeLabel = measured ? `${formatNumber(s, 3)} ${unitInfo(opt.unit || unit.id).short}` : `${formatNumber(s)} ${pluralize(itemOne, s)}`;
      if (method === "profit_amount") {
        const a = val(opt.profitAmount);
        if (a === null) issues.push({ field: `${field}-profit`, message: `Enter how much profit you'd like on each ${name}.` });
        else if (a < 0) issues.push({ field: `${field}-profit`, message: "Your profit can't be negative." });
      }
      packageSizes.push({ opt: { ...opt, name }, size, sizeLabel });
    });
  }

  for (const [key, p] of Object.entries(input.chosenPrices ?? {})) {
    if (p !== null && p !== undefined && (!isNum(p) || p <= 0)) issues.push({ field: `chosen-${key}`, message: "A chosen price must be more than 0." });
  }

  if (issues.length || q === null) return { ok: false, issues };

  // --- the math ------------------------------------------------------------------
  const costPerUnit = calculateCostPerUnit(batchCost, q, perItemCost);
  const allItemCosts = batchCost + perItemCost * q;

  const priceFor = (key: string, cost: number, amount: number | null) => {
    const calculated = calculateSellingPrice(cost, method, method === "profit_amount" ? (amount ?? 0) : (percent ?? 0), fees);
    return { calculated, chosen: val(input.chosenPrices?.[key]) };
  };

  const build = (key: string, kind: "item" | "package", one: string, many: string, available: number, cost: number, upfront: number, amount: number | null, extra: Partial<SellUnitResult>): SellUnitResult | Issue => {
    const { calculated, chosen } = priceFor(key, cost, amount);
    if (calculated === null) return { field: "percent", message: "No price can reach that profit after fees. Try a smaller percentage." };
    const price = chosen ?? calculated;
    const profit = calculateProfit(price, cost, fees);
    const net = price - calculateFees(price, fees);
    const be = calculateBreakEven(upfront, net);
    return {
      key,
      kind,
      one,
      many,
      available,
      leftoverLabel: null,
      cost,
      calculatedPrice: calculated,
      price,
      priceChosen: chosen !== null,
      priceWithTax: tax ? roundMoney(price * (1 + tax / 100)) : null,
      feesPerSale: calculateFees(price, fees),
      profit,
      marginPct: calculateProfitMargin(profit, price),
      markupPct: calculateMarkup(profit, cost),
      roundingOptions: suggestRoundedPrices(calculated),
      sellAll: { revenue: price * available, totalCost: upfront, profit: net * available - upfront },
      breakEven: { units: be.units, enoughStock: be.units !== null && be.units <= available },
      ...extra,
    };
  };

  let items: SellUnitResult | null = null;
  if (sellItems) {
    const r = build("item", "item", itemOne, itemMany, q, costPerUnit, allItemCosts, val(input.pricing.itemAmount), {});
    if ("field" in r) return { ok: false, issues: [r] };
    items = r;
  }

  const packages: SellUnitResult[] = [];
  for (const { opt, size, sizeLabel } of packageSizes) {
    const { packages: count, leftover } = calculatePackages(q, size);
    const cost = calculateCostPerPackage(costPerUnit, size, perPackageCost);
    const upfront = allItemCosts + perPackageCost * count;
    const leftoverLabel = leftover > EPS ? (measured ? `${formatNumber(leftover, 3)} ${unit.short}` : `${formatNumber(leftover)} ${pluralize(itemOne, leftover)}`) : null;
    const r = build(opt.id, "package", opt.name, pluralize(opt.name), count, cost, upfront, val(opt.profitAmount), { sizeLabel, sizeInUnits: size, leftoverLabel });
    if ("field" in r) return { ok: false, issues: [r] };
    packages.push(r);
  }

  const main = items ?? packages[0];

  // --- wholesale, discounts, fixed-cost break-even (advanced) -------------------
  let wholesale: SmartResult["wholesale"] = null;
  if (input.wholesale.enabled) {
    const w = input.wholesale;
    const wPrice = w.mode === "discount" ? (isNum(w.discountPct) && w.discountPct >= 0 && w.discountPct < 100 ? calculateWholesalePrice(main.price, w.discountPct) : null) : val(w.price);
    const minOrder = val(w.minOrder) && w.minOrder! > 0 ? Math.floor(w.minOrder!) : 1;
    if (wPrice !== null && wPrice > 0) {
      const profit = wPrice - main.cost;
      wholesale = {
        price: wPrice,
        profit,
        minOrder,
        orderRevenue: wPrice * minOrder,
        orderProfit: profit * minOrder,
        profitIfAllWholesale: wPrice * main.available - main.sellAll.totalCost,
        belowCost: profit < 0,
      };
    }
  }

  const discounts = (input.discounts ?? [])
    .filter((d) => isNum(d) && d > 0 && d < 100)
    .map((pct) => {
      const price = calculateDiscountPrice(main.price, pct);
      const profit = calculateProfit(price, main.cost, fees);
      return { pct, price, profit, totalProfit: (price - calculateFees(price, fees)) * main.available - main.sellAll.totalCost, belowCost: profit < 0 };
    });

  const fixed = val(input.fixedCosts);
  const fixedCostBreakEven = fixed !== null && fixed > 0 ? { fixedCosts: fixed, units: calculateBreakEven(fixed, main.profit).units } : null;

  // --- warnings ----------------------------------------------------------------
  const warnings: string[] = [];
  for (const r of [items, ...packages].filter(Boolean) as SellUnitResult[]) {
    if (r.profit < 0) warnings.push(`At ${money(r.price)} you would lose ${money(-r.profit)} on every ${r.one}.`);
    else if (r.priceChosen && r.price < r.calculatedPrice) warnings.push(`${money(r.price)} is below your calculated ${money(r.calculatedPrice)}, so you'll make less profit than you asked for.`);
    if (r.breakEven.units === null) warnings.push(`At this price you can't get your money back on ${r.many}.`);
    else if (!r.breakEven.enoughStock) warnings.push(`To get your money back you'd need to sell ${formatNumber(r.breakEven.units)} ${r.many}, but you only have ${formatNumber(r.available)}. Raise the price.`);
    if (r.kind === "package" && r.leftoverLabel) warnings.push(`${r.leftoverLabel} will be left over after making ${formatNumber(r.available)} ${r.many}.`);
  }
  if (wholesale?.belowCost) warnings.push(`Your wholesale price is below your cost: you'd lose ${money(-wholesale.profit)} on each one.`);

  const result: SmartResult = {
    currency: cur,
    category: input.category,
    productName: input.product.name.trim(),
    quantity: q,
    unit: unit.id,
    quantityLabel: measured ? `${formatNumber(q, 3)} ${unit.short}` : `${formatNumber(q)} ${pluralize(itemOne, q)}`,
    itemOne,
    itemMany,
    lines,
    batchCost,
    perItemCost,
    perPackageCost,
    purchaseEach: paid !== null && lines[0]?.name === (input.product.name.trim() || "What you bought") ? lines[0].amount / q : null,
    totalSpent: main.sellAll.totalCost,
    costPerUnit,
    items,
    packages,
    main,
    wholesale,
    discounts,
    fixedCostBreakEven,
    warnings,
    steps: [],
  };
  result.steps = explainCalculation(result, input);
  return { ok: true, result };
}

/**
 * Costs, cost per item and package counts before the user has chosen a
 * profit, so those numbers can appear while they're still filling in the form.
 */
export function previewCosts(input: SmartInput): SmartOutcome {
  return runSmartCalculator({
    ...input,
    pricing: { method: "profit_amount", percent: null, itemAmount: 0 },
    packages: input.packages.map((p) => ({ ...p, profitAmount: 0 })),
    chosenPrices: {},
    fees: { percent: null, fixed: null },
    taxPercent: null,
    wholesale: { ...input.wholesale, enabled: false },
    discounts: [],
    fixedCosts: null,
  });
}

// ---------------------------------------------------------------------------
// "Show me how you calculated this"
// ---------------------------------------------------------------------------

/** The calculation in plain English, one sentence per step, using the real numbers. */
export function explainCalculation(r: SmartResult, input: SmartInput): string[] {
  const m = (n: number) => formatMoney(n, r.currency);
  const steps: string[] = [];
  const batch = r.lines.filter((l) => l.appliesTo === "batch");
  const each = r.lines.filter((l) => l.appliesTo === "item");
  const perPack = r.lines.filter((l) => l.appliesTo === "package");

  for (const l of r.lines.filter((x) => x.conversion)) steps.push(`${l.name}: you paid ${l.conversion}.`);
  if (batch.length === 1) steps.push(`You spent ${m(r.batchCost)} on ${batch[0].name}.`);
  else if (batch.length > 1) steps.push(`You spent ${batch.map((l) => `${m(l.amount)} on ${l.name}`).join(", ")}. That adds up to ${m(r.batchCost)}.`);

  const measured = isMeasured(r.unit);
  steps.push(`You have ${r.quantityLabel}.`);
  if (r.batchCost > 0) {
    steps.push(`${m(r.batchCost)} ÷ ${formatNumber(r.quantity, 3)} = ${m(r.batchCost / r.quantity)} for each ${r.itemOne}.`);
  }
  if (each.length) {
    steps.push(`You also pay ${m(r.perItemCost)} for each ${r.itemOne} (${each.map((l) => l.name).join(", ")}), so each ${r.itemOne} really costs you ${m(r.costPerUnit)}.`);
  }

  const methodSentence = (cost: number, one: string, amount: number | null) => {
    const p = input.pricing.percent ?? 0;
    if (input.pricing.method === "profit_amount") return `You chose a ${m(amount ?? 0)} profit. ${m(cost)} cost + ${m(amount ?? 0)} profit = ${m(cost + (amount ?? 0))} for each ${one}.`;
    if (input.pricing.method === "markup") return `You chose to add ${formatNumber(p)}% on top. ${formatNumber(p)}% of ${m(cost)} is ${m((cost * p) / 100)}, so ${m(cost)} + ${m((cost * p) / 100)} = ${m(cost * (1 + p / 100))} for each ${one}.`;
    return `You want ${formatNumber(p)}% of the price to be profit. ${m(cost)} ÷ (100% − ${formatNumber(p)}%) = ${m(cost / (1 - p / 100))}. Check: ${formatNumber(p)}% of that price is your profit.`;
  };
  const feeSentence = input.fees.percent || input.fees.fixed
    ? `Your selling fees (${formatNumber(input.fees.percent ?? 0)}% + ${m(input.fees.fixed ?? 0)} per sale) are added to the price so you still keep your profit.`
    : null;

  const describe = (u: SellUnitResult, amount: number | null) => {
    if (u.kind === "package") {
      const sizeWords = u.sizeLabel ?? "";
      if (measured) steps.push(`Each ${u.one} holds ${sizeWords}. ${r.quantityLabel} makes ${formatNumber(u.available)} ${u.many}.`);
      else steps.push(`You put ${sizeWords} in each ${u.one}. ${formatNumber(r.quantity)} ÷ ${formatNumber(u.sizeInUnits)} = ${formatNumber(u.available)} ${u.many}.`);
      const contentCost = u.cost - r.perPackageCost;
      steps.push(
        measured
          ? `What goes in one ${u.one} costs ${m(contentCost)}${r.perPackageCost > 0 ? `, plus ${m(r.perPackageCost)} for the ${perPack.map((l) => l.name).join(", ")}` : ""}, so each ${u.one} costs you ${m(u.cost)}.`
          : `${sizeWords} × ${m(r.costPerUnit)} = ${m(contentCost)}${r.perPackageCost > 0 ? `, plus ${m(r.perPackageCost)} for the ${perPack.map((l) => l.name).join(", ")}` : ""}, so each ${u.one} costs you ${m(u.cost)}.`,
      );
      if (u.leftoverLabel) steps.push(`${u.leftoverLabel} will be left over.`);
    }
    steps.push(methodSentence(u.cost, u.one, amount));
    if (feeSentence) steps.push(feeSentence);
    steps.push(`Suggested price: ${m(u.calculatedPrice)} for each ${u.one}.`);
    if (u.priceChosen) steps.push(`You chose to charge ${m(u.price)} instead of the calculated ${m(u.calculatedPrice)}.`);
    steps.push(`At ${m(u.price)}, you keep ${m(u.profit)} on each ${u.one}.`);
    steps.push(`If you sell all ${formatNumber(u.available)} ${u.many}: ${formatNumber(u.available)} × ${m(u.price)} = ${m(u.sellAll.revenue)}${feeSentence ? " before fees" : ""}. Take away the ${m(u.sellAll.totalCost)} you spent, and your profit is ${m(u.sellAll.profit)}.`);
    if (u.breakEven.units !== null && u.breakEven.units > 0) {
      steps.push(`To get your ${m(u.sellAll.totalCost)} back, you need to sell ${formatNumber(u.breakEven.units)} ${pluralize(u.one, u.breakEven.units)} (${m(u.sellAll.totalCost)} ÷ ${m(u.price - u.feesPerSale)}, rounded up). Everything after that is profit.`);
    }
    if (u.priceWithTax !== null) steps.push(`With ${formatNumber(input.taxPercent ?? 0)}% tax, customers pay ${m(u.priceWithTax)}. The tax goes to the government, not into your profit.`);
  };

  if (r.items) describe(r.items, input.pricing.itemAmount);
  for (const p of r.packages) describe(p, input.packages.find((o) => o.id === p.key)?.profitAmount ?? null);
  return steps;
}

// ---------------------------------------------------------------------------
// Defaults and the built-in example
// ---------------------------------------------------------------------------

let idCounter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

export function emptySmartInput(currency: string): SmartInput {
  return {
    version: 2,
    category: "other",
    currency,
    rates: {},
    product: { name: "", itemName: "", quantity: null, unit: "items", amountPaid: null, paidCurrency: currency },
    costs: [],
    sellAs: "items",
    packages: [{ id: "pkg-1", name: "", size: null, unit: "items", profitAmount: null }],
    pricing: { method: "profit_amount", percent: null, itemAmount: null },
    chosenPrices: {},
    fees: { percent: null, fixed: null },
    taxPercent: null,
    wholesale: { enabled: false, mode: "discount", price: null, discountPct: 25, minOrder: 10 },
    discounts: [10, 25, 50],
    fixedCosts: null,
  };
}

/** "Try an Example": 100 items for BBD 20 + 5 packaging, 4 per bag, BBD 1 profit per bag. */
export function exampleSmartInput(): SmartInput {
  const base = emptySmartInput("BBD");
  return {
    ...base,
    category: "other",
    product: { name: "Fishing worms", itemName: "worm", quantity: 100, unit: "items", amountPaid: 20, paidCurrency: "BBD" },
    costs: [{ id: "ex-pack", name: "Packaging", amount: 5, currency: "BBD", appliesTo: "batch" }],
    sellAs: "packages",
    packages: [{ id: "pkg-1", name: "bag", size: 4, unit: "items", profitAmount: 1 }],
    pricing: { method: "profit_amount", percent: null, itemAmount: null },
  };
}

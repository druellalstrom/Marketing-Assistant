/**
 * Pricing & Business Calculator — pure functions, no I/O.
 *
 * Definitions used throughout (standard small-business conventions):
 *   - Unit cost (variable cost per unit): everything it costs to make ONE unit.
 *   - Profit margin = (price − cost) / price          (share of the price that is profit)
 *   - Markup        = (price − cost) / cost           (how much you add on top of cost)
 *   - Contribution per unit = net revenue per unit − unit cost
 *   - Break-even units = fixed costs / contribution per unit (rounded UP to whole units)
 *
 * Percentages are passed in as human numbers (40 means 40%), never as 0.4.
 * Money values are plain numbers in the user's currency; rounding to cents is
 * done only by `roundMoney` for display so intermediate math stays exact.
 */

export class PricingInputError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "PricingInputError";
  }
}

/** Human-readable names for error messages. */
const FIELD_LABELS: Record<string, string> = {
  materialCostPerBatch: "Materials cost",
  laborHoursPerBatch: "Labour hours",
  laborRatePerHour: "Labour rate",
  otherCostPerBatch: "Other batch costs",
  unitsPerBatch: "Units per batch",
  packagingCostPerUnit: "Packaging per unit",
  monthlyFixedCosts: "Monthly fixed costs",
  targetRetailMarginPct: "Target retail margin",
  targetWholesaleMarginPct: "Target wholesale margin",
  targetMarginPct: "Target margin",
  percentFee: "Percentage fee",
  fixedFeePerSale: "Fixed fee per sale",
  fixedCosts: "Fixed costs",
  price: "Price",
  unitCost: "Unit cost",
  marginPct: "Margin",
  markupPct: "Markup",
};

const label = (field: string) => FIELD_LABELS[field] ?? field;

function assertFiniteNonNegative(field: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PricingInputError(field, `${label(field)} must be a number.`);
  }
  if (value < 0) {
    throw new PricingInputError(field, `${label(field)} cannot be negative.`);
  }
}

function assertPositive(field: string, value: number): void {
  assertFiniteNonNegative(field, value);
  if (value === 0) {
    throw new PricingInputError(field, `${label(field)} must be greater than zero.`);
  }
}

function assertPercentBelow100(field: string, value: number): void {
  assertFiniteNonNegative(field, value);
  if (value >= 100) {
    throw new PricingInputError(field, `${label(field)} must be less than 100%.`);
  }
}

/** Round to cents using half-away-from-zero, robust to float noise (1.005 → 1.01). */
export function roundMoney(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
}

/** Round a percentage to 2 decimal places for display. */
export function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Cost per unit
// ---------------------------------------------------------------------------

export interface UnitCostInput {
  /** Total materials/ingredients cost for one batch. */
  materialCostPerBatch: number;
  /** Hours of labour to produce one batch. */
  laborHoursPerBatch: number;
  /** What you pay (or want to pay yourself) per labour hour. */
  laborRatePerHour: number;
  /** Any other per-batch variable cost (equipment wear, shipping in supplies, etc.). */
  otherCostPerBatch: number;
  /** Number of sellable units a batch produces. */
  unitsPerBatch: number;
  /** Packaging / labels per unit. */
  packagingCostPerUnit: number;
}

export interface UnitCostBreakdown {
  materialPerUnit: number;
  laborPerUnit: number;
  otherPerUnit: number;
  packagingPerUnit: number;
  totalBatchCost: number;
  costPerUnit: number;
}

export function calculateUnitCost(input: UnitCostInput): UnitCostBreakdown {
  assertFiniteNonNegative("materialCostPerBatch", input.materialCostPerBatch);
  assertFiniteNonNegative("laborHoursPerBatch", input.laborHoursPerBatch);
  assertFiniteNonNegative("laborRatePerHour", input.laborRatePerHour);
  assertFiniteNonNegative("otherCostPerBatch", input.otherCostPerBatch);
  assertPositive("unitsPerBatch", input.unitsPerBatch);
  assertFiniteNonNegative("packagingCostPerUnit", input.packagingCostPerUnit);

  const laborBatch = input.laborHoursPerBatch * input.laborRatePerHour;
  const materialPerUnit = input.materialCostPerBatch / input.unitsPerBatch;
  const laborPerUnit = laborBatch / input.unitsPerBatch;
  const otherPerUnit = input.otherCostPerBatch / input.unitsPerBatch;
  const packagingPerUnit = input.packagingCostPerUnit;

  return {
    materialPerUnit,
    laborPerUnit,
    otherPerUnit,
    packagingPerUnit,
    totalBatchCost:
      input.materialCostPerBatch +
      laborBatch +
      input.otherCostPerBatch +
      packagingPerUnit * input.unitsPerBatch,
    costPerUnit: materialPerUnit + laborPerUnit + otherPerUnit + packagingPerUnit,
  };
}

// ---------------------------------------------------------------------------
// Margin / markup conversions
// ---------------------------------------------------------------------------

/** Profit margin % = (price − cost) / price × 100. Returns null when price is 0. */
export function profitMarginPercent(price: number, unitCost: number): number | null {
  assertFiniteNonNegative("price", price);
  assertFiniteNonNegative("unitCost", unitCost);
  if (price === 0) return null;
  return ((price - unitCost) / price) * 100;
}

/** Markup % = (price − cost) / cost × 100. Returns null when cost is 0 (undefined markup). */
export function markupPercent(price: number, unitCost: number): number | null {
  assertFiniteNonNegative("price", price);
  assertFiniteNonNegative("unitCost", unitCost);
  if (unitCost === 0) return null;
  return ((price - unitCost) / unitCost) * 100;
}

/** Convert a margin % into the equivalent markup %. 50% margin = 100% markup. */
export function marginToMarkup(marginPct: number): number {
  assertPercentBelow100("marginPct", marginPct);
  const m = marginPct / 100;
  return (m / (1 - m)) * 100;
}

/** Convert a markup % into the equivalent margin %. 100% markup = 50% margin. */
export function markupToMargin(markupPct: number): number {
  assertFiniteNonNegative("markupPct", markupPct);
  const k = markupPct / 100;
  return (k / (1 + k)) * 100;
}

// ---------------------------------------------------------------------------
// Price from a target
// ---------------------------------------------------------------------------

export interface SalesFees {
  /** Percentage fee taken from each sale (payment processor, marketplace). */
  percentFee: number;
  /** Flat fee per sale (e.g. $0.30 card fee). */
  fixedFeePerSale: number;
}

export const NO_FEES: SalesFees = { percentFee: 0, fixedFeePerSale: 0 };

function assertFees(fees: SalesFees): void {
  assertPercentBelow100("percentFee", fees.percentFee);
  assertFiniteNonNegative("fixedFeePerSale", fees.fixedFeePerSale);
}

/**
 * Price that achieves a target profit margin AFTER sales fees.
 *
 * Solve: price − price·f − F − cost = m·price
 *   ⇒ price = (cost + F) / (1 − m − f)
 */
export function priceForTargetMargin(
  unitCost: number,
  targetMarginPct: number,
  fees: SalesFees = NO_FEES,
): number {
  assertFiniteNonNegative("unitCost", unitCost);
  assertPercentBelow100("targetMarginPct", targetMarginPct);
  assertFees(fees);
  const denominator = 1 - targetMarginPct / 100 - fees.percentFee / 100;
  if (denominator <= 0) {
    throw new PricingInputError(
      "targetMarginPct",
      "Target margin plus percentage fees must be below 100% — no price can achieve this.",
    );
  }
  return (unitCost + fees.fixedFeePerSale) / denominator;
}

/** Price that applies a markup % on top of cost (fees not included — markup is cost-based). */
export function priceForMarkup(unitCost: number, markupPct: number): number {
  assertFiniteNonNegative("unitCost", unitCost);
  assertFiniteNonNegative("markupPct", markupPct);
  return unitCost * (1 + markupPct / 100);
}

// ---------------------------------------------------------------------------
// Per-unit profit at a given price
// ---------------------------------------------------------------------------

export interface UnitEconomics {
  price: number;
  unitCost: number;
  feesPerUnit: number;
  netRevenuePerUnit: number;
  profitPerUnit: number;
  /** Net profit margin after fees, as % of price. null when price is 0. */
  profitMarginPct: number | null;
  /** Markup on cost, as %. null when cost is 0. */
  markupPct: number | null;
}

export function unitEconomics(
  price: number,
  unitCost: number,
  fees: SalesFees = NO_FEES,
): UnitEconomics {
  assertFiniteNonNegative("price", price);
  assertFiniteNonNegative("unitCost", unitCost);
  assertFees(fees);
  const feesPerUnit = price * (fees.percentFee / 100) + fees.fixedFeePerSale;
  const netRevenuePerUnit = price - feesPerUnit;
  const profitPerUnit = netRevenuePerUnit - unitCost;
  return {
    price,
    unitCost,
    feesPerUnit,
    netRevenuePerUnit,
    profitPerUnit,
    profitMarginPct: price === 0 ? null : (profitPerUnit / price) * 100,
    markupPct: markupPercent(price, unitCost),
  };
}

// ---------------------------------------------------------------------------
// Break-even
// ---------------------------------------------------------------------------

export interface BreakEvenResult {
  /** Whole units needed to cover fixed costs (rounded up). null = never breaks even. */
  units: number | null;
  /** Revenue at `units` sold (units × price). null = never breaks even. */
  revenue: number | null;
  /** Exact (fractional) break-even revenue: fixed / contribution-margin ratio. */
  exactRevenue: number | null;
  contributionPerUnit: number;
  reason?: string;
}

export function breakEven(
  fixedCosts: number,
  price: number,
  unitCost: number,
  fees: SalesFees = NO_FEES,
): BreakEvenResult {
  assertFiniteNonNegative("fixedCosts", fixedCosts);
  const econ = unitEconomics(price, unitCost, fees);
  const contribution = econ.profitPerUnit;

  if (fixedCosts === 0) {
    return contribution >= 0
      ? { units: 0, revenue: 0, exactRevenue: 0, contributionPerUnit: contribution }
      : {
          units: null,
          revenue: null,
          exactRevenue: null,
          contributionPerUnit: contribution,
          reason: "Each sale loses money, so you can never break even at this price.",
        };
  }

  if (contribution <= 0) {
    return {
      units: null,
      revenue: null,
      exactRevenue: null,
      contributionPerUnit: contribution,
      reason:
        contribution === 0
          ? "Each sale only covers its own cost, so fixed costs are never recovered."
          : "Each sale loses money, so you can never break even at this price.",
    };
  }

  // Guard against float noise such as 100 / (1/3) → 300.00000000000006 → 301.
  const rawUnits = fixedCosts / contribution;
  const units = Math.ceil(rawUnits - 1e-9);
  return {
    units,
    revenue: units * price,
    exactRevenue: (fixedCosts / contribution) * price,
    contributionPerUnit: contribution,
  };
}

// ---------------------------------------------------------------------------
// Full calculator (what the UI calls)
// ---------------------------------------------------------------------------

export interface PricingCalculatorInput extends UnitCostInput {
  /** Monthly fixed costs (rent, software, insurance…). */
  monthlyFixedCosts: number;
  /** Margin you want on direct-to-customer (retail) sales. */
  targetRetailMarginPct: number;
  /** Margin you want on wholesale sales to shops. */
  targetWholesaleMarginPct: number;
  /** Fees on retail sales (card processing, Etsy, Shopify…). */
  retailFees: SalesFees;
  /** Optional: evaluate a price you already charge (or are considering). */
  actualRetailPrice?: number | null;
}

export interface PricingCalculatorResult {
  unitCost: UnitCostBreakdown;
  suggestedRetailPrice: number;
  suggestedWholesalePrice: number;
  retail: UnitEconomics;
  wholesale: UnitEconomics;
  /** Economics at the user's actual price, if one was provided. */
  actual: UnitEconomics | null;
  breakEvenRetail: BreakEvenResult;
  breakEvenWholesale: BreakEvenResult;
  breakEvenActual: BreakEvenResult | null;
  warnings: string[];
}

export function runPricingCalculator(input: PricingCalculatorInput): PricingCalculatorResult {
  const unitCost = calculateUnitCost(input);
  const cost = unitCost.costPerUnit;
  // Validate targets under their own names so errors point at the right field.
  assertPercentBelow100("targetRetailMarginPct", input.targetRetailMarginPct);
  assertPercentBelow100("targetWholesaleMarginPct", input.targetWholesaleMarginPct);
  assertFees(input.retailFees);
  if (input.targetRetailMarginPct + input.retailFees.percentFee >= 100) {
    throw new PricingInputError(
      "targetRetailMarginPct",
      "Target retail margin plus the percentage fee must be below 100% — no price can achieve this.",
    );
  }

  // Wholesale is typically sold by invoice with no per-sale platform fees.
  const suggestedWholesalePrice = priceForTargetMargin(cost, input.targetWholesaleMarginPct);
  const suggestedRetailPrice = priceForTargetMargin(
    cost,
    input.targetRetailMarginPct,
    input.retailFees,
  );

  const retail = unitEconomics(suggestedRetailPrice, cost, input.retailFees);
  const wholesale = unitEconomics(suggestedWholesalePrice, cost);

  const hasActual =
    input.actualRetailPrice !== undefined &&
    input.actualRetailPrice !== null &&
    !Number.isNaN(input.actualRetailPrice);
  const actual = hasActual
    ? unitEconomics(input.actualRetailPrice as number, cost, input.retailFees)
    : null;

  const warnings: string[] = [];
  if (suggestedWholesalePrice > suggestedRetailPrice) {
    warnings.push(
      "Suggested wholesale price is higher than retail. Shops usually need to buy at roughly half of retail — raise your retail margin or lower your wholesale margin.",
    );
  } else if (suggestedRetailPrice > 0 && suggestedWholesalePrice / suggestedRetailPrice > 0.6) {
    warnings.push(
      "Wholesale is more than 60% of retail, which leaves stockists little room for their own markup (they typically double wholesale).",
    );
  }
  if (actual && actual.profitPerUnit < 0) {
    warnings.push("Your current price is below your cost after fees — every sale loses money.");
  }
  if (input.laborRatePerHour === 0 && input.laborHoursPerBatch > 0) {
    warnings.push("Labour is costed at $0/hour. Pay yourself — otherwise your profit figures are overstated.");
  }

  return {
    unitCost,
    suggestedRetailPrice,
    suggestedWholesalePrice,
    retail,
    wholesale,
    actual,
    breakEvenRetail: breakEven(input.monthlyFixedCosts, suggestedRetailPrice, cost, input.retailFees),
    breakEvenWholesale: breakEven(input.monthlyFixedCosts, suggestedWholesalePrice, cost),
    breakEvenActual: actual
      ? breakEven(input.monthlyFixedCosts, actual.price, cost, input.retailFees)
      : null,
    warnings,
  };
}

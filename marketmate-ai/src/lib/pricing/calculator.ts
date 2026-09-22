/**
 * Pricing & Business Calculator — pure functions, no I/O.
 *
 * Definitions used throughout (standard small-business conventions):
 *   - Unit cost (variable cost per unit): everything it costs to make ONE unit.
 *   - Profit margin = (price − cost) / price          (share of the price that is profit)
 *   - Markup        = (price − cost) / cost           (how much you add on top of cost)
 *   - Contribution per unit = net revenue per unit − unit cost
 *   - Break-even units = costs to recover / profit contributed per unit (rounded UP)
 *
 * A "production run" is one batch you make (e.g. 100 candles). Every cost is
 * entered either as a total for the run or per unit; both are normalised to a
 * run total and a per-unit amount. Break-even answers: how many of this run
 * must I sell to earn back everything I spent making it?
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
  quantity: "Quantity produced",
  materials: "Material costs",
  packaging: "Packaging costs",
  labor: "Labour costs",
  transportation: "Transportation / gas",
  electricity: "Electricity",
  marketing: "Marketing expenses",
  other: "Other expenses",
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
// Production cost
// ---------------------------------------------------------------------------

export const COST_CATEGORIES = [
  "materials",
  "packaging",
  "labor",
  "transportation",
  "electricity",
  "marketing",
  "other",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

/** "total" = amount for the whole production run; "per_unit" = amount for each unit. */
export type CostBasis = "total" | "per_unit";

export interface CostLine {
  amount: number;
  basis: CostBasis;
}

export type ProductionCosts = Record<CostCategory, CostLine>;

export interface CostLineResult {
  category: CostCategory;
  total: number;
  perUnit: number;
}

export interface ProductionCostBreakdown {
  quantity: number;
  lines: CostLineResult[];
  totalProductionCost: number;
  costPerUnit: number;
}

/**
 * Normalises every cost to a run total and a per-unit amount.
 * Example: materials $300 (total) over 100 units → $3.00 per unit.
 */
export function calculateProductionCost(quantity: number, costs: ProductionCosts): ProductionCostBreakdown {
  assertPositive("quantity", quantity);
  if (!Number.isInteger(quantity)) {
    throw new PricingInputError("quantity", "Quantity produced must be a whole number.");
  }
  const lines = COST_CATEGORIES.map((category): CostLineResult => {
    const line = costs[category];
    assertFiniteNonNegative(category, line?.amount);
    if (line.basis !== "total" && line.basis !== "per_unit") {
      throw new PricingInputError(category, `${label(category)} must be a total or a per-unit amount.`);
    }
    return line.basis === "total"
      ? { category, total: line.amount, perUnit: line.amount / quantity }
      : { category, total: line.amount * quantity, perUnit: line.amount };
  });
  const totalProductionCost = lines.reduce((sum, l) => sum + l.total, 0);
  return { quantity, lines, totalProductionCost, costPerUnit: totalProductionCost / quantity };
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
// Full calculator (what the UI and the AI assistant call)
// ---------------------------------------------------------------------------

export interface PricingCalculatorInput {
  quantity: number;
  costs: ProductionCosts;
  /** Profit margin you want on direct-to-customer (retail) sales, after fees. */
  targetRetailMarginPct: number;
  /** Profit margin you want when selling wholesale to shops. */
  targetWholesaleMarginPct: number;
  /** Fees on retail sales (card processing, Etsy, Shopify…). Wholesale is assumed invoiced, fee-free. */
  retailFees: SalesFees;
  /** Optional: evaluate a price you already charge (or are considering). */
  actualRetailPrice?: number | null;
}

export interface ChannelResult extends UnitEconomics {
  /** Profit if the whole production run sells at this price. */
  totalPotentialProfit: number;
  /** Revenue if the whole production run sells at this price. */
  totalPotentialRevenue: number;
  /** Units of this run you must sell to earn back the total production cost. */
  breakEven: BreakEvenResult;
}

export interface PricingCalculatorResult {
  production: ProductionCostBreakdown;
  retail: ChannelResult;
  wholesale: ChannelResult;
  /** Results at the user's own price, if one was provided. */
  actual: ChannelResult | null;
  warnings: string[];
}

function channel(price: number, production: ProductionCostBreakdown, fees: SalesFees): ChannelResult {
  const econ = unitEconomics(price, production.costPerUnit, fees);
  return {
    ...econ,
    totalPotentialProfit: econ.profitPerUnit * production.quantity,
    totalPotentialRevenue: price * production.quantity,
    // Everything was spent up front, so each sale recovers its net revenue.
    breakEven: breakEven(production.totalProductionCost, price, 0, fees),
  };
}

export function runPricingCalculator(input: PricingCalculatorInput): PricingCalculatorResult {
  const production = calculateProductionCost(input.quantity, input.costs);
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

  const cost = production.costPerUnit;
  const retail = channel(priceForTargetMargin(cost, input.targetRetailMarginPct, input.retailFees), production, input.retailFees);
  const wholesale = channel(priceForTargetMargin(cost, input.targetWholesaleMarginPct), production, NO_FEES);

  const hasActual =
    input.actualRetailPrice !== undefined &&
    input.actualRetailPrice !== null &&
    !Number.isNaN(input.actualRetailPrice);
  if (hasActual) assertFiniteNonNegative("price", input.actualRetailPrice as number);
  const actual = hasActual ? channel(input.actualRetailPrice as number, production, input.retailFees) : null;

  const warnings: string[] = [];
  if (wholesale.price > retail.price) {
    warnings.push(
      "Suggested wholesale price is higher than retail. Shops usually need to buy at roughly half of retail — raise your retail margin or lower your wholesale margin.",
    );
  } else if (retail.price > 0 && wholesale.price / retail.price > 0.6) {
    warnings.push(
      "Wholesale is more than 60% of retail, which leaves stockists little room for their own markup (they typically double wholesale).",
    );
  }
  if (actual && actual.profitPerUnit < 0) {
    warnings.push("Your price is below your cost after fees — every sale loses money.");
  }
  if (actual?.breakEven.units != null && actual.breakEven.units > production.quantity) {
    warnings.push(
      `At your price you would need to sell ${actual.breakEven.units} units to break even, but this run only makes ${production.quantity}.`,
    );
  }
  if (input.costs.labor.amount === 0) {
    warnings.push("Labour is $0. Pay yourself — otherwise your profit figures are overstated.");
  }

  return { production, retail, wholesale, actual, warnings };
}

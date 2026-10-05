/**
 * Currencies and measurement units for the Smart Pricing Calculator.
 * Pure functions, safe to use on the server and in the browser.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /**
   * Units of this currency per 1 US dollar, ONLY for currencies with an
   * official fixed peg. These never change, so they can be offered as a
   * suggestion; every other rate must come from the user.
   */
  usdPeg?: number;
}

/** Add a currency here to make it available everywhere. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "BBD", name: "Barbadian Dollar", symbol: "$", usdPeg: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", usdPeg: 1 },
  { code: "CAD", name: "Canadian Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "TTD", name: "Trinidad & Tobago Dollar", symbol: "$" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "$" },
  { code: "XCD", name: "East Caribbean Dollar", symbol: "$", usdPeg: 2.7 },
];

export const DEFAULT_CURRENCY = "BBD";

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, name: code, symbol: "" };
}

export function isKnownCurrency(code: string): boolean {
  return CURRENCIES.some((c) => c.code === code);
}

/**
 * Formats money as "BBD $25.00". The code is always shown because "$" alone
 * is ambiguous across BBD, USD, CAD, TTD, JMD and XCD. Never returns NaN:
 * a missing or invalid amount shows as "—". Tiny amounts (like a cost per
 * gram) keep enough decimals to not show as $0.00.
 */
export function formatMoney(amount: number | null | undefined, code: string): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const decimals = abs > 0 && abs < 0.1 ? { minimumFractionDigits: 2, maximumFractionDigits: 4 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const digits = new Intl.NumberFormat("en-US", decimals).format(abs);
  const { symbol } = currencyInfo(code);
  return `${code} ${amount < 0 ? "-" : ""}${symbol}${digits}`;
}

/** "12" / "12.5" / "1,250" — numbers for sentences, never NaN. */
export function formatNumber(n: number | null | undefined, maxDecimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDecimals }).format(n);
}

/**
 * The official fixed rate between two pegged currencies (e.g. 1 USD = 2 BBD),
 * or null when either currency floats. Never a "live" rate.
 */
export function fixedRate(from: string, to: string): number | null {
  const a = currencyInfo(from).usdPeg;
  const b = currencyInfo(to).usdPeg;
  if (!a || !b) return null;
  return b / a;
}

export class CurrencyRateMissingError extends Error {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Enter the exchange rate: 1 ${from} = how many ${to}?`);
    this.name = "CurrencyRateMissingError";
  }
}

/**
 * Converts money using a rate the USER supplied (`rates[from]` = how many
 * `to` for 1 `from`). Never converts silently: with no rate it throws.
 */
export function convertCurrency(amount: number, from: string, to: string, rates: Record<string, number | null | undefined>): number {
  if (from === to) return amount;
  const rate = rates[from];
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) throw new CurrencyRateMissingError(from, to);
  return amount * rate;
}

// ---------------------------------------------------------------------------
// Measurement units
// ---------------------------------------------------------------------------

export type Dimension = "count" | "mass" | "volume" | "length";

export interface UnitInfo {
  id: string;
  /** Plural label, e.g. "kilograms (kg)". */
  label: string;
  /** Short form used in sentences, e.g. "kg". */
  short: string;
  singular: string;
  dimension: Dimension;
  /** Size in the dimension's base unit (g, ml, m). Count units are never converted. */
  toBase: number;
}

const count = (id: string, singular: string): UnitInfo => ({ id, label: id, short: id, singular, dimension: "count", toBase: 1 });

export const UNITS: UnitInfo[] = [
  count("pieces", "piece"),
  count("items", "item"),
  count("units", "unit"),
  count("boxes", "box"),
  count("bags", "bag"),
  count("packs", "pack"),
  count("portions", "portion"),
  count("servings", "serving"),
  count("plates", "plate"),
  count("cups", "cup"),
  count("bottles", "bottle"),
  count("containers", "container"),
  count("trays", "tray"),
  { id: "g", label: "grams (g)", short: "g", singular: "gram", dimension: "mass", toBase: 1 },
  { id: "kg", label: "kilograms (kg)", short: "kg", singular: "kilogram", dimension: "mass", toBase: 1000 },
  { id: "oz", label: "ounces (oz, weight)", short: "oz", singular: "ounce", dimension: "mass", toBase: 28.349523125 },
  { id: "lb", label: "pounds (lb)", short: "lb", singular: "pound", dimension: "mass", toBase: 453.59237 },
  { id: "ml", label: "milliliters (ml)", short: "ml", singular: "milliliter", dimension: "volume", toBase: 1 },
  { id: "l", label: "liters (L)", short: "L", singular: "liter", dimension: "volume", toBase: 1000 },
  { id: "floz", label: "fluid ounces (US fl oz)", short: "fl oz", singular: "fluid ounce", dimension: "volume", toBase: 29.5735295625 },
  { id: "gal", label: "gallons (US)", short: "gal", singular: "gallon", dimension: "volume", toBase: 3785.411784 },
  { id: "cm", label: "centimeters (cm)", short: "cm", singular: "centimeter", dimension: "length", toBase: 0.01 },
  { id: "m", label: "meters (m)", short: "m", singular: "meter", dimension: "length", toBase: 1 },
  { id: "in", label: "inches (in)", short: "in", singular: "inch", dimension: "length", toBase: 0.0254 },
  { id: "ft", label: "feet (ft)", short: "ft", singular: "foot", dimension: "length", toBase: 0.3048 },
  { id: "yd", label: "yards (yd)", short: "yd", singular: "yard", dimension: "length", toBase: 0.9144 },
];

export function unitInfo(id: string): UnitInfo {
  return UNITS.find((u) => u.id === id) ?? count("items", "item");
}

export function isMeasured(unitId: string): boolean {
  return unitInfo(unitId).dimension !== "count";
}

/** Units that can be converted to/from `unitId` (same dimension); count units only match themselves. */
export function compatibleUnits(unitId: string): UnitInfo[] {
  const u = unitInfo(unitId);
  return u.dimension === "count" ? [u] : UNITS.filter((x) => x.dimension === u.dimension);
}

export class MeasurementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeasurementError";
  }
}

/** Converts between units of the same kind, e.g. 5 kg → 5000 g. */
export function convertMeasurement(value: number, from: string, to: string): number {
  if (from === to) return value;
  const a = unitInfo(from);
  const b = unitInfo(to);
  if (a.dimension === "count" || b.dimension === "count" || a.dimension !== b.dimension) {
    throw new MeasurementError(`${a.singular}s can't be converted to ${b.singular}s.`);
  }
  return (value * a.toBase) / b.toBase;
}

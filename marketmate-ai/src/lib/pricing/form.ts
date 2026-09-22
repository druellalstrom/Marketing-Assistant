import { COST_CATEGORIES, type CostBasis, type CostCategory, type PricingCalculatorInput } from "./calculator";

/** String-valued form state for the calculator UI (shared by server and client). */
export interface CalculatorFormState {
  productName: string;
  quantity: string;
  costs: Record<CostCategory, { amount: string; basis: CostBasis }>;
  retailMargin: string;
  wholesaleMargin: string;
  percentFee: string;
  fixedFee: string;
  actualPrice: string;
}

export const DEFAULT_FORM: CalculatorFormState = {
  productName: "",
  quantity: "100",
  costs: {
    materials: { amount: "300", basis: "total" },
    packaging: { amount: "0.50", basis: "per_unit" },
    labor: { amount: "200", basis: "total" },
    transportation: { amount: "30", basis: "total" },
    electricity: { amount: "20", basis: "total" },
    marketing: { amount: "50", basis: "total" },
    other: { amount: "0", basis: "total" },
  },
  retailMargin: "70",
  wholesaleMargin: "40",
  percentFee: "0",
  fixedFee: "0",
  actualPrice: "",
};

/** Converts a saved calculation's inputs back into form state. */
export function formFromInput(name: string, input: PricingCalculatorInput): CalculatorFormState {
  return {
    productName: name,
    quantity: String(input.quantity),
    costs: Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, { amount: String(input.costs[c].amount), basis: input.costs[c].basis }]),
    ) as CalculatorFormState["costs"],
    retailMargin: String(input.targetRetailMarginPct),
    wholesaleMargin: String(input.targetWholesaleMarginPct),
    percentFee: String(input.retailFees.percentFee),
    fixedFee: String(input.retailFees.fixedFeePerSale),
    actualPrice: input.actualRetailPrice == null ? "" : String(input.actualRetailPrice),
  };
}


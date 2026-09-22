"use client";

import { useMemo, useState, useTransition } from "react";
import {
  PricingInputError,
  roundPercent,
  runPricingCalculator,
  type BreakEvenResult,
  type PricingCalculatorInput,
  type UnitEconomics,
} from "@/lib/pricing/calculator";
import { saveCalculation } from "./actions";

type FieldKey =
  | "materialCostPerBatch"
  | "laborHoursPerBatch"
  | "laborRatePerHour"
  | "otherCostPerBatch"
  | "unitsPerBatch"
  | "packagingCostPerUnit"
  | "monthlyFixedCosts"
  | "targetRetailMarginPct"
  | "targetWholesaleMarginPct"
  | "percentFee"
  | "fixedFeePerSale"
  | "actualRetailPrice";

const DEFAULTS: Record<FieldKey, string> = {
  materialCostPerBatch: "40",
  laborHoursPerBatch: "2",
  laborRatePerHour: "20",
  otherCostPerBatch: "10",
  unitsPerBatch: "20",
  packagingCostPerUnit: "0.50",
  monthlyFixedCosts: "500",
  targetRetailMarginPct: "60",
  targetWholesaleMarginPct: "50",
  percentFee: "2.9",
  fixedFeePerSale: "0.30",
  actualRetailPrice: "",
};

const SECTIONS: { title: string; fields: [FieldKey, string, string?][] }[] = [
  {
    title: "Production costs (per batch)",
    fields: [
      ["materialCostPerBatch", "Materials / ingredients ($)"],
      ["laborHoursPerBatch", "Labour hours"],
      ["laborRatePerHour", "Labour rate ($/hour)", "Include what you pay yourself."],
      ["otherCostPerBatch", "Other batch costs ($)"],
      ["unitsPerBatch", "Units per batch"],
      ["packagingCostPerUnit", "Packaging per unit ($)"],
    ],
  },
  {
    title: "Targets & overheads",
    fields: [
      ["targetRetailMarginPct", "Target retail margin (%)", "Profit as % of the retail price, after fees."],
      ["targetWholesaleMarginPct", "Target wholesale margin (%)"],
      ["monthlyFixedCosts", "Monthly fixed costs ($)", "Rent, software, insurance, etc."],
    ],
  },
  {
    title: "Retail sales fees",
    fields: [
      ["percentFee", "Percentage fee (%)", "Card processing / marketplace fee."],
      ["fixedFeePerSale", "Fixed fee per sale ($)"],
      ["actualRetailPrice", "Your current price ($, optional)", "See how an existing price performs."],
    ],
  },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (n: number) => currency.format(n);
const pct = (n: number | null) => (n === null ? "—" : `${roundPercent(n)}%`);

function toInput(values: Record<FieldKey, string>): PricingCalculatorInput {
  const num = (k: FieldKey) => (values[k].trim() === "" ? Number.NaN : Number(values[k]));
  return {
    materialCostPerBatch: num("materialCostPerBatch"),
    laborHoursPerBatch: num("laborHoursPerBatch"),
    laborRatePerHour: num("laborRatePerHour"),
    otherCostPerBatch: num("otherCostPerBatch"),
    unitsPerBatch: num("unitsPerBatch"),
    packagingCostPerUnit: num("packagingCostPerUnit"),
    monthlyFixedCosts: num("monthlyFixedCosts"),
    targetRetailMarginPct: num("targetRetailMarginPct"),
    targetWholesaleMarginPct: num("targetWholesaleMarginPct"),
    retailFees: { percentFee: num("percentFee"), fixedFeePerSale: num("fixedFeePerSale") },
    actualRetailPrice: values.actualRetailPrice.trim() === "" ? null : num("actualRetailPrice"),
  };
}

function breakEvenText(b: BreakEvenResult) {
  if (b.units === null) return b.reason ?? "Never";
  return `${b.units.toLocaleString()} units / month (${money(b.revenue ?? 0)})`;
}

function EconomicsCard({ title, e, be, highlight }: { title: string; e: UnitEconomics; be: BreakEvenResult; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "border-brand" : ""}`}>
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-1 text-3xl font-bold">{money(e.price)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Profit / unit</dt>
        <dd className={`text-right font-medium ${e.profitPerUnit < 0 ? "text-red-600" : ""}`}>{money(e.profitPerUnit)}</dd>
        <dt className="text-muted">Profit margin</dt>
        <dd className="text-right font-medium">{pct(e.profitMarginPct)}</dd>
        <dt className="text-muted">Markup</dt>
        <dd className="text-right font-medium">{pct(e.markupPct)}</dd>
        {e.feesPerUnit > 0 && (
          <>
            <dt className="text-muted">Fees / sale</dt>
            <dd className="text-right font-medium">{money(e.feesPerUnit)}</dd>
          </>
        )}
        <dt className="col-span-2 mt-2 text-muted">Break-even</dt>
        <dd className="col-span-2 font-medium">{breakEvenText(be)}</dd>
      </dl>
    </div>
  );
}

export function PricingCalculator({ canSave }: { canSave: boolean }) {
  const [values, setValues] = useState(DEFAULTS);
  const [productName, setProductName] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const input = useMemo(() => toInput(values), [values]);
  const computed = useMemo(() => {
    try {
      return { result: runPricingCalculator(input), error: null };
    } catch (e) {
      if (e instanceof PricingInputError) return { result: null, error: e };
      throw e;
    }
  }, [input]);

  const set = (k: FieldKey) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: ev.target.value }));
    setSaveMsg(null);
  };

  function onSave(ev: React.FormEvent) {
    ev.preventDefault();
    startSaving(async () => {
      const res = await saveCalculation(productName, input);
      setSaveMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error ?? "Failed." });
    });
  }

  const r = computed.result;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <fieldset key={section.title} className="card space-y-3">
            <legend className="px-1 text-sm font-semibold">{section.title}</legend>
            {section.fields.map(([key, label, help]) => (
              <div key={key}>
                <label className="label" htmlFor={key}>{label}</label>
                <input
                  id={key}
                  className={`input ${computed.error?.field === key ? "border-red-500" : ""}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={values[key]}
                  onChange={set(key)}
                  aria-describedby={help ? `${key}-help` : undefined}
                />
                {help && <p id={`${key}-help`} className="mt-1 text-xs text-muted">{help}</p>}
              </div>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="space-y-6" aria-live="polite">
        {computed.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {computed.error.message}
          </div>
        )}
        {r && (
          <>
            <div className="card">
              <p className="text-sm text-muted">Cost per unit</p>
              <p className="mt-1 text-3xl font-bold">{money(r.unitCost.costPerUnit)}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  ["Materials", r.unitCost.materialPerUnit],
                  ["Labour", r.unitCost.laborPerUnit],
                  ["Other", r.unitCost.otherPerUnit],
                  ["Packaging", r.unitCost.packagingPerUnit],
                ].map(([label, val]) => (
                  <div key={label as string} className="rounded-lg bg-background p-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-medium">{money(val as number)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">Total batch cost: {money(r.unitCost.totalBatchCost)}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <EconomicsCard title="Suggested retail price" e={r.retail} be={r.breakEvenRetail} highlight />
              <EconomicsCard title="Suggested wholesale price" e={r.wholesale} be={r.breakEvenWholesale} />
              {r.actual && r.breakEvenActual && (
                <EconomicsCard title="Your current price" e={r.actual} be={r.breakEvenActual} />
              )}
            </div>

            {r.warnings.length > 0 && (
              <ul className="space-y-2">
                {r.warnings.map((w) => (
                  <li key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w}</li>
                ))}
              </ul>
            )}

            <form onSubmit={onSave} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="label" htmlFor="productName">Product name</label>
                <input
                  id="productName"
                  className="input"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Lavender candle 8oz"
                  maxLength={200}
                  required
                  disabled={!canSave}
                />
              </div>
              <button className="btn-primary" disabled={!canSave || saving}>
                {saving ? "Saving…" : "Save calculation"}
              </button>
              {!canSave && <p className="text-sm text-muted">Sign in to save.</p>}
              {saveMsg && (
                <p className={`text-sm ${saveMsg.ok ? "text-green-700" : "text-red-600"}`} role="status">{saveMsg.text}</p>
              )}
            </form>
          </>
        )}
        <details className="card text-sm text-muted">
          <summary className="cursor-pointer font-medium text-foreground">How these numbers are calculated</summary>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Cost per unit = (materials + labour hours × rate + other batch costs) ÷ units + packaging.</li>
            <li>Price for a target margin (after fees) = (cost + fixed fee) ÷ (1 − margin% − fee%).</li>
            <li>Profit margin = profit ÷ price. Markup = (price − cost) ÷ cost.</li>
            <li>Break-even units = monthly fixed costs ÷ profit per unit, rounded up.</li>
            <li>Wholesale is calculated without per-sale fees (typically invoiced).</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

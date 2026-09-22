"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  COST_CATEGORIES,
  PricingInputError,
  roundPercent,
  runPricingCalculator,
  type ChannelResult,
  type CostBasis,
  type CostCategory,
  type PricingCalculatorInput,
} from "@/lib/pricing/calculator";
import { saveCalculation } from "./actions";
import { DEFAULT_FORM, type CalculatorFormState } from "@/lib/pricing/form";

const COST_LABELS: Record<CostCategory, { label: string; hint: string; basis: CostBasis }> = {
  materials: { label: "Material costs", hint: "e.g. wax, wicks, fragrance for the whole run", basis: "total" },
  packaging: { label: "Packaging costs", hint: "jars, labels, boxes", basis: "per_unit" },
  labor: { label: "Labour costs", hint: "include what you pay yourself", basis: "total" },
  transportation: { label: "Transportation / gas", hint: "supply runs, deliveries", basis: "total" },
  electricity: { label: "Electricity", hint: "power used for this run", basis: "total" },
  marketing: { label: "Marketing expenses", hint: "ads, samples, promo for this product", basis: "total" },
  other: { label: "Other expenses", hint: "anything else", basis: "total" },
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (n: number) => currency.format(n);
const pct = (n: number | null) => (n === null ? "—" : `${roundPercent(n)}%`);
const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

function toInput(f: CalculatorFormState): PricingCalculatorInput {
  return {
    quantity: num(f.quantity),
    costs: Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, { amount: num(f.costs[c].amount), basis: f.costs[c].basis }]),
    ) as PricingCalculatorInput["costs"],
    targetRetailMarginPct: num(f.retailMargin),
    targetWholesaleMarginPct: num(f.wholesaleMargin),
    retailFees: { percentFee: num(f.percentFee), fixedFeePerSale: num(f.fixedFee) },
    actualRetailPrice: f.actualPrice.trim() === "" ? null : num(f.actualPrice),
  };
}

function ChannelCard({ title, c, highlight, quantity }: { title: string; c: ChannelResult; highlight?: boolean; quantity: number }) {
  const be = c.breakEven;
  return (
    <div className={`card ${highlight ? "border-brand ring-1 ring-brand/30" : ""}`}>
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{money(c.price)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Profit per unit</dt>
        <dd className={`text-right font-medium tabular-nums ${c.profitPerUnit < 0 ? "text-red-600" : ""}`}>{money(c.profitPerUnit)}</dd>
        <dt className="text-muted">Total potential profit</dt>
        <dd className={`text-right font-medium tabular-nums ${c.totalPotentialProfit < 0 ? "text-red-600" : ""}`}>{money(c.totalPotentialProfit)}</dd>
        <dt className="text-muted">Profit margin</dt>
        <dd className="text-right font-medium tabular-nums">{pct(c.profitMarginPct)}</dd>
        <dt className="text-muted">Markup</dt>
        <dd className="text-right font-medium tabular-nums">{pct(c.markupPct)}</dd>
        {c.feesPerUnit > 0 && (
          <>
            <dt className="text-muted">Fees per sale</dt>
            <dd className="text-right font-medium tabular-nums">{money(c.feesPerUnit)}</dd>
          </>
        )}
        <dt className="col-span-2 mt-2 border-t border-border pt-2 text-muted">Break-even</dt>
        <dd className="col-span-2 font-medium">
          {be.units === null
            ? be.reason
            : `${be.units.toLocaleString()} of ${quantity.toLocaleString()} units · ${money(be.revenue ?? 0)} revenue`}
        </dd>
      </dl>
    </div>
  );
}

function MarginInput({ id, label, value, onChange, help }: { id: string; label: string; value: string; onChange: (v: string) => void; help: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={95} step={1} value={Number(value) || 0} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-[var(--brand)]" aria-label={`${label} slider`} />
        <div className="relative w-24">
          <input id={id} className="input pr-7 tabular-nums" type="number" min={0} max={99.99} step="any" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
          <span className="pointer-events-none absolute right-3 top-2 text-sm text-muted">%</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{help}</p>
    </div>
  );
}

export function PricingCalculator({ canSave, initial, savedId }: { canSave: boolean; initial?: CalculatorFormState; savedId?: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState<CalculatorFormState>(initial ?? DEFAULT_FORM);
  const [currentId, setCurrentId] = useState<string | null>(savedId ?? null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const input = useMemo(() => toInput(form), [form]);
  const computed = useMemo(() => {
    try {
      return { result: runPricingCalculator(input), error: null };
    } catch (e) {
      if (e instanceof PricingInputError) return { result: null, error: e };
      throw e;
    }
  }, [input]);

  const update = (patch: Partial<CalculatorFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaveMsg(null);
  };
  const updateCost = (c: CostCategory, patch: Partial<{ amount: string; basis: CostBasis }>) =>
    update({ costs: { ...form.costs, [c]: { ...form.costs[c], ...patch } } });

  function save(asNew: boolean) {
    startSaving(async () => {
      const res = await saveCalculation(asNew ? null : currentId, form.productName, input);
      if (res.ok) {
        setCurrentId(res.id ?? null);
        setSaveMsg({ ok: true, text: asNew || !currentId ? "Saved to your pricing library." : "Changes saved." });
        router.refresh();
      } else {
        setSaveMsg({ ok: false, text: res.error ?? "Save failed." });
      }
    });
  }

  const errField = computed.error?.field;
  const r = computed.result;
  const q = Number.isFinite(input.quantity) ? input.quantity : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_1fr]">
      <div className="space-y-6">
        <fieldset className="card space-y-3">
          <legend className="px-1 text-sm font-semibold">Product</legend>
          <div>
            <label className="label" htmlFor="productName">Product name</label>
            <input id="productName" className="input" maxLength={200} value={form.productName} onChange={(e) => update({ productName: e.target.value })} placeholder="e.g. Lavender soy candle, 8oz" />
          </div>
          <div>
            <label className="label" htmlFor="quantity">Quantity produced</label>
            <input id="quantity" className={`input tabular-nums ${errField === "quantity" ? "border-red-500" : ""}`} type="number" min={1} step={1} inputMode="numeric" value={form.quantity} onChange={(e) => update({ quantity: e.target.value })} />
            <p className="mt-1 text-xs text-muted">How many units this production run makes.</p>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend className="px-1 text-sm font-semibold">Costs for this production run</legend>
          <div className="space-y-3">
            {COST_CATEGORIES.map((c) => {
              const line = r?.production.lines.find((l) => l.category === c);
              return (
                <div key={c}>
                  <label className="label" htmlFor={`cost-${c}`}>{COST_LABELS[c].label}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted">$</span>
                      <input id={`cost-${c}`} className={`input pl-6 tabular-nums ${errField === c ? "border-red-500" : ""}`} type="number" min={0} step="any" inputMode="decimal" value={form.costs[c].amount} onChange={(e) => updateCost(c, { amount: e.target.value })} />
                    </div>
                    <select className="input w-36" aria-label={`${COST_LABELS[c].label} basis`} value={form.costs[c].basis} onChange={(e) => updateCost(c, { basis: e.target.value as CostBasis })}>
                      <option value="total">total for run</option>
                      <option value="per_unit">per unit</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {line && line.total > 0 ? `${money(line.total)} total · ${money(line.perUnit)} per unit` : COST_LABELS[c].hint}
                  </p>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Pricing targets</legend>
          <MarginInput id="retailMargin" label="Desired retail profit margin" value={form.retailMargin} onChange={(v) => update({ retailMargin: v })} help="Share of the retail price you keep as profit, after fees." />
          <MarginInput id="wholesaleMargin" label="Desired wholesale profit margin" value={form.wholesaleMargin} onChange={(v) => update({ wholesaleMargin: v })} help="Shops usually need wholesale at about half your retail price." />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="percentFee">Sales fee (%)</label>
              <input id="percentFee" className={`input tabular-nums ${errField === "percentFee" ? "border-red-500" : ""}`} type="number" min={0} step="any" value={form.percentFee} onChange={(e) => update({ percentFee: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="fixedFee">Fee per sale ($)</label>
              <input id="fixedFee" className={`input tabular-nums ${errField === "fixedFeePerSale" ? "border-red-500" : ""}`} type="number" min={0} step="any" value={form.fixedFee} onChange={(e) => update({ fixedFee: e.target.value })} />
            </div>
            <p className="col-span-2 -mt-1 text-xs text-muted">Card processing or marketplace fees on retail sales (e.g. 2.9% + $0.30). Leave 0 if none.</p>
          </div>
          <div>
            <label className="label" htmlFor="actualPrice">Your current price ($, optional)</label>
            <input id="actualPrice" className={`input tabular-nums ${errField === "price" ? "border-red-500" : ""}`} type="number" min={0} step="any" value={form.actualPrice} onChange={(e) => update({ actualPrice: e.target.value })} placeholder="See how a price you charge performs" />
          </div>
        </fieldset>
      </div>

      <div className="space-y-6" aria-live="polite">
        {computed.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">{computed.error.message}</div>
        )}
        {r && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card">
                <p className="text-sm text-muted">Total production cost</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{money(r.production.totalProductionCost)}</p>
                <p className="mt-1 text-xs text-muted">for {r.production.quantity.toLocaleString()} units</p>
              </div>
              <div className="card">
                <p className="text-sm text-muted">Cost per unit</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{money(r.production.costPerUnit)}</p>
                <p className="mt-1 text-xs text-muted">what each unit really costs you</p>
              </div>
            </div>

            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <caption className="sr-only">Cost breakdown</caption>
                <thead className="border-b border-border text-left text-muted">
                  <tr><th className="p-3 font-medium">Cost</th><th className="p-3 text-right font-medium">Run total</th><th className="p-3 text-right font-medium">Per unit</th></tr>
                </thead>
                <tbody>
                  {r.production.lines.filter((l) => l.total > 0).map((l) => (
                    <tr key={l.category} className="border-b border-border last:border-0">
                      <td className="p-3">{COST_LABELS[l.category].label}</td>
                      <td className="p-3 text-right tabular-nums">{money(l.total)}</td>
                      <td className="p-3 text-right tabular-nums">{money(l.perUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelCard title="Suggested retail price" c={r.retail} quantity={q} highlight />
              <ChannelCard title="Suggested wholesale price" c={r.wholesale} quantity={q} />
              {r.actual && <ChannelCard title="Your current price" c={r.actual} quantity={q} />}
            </div>

            {r.warnings.length > 0 && (
              <ul className="space-y-2">
                {r.warnings.map((w) => (
                  <li key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w}</li>
                ))}
              </ul>
            )}

            <div className="card space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-primary" disabled={!canSave || saving || !form.productName.trim()} onClick={() => save(false)}>
                  {saving ? "Saving…" : currentId ? "Save changes" : "Save calculation"}
                </button>
                {currentId && (
                  <button type="button" className="btn-secondary" disabled={!canSave || saving || !form.productName.trim()} onClick={() => save(true)}>Save as new</button>
                )}
                <button type="button" className="btn-secondary" onClick={() => { setForm(DEFAULT_FORM); setCurrentId(null); setSaveMsg(null); }}>Reset</button>
              </div>
              {!canSave && <p className="text-sm text-muted">Sign in to save calculations.</p>}
              {canSave && !form.productName.trim() && <p className="text-sm text-muted">Enter a product name to save.</p>}
              {saveMsg && <p className={`text-sm ${saveMsg.ok ? "text-green-700" : "text-red-600"}`} role="status">{saveMsg.text}</p>}
            </div>
          </>
        )}

        <details className="card text-sm" open>
          <summary className="cursor-pointer font-semibold">What these terms mean</summary>
          <dl className="mt-3 space-y-3">
            {[
              ["Cost", "What it costs you to make one unit: every expense for the run divided by the quantity produced. $300 of materials across 100 units is $3 per unit."],
              ["Retail price", "What you charge customers who buy directly from you."],
              ["Wholesale price", "The lower price you charge shops that buy in bulk to resell. They usually double it to set their own retail price, so it should be around half of yours."],
              ["Profit", "What you keep from a sale: price − fees − cost per unit."],
              ["Profit margin", "Profit as a share of the price. A $10 item with $4 profit has a 40% margin."],
              ["Markup", "How much you add on top of cost, as a share of cost. Cost $6, price $10 → $4 added → 66.7% markup. Margin and markup describe the same profit from different starting points, so a 50% margin equals a 100% markup."],
              ["Break-even point", "How many units of this run you must sell to earn back everything you spent making it. Every sale after that is profit."],
            ].map(([term, def]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted">{def}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Formulas: price for a target margin = (cost + fee per sale) ÷ (1 − margin% − fee%). Break-even units = total production cost ÷ what you receive per sale after fees, rounded up.</p>
        </details>
      </div>
    </div>
  );
}

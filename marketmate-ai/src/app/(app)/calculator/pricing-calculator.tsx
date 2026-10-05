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

const COST_LABELS: Record<CostCategory, { label: string; hint: string }> = {
  materials: { label: "Materials", hint: "fabric, thread, wax, ingredients…" },
  packaging: { label: "Packaging", hint: "bags, boxes, labels, tags" },
  labor: { label: "Your time / labour", hint: "what you pay yourself or helpers" },
  transportation: { label: "Transport / gas", hint: "supply runs, deliveries" },
  electricity: { label: "Electricity", hint: "power used to make them" },
  marketing: { label: "Advertising", hint: "ads, samples, promotion" },
  other: { label: "Anything else", hint: "tools, fees, other costs" },
};
/** The three costs almost everyone has; the rest sit behind "Add more costs". */
const MAIN_COSTS: CostCategory[] = ["materials", "packaging", "labor"];
const EXTRA_COSTS = COST_CATEGORIES.filter((c) => !MAIN_COSTS.includes(c));

const PROFIT_LEVELS = [
  { value: "50", label: "Lower price", detail: "keep 50% as profit" },
  { value: "60", label: "Balanced", detail: "keep 60% as profit" },
  { value: "70", label: "Higher profit", detail: "keep 70% as profit" },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (n: number) => currency.format(n);
const pct = (n: number | null) => (n === null ? "—" : `${roundPercent(n)}%`);
const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
/** Optional money boxes: blank means $0. */
const orZero = (v: string) => (v.trim() === "" ? 0 : Number(v));

function toInput(f: CalculatorFormState): PricingCalculatorInput {
  return {
    quantity: num(f.quantity),
    costs: Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, { amount: orZero(f.costs[c].amount), basis: f.costs[c].basis }]),
    ) as PricingCalculatorInput["costs"],
    targetRetailMarginPct: num(f.retailMargin),
    targetWholesaleMarginPct: num(f.wholesaleMargin),
    retailFees: { percentFee: orZero(f.percentFee), fixedFeePerSale: orZero(f.fixedFee) },
    actualRetailPrice: f.actualPrice.trim() === "" ? null : num(f.actualPrice),
  };
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-lg font-bold text-navy">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-base text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function MoneyInput({ id, value, onChange, invalid, placeholder = "0.00", label }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; placeholder?: string; label?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted">$</span>
      <input
        id={id}
        aria-label={label}
        className={`input pl-7 text-lg tabular-nums ${invalid ? "border-red-500" : ""}`}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CostRow({ c, form, quantity, invalid, onAmount, onBasis }: {
  c: CostCategory;
  form: CalculatorFormState;
  quantity: number;
  invalid: boolean;
  onAmount: (v: string) => void;
  onBasis: (b: CostBasis) => void;
}) {
  const { label, hint } = COST_LABELS[c];
  const basis = form.costs[c].basis;
  const choice = (b: CostBasis, text: string) => (
    <button
      type="button"
      aria-pressed={basis === b}
      onClick={() => onBasis(b)}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${basis === b ? "bg-navy text-white" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <label className="label" htmlFor={`cost-${c}`}>{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-32 flex-1">
          <MoneyInput id={`cost-${c}`} value={form.costs[c].amount} onChange={onAmount} invalid={invalid} />
        </div>
        <div role="group" aria-label={`${label}: is this amount for all of them or for each one?`} className="flex rounded-full border border-border p-0.5">
          {choice("total", quantity > 0 ? `for all ${quantity.toLocaleString()}` : "for all")}
          {choice("per_unit", "for each one")}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

function ChannelDetails({ title, c, quantity }: { title: string; c: ChannelResult; quantity: number }) {
  const rows: [string, string][] = [
    ["Price", money(c.price)],
    ["Profit per item", money(c.profitPerUnit)],
    [`Profit if all ${quantity.toLocaleString()} sell`, money(c.totalPotentialProfit)],
    ["Profit margin", pct(c.profitMarginPct)],
    ["Markup", pct(c.markupPct)],
    ...(c.feesPerUnit > 0 ? [["Fees per sale", money(c.feesPerUnit)] as [string, string]] : []),
    ["Break-even", c.breakEven.units === null ? (c.breakEven.reason ?? "—") : `${c.breakEven.units.toLocaleString()} sold (${money(c.breakEven.revenue ?? 0)})`],
  ];
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

export function PricingCalculator({ canSave, initial, savedId }: { canSave: boolean; initial?: CalculatorFormState; savedId?: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState<CalculatorFormState>(initial ?? DEFAULT_FORM);
  const [currentId, setCurrentId] = useState<string | null>(savedId ?? null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [showExtra, setShowExtra] = useState(() => EXTRA_COSTS.some((c) => (initial ?? DEFAULT_FORM).costs[c].amount.trim() !== ""));

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
  const updateCost = (c: CostCategory, patch: Partial<{ amount: string; basis: CostBasis }>) => {
    setForm((f) => ({ ...f, costs: { ...f.costs, [c]: { ...f.costs[c], ...patch } } }));
    setSaveMsg(null);
  };

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

  const r = computed.result;
  const q = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 0;
  const noQuantity = form.quantity.trim() === "" || input.quantity === 0;
  const noCosts = Boolean(r) && r!.production.totalProductionCost === 0;
  // Missing answers are a prompt, not an error.
  const error = noQuantity ? null : computed.error;
  const errField = error?.field;
  const name = form.productName.trim();
  const itemName = name && name.length <= 40 ? name : "one";
  const isPreset = PROFIT_LEVELS.some((l) => l.value === form.retailMargin);
  const ready = Boolean(r) && !error && !noQuantity && !noCosts;
  // Shop-pricing warnings belong with the shop details, not in front of beginners.
  const isShopWarning = (w: string) => /wholesale/i.test(w);
  const mainWarnings = ready ? r!.warnings.filter((w) => !isShopWarning(w)) : [];
  const shopWarnings = ready ? r!.warnings.filter(isShopWarning) : [];
  const moreOptionsUsed = !isPreset || form.wholesaleMargin !== "40" || orZero(form.percentFee) > 0 || orZero(form.fixedFee) > 0 || form.actualPrice.trim() !== "";

  return (
    <div className={`grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_1fr] ${ready ? "pb-20 xl:pb-0" : ""}`}>
      {ready && r && (
        // Phones: keep the answer in view while filling in the form.
        <a
          href="#your-answer"
          className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(23,37,84,0.12)] xl:hidden"
        >
          <span className="text-base text-slate-700">Sell each for <strong className="text-2xl tabular-nums text-navy">{money(r.retail.price)}</strong></span>
          <span className="text-sm font-semibold text-brand-strong">See details ↓</span>
        </a>
      )}
      <div className="space-y-6">
        <Step n={1} title="What are you pricing?">
          <div>
            <label className="label" htmlFor="productName">Product name</label>
            <input id="productName" className="input text-lg" maxLength={200} value={form.productName} onChange={(e) => update({ productName: e.target.value })} placeholder="e.g. Summer dress" />
          </div>
          <div>
            <label className="label" htmlFor="quantity">How many did you make?</label>
            <input id="quantity" className={`input text-lg tabular-nums ${errField === "quantity" ? "border-red-500" : ""}`} type="number" min={1} step={1} inputMode="numeric" placeholder="e.g. 20" value={form.quantity} onChange={(e) => update({ quantity: e.target.value })} />
            <p className="mt-1 text-sm text-muted">The number of items in this batch.</p>
          </div>
        </Step>

        <Step n={2} title="What did they cost you?">
          <p className="-mt-2 text-sm text-muted">Fill in what applies and leave the rest empty. For each cost, choose whether the amount is for the whole batch or for each item.</p>
          {MAIN_COSTS.map((c) => (
            <CostRow key={c} c={c} form={form} quantity={q} invalid={errField === c} onAmount={(v) => updateCost(c, { amount: v })} onBasis={(b) => updateCost(c, { basis: b })} />
          ))}
          {showExtra ? (
            EXTRA_COSTS.map((c) => (
              <CostRow key={c} c={c} form={form} quantity={q} invalid={errField === c} onAmount={(v) => updateCost(c, { amount: v })} onBasis={(b) => updateCost(c, { basis: b })} />
            ))
          ) : (
            <button type="button" className="btn-secondary w-full" onClick={() => setShowExtra(true)}>
              + Add more costs (transport, electricity, advertising…)
            </button>
          )}
        </Step>

        <Step n={3} title="How much profit do you want?">
          <div role="radiogroup" aria-label="Profit level" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROFIT_LEVELS.map((l) => {
              const active = form.retailMargin === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ retailMargin: l.value })}
                  className={`rounded-xl border-2 p-3 text-left transition ${active ? "border-brand bg-brand/5" : "border-border hover:border-slate-400"}`}
                >
                  <span className="block font-semibold">{l.label}</span>
                  <span className="block text-sm text-muted">{l.detail}</span>
                </button>
              );
            })}
          </div>
          {!isPreset && <p className="text-sm text-muted">Using your own setting: keep {form.retailMargin || "?"}% as profit (change it under More options).</p>}
          <p className="text-sm text-muted">Not sure? <strong>Balanced</strong> suits most handmade and small-batch products.</p>
        </Step>

        <details className="card" open={moreOptionsUsed || undefined}>
          <summary className="cursor-pointer text-base font-semibold">More options <span className="font-normal text-muted">(fees, shop prices, your current price)</span></summary>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="retailMargin">Exact profit you want to keep (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={95} step={1} value={Number(form.retailMargin) || 0} onChange={(e) => update({ retailMargin: e.target.value })} className="flex-1 accent-[var(--brand)]" aria-label="Profit percentage slider" />
                <input id="retailMargin" className={`input w-24 tabular-nums ${errField === "targetRetailMarginPct" ? "border-red-500" : ""}`} type="number" min={0} max={95} step="any" inputMode="decimal" value={form.retailMargin} onChange={(e) => update({ retailMargin: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="percentFee">Selling fees</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input id="percentFee" aria-label="Percentage fee" className={`input pr-7 tabular-nums ${errField === "percentFee" ? "border-red-500" : ""}`} type="number" min={0} step="any" inputMode="decimal" placeholder="0" value={form.percentFee} onChange={(e) => update({ percentFee: e.target.value })} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
                </div>
                <MoneyInput id="fixedFee" label="Fee per sale" value={form.fixedFee} onChange={(v) => update({ fixedFee: v })} invalid={errField === "fixedFeePerSale"} placeholder="0" />
              </div>
              <p className="mt-1 text-sm text-muted">Card or marketplace fees, e.g. 2.9% + $0.30. Leave 0 if none.</p>
            </div>
            <div>
              <label className="label" htmlFor="wholesaleMargin">Profit to keep when selling to shops (%)</label>
              <input id="wholesaleMargin" className={`input w-28 tabular-nums ${errField === "targetWholesaleMarginPct" ? "border-red-500" : ""}`} type="number" min={0} max={95} step="any" inputMode="decimal" value={form.wholesaleMargin} onChange={(e) => update({ wholesaleMargin: e.target.value })} />
              <p className="mt-1 text-sm text-muted">Shops buy for less so they can resell. 40% is a common choice.</p>
            </div>
            <div>
              <label className="label" htmlFor="actualPrice">Price you charge now (optional)</label>
              <MoneyInput id="actualPrice" value={form.actualPrice} onChange={(v) => update({ actualPrice: v })} invalid={errField === "price"} placeholder="See how your current price does" />
            </div>
          </div>
        </details>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:h-fit" aria-live="polite">
        <section id="your-answer" className="card scroll-mt-24 border-2 border-brand/40" aria-labelledby="answer-title">
          <p id="answer-title" className="eyebrow">Your answer</p>
          {noQuantity ? (
            <p className="mt-2 text-lg text-slate-700">Enter <strong>how many you made</strong> (step 1) and your <strong>costs</strong> (step 2), and your price appears here.</p>
          ) : error ? (
            <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-800" role="alert">{error.message}</p>
          ) : r && noCosts ? (
            <p className="mt-2 text-lg text-slate-700">Now add <strong>what they cost you</strong> in step 2, and your price appears here.</p>
          ) : r ? (
            <>
              <p className="mt-2 text-lg text-slate-700">Sell each {itemName} for</p>
              <p className="text-5xl font-extrabold tabular-nums text-navy">{money(r.retail.price)}</p>
              <ul className="mt-5 space-y-3 text-base text-slate-800">
                <li>It costs you <strong className="tabular-nums">{money(r.production.costPerUnit)}</strong> to make each one ({money(r.production.totalProductionCost)} for all {q.toLocaleString()}).</li>
                <li>You keep <strong className="tabular-nums">{money(r.retail.profitPerUnit)}</strong> profit on every sale{r.retail.feesPerUnit > 0 ? " after fees" : ""}.</li>
                <li>
                  {r.retail.breakEven.units === null
                    ? r.retail.breakEven.reason
                    : <>Sell <strong>{r.retail.breakEven.units.toLocaleString()}</strong> of your {q.toLocaleString()} to get your money back. Every sale after that is profit.</>}
                </li>
                <li>Sell all {q.toLocaleString()} and you make <strong className="tabular-nums">{money(r.retail.totalPotentialProfit)}</strong> profit.</li>
              </ul>
              <p className="mt-5 rounded-xl bg-violet-50 p-3 text-base text-slate-800">
                <strong>Selling to shops?</strong> Charge them about <strong className="tabular-nums">{money(r.wholesale.price)}</strong> each. You&apos;d keep {money(r.wholesale.profitPerUnit)} per item.
              </p>
              {r.actual && (
                <p className={`mt-3 rounded-xl p-3 text-base ${r.actual.profitPerUnit < 0 ? "bg-red-50 text-red-900" : "bg-slate-50 text-slate-800"}`}>
                  <strong>At your current price of {money(r.actual.price)}</strong>, you {r.actual.profitPerUnit < 0 ? "lose" : "keep"}{" "}
                  <strong className="tabular-nums">{money(Math.abs(r.actual.profitPerUnit))}</strong> per sale
                  {r.actual.breakEven.units !== null && <> and need to sell {r.actual.breakEven.units.toLocaleString()} to get your money back</>}.
                </p>
              )}
            </>
          ) : null}
        </section>

        {mainWarnings.length > 0 && (
          <ul className="space-y-2">
            {mainWarnings.map((w) => (
              <li key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w}</li>
            ))}
          </ul>
        )}

        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!canSave || saving || !name || !r || noQuantity || Boolean(error)} onClick={() => save(false)}>
              {saving ? "Saving…" : currentId ? "Save changes" : "Save calculation"}
            </button>
            {currentId && (
              <button type="button" className="btn-secondary" disabled={!canSave || saving || !name || !r || noQuantity || Boolean(error)} onClick={() => save(true)}>Save as new</button>
            )}
            <button type="button" className="btn-secondary" onClick={() => { setForm(DEFAULT_FORM); setCurrentId(null); setSaveMsg(null); setShowExtra(false); }}>Start over</button>
          </div>
          {!canSave && <p className="text-sm text-muted">Sign in to save calculations.</p>}
          {canSave && !name && <p className="text-sm text-muted">Enter a product name to save.</p>}
          {saveMsg && <p className={`text-sm ${saveMsg.ok ? "text-green-700" : "text-red-600"}`} role="status">{saveMsg.text}</p>}
        </div>

        {ready && r && (
          <details className="card text-sm">
            <summary className="cursor-pointer text-base font-semibold">See the full breakdown</summary>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Cost breakdown</caption>
              <thead className="border-b border-border text-left text-muted">
                <tr><th className="py-2 font-medium">Cost</th><th className="py-2 text-right font-medium">All {q.toLocaleString()}</th><th className="py-2 text-right font-medium">Each</th></tr>
              </thead>
              <tbody>
                {r.production.lines.filter((l) => l.total > 0).map((l) => (
                  <tr key={l.category} className="border-b border-border last:border-0">
                    <td className="py-2">{COST_LABELS[l.category].label}</td>
                    <td className="py-2 text-right tabular-nums">{money(l.total)}</td>
                    <td className="py-2 text-right tabular-nums">{money(l.perUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <ChannelDetails title="Selling to customers" c={r.retail} quantity={q} />
              <ChannelDetails title="Selling to shops" c={r.wholesale} quantity={q} />
            </div>
            {shopWarnings.map((w) => (
              <p key={w} className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{w}</p>
            ))}
          </details>
        )}

        <details className="card text-sm">
          <summary className="cursor-pointer text-base font-semibold">What do these words mean?</summary>
          <dl className="mt-3 space-y-3">
            {[
              ["Cost per item", "Everything you spent on the batch, divided by how many you made. $300 of materials for 100 items is $3 each."],
              ["Profit", "What you keep from a sale: the price, minus any selling fees, minus what the item cost you."],
              ["Profit margin", "Profit as a share of the price. A $10 item with $4 profit has a 40% margin. This is what the profit level in step 3 sets."],
              ["Markup", "How much you add on top of your cost. Cost $6, price $10 → $4 added → 66.7% markup."],
              ["Wholesale price", "The lower price for shops that buy to resell. They usually double it for their own customers."],
              ["Break-even", "How many you must sell to earn back what the batch cost. Every sale after that is profit."],
            ].map(([term, def]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted">{def}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </div>
  );
}

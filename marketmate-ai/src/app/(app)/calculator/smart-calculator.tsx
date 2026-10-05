"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, categoryInfo, pluralize } from "@/lib/pricing/categories";
import { compatibleUnits, currencyInfo, fixedRate, formatMoney, formatNumber, isMeasured, unitInfo } from "@/lib/pricing/money";
import {
  emptySmartInput,
  exampleSmartInput,
  newId,
  previewCosts,
  roundMoney,
  runSmartCalculator,
  type AppliesTo,
  type CostRow,
  type PackageOption,
  type PricingMethod,
  type SellAs,
  type SmartInput,
} from "@/lib/pricing/smart";
import { saveSmartCalculation, setBusinessCurrency } from "./actions";
import { ChoiceGroup, CurrencySelect, Field, MoneyInput, NumberInput, StepCard, UnitSelect } from "./fields";
import { AnswerCard } from "./results";

type Mode = "simple" | "advanced";
const MODE_KEY = "marketmate-calculator-mode";

/** Simple/Advanced is remembered on this device only (a convenience, never required). */
function readStoredMode(): Mode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "simple" || v === "advanced" ? v : null;
  } catch {
    return null;
  }
}
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Simple Mode ignores the advanced-only settings, so hidden fields never change the answer. */
function effectiveInput(input: SmartInput, mode: Mode): SmartInput {
  if (mode === "advanced") return input;
  return {
    ...input,
    packages: input.packages.slice(0, 1),
    fees: { percent: null, fixed: null },
    taxPercent: null,
    wholesale: { ...input.wholesale, enabled: false },
    discounts: [],
    fixedCosts: null,
  };
}

function hasAdvancedSettings(input: SmartInput): boolean {
  return Boolean(input.fees.percent || input.fees.fixed || input.taxPercent || input.wholesale.enabled || input.fixedCosts || input.packages.length > 1);
}

export function SmartCalculator({
  initial,
  savedId,
  savedName,
  canSave,
  businessCurrency,
}: {
  initial: SmartInput | null;
  savedId: string | null;
  savedName: string;
  canSave: boolean;
  businessCurrency: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState<SmartInput>(initial ?? emptySmartInput(businessCurrency));
  // An opened calculation with advanced settings starts in Advanced Mode; otherwise use the remembered choice.
  const [chosenMode, setChosenMode] = useState<Mode | null>(() => (initial && hasAdvancedSettings(initial) ? "advanced" : null));
  const storedMode = useSyncExternalStore(subscribeStorage, readStoredMode, () => null);
  const mode: Mode = chosenMode ?? storedMode ?? "simple";
  const [isExample, setIsExample] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(savedId);
  const [saveName, setSaveName] = useState(savedName);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState(businessCurrency);
  const [currencyMsg, setCurrencyMsg] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  /** Bumped by "Try an Example" / "Start over" to rebuild every input box from scratch. */
  const [formKey, setFormKey] = useState(0);

  const chooseMode = (m: Mode) => {
    setChosenMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage unavailable: the choice still applies to this visit */
    }
  };

  const used = useMemo(() => effectiveInput(input, mode), [input, mode]);
  const outcome = useMemo(() => runSmartCalculator(used), [used]);
  const preview = useMemo(() => previewCosts(used), [used]);
  const p = preview.ok ? preview.result : null;

  const cat = categoryInfo(input.category);
  const unit = unitInfo(input.product.unit);
  const measured = isMeasured(unit.id);
  const itemOne = p?.itemOne ?? (measured ? unit.singular : input.product.itemName.trim() || (["pieces", "items", "units"].includes(unit.id) ? cat.itemWord : unit.singular));
  const itemMany = measured ? `${unit.singular}s` : pluralize(itemOne);
  const sellsPackages = input.sellAs !== "items";
  const pkgName = (o: PackageOption) => o.name.trim() || cat.packageWord;
  const cur = input.currency;
  const m = (n: number) => formatMoney(n, cur);

  /** Every edit goes through here: it ends "example" mode and clears old save messages. */
  const edit = (fn: (i: SmartInput) => SmartInput) => {
    setInput((i) => fn(i));
    setIsExample(false);
    setSaveMsg(null);
  };
  const setProduct = (patch: Partial<SmartInput["product"]>) => edit((i) => ({ ...i, product: { ...i.product, ...patch } }));
  const setCost = (id: string, patch: Partial<CostRow>) => edit((i) => ({ ...i, costs: i.costs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const setPackage = (id: string, patch: Partial<PackageOption>) => edit((i) => ({ ...i, packages: i.packages.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const addCost = (name = "") =>
    edit((i) => ({ ...i, costs: [...i.costs, { id: newId("cost"), name, amount: null, currency: i.currency, appliesTo: "batch" }] }));

  const changeCurrency = (code: string) =>
    edit((i) => ({
      ...i,
      currency: code,
      // In Simple Mode everything is in one currency; Advanced keeps each cost's own currency.
      product: mode === "simple" ? { ...i.product, paidCurrency: code } : i.product,
      costs: mode === "simple" ? i.costs.map((c) => ({ ...c, currency: code })) : i.costs,
      chosenPrices: {},
    }));

  const changeCategory = (id: string) =>
    edit((i) => {
      const before = categoryInfo(i.category);
      const after = categoryInfo(id);
      const unitWasDefault = i.product.unit === before.defaultUnit || i.product.unit === "items";
      return { ...i, category: id, product: { ...i.product, unit: i.product.quantity === null && unitWasDefault ? after.defaultUnit : i.product.unit } };
    });

  const changeUnit = (u: string) =>
    edit((i) => ({
      ...i,
      product: { ...i.product, unit: u },
      // Keep package sizes in a unit that matches (e.g. switching to liters → ml bottles).
      packages: i.packages.map((o) => ({ ...o, unit: compatibleUnits(u).some((x) => x.id === o.unit) ? o.unit : u })),
      costs: isMeasured(u) ? i.costs.map((c) => (c.appliesTo === "item" ? { ...c, appliesTo: "batch" as AppliesTo } : c)) : i.costs,
    }));

  // Currencies used that need a rate to the business currency.
  const foreign = [...new Set([input.product.paidCurrency, ...input.costs.map((c) => c.currency)].filter((c) => c !== cur))];

  function loadExample() {
    const ex = exampleSmartInput();
    setInput(ex);
    setFormKey((k) => k + 1);
    setIsExample(true);
    setCurrentId(null);
    setSaveName("");
    setSaveMsg(null);
  }
  function startOver() {
    setInput(emptySmartInput(defaultCurrency));
    setFormKey((k) => k + 1);
    setIsExample(false);
    setCurrentId(null);
    setSaveName("");
    setSaveMsg(null);
    router.replace("/calculator");
  }

  function save(asNew: boolean) {
    const name = (saveName.trim() || input.product.name.trim()).slice(0, 200);
    startSaving(async () => {
      const res = await saveSmartCalculation(asNew ? null : currentId, name, used);
      if (res.ok) {
        setCurrentId(res.id ?? null);
        setSaveName(name);
        setSaveMsg({ ok: true, text: asNew || !currentId ? `Saved "${name}" to My Products.` : "Changes saved." });
        router.refresh();
      } else {
        setSaveMsg({ ok: false, text: res.error ?? "Save failed." });
      }
    });
  }

  const isEmpty = input.product.quantity === null && input.product.amountPaid === null && input.costs.every((c) => c.amount === null);
  const doubleCost = (cost: number) => roundMoney(cost);

  return (
    <div className="text-lg">
      {/* Mode, example, currency */}
      <div className="card mb-6 space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Calculator mode" className="flex rounded-2xl border-2 border-slate-300 p-1">
            {(["simple", "advanced"] as Mode[]).map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={mode === x}
                onClick={() => chooseMode(x)}
                className={`min-h-12 rounded-xl px-5 text-lg font-bold ${mode === x ? "bg-navy text-white" : "text-navy hover:bg-slate-100"}`}
              >
                {x === "simple" ? "Simple Mode" : "Advanced Mode"}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary min-h-12 text-lg" onClick={loadExample}>✨ Try an Example</button>
          <button type="button" className="btn-secondary min-h-12 text-lg" onClick={startOver}>Start over</button>
        </div>
        <p className="text-base text-slate-600">
          {mode === "simple"
            ? "Simple Mode asks only what you need. Switch to Advanced Mode for selling fees, tax, wholesale, sales, several package sizes and other currencies."
            : "Advanced Mode adds selling fees, tax, wholesale, sale prices, fixed costs, several package sizes and costs in other currencies."}
        </p>
        {mode === "simple" && hasAdvancedSettings(input) && (
          <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-950">You have advanced settings (like fees or tax). They only count in Advanced Mode.</p>
        )}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,22rem)_auto]">
          <Field label="💱 Your currency" htmlFor="currency" help="Every result is shown in this currency.">
            <CurrencySelect id="currency" value={cur} onChange={changeCurrency} />
          </Field>
          {canSave && cur !== defaultCurrency && (
            <button
              type="button"
              className="btn-secondary min-h-14 text-base"
              onClick={async () => {
                const res = await setBusinessCurrency(cur);
                if (res.ok) {
                  setDefaultCurrency(cur);
                  setCurrencyMsg(`${cur} is now your business currency.`);
                } else setCurrencyMsg(res.error ?? "Couldn't save.");
              }}
            >
              Make {cur} my business currency
            </button>
          )}
        </div>
        {currencyMsg && <p className="text-base text-green-800" role="status">{currencyMsg}</p>}
      </div>

      {isExample && (
        <div className="mb-6 rounded-2xl border-2 border-gold bg-amber-50 p-4 text-lg text-amber-950" role="status">
          <strong>This is an example, not your data.</strong> 100 items bought for BBD $25 (with packaging), 4 in each bag, BBD $1 profit per bag.
          Change anything to make it your own, or press <strong>Start over</strong>.
        </div>
      )}

      <div key={formKey} className="grid grid-cols-1 gap-6 wide:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] 3xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)]">
        <div className="space-y-6">
          {/* 1 — what are you selling */}
          <StepCard n={1} emoji="🏷️" title="What are you selling?" subtitle="Pick the closest one. It only changes the wording; the math is the same for everyone.">
            <div role="radiogroup" aria-label="What are you selling?" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4">
              {CATEGORIES.map((c) => {
                const active = c.id === input.category;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeCategory(c.id)}
                    className={`flex min-h-16 items-center gap-2 rounded-2xl border-2 p-3 text-left text-base font-semibold leading-snug sm:text-lg ${active ? "border-brand bg-pink-50 text-navy" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"}`}
                  >
                    <span aria-hidden className="text-2xl">{c.emoji}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </StepCard>

          {/* 2 — what did you buy */}
          <StepCard n={2} emoji="🛒" title="What did you buy or make?" subtitle="Enter what you bought and we'll calculate the rest.">
            <Field label="What is it called?" htmlFor="productName" help="For example: Women's T-Shirts, Chicken meals, Gift baskets.">
              <input id="productName" className="input h-14 text-xl" maxLength={200} value={input.product.name} onChange={(e) => setProduct({ name: e.target.value })} placeholder="Product name" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
              <Field label={measured ? "How much did you buy or make?" : cat.quantityQuestion} htmlFor="quantity" help={cat.quantityHelp}>
                <NumberInput id="quantity" value={input.product.quantity} onChange={(v) => setProduct({ quantity: v })} placeholder={measured ? "e.g. 5" : "e.g. 20"} />
              </Field>
              <Field label="Counted in" htmlFor="unit" help="Pieces, or weigh/measure it.">
                <UnitSelect id="unit" value={input.product.unit} onChange={changeUnit} />
              </Field>
            </div>
            {!measured && (
              <Field label={`What do you call one? (optional)`} htmlFor="itemName" help={`Used in your results, e.g. "each T-shirt". Leave empty to say "each ${cat.itemWord}".`}>
                <input id="itemName" className="input h-14 text-xl" maxLength={60} value={input.product.itemName} onChange={(e) => setProduct({ itemName: e.target.value })} placeholder={cat.itemWord} />
              </Field>
            )}
            <div className={`grid grid-cols-1 gap-4 ${mode === "advanced" ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]" : ""}`}>
              <Field label="How much did you pay in total?" htmlFor="amountPaid" help="The whole amount for everything above, not for one.">
                <MoneyInput id="amountPaid" currency={input.product.paidCurrency} value={input.product.amountPaid} onChange={(v) => setProduct({ amountPaid: v })} />
              </Field>
              {mode === "advanced" && (
                <Field label="Paid in" htmlFor="paidCurrency" help="The currency of this purchase.">
                  <CurrencySelect id="paidCurrency" value={input.product.paidCurrency} onChange={(v) => setProduct({ paidCurrency: v })} />
                </Field>
              )}
            </div>
            {p?.purchaseEach != null && (
              <p className="rounded-2xl bg-green-50 p-4 text-xl text-green-950">
                ✅ You paid <strong>{m(p.purchaseEach)}</strong> for each {itemOne}.
              </p>
            )}
          </StepCard>

          {/* 3 — other costs */}
          <StepCard n={3} emoji="➕" title="Any other costs?" subtitle="Let's work out what everything REALLY cost you: packaging, transport, labels, your time…">
            {input.costs.length > 0 && (
              <ul className="space-y-4">
                {input.costs.map((c, idx) => (
                  <li key={c.id} className="rounded-2xl border-2 border-slate-200 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="What was it for?" htmlFor={`cost-name-${c.id}`}>
                        <input id={`cost-name-${c.id}`} className="input h-14 text-xl" maxLength={80} value={c.name} placeholder={`Cost ${idx + 1}`} onChange={(e) => setCost(c.id, { name: e.target.value })} />
                      </Field>
                      <Field label="How much?" htmlFor={`cost-amount-${c.id}`}>
                        <MoneyInput id={`cost-amount-${c.id}`} currency={c.currency} value={c.amount} onChange={(v) => setCost(c.id, { amount: v })} />
                      </Field>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-base font-semibold text-navy">Is this for everything, or for each one?</p>
                      <div role="radiogroup" aria-label={`${c.name || `Cost ${idx + 1}`}: for everything or for each one?`} className="flex flex-wrap gap-2">
                        {([
                          ["batch", "For everything"],
                          ...(!measured ? [["item", `For each ${itemOne}`]] : []),
                          ...(sellsPackages ? [["package", `For each ${pkgName(input.packages[0] ?? { name: "" } as PackageOption)}`]] : []),
                        ] as [AppliesTo, string][]).map(([v, label]) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={c.appliesTo === v}
                            onClick={() => setCost(c.id, { appliesTo: v })}
                            className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold ${c.appliesTo === v ? "border-navy bg-navy text-white" : "border-slate-300 text-slate-800 hover:border-slate-500"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      {mode === "advanced" ? (
                        <div className="w-full sm:w-64">
                          <Field label="Paid in" htmlFor={`cost-cur-${c.id}`}>
                            <CurrencySelect id={`cost-cur-${c.id}`} value={c.currency} onChange={(v) => setCost(c.id, { currency: v })} />
                          </Field>
                        </div>
                      ) : <span />}
                      <button type="button" className="btn-secondary min-h-12 text-base text-red-700" onClick={() => edit((i) => ({ ...i, costs: i.costs.filter((x) => x.id !== c.id) }))}>
                        Remove this cost
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-2 text-base font-semibold text-navy">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {[...cat.costIdeas, ...(mode === "advanced" ? ["Labour", "Advertising", "Shipping", "Electricity"].filter((x) => !cat.costIdeas.includes(x)) : [])].map((name) => (
                  <button key={name} type="button" className="btn-secondary min-h-12 text-base" onClick={() => addCost(name)}>+ {name}</button>
                ))}
              </div>
            </div>
            <button type="button" className="btn-navy min-h-14 w-full text-lg" onClick={() => addCost()}>+ Add another cost</button>
            {p && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <ul className="divide-y divide-border text-lg">
                  {p.lines.map((l, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{l.name}{l.appliesTo === "item" ? ` (each ${itemOne})` : l.appliesTo === "package" ? " (each package)" : ""}</span>
                      <span className="font-semibold tabular-nums">{m(l.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex flex-wrap justify-between gap-2 border-t-2 border-navy pt-3 text-xl font-extrabold text-navy">
                  <span>TOTAL COST</span><span className="tabular-nums">{m(p.batchCost + p.perItemCost * p.quantity)}</span>
                </p>
                <p className="mt-2 text-lg text-slate-800">
                  {p.quantityLabel} → <strong>TRUE COST PER {itemOne.toUpperCase()}: {m(p.costPerUnit)}</strong>
                </p>
                <p className="mt-1 text-base text-slate-700">This means each {itemOne} really costs you about {m(p.costPerUnit)} after your other expenses.</p>
              </div>
            )}
          </StepCard>

          {/* Exchange rates: only when another currency is used */}
          {foreign.length > 0 && (
            <StepCard emoji="💱" title="Exchange rates" subtitle={`Some costs are in another currency. Tell us the rate you paid so we can show everything in ${cur}. These are not live rates; we never convert without your rate.`}>
              {foreign.map((code) => {
                const peg = fixedRate(code, cur);
                return (
                  <Field key={code} label={`1 ${code} (${currencyInfo(code).name}) =`} htmlFor={`rate-${code}`} help={`How many ${cur} for 1 ${code}?`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <NumberInput id={`rate-${code}`} className="w-48" value={input.rates[code] ?? null} onChange={(v) => edit((i) => ({ ...i, rates: { ...i.rates, [code]: v } }))} suffix={cur} />
                      {peg !== null && (
                        <button type="button" className="btn-secondary min-h-12 text-base" onClick={() => edit((i) => ({ ...i, rates: { ...i.rates, [code]: roundMoney(peg * 10000) / 10000 } }))}>
                          Use the official fixed rate ({formatNumber(peg, 4)})
                        </button>
                      )}
                    </div>
                  </Field>
                );
              })}
            </StepCard>
          )}

          {/* 4 — packages */}
          <StepCard n={4} emoji="📦" title="Do you sell them one at a time or in packages?">
            <ChoiceGroup<SellAs>
              label="How do you sell them?"
              value={input.sellAs}
              onChange={(v) => edit((i) => ({ ...i, sellAs: v, costs: v === "items" ? i.costs.map((c) => (c.appliesTo === "package" ? { ...c, appliesTo: "batch" } : c)) : i.costs }))}
              options={[
                { value: "items", title: measured ? `By the ${unit.singular}` : "One at a time", detail: measured ? `Price per ${unit.short}` : `Single ${itemMany}`, emoji: "1️⃣" },
                { value: "packages", title: "In packages", detail: "Bags, bottles, boxes, plates…", emoji: "🛍️" },
                { value: "both", title: "Both", detail: "Singles and packages", emoji: "➕" },
              ]}
            />
            {sellsPackages && (
              <div className="space-y-4">
                {(mode === "advanced" ? input.packages : input.packages.slice(0, 1)).map((o, idx) => {
                  const res = p?.packages.find((x) => x.key === o.id);
                  return (
                    <div key={o.id} className="space-y-4 rounded-2xl border-2 border-slate-200 p-4">
                      <Field label="What do you call one package?" htmlFor={`pkg-name-${o.id}`} help={`For example: bag, bottle, box, plate, basket.`}>
                        <input id={`pkg-name-${o.id}`} className="input h-14 text-xl" maxLength={40} value={o.name} placeholder={cat.packageWord} onChange={(e) => setPackage(o.id, { name: e.target.value })} />
                      </Field>
                      {measured ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
                          <Field label={`How much goes in one ${pkgName(o)}?`} htmlFor={`pkg-size-${o.id}`} help="We convert the units for you, e.g. kg and g.">
                            <NumberInput id={`pkg-size-${o.id}`} value={o.size} onChange={(v) => setPackage(o.id, { size: v })} placeholder="e.g. 250" />
                          </Field>
                          <Field label="Unit" htmlFor={`pkg-unit-${o.id}`}>
                            <UnitSelect id={`pkg-unit-${o.id}`} value={o.unit} units={compatibleUnits(unit.id)} onChange={(v) => setPackage(o.id, { unit: v })} />
                          </Field>
                        </div>
                      ) : (
                        <Field label={`How many ${itemMany} go in one ${pkgName(o)}?`} htmlFor={`pkg-size-${o.id}`}>
                          <NumberInput id={`pkg-size-${o.id}`} value={o.size} onChange={(v) => setPackage(o.id, { size: v })} placeholder="e.g. 4" />
                        </Field>
                      )}
                      {res && (
                        <div className="rounded-2xl bg-green-50 p-4 text-xl text-green-950">
                          <p>✅ You can make <strong>{formatNumber(res.available)} {res.available === 1 ? res.one : res.many}</strong> from {p!.quantityLabel}.{res.leftoverLabel && ` (${res.leftoverLabel} left over.)`}</p>
                          <p className="mt-1">Each {res.one} costs you <strong>{m(res.cost)}</strong> to make.</p>
                        </div>
                      )}
                      {mode === "advanced" && input.packages.length > 1 && (
                        <button type="button" className="btn-secondary min-h-12 text-base text-red-700" onClick={() => edit((i) => ({ ...i, packages: i.packages.filter((x) => x.id !== o.id) }))}>
                          Remove package size {idx + 1}
                        </button>
                      )}
                    </div>
                  );
                })}
                {mode === "advanced" && input.packages.length < 6 && (
                  <button type="button" className="btn-secondary min-h-12 w-full text-lg" onClick={() => edit((i) => ({ ...i, packages: [...i.packages, { id: newId("pkg"), name: "", size: null, unit: i.packages[0]?.unit ?? i.product.unit, profitAmount: null }] }))}>
                    + Add another package size
                  </button>
                )}
              </div>
            )}
          </StepCard>

          {/* 5 — profit */}
          <StepCard n={5} emoji="💰" title="How much profit would you like?">
            <ChoiceGroup<PricingMethod>
              label="How do you want to set your price?"
              value={input.pricing.method}
              onChange={(v) => edit((i) => ({ ...i, pricing: { ...i.pricing, method: v }, chosenPrices: {} }))}
              options={[
                { value: "profit_amount", title: "Add a profit amount", detail: "\"I want $5 on each one.\"" },
                { value: "markup", title: "Add a percentage on top", detail: "\"Cost + 50%.\" (markup)" },
                { value: "margin", title: "Keep a share of the price", detail: "\"40% of the price is mine.\" (margin)" },
              ]}
            />
            <details className="rounded-2xl bg-slate-50 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-navy">Which one should I use?</summary>
              <div className="mt-3 space-y-2 text-base text-slate-800">
                <p><strong>Add a profit amount</strong> is the easiest: you decide how many dollars you want to keep on each sale.</p>
                <p><strong>Add a percentage on top</strong> (markup): your price grows with your cost. Cost {m(10)} + 50% = {m(15)}.</p>
                <p><strong>Keep a share of the price</strong> (margin): you decide what part of the selling price is profit. For a {m(10)} cost and 40%, the price is {m(16.67)}, because 40% of {m(16.67)} is your {m(6.67)} profit.</p>
                <p>Not sure? Use <strong>Add a profit amount</strong>.</p>
              </div>
            </details>

            {input.pricing.method === "profit_amount" ? (
              <div className="space-y-4">
                {input.sellAs !== "packages" && (
                  <Field label={`Profit on each ${itemOne}`} htmlFor="itemAmount" help={`How much you want to keep from each ${itemOne} you sell.`}>
                    <MoneyInput id="itemAmount" currency={cur} value={input.pricing.itemAmount} onChange={(v) => edit((i) => ({ ...i, pricing: { ...i.pricing, itemAmount: v }, chosenPrices: {} }))} />
                    {p && p.costPerUnit > 0 && (
                      <button type="button" className="mt-2 text-base font-semibold text-brand-strong underline" onClick={() => edit((i) => ({ ...i, pricing: { ...i.pricing, itemAmount: doubleCost(p.costPerUnit) }, chosenPrices: {} }))}>
                        Not sure? Double my cost (add {m(p.costPerUnit)})
                      </button>
                    )}
                  </Field>
                )}
                {sellsPackages && (mode === "advanced" ? input.packages : input.packages.slice(0, 1)).map((o) => {
                  const res = p?.packages.find((x) => x.key === o.id);
                  return (
                    <Field key={o.id} label={`Profit on each ${pkgName(o)}`} htmlFor={`pkg-profit-${o.id}`} help={`How much you want to keep from each ${pkgName(o)} you sell.`}>
                      <MoneyInput id={`pkg-profit-${o.id}`} currency={cur} value={o.profitAmount} onChange={(v) => edit((i) => ({ ...i, packages: i.packages.map((x) => (x.id === o.id ? { ...x, profitAmount: v } : x)), chosenPrices: {} }))} />
                      {res && res.cost > 0 && (
                        <button type="button" className="mt-2 text-base font-semibold text-brand-strong underline" onClick={() => edit((i) => ({ ...i, packages: i.packages.map((x) => (x.id === o.id ? { ...x, profitAmount: doubleCost(res.cost) } : x)), chosenPrices: {} }))}>
                          Not sure? Double my cost (add {m(res.cost)})
                        </button>
                      )}
                    </Field>
                  );
                })}
              </div>
            ) : (
              <Field
                label={input.pricing.method === "markup" ? "How much % to add on top of your cost?" : "What % of the price should be profit?"}
                htmlFor="percent"
                help={input.pricing.method === "markup" ? "100% doubles your cost." : "Must be under 100%. 50% means half the price is profit."}
              >
                <NumberInput id="percent" className="max-w-xs" value={input.pricing.percent} onChange={(v) => edit((i) => ({ ...i, pricing: { ...i.pricing, percent: v }, chosenPrices: {} }))} suffix="%" placeholder="e.g. 50" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(input.pricing.method === "markup" ? [25, 50, 100] : [20, 30, 50]).map((v) => (
                    <button key={v} type="button" className="btn-secondary min-h-12 text-lg" onClick={() => edit((i) => ({ ...i, pricing: { ...i.pricing, percent: v }, chosenPrices: {} }))}>{v}%</button>
                  ))}
                </div>
              </Field>
            )}
          </StepCard>

          {mode === "advanced" && (
            <StepCard n={6} emoji="⚙️" title="Advanced settings" subtitle="All optional. Leave anything empty that doesn't apply to you.">
              <div className="space-y-6">
                <fieldset className="space-y-3">
                  <legend className="text-xl font-bold text-navy">Selling fees</legend>
                  <p className="text-base text-slate-600">Card machines, online shops and marketplaces often take a % plus a fixed amount per sale (e.g. 2.9% + $0.30). Your price is raised so you still keep your profit.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Fee %" htmlFor="feePct"><NumberInput id="feePct" value={input.fees.percent} onChange={(v) => edit((i) => ({ ...i, fees: { ...i.fees, percent: v }, chosenPrices: {} }))} suffix="%" placeholder="0" /></Field>
                    <Field label="Fee per sale" htmlFor="feeFixed"><MoneyInput id="feeFixed" currency={cur} value={input.fees.fixed} onChange={(v) => edit((i) => ({ ...i, fees: { ...i.fees, fixed: v }, chosenPrices: {} }))} /></Field>
                  </div>
                </fieldset>

                <Field label="Sales tax / VAT %" htmlFor="tax" help="Shows what customers pay with tax. Tax doesn't change your profit; you pass it on to the government.">
                  <NumberInput id="tax" className="max-w-xs" value={input.taxPercent} onChange={(v) => edit((i) => ({ ...i, taxPercent: v }))} suffix="%" placeholder="0" />
                </Field>

                <fieldset className="space-y-3">
                  <legend className="text-xl font-bold text-navy">Do you sell wholesale too?</legend>
                  <ChoiceGroup<"no" | "yes">
                    label="Do you sell wholesale too?"
                    columns="grid-cols-2"
                    value={input.wholesale.enabled ? "yes" : "no"}
                    onChange={(v) => edit((i) => ({ ...i, wholesale: { ...i.wholesale, enabled: v === "yes" } }))}
                    options={[{ value: "no", title: "No" }, { value: "yes", title: "Yes" }]}
                  />
                  {input.wholesale.enabled && (
                    <div className="space-y-3">
                      <ChoiceGroup<"discount" | "price">
                        label="How do you set your wholesale price?"
                        columns="sm:grid-cols-2"
                        value={input.wholesale.mode}
                        onChange={(v) => edit((i) => ({ ...i, wholesale: { ...i.wholesale, mode: v } }))}
                        options={[{ value: "discount", title: "% off my retail price", detail: "e.g. shops pay 25% less" }, { value: "price", title: "I'll enter the price", detail: "a set wholesale price" }]}
                      />
                      {input.wholesale.mode === "discount" ? (
                        <Field label="Discount for shops" htmlFor="wsPct"><NumberInput id="wsPct" className="max-w-xs" value={input.wholesale.discountPct} onChange={(v) => edit((i) => ({ ...i, wholesale: { ...i.wholesale, discountPct: v } }))} suffix="%" /></Field>
                      ) : (
                        <Field label="Wholesale price for each one" htmlFor="wsPrice"><MoneyInput id="wsPrice" currency={cur} value={input.wholesale.price} onChange={(v) => edit((i) => ({ ...i, wholesale: { ...i.wholesale, price: v } }))} /></Field>
                      )}
                      <Field label="Smallest wholesale order" htmlFor="wsMin" help="The fewest a shop must buy at the wholesale price.">
                        <NumberInput id="wsMin" className="max-w-xs" value={input.wholesale.minOrder} onChange={(v) => edit((i) => ({ ...i, wholesale: { ...i.wholesale, minOrder: v } }))} placeholder="e.g. 10" />
                      </Field>
                    </div>
                  )}
                </fieldset>

                <Field label="Test a sale (% off)" htmlFor="discounts" help="See your profit if you run a promotion. Separate several with commas, e.g. 10, 25, 50.">
                  <input
                    id="discounts"
                    className="input h-14 max-w-md text-xl"
                    defaultValue={input.discounts.join(", ")}
                    onChange={(e) => {
                      const list = e.target.value.split(",").map((x) => Number(x.trim().replace("%", ""))).filter((x) => Number.isFinite(x) && x > 0 && x < 100).slice(0, 6);
                      edit((i) => ({ ...i, discounts: list }));
                    }}
                  />
                </Field>

                <Field label="Costs you pay no matter what (optional)" htmlFor="fixedCosts" help="Stall rent, equipment, a website… We'll tell you how many you need to sell to cover them.">
                  <MoneyInput id="fixedCosts" currency={cur} value={input.fixedCosts} onChange={(v) => edit((i) => ({ ...i, fixedCosts: v }))} />
                </Field>
              </div>
            </StepCard>
          )}
        </div>

        {/* Answer */}
        <div className="space-y-6 wide:sticky wide:top-6 wide:h-fit">
          <AnswerCard outcome={outcome} preview={preview} isEmpty={isEmpty} onChoosePrice={(key, price) => edit((i) => ({ ...i, chosenPrices: { ...i.chosenPrices, [key]: price } }))} />

          <div className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-navy">💾 Save this calculation</h2>
            {isExample ? (
              <p className="text-lg text-slate-700">This is the example. Press <strong>Start over</strong> to price your own product, then save it.</p>
            ) : !canSave ? (
              <p className="text-lg text-slate-700">Sign in to save your calculations.</p>
            ) : (
              <>
                <Field label="Name" htmlFor="saveName" help="So you can find it again, e.g. Christmas Gift Basket.">
                  <input id="saveName" className="input h-14 text-xl" maxLength={200} value={saveName} placeholder={input.product.name || "Product name"} onChange={(e) => setSaveName(e.target.value)} />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn-primary min-h-14 text-lg" disabled={saving || !outcome.ok || !(saveName.trim() || input.product.name.trim())} onClick={() => save(false)}>
                    {saving ? "Saving…" : currentId ? "Save changes" : "Save calculation"}
                  </button>
                  {currentId && (
                    <button type="button" className="btn-secondary min-h-14 text-lg" disabled={saving || !outcome.ok} onClick={() => save(true)}>Save as a copy</button>
                  )}
                </div>
                {!outcome.ok && <p className="text-base text-slate-600">Finish the questions above to save.</p>}
              </>
            )}
            {saveMsg && <p className={`text-lg ${saveMsg.ok ? "text-green-800" : "text-red-700"}`} role="status">{saveMsg.text}</p>}
          </div>
        </div>
      </div>

      {outcome.ok && (
        // Phones: keep the price in view while filling in the form.
        <a href="#your-answer" className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(23,37,84,0.15)] wide:hidden">
          <span className="text-lg text-slate-700">Sell one {outcome.result.main.one} for <strong className="block text-2xl tabular-nums text-navy">{m(outcome.result.main.price)}</strong></span>
          <span className="text-base font-semibold text-brand-strong">See my answer ↓</span>
        </a>
      )}
      {outcome.ok && <div className="h-24 wide:hidden" aria-hidden />}
    </div>
  );
}

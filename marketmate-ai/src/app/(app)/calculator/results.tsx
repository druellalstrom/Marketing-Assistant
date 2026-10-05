"use client";

import { useState } from "react";
import { formatMoney, formatNumber } from "@/lib/pricing/money";
import type { SmartOutcome, SmartResult, SellUnitResult } from "@/lib/pricing/smart";
import { BigNumber } from "./fields";

const pct = (n: number | null) => (n === null ? "—" : `${formatNumber(n, 2)}%`);

/** "Your calculated price is X. Would you like to round it?" — never changes the price by itself. */
function RoundingChoices({ u, currency, onChoose }: { u: SellUnitResult; currency: string; onChoose: (price: number | null) => void }) {
  const m = (n: number) => formatMoney(n, currency);
  const options = u.roundingOptions.filter((p) => p !== u.calculatedPrice);
  if (!u.priceChosen && options.length === 0) return null;
  return (
    <div className="rounded-2xl bg-amber-50 p-4">
      <p className="text-base font-semibold text-slate-900">Make my price easier to sell</p>
      {u.priceChosen ? (
        <p className="mt-1 text-base text-slate-800">
          You chose <strong>{m(u.price)}</strong>. The calculated price was {m(u.calculatedPrice)}.{" "}
          <button type="button" className="font-semibold text-brand-strong underline" onClick={() => onChoose(null)}>Use {m(u.calculatedPrice)} instead</button>
        </p>
      ) : (
        <>
          <p className="mt-1 text-base text-slate-800">Your calculated price is <strong>{m(u.calculatedPrice)}</strong>. Would you like to round it?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((p) => (
              <button key={p} type="button" className="btn-secondary min-h-12 text-lg" onClick={() => onChoose(p)}>
                {m(p)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One "sell this" block: cost → have → charge → profit, then "if you sell everything". */
function UnitAnswer({ u, r, onChoose, title }: { u: SellUnitResult; r: SmartResult; onChoose: (price: number | null) => void; title?: string }) {
  const m = (n: number) => formatMoney(n, r.currency);
  const loss = u.profit < 0;
  return (
    <div className="space-y-5">
      {title && <h3 className="text-xl font-bold text-navy">{title}</h3>}

      <div className="rounded-3xl bg-navy p-5 text-white sm:p-6">
        <p className="text-base font-bold uppercase tracking-wide text-pink-200">🏷️ Sell one {u.one} for</p>
        <p className="text-5xl font-extrabold tabular-nums [overflow-wrap:anywhere] sm:text-6xl" data-testid={`price-${u.key}`}>{m(u.price)}</p>
        {u.priceWithTax !== null && <p className="mt-1 text-lg text-pink-100">Customers pay {m(u.priceWithTax)} with tax.</p>}
      </div>

      <ol className="grid grid-cols-1 gap-3 @md:grid-cols-2" aria-label="How your price comes together">
        <li className="rounded-2xl border border-border bg-white p-4">
          <BigNumber label={`💰 Your true cost per ${u.one}`} value={m(u.cost)} note={u.kind === "package" && u.sizeLabel ? `${u.sizeLabel} in each ${u.one}` : "after all your costs"} />
        </li>
        <li className="rounded-2xl border border-border bg-white p-4">
          <BigNumber label="📦 What you have" value={`${formatNumber(u.available)} ${u.available === 1 ? u.one : u.many}`} note={u.leftoverLabel ? `plus ${u.leftoverLabel} left over` : undefined} />
        </li>
        <li className={`rounded-2xl border p-4 ${loss ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <BigNumber label={`📈 Profit per ${u.one}`} value={m(u.profit)} tone={loss ? "red" : "green"} note={loss ? `You would LOSE ${m(-u.profit)} on each one.` : u.feesPerSale > 0 ? "after selling fees" : undefined} />
        </li>
        <li className="rounded-2xl border border-border bg-white p-4">
          <BigNumber label="Profit margin" value={pct(u.marginPct)} note="of the price is profit" />
        </li>
      </ol>

      <RoundingChoices u={u} currency={r.currency} onChoose={onChoose} />

      <div className="rounded-2xl border-2 border-dashed border-purple/40 bg-violet-50 p-4 sm:p-5">
        <p className="text-lg font-bold text-navy">If you sell all {formatNumber(u.available)} {u.available === 1 ? u.one : u.many}</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-lg @xl:grid-cols-3">
          <div><dt className="text-base text-slate-600">Money in</dt><dd className="text-2xl font-extrabold tabular-nums text-navy">{m(u.sellAll.revenue)}</dd></div>
          <div><dt className="text-base text-slate-600">You spent</dt><dd className="text-2xl font-extrabold tabular-nums text-navy">{m(u.sellAll.totalCost)}</dd></div>
          <div><dt className="text-base text-slate-600">Your profit</dt><dd className={`text-2xl font-extrabold tabular-nums ${u.sellAll.profit < 0 ? "text-red-700" : "text-green-800"}`}>{m(u.sellAll.profit)}</dd></div>
        </dl>
        {u.feesPerSale > 0 && <p className="mt-2 text-base text-slate-600">Profit is after selling fees.</p>}
      </div>

      <p className="text-lg text-slate-800">
        {u.breakEven.units === null
          ? <>⚠️ At this price you can&apos;t get your money back. Raise the price.</>
          : u.breakEven.units === 0
            ? null
            : <>🎯 Sell <strong>{formatNumber(u.breakEven.units)}</strong> {u.breakEven.units === 1 ? u.one : u.many} to get your {m(u.sellAll.totalCost)} back. Everything you sell after that is profit.</>}
      </p>
    </div>
  );
}

export function AnswerCard({
  outcome,
  preview,
  onChoosePrice,
  isEmpty,
}: {
  outcome: SmartOutcome;
  preview: SmartOutcome;
  onChoosePrice: (key: string, price: number | null) => void;
  isEmpty: boolean;
}) {
  const [showHow, setShowHow] = useState(false);

  if (!outcome.ok) {
    return (
      <section id="your-answer" className="@container card scroll-mt-24 space-y-4 border-2 border-brand/30 p-5 sm:p-7" aria-labelledby="answer-title" aria-live="polite">
        <h2 id="answer-title" className="text-2xl font-bold text-navy">Your Pricing Recommendation</h2>
        {isEmpty ? (
          <p className="text-lg text-slate-700">Answer the questions and your price appears here. Not sure how it works? Press <strong>Try an Example</strong> at the top.</p>
        ) : (
          <>
            {preview.ok && <CostSoFar r={preview.result} />}
            <div>
              <p className="text-lg font-semibold text-navy">To see your price:</p>
              <ul className="mt-2 space-y-2">
                {outcome.issues.slice(0, 4).map((i) => (
                  <li key={i.field + i.message} className="flex gap-2 text-lg text-slate-800"><span aria-hidden>👉</span>{i.message}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    );
  }

  const r = outcome.result;
  const m = (n: number) => formatMoney(n, r.currency);
  const units = [...(r.items ? [r.items] : []), ...r.packages];
  return (
    <section id="your-answer" className="@container card scroll-mt-24 space-y-6 border-2 border-brand/40 p-5 sm:p-7" aria-labelledby="answer-title" aria-live="polite">
      <div>
        <h2 id="answer-title" className="text-2xl font-bold text-navy sm:text-3xl">Your Pricing Recommendation</h2>
        {r.productName && <p className="text-lg text-slate-700">for {r.productName}</p>}
      </div>

      <CostSoFar r={r} />

      {units.map((u) => (
        <UnitAnswer
          key={u.key}
          u={u}
          r={r}
          title={units.length > 1 ? (u.kind === "item" ? `Selling single ${r.itemMany}` : `Selling ${u.many} (${u.sizeLabel} each)`) : undefined}
          onChoose={(p) => onChoosePrice(u.key, p)}
        />
      ))}

      {r.warnings.length > 0 && (
        <ul className="space-y-2">
          {r.warnings.map((w) => (
            <li key={w} className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-base font-medium text-amber-950">⚠️ {w}</li>
          ))}
        </ul>
      )}

      {r.wholesale && <WholesaleCompare r={r} />}
      {r.discounts.length > 0 && <DiscountTable r={r} />}
      {r.fixedCostBreakEven && (
        <p className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-800">
          🏪 To cover your fixed costs of {m(r.fixedCostBreakEven.fixedCosts)}, you need to sell{" "}
          {r.fixedCostBreakEven.units === null
            ? <strong>more than you can: you make no profit per sale at this price.</strong>
            : <><strong>{formatNumber(r.fixedCostBreakEven.units)}</strong> {r.main.many} ({m(r.fixedCostBreakEven.fixedCosts)} ÷ {m(r.main.profit)} profit each, rounded up). Everything after that adds to your profit.</>}
        </p>
      )}

      <div>
        <button type="button" className="btn-navy min-h-14 w-full text-lg" aria-expanded={showHow} onClick={() => setShowHow((s) => !s)}>
          {showHow ? "Hide the explanation" : "🧮 Show me how you calculated this"}
        </button>
        {showHow && (
          <ol className="mt-4 list-decimal space-y-2 rounded-2xl bg-slate-50 p-5 pl-10 text-lg text-slate-900">
            {r.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
      </div>
    </section>
  );
}

/** "YOU SPENT / YOU HAVE / COST PER ITEM" — shown as soon as the costs are known. */
export function CostSoFar({ r }: { r: SmartResult }) {
  const m = (n: number) => formatMoney(n, r.currency);
  const lines = r.lines;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
        <BigNumber label="💰 You spent" value={m(r.batchCost + r.perItemCost * r.quantity)} note={r.perPackageCost > 0 ? `plus ${m(r.perPackageCost)} for each package` : undefined} />
        <BigNumber label="📦 You have" value={r.quantityLabel} />
        <BigNumber label={`Cost per ${r.itemOne}`} value={m(r.costPerUnit)} tone="pink" />
      </div>
      {lines.some((l) => l.conversion) && (
        <ul className="mt-3 space-y-1 text-base text-slate-800" aria-label="Currency conversions">
          {lines.filter((l) => l.conversion).map((l, i) => (
            <li key={i}>💱 {l.name}: {l.conversion}</li>
          ))}
        </ul>
      )}
      {lines.length > 1 && (
        <details className="mt-3 text-base">
          <summary className="cursor-pointer font-semibold text-navy">See each cost</summary>
          <ul className="mt-2 divide-y divide-border">
            {lines.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{l.name}{l.appliesTo === "item" ? ` (each ${r.itemOne})` : l.appliesTo === "package" ? " (each package)" : ""}</span>
                <span className="font-semibold tabular-nums">{m(l.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-base text-slate-800">
        This means each {r.itemOne} really costs you about <strong>{m(r.costPerUnit)}</strong> after your other expenses.
      </p>
    </div>
  );
}

function WholesaleCompare({ r }: { r: SmartResult }) {
  const w = r.wholesale!;
  const m = (n: number) => formatMoney(n, r.currency);
  const u = r.main;
  return (
    <div className="rounded-2xl border border-border p-4 sm:p-5">
      <h3 className="text-xl font-bold text-navy">🏬 Retail vs wholesale</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-lg">
          <thead>
            <tr className="text-left text-base text-slate-600"><th className="py-2 font-semibold" scope="col"><span className="sr-only">Per {u.one}</span></th><th className="py-2 font-semibold" scope="col">Retail</th><th className="py-2 font-semibold" scope="col">Wholesale</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr><th scope="row" className="py-2 text-left font-normal">Price per {u.one}</th><td className="py-2 font-bold tabular-nums">{m(u.price)}</td><td className="py-2 font-bold tabular-nums">{m(w.price)}</td></tr>
            <tr><th scope="row" className="py-2 text-left font-normal">Profit per {u.one}</th><td className="py-2 font-bold tabular-nums text-green-800">{m(u.profit)}</td><td className={`py-2 font-bold tabular-nums ${w.belowCost ? "text-red-700" : "text-green-800"}`}>{m(w.profit)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-lg text-slate-800">
        A wholesale order of {formatNumber(w.minOrder)} {w.minOrder === 1 ? u.one : u.many} brings in {m(w.orderRevenue)} and makes you <strong>{m(w.orderProfit)}</strong> profit.
      </p>
    </div>
  );
}

function DiscountTable({ r }: { r: SmartResult }) {
  const m = (n: number) => formatMoney(n, r.currency);
  const u = r.main;
  return (
    <div className="rounded-2xl border border-border p-4 sm:p-5">
      <h3 className="text-xl font-bold text-navy">🏷️ If you run a sale</h3>
      <p className="text-base text-slate-600">Normal price {m(u.price)}.</p>
      <ul className="mt-3 space-y-2">
        {r.discounts.map((d) => (
          <li key={d.pct} className={`rounded-xl p-3 text-lg ${d.belowCost ? "bg-red-50 text-red-900" : "bg-green-50 text-slate-900"}`}>
            <strong>{formatNumber(d.pct)}% off</strong> → sale price {m(d.price)}.{" "}
            {d.belowCost
              ? <>⚠️ At this price you would lose {m(-d.profit)} per {u.one}.</>
              : d.profit === 0
                ? <>You only break even on each {u.one}: no profit.</>
                : <>You&apos;re still making {m(d.profit)} profit per {u.one}.</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

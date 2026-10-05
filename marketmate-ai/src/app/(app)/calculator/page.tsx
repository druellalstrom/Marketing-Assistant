import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { DEFAULT_CURRENCY, formatMoney, formatNumber, isKnownCurrency } from "@/lib/pricing/money";
import { pricingInputSchema } from "@/lib/pricing/schema";
import { pricingRowView, smartFromV1, smartInputSchema } from "@/lib/pricing/smart-schema";
import type { SmartInput } from "@/lib/pricing/smart";
import { getAuthContext } from "@/lib/supabase/server";
import { deleteItem, duplicateItem } from "../library/actions";
import { SmartCalculator } from "./smart-calculator";

export const metadata: Metadata = { title: "Smart Pricing Calculator" };

interface SavedRow {
  id: string;
  product_name: string;
  results: unknown;
  cost_per_unit: number;
  suggested_retail_price: number;
  updated_at: string;
}

export default async function CalculatorPage({ searchParams }: PageProps<"/calculator">) {
  const auth = await getAuthContext();
  const { load } = await searchParams;
  const metaCurrency = auth?.user.user_metadata?.currency;
  const businessCurrency = typeof metaCurrency === "string" && isKnownCurrency(metaCurrency) ? metaCurrency : DEFAULT_CURRENCY;

  let initial: SmartInput | null = null;
  let loadedId: string | null = null;
  let loadedName = "";
  let loadError: string | null = null;
  let saved: SavedRow[] = [];

  if (auth) {
    if (typeof load === "string" && z.uuid().safeParse(load).success) {
      const { data } = await auth.supabase.from("pricing_calculations").select("id, product_name, inputs").eq("id", load).maybeSingle();
      if (data) {
        const smart = smartInputSchema.safeParse(data.inputs);
        const old = smart.success ? null : pricingInputSchema.safeParse(data.inputs);
        if (smart.success) initial = smart.data as SmartInput;
        else if (old?.success) initial = smartFromV1(data.product_name, old.data, businessCurrency);
        if (initial) {
          loadedId = data.id;
          loadedName = data.product_name;
        } else loadError = "This calculation couldn't be opened.";
      } else loadError = "That calculation wasn't found.";
    }
    const { data } = await auth.supabase
      .from("pricing_calculations")
      .select("id, product_name, results, cost_per_unit, suggested_retail_price, updated_at")
      .order("updated_at", { ascending: false })
      .limit(24);
    saved = (data ?? []) as SavedRow[];
  }

  return (
    <>
      <PageHeader title="Smart Pricing Calculator" description="Know your costs. Set your price. Understand your profit." />
      <p className="mb-6 rounded-2xl bg-pink-50 p-4 text-lg text-slate-800">
        🙂 Don&apos;t worry about the math. Enter what you bought and we&apos;ll calculate the rest.
      </p>
      {loadError && <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-lg text-red-800" role="alert">{loadError}</p>}

      <SmartCalculator key={loadedId ?? "new"} initial={initial} savedId={loadedId} savedName={loadedName} canSave={Boolean(auth)} businessCurrency={businessCurrency} />

      {auth && (
        <section className="mt-12" aria-labelledby="my-products-title">
          <h2 id="my-products-title" className="text-2xl font-bold text-navy">🗂️ My Products</h2>
          <p className="mb-4 text-lg text-slate-600">Your saved calculations. Open one to change it, or duplicate it to start a new product from it.</p>
          {saved.length === 0 ? (
            <p className="card text-lg text-slate-700">Nothing saved yet. Work out a price above and press <strong>Save calculation</strong>.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {saved.map((row) => {
                const v = pricingRowView(row, businessCurrency);
                const m = (n: number) => formatMoney(n, v.currency);
                return (
                  <li key={row.id} className={`card flex flex-col gap-3 p-5 ${row.id === loadedId ? "ring-2 ring-brand" : ""}`}>
                    <p className="flex items-start gap-2 text-xl font-bold text-navy [overflow-wrap:anywhere]"><span aria-hidden>{v.emoji}</span>{row.product_name}</p>
                    <dl className="grid grid-cols-3 gap-2 text-base">
                      <div><dt className="text-slate-600">Cost</dt><dd className="font-bold tabular-nums">{m(v.cost)}</dd></div>
                      <div><dt className="text-slate-600">Sell for</dt><dd className="font-bold tabular-nums text-brand-strong">{m(v.price)}</dd></div>
                      <div><dt className="text-slate-600">Profit</dt><dd className={`font-bold tabular-nums ${v.profit < 0 ? "text-red-700" : "text-green-800"}`}>{m(v.profit)}</dd></div>
                    </dl>
                    <p className="text-base text-slate-600">
                      per {v.one}
                      {v.totalProfit !== null && v.available !== null ? ` · ${m(v.totalProfit)} profit if all ${formatNumber(v.available)} sell` : ""} · {new Date(row.updated_at).toLocaleDateString()}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <a href={`/calculator?load=${row.id}`} className="btn-primary min-h-12 text-base">Open</a>
                      <form action={duplicateItem.bind(null, "pricing", row.id)}><button className="btn-secondary min-h-12 text-base">Duplicate</button></form>
                      <form action={deleteItem.bind(null, "pricing", row.id, "/calculator")}>
                        <ConfirmButton message={`Delete "${row.product_name}"?`} className="btn-secondary min-h-12 text-base text-red-700">Delete</ConfirmButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

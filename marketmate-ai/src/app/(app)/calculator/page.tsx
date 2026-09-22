import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { formFromInput, type CalculatorFormState } from "@/lib/pricing/form";
import { pricingInputSchema } from "@/lib/pricing/schema";
import { getAuthContext } from "@/lib/supabase/server";
import { PricingCalculator } from "./pricing-calculator";

export const metadata: Metadata = { title: "Pricing calculator" };

interface SavedCalc {
  id: string;
  product_name: string;
  cost_per_unit: number;
  suggested_retail_price: number;
  suggested_wholesale_price: number;
  updated_at: string;
}

export default async function CalculatorPage({ searchParams }: PageProps<"/calculator">) {
  const auth = await getAuthContext();
  const { load } = await searchParams;

  let initial: CalculatorFormState | undefined;
  let loadedId: string | null = null;
  let loadError: string | null = null;
  let saved: SavedCalc[] = [];

  if (auth) {
    if (typeof load === "string" && z.uuid().safeParse(load).success) {
      const { data } = await auth.supabase
        .from("pricing_calculations")
        .select("id, product_name, inputs")
        .eq("id", load)
        .maybeSingle();
      const parsed = data ? pricingInputSchema.safeParse(data.inputs) : null;
      if (data && parsed?.success) {
        initial = formFromInput(data.product_name, parsed.data);
        loadedId = data.id;
      } else {
        loadError = data
          ? "This calculation was saved in an older format and can't be opened in the calculator."
          : "That calculation wasn't found.";
      }
    }
    const { data } = await auth.supabase
      .from("pricing_calculations")
      .select("id, product_name, cost_per_unit, suggested_retail_price, suggested_wholesale_price, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    saved = (data ?? []) as SavedCalc[];
  }
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  return (
    <>
      <PageHeader
        title="Pricing & business calculator"
        description="Enter what a production run costs you. MarketMate works out your true cost per unit, what to charge retail and wholesale, your profit, and how many you need to sell to break even. Results update as you type."
      />
      {loadError && <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{loadError}</p>}
      {/* key forces a fresh form when a different saved calculation is opened */}
      <PricingCalculator key={loadedId ?? "new"} canSave={Boolean(auth)} initial={initial} savedId={loadedId} />

      {auth && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Saved calculations</h2>
            <Link href="/library?tab=pricing" className="text-sm text-brand hover:underline">Manage in Saved work →</Link>
          </div>
          {saved.length === 0 ? (
            <p className="text-sm text-muted">Nothing saved yet.</p>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3 font-medium">Product</th>
                    <th className="p-3 text-right font-medium">Cost / unit</th>
                    <th className="p-3 text-right font-medium">Retail</th>
                    <th className="p-3 text-right font-medium">Wholesale</th>
                    <th className="p-3 font-medium">Updated</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {saved.map((c) => (
                    <tr key={c.id} className={`border-b border-border last:border-0 ${c.id === loadedId ? "bg-brand/5" : ""}`}>
                      <td className="p-3 font-medium">{c.product_name}</td>
                      <td className="p-3 text-right tabular-nums">{fmt.format(Number(c.cost_per_unit))}</td>
                      <td className="p-3 text-right tabular-nums">{fmt.format(Number(c.suggested_retail_price))}</td>
                      <td className="p-3 text-right tabular-nums">{fmt.format(Number(c.suggested_wholesale_price))}</td>
                      <td className="p-3 text-muted">{new Date(c.updated_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <Link href={`/calculator?load=${c.id}`} className="text-brand hover:underline">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

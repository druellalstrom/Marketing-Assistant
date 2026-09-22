import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getAuthContext } from "@/lib/supabase/server";
import { PricingCalculator } from "./pricing-calculator";
import { deleteCalculation } from "./actions";

export const metadata: Metadata = { title: "Pricing calculator" };

interface SavedCalc {
  id: string;
  product_name: string;
  cost_per_unit: number;
  suggested_retail_price: number;
  suggested_wholesale_price: number;
  created_at: string;
}

export default async function CalculatorPage() {
  const auth = await getAuthContext();
  let saved: SavedCalc[] = [];
  if (auth) {
    const { data } = await auth.supabase
      .from("pricing_calculations")
      .select("id, product_name, cost_per_unit, suggested_retail_price, suggested_wholesale_price, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    saved = (data ?? []) as SavedCalc[];
  }
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  return (
    <>
      <PageHeader
        title="Pricing & business calculator"
        description="Work out your true cost per unit, what to charge retail and wholesale, your profit, margin, markup and how many sales you need to break even. Results update as you type."
      />
      <PricingCalculator canSave={Boolean(auth)} />

      {auth && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Saved calculations</h2>
          {saved.length === 0 ? (
            <p className="text-sm text-muted">Nothing saved yet.</p>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Cost / unit</th>
                    <th className="p-3 text-right">Retail</th>
                    <th className="p-3 text-right">Wholesale</th>
                    <th className="p-3">Saved</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {saved.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{c.product_name}</td>
                      <td className="p-3 text-right">{fmt.format(Number(c.cost_per_unit))}</td>
                      <td className="p-3 text-right">{fmt.format(Number(c.suggested_retail_price))}</td>
                      <td className="p-3 text-right">{fmt.format(Number(c.suggested_wholesale_price))}</td>
                      <td className="p-3 text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <form action={deleteCalculation.bind(null, c.id)}>
                          <button className="text-red-600 hover:underline">Delete</button>
                        </form>
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

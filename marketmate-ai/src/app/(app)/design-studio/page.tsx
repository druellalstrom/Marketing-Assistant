import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { getImageProvider } from "@/lib/design/provider";
import { requireAuth } from "@/lib/supabase/server";
import { DesignForm } from "./design-form";

export const metadata: Metadata = { title: "Design Studio" };

const STATUS_LABEL: Record<string, string> = {
  not_connected: "Not generated — provider not connected",
  draft: "Draft",
  queued: "Queued",
  generating: "Generating",
  completed: "Completed",
  failed: "Failed",
};

export default async function DesignStudioPage() {
  const { supabase, user } = await requireAuth("/design-studio");
  const business = await getPrimaryBusiness(supabase);
  const kit = business ? await getBrandKit(supabase, business.id) : null;
  const { data: designs } = await supabase
    .from("designs")
    .select("id, title, design_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const connected = getImageProvider().connected;

  return (
    <>
      <PageHeader title="Design Studio" description="Create social graphics, flyers and labels from a simple brief." />
      {!connected && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Image generation: not connected yet.</strong> Everything else here works — briefs and
          uploads are saved — but pressing Generate will not produce an image until an image provider is connected.
        </div>
      )}
      <DesignForm
        userId={user.id}
        defaults={{
          businessName: business?.name ?? "",
          primary: kit?.primary_color ?? "#4F46E5",
          secondary: kit?.secondary_color ?? "#FFFFFF",
          accent: kit?.accent_color ?? "#F59E0B",
          logoPath: kit?.logo_path ?? null,
        }}
      />
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Saved briefs</h2>
        {designs?.length ? (
          <ul className="space-y-2 text-sm">
            {designs.map((d) => (
              <li key={d.id} className="card flex flex-wrap justify-between gap-2 p-3">
                <span><span className="font-medium">{d.title}</span> <span className="text-muted">· {d.design_type}</span></span>
                <span className="text-muted">{STATUS_LABEL[d.status] ?? d.status} · {new Date(d.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No briefs yet.</p>
        )}
      </section>
    </>
  );
}

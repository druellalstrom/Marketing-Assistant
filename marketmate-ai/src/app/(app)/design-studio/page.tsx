import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { isAiConfigured } from "@/lib/ai/provider";
import { getBrandKit, getPrimaryBusiness } from "@/lib/data/business";
import { DESIGN_STYLES, DESIGN_TYPES } from "@/lib/design/brief";
import { getImageProvider } from "@/lib/design/provider";
import { libraryHref } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";
import { DesignForm, type DesignFormValues } from "./design-form";

export const metadata: Metadata = { title: "Design Studio" };

const STATUS_LABEL: Record<string, string> = {
  not_connected: "Image not generated — provider not connected",
  draft: "Draft",
  queued: "Queued",
  generating: "Generating",
  completed: "Completed",
  failed: "Failed",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default async function DesignStudioPage({ searchParams }: PageProps<"/design-studio">) {
  const { supabase, user } = await requireAuth("/design-studio");
  const { load } = await searchParams;
  const business = await getPrimaryBusiness(supabase);
  const kit = business ? await getBrandKit(supabase, business.id) : null;

  const handles = Object.entries(business?.social_handles ?? {})
    .filter(([, h]) => h)
    .map(([, h]) => h)
    .join(" · ");
  let initial: DesignFormValues = {
    title: "",
    designType: DESIGN_TYPES[0],
    style: DESIGN_STYLES[0],
    businessName: business?.name ?? "",
    productName: "",
    description: "",
    price: "",
    promotion: "",
    contact: [business?.phone, business?.email, business?.website].filter(Boolean).join(" · "),
    handles,
    targetAudience: business?.target_audience ?? "",
    headline: "",
    callToAction: "",
    details: "",
    copy: "",
    colors: {
      primary: kit?.primary_color ?? "#4F46E5",
      secondary: kit?.secondary_color ?? "#FFFFFF",
      accent: kit?.accent_color ?? "#F59E0B",
    },
    uploads: { logo: kit?.logo_path ?? "", productPhoto: "", reference: "" },
  };

  let loadedId: string | null = null;
  if (typeof load === "string" && z.uuid().safeParse(load).success) {
    const { data } = await supabase.from("designs").select("id, title, brief").eq("id", load).maybeSingle();
    if (data) {
      const b = (data.brief ?? {}) as Record<string, unknown>;
      const colors = (b.colors ?? {}) as Record<string, string>;
      const uploads = (b.uploads ?? {}) as Record<string, string>;
      loadedId = data.id;
      initial = {
        ...initial,
        title: data.title,
        designType: (DESIGN_TYPES as readonly string[]).includes(str(b.designType)) ? str(b.designType) : initial.designType,
        style: (DESIGN_STYLES as readonly string[]).includes(str(b.style)) ? str(b.style) : initial.style,
        businessName: str(b.businessName),
        productName: str(b.productName),
        description: str(b.description),
        price: str(b.price),
        promotion: str(b.promotion),
        contact: str(b.contact),
        handles: str(b.handles),
        targetAudience: str(b.targetAudience),
        headline: str(b.headline),
        callToAction: str(b.callToAction),
        details: str(b.details),
        copy: str(b.copy),
        colors: { primary: colors.primary ?? initial.colors.primary, secondary: colors.secondary ?? initial.colors.secondary, accent: colors.accent ?? initial.colors.accent },
        uploads: { logo: uploads.logo ?? "", productPhoto: uploads.productPhoto ?? "", reference: uploads.reference ?? "" },
      };
    }
  }

  const { data: designs } = await supabase
    .from("designs")
    .select("id, title, design_type, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);
  const connected = getImageProvider().connected;

  return (
    <>
      <PageHeader
        title="Design Studio"
        description="Posters, social graphics, flyers, ads, business cards and banners — from one brief, with AI-written copy."
      />
      {!connected && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Image generation: not connected yet.</strong> AI marketing copy, briefs, uploads and saving all work, but no
          image is created until an image provider (e.g. Pollinations.ai or a paid API) is connected.
        </div>
      )}
      {loadedId && (
        <p className="mb-4 text-sm text-muted">
          Editing a saved design. <Link href="/design-studio" className="text-brand hover:underline">Start a new one</Link>
        </p>
      )}
      <DesignForm key={loadedId ?? "new"} userId={user.id} initial={initial} designId={loadedId} aiConfigured={isAiConfigured()} />

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent designs</h2>
          <Link href="/library?tab=designs" className="text-sm text-brand hover:underline">All designs →</Link>
        </div>
        {designs?.length ? (
          <ul className="card divide-y divide-border p-0 text-sm">
            {designs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Link href={libraryHref("designs", d.id)} className="font-medium hover:text-brand hover:underline">{d.title}</Link>
                <span className="text-sm text-muted">{d.design_type} · {STATUS_LABEL[d.status] ?? d.status} · {new Date(d.updated_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No designs yet.</p>
        )}
      </section>
    </>
  );
}

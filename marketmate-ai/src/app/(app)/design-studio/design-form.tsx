"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/file-upload";
import { ResultActions } from "@/components/result-actions";
import { DESIGN_STYLES, DESIGN_TYPES } from "@/lib/design/brief";

export interface DesignFormValues {
  title: string;
  designType: string;
  style: string;
  businessName: string;
  productName: string;
  description: string;
  price: string;
  promotion: string;
  contact: string;
  handles: string;
  targetAudience: string;
  headline: string;
  callToAction: string;
  details: string;
  copy: string;
  colors: { primary: string; secondary: string; accent: string };
  uploads: { logo: string; productPhoto: string; reference: string };
}

interface Props {
  userId: string;
  initial: DesignFormValues;
  designId: string | null;
  aiConfigured: boolean;
}

type ImageResult =
  | { kind: "not_connected"; message: string; prompt: string }
  | { kind: "completed"; imageUrl: string; prompt: string }
  | { kind: "error"; message: string };

const TEXT_FIELDS: [keyof DesignFormValues, string, { max: number; textarea?: boolean; placeholder?: string; required?: boolean }][] = [
  ["businessName", "Business name", { max: 200, required: true }],
  ["productName", "Product / service", { max: 200, required: true }],
  ["description", "Product description", { max: 2000, textarea: true }],
  ["price", "Price", { max: 50, placeholder: "$24" }],
  ["promotion", "Promotion", { max: 300, placeholder: "e.g. 20% off this weekend" }],
  ["contact", "Contact information", { max: 300, placeholder: "Phone, email or website" }],
  ["handles", "Social media handles", { max: 300, placeholder: "@yourbrand" }],
  ["targetAudience", "Target audience", { max: 500 }],
];

export function DesignForm({ userId, initial, designId: initialId, aiConfigured }: Props) {
  const router = useRouter();
  const [v, setV] = useState<DesignFormValues>(initial);
  const [designId, setDesignId] = useState<string | null>(initialId);
  const [copyState, setCopyState] = useState<{ kind: "idle" | "loading" | "error"; message?: string }>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);

  const set = <K extends keyof DesignFormValues>(k: K, value: DesignFormValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const missing = [!v.businessName.trim() && "Business name", !v.productName.trim() && "Product / service"].filter(Boolean) as string[];

  async function generateCopy() {
    if (missing.length) return setCopyState({ kind: "error", message: `Please fill in: ${missing.join(", ")}.` });
    setCopyState({ kind: "loading" });
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "design_copy",
          input: {
            design_type: v.designType,
            business_name: v.businessName,
            product: v.productName,
            description: v.description,
            price: v.price,
            promotion: v.promotion,
            contact: v.contact,
            handles: v.handles,
            target_audience: v.targetAudience,
            style: v.style,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setCopyState({ kind: "error", message: data.error ?? `Request failed (${res.status}).` });
      set("copy", data.text);
      setCopyState({ kind: "idle" });
    } catch {
      setCopyState({ kind: "error", message: "Network error — please try again." });
    }
  }

  async function saveAndGenerate() {
    if (missing.length) return setResult({ kind: "error", message: `Please fill in: ${missing.join(", ")}.` });
    setSaving(true);
    setResult(null);
    const opt = (s: string) => s.trim() || undefined;
    const brief = {
      designId: designId ?? undefined,
      title: opt(v.title),
      designType: v.designType,
      style: v.style,
      businessName: v.businessName,
      productName: v.productName,
      description: opt(v.description),
      price: opt(v.price),
      promotion: opt(v.promotion),
      contact: opt(v.contact),
      handles: opt(v.handles),
      targetAudience: opt(v.targetAudience),
      headline: opt(v.headline),
      callToAction: opt(v.callToAction),
      details: opt(v.details),
      copy: opt(v.copy),
      colors: v.colors,
      uploads: Object.fromEntries(Object.entries(v.uploads).filter(([, p]) => p)),
    };
    try {
      const res = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const data = await res.json().catch(() => ({}));
      if (data.designId) {
        setDesignId(data.designId);
        router.refresh();
      }
      if (data.status === "not_connected") setResult({ kind: "not_connected", message: data.message, prompt: data.prompt });
      else if (data.status === "completed") setResult({ kind: "completed", imageUrl: data.imageUrl, prompt: data.prompt });
      else setResult({ kind: "error", message: data.error ?? `Request failed (${res.status}).` });
    } catch {
      setResult({ kind: "error", message: "Network error — please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,500px)_1fr]">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void saveAndGenerate();
        }}
        noValidate
      >
        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Design</legend>
          <div>
            <label className="label" htmlFor="d-title">Design name (optional)</label>
            <input id="d-title" className="input" maxLength={200} value={v.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="d-type">Design type</label>
              <select id="d-type" className="input" value={v.designType} onChange={(e) => set("designType", e.target.value)}>
                {DESIGN_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-style">Desired style</label>
              <select id="d-style" className="input" value={v.style} onChange={(e) => set("style", e.target.value)}>
                {DESIGN_STYLES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">What to promote</legend>
          {TEXT_FIELDS.map(([k, label, o]) => (
            <div key={k}>
              <label className="label" htmlFor={`d-${k}`}>{label}{o.required && <span className="text-red-600"> *</span>}</label>
              {o.textarea ? (
                <textarea id={`d-${k}`} className="input min-h-20" maxLength={o.max} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} />
              ) : (
                <input id={`d-${k}`} className="input" maxLength={o.max} placeholder={o.placeholder} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} aria-required={o.required} />
              )}
            </div>
          ))}
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Look &amp; assets</legend>
          <div>
            <p className="label">Brand colours</p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(v.colors) as (keyof DesignFormValues["colors"])[]).map((k) => (
                <label key={k} className="flex flex-col items-center gap-1 text-xs capitalize text-muted">
                  <input type="color" value={v.colors[k]} onChange={(e) => set("colors", { ...v.colors, [k]: e.target.value.toUpperCase() })} className="h-10 w-full cursor-pointer rounded border border-border" />
                  {k} {v.colors[k]}
                </label>
              ))}
            </div>
          </div>
          <FileUpload name="logo" label="Logo" userId={userId} folder="designs" defaultPath={v.uploads.logo || null} onChange={(p) => set("uploads", { ...v.uploads, logo: p })} />
          <FileUpload name="productPhoto" label="Product image" userId={userId} folder="designs" defaultPath={v.uploads.productPhoto || null} onChange={(p) => set("uploads", { ...v.uploads, productPhoto: p })} />
          <FileUpload name="reference" label="Reference / inspiration image" userId={userId} folder="designs" defaultPath={v.uploads.reference || null} onChange={(p) => set("uploads", { ...v.uploads, reference: p })} />
          <div>
            <label className="label" htmlFor="d-details">Extra direction</label>
            <textarea id="d-details" className="input min-h-16" maxLength={2000} value={v.details} onChange={(e) => set("details", e.target.value)} placeholder="e.g. autumn leaves, cozy lighting, lots of white space" />
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="px-1 text-sm font-semibold">Marketing copy</legend>
          <p className="text-sm text-muted">Generate headline, supporting text and a call to action with AI, then edit them.</p>
          <button type="button" className="btn-secondary w-full" disabled={copyState.kind === "loading" || !aiConfigured} onClick={() => void generateCopy()}>
            {copyState.kind === "loading" ? "Writing copy…" : v.copy ? "Regenerate copy" : "Generate marketing copy"}
          </button>
          {!aiConfigured && <p className="text-xs text-amber-800">AI copy needs ANTHROPIC_API_KEY on the server.</p>}
          {copyState.kind === "error" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
              <span>{copyState.message}</span>
              {missing.length === 0 && <button type="button" className="btn-secondary py-1" onClick={() => void generateCopy()}>Retry</button>}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="d-headline">Headline</label>
              <input id="d-headline" className="input" maxLength={200} value={v.headline} onChange={(e) => set("headline", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="d-cta">Call to action</label>
              <input id="d-cta" className="input" maxLength={100} value={v.callToAction} onChange={(e) => set("callToAction", e.target.value)} placeholder="Shop now" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="d-copy">Copy</label>
            <textarea id="d-copy" className="input min-h-40 font-mono text-[13px]" maxLength={5000} value={v.copy} onChange={(e) => set("copy", e.target.value)} placeholder="Generated or your own copy for the design" />
          </div>
          {v.copy && <ResultActions text={v.copy} filename={`${v.productName} copy`} />}
        </fieldset>

        <div className="card space-y-2">
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Saving…" : designId ? "Save changes & generate image" : "Save design & generate image"}</button>
          <p className="text-xs text-muted">Image generation isn&apos;t connected yet — your design brief and copy will be saved, but no image will be created.</p>
        </div>
      </form>

      <div aria-live="polite" className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
        <div className="card">
          <p className="mb-3 text-sm font-medium">Layout preview (not a generated image)</p>
          <div className="overflow-hidden rounded-lg border border-border p-5" style={{ background: v.colors.secondary }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: v.colors.primary }}>{v.businessName || "Business name"}</p>
            <p className="mt-2 text-2xl font-bold leading-tight" style={{ color: v.colors.primary }}>{v.headline || v.productName || "Your headline"}</p>
            {v.promotion && <p className="mt-2 inline-block rounded px-2 py-1 text-sm font-semibold text-white" style={{ background: v.colors.accent }}>{v.promotion}</p>}
            {v.price && <p className="mt-2 text-lg font-semibold" style={{ color: v.colors.primary }}>{v.price}</p>}
            <p className="mt-3 inline-block rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: v.colors.accent }}>{v.callToAction || "Shop now"}</p>
            {(v.contact || v.handles) && <p className="mt-3 text-xs" style={{ color: v.colors.primary }}>{[v.contact, v.handles].filter(Boolean).join(" · ")}</p>}
          </div>
          <p className="mt-2 text-xs text-muted">A simple mock-up of your text and colours to check the brief. It is not AI-generated artwork.</p>
        </div>

        {result?.kind === "not_connected" && (
          <>
            <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-amber-950" role="status">
              <p className="font-semibold">Not connected yet — no image was generated</p>
              <p className="mt-1 text-sm">{result.message}</p>
            </div>
            <div className="card">
              <p className="mb-2 text-sm font-medium">Prompt that will be sent once a provider is connected</p>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg bg-background p-3 font-mono text-xs">{result.prompt}</p>
            </div>
          </>
        )}
        {result?.kind === "completed" && (
          // eslint-disable-next-line @next/next/no-img-element -- provider URLs are arbitrary remote hosts
          <img src={result.imageUrl} alt="Generated design" className="card w-full p-2" />
        )}
        {result?.kind === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <span>{result.message}</span>
            {missing.length === 0 && <button type="button" className="btn-secondary py-1" onClick={() => void saveAndGenerate()}>Retry</button>}
          </div>
        )}
      </div>
    </div>
  );
}

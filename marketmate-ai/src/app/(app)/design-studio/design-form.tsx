"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/file-upload";
import { DESIGN_STYLES, DESIGN_TYPES } from "@/lib/design/brief";

interface Props {
  userId: string;
  defaults: { businessName: string; primary: string; secondary: string; accent: string; logoPath: string | null };
}

type Result =
  | { kind: "not_connected"; message: string; prompt: string }
  | { kind: "completed"; imageUrl: string; prompt: string }
  | { kind: "error"; message: string };

export function DesignForm({ userId, defaults }: Props) {
  const router = useRouter();
  const [colors, setColors] = useState({ primary: defaults.primary, secondary: defaults.secondary, accent: defaults.accent });
  const [uploads, setUploads] = useState({ logo: defaults.logoPath ?? "", productPhoto: "", reference: "" });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const brief = {
      title: text("title"),
      designType: f.get("designType"),
      style: f.get("style"),
      businessName: String(f.get("businessName") ?? ""),
      productName: String(f.get("productName") ?? ""),
      price: text("price"),
      headline: text("headline"),
      callToAction: text("callToAction"),
      details: text("details"),
      colors,
      uploads: Object.fromEntries(Object.entries(uploads).filter(([, v]) => v)),
    };

    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const data = await res.json().catch(() => ({}));
      if (data.status === "not_connected") setResult({ kind: "not_connected", message: data.message, prompt: data.prompt });
      else if (data.status === "completed") setResult({ kind: "completed", imageUrl: data.imageUrl, prompt: data.prompt });
      else setResult({ kind: "error", message: data.error ?? `Request failed (${res.status}).` });
      if (data.designId) router.refresh();
    } catch {
      setResult({ kind: "error", message: "Network error — please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_1fr]">
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">Design name (optional)</label>
          <input className="input" id="title" name="title" maxLength={200} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="designType">Format</label>
            <select className="input" id="designType" name="designType">{DESIGN_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="style">Style</label>
            <select className="input" id="style" name="style">{DESIGN_STYLES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="businessName">Business name *</label>
            <input className="input" id="businessName" name="businessName" required maxLength={200} defaultValue={defaults.businessName} />
          </div>
          <div>
            <label className="label" htmlFor="productName">Product *</label>
            <input className="input" id="productName" name="productName" required maxLength={200} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="price">Price</label>
            <input className="input" id="price" name="price" maxLength={50} placeholder="$24" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="callToAction">Call to action</label>
            <input className="input" id="callToAction" name="callToAction" maxLength={100} placeholder="Shop now" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="headline">Headline text</label>
          <input className="input" id="headline" name="headline" maxLength={200} />
        </div>
        <fieldset>
          <legend className="label">Brand colours</legend>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(colors) as (keyof typeof colors)[]).map((k) => (
              <label key={k} className="flex flex-col items-center gap-1 text-xs capitalize text-muted">
                <input type="color" value={colors[k]} onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value.toUpperCase() }))} className="h-10 w-full cursor-pointer rounded border border-border" />
                {k} {colors[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <FileUpload name="logo" label="Logo" userId={userId} folder="designs" defaultPath={defaults.logoPath} onChange={(p) => setUploads((u) => ({ ...u, logo: p }))} />
        <FileUpload name="productPhoto" label="Product photo" userId={userId} folder="designs" onChange={(p) => setUploads((u) => ({ ...u, productPhoto: p }))} />
        <FileUpload name="reference" label="Reference / inspiration image" userId={userId} folder="designs" onChange={(p) => setUploads((u) => ({ ...u, reference: p }))} />
        <div>
          <label className="label" htmlFor="details">Extra direction</label>
          <textarea className="input min-h-20" id="details" name="details" maxLength={2000} placeholder="e.g. autumn leaves, cozy lighting, lots of white space" />
        </div>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving brief…" : "Generate design"}</button>
      </form>

      <div aria-live="polite">
        {result?.kind === "not_connected" && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-amber-950" role="status">
              <p className="font-semibold">Not connected yet — no image was generated</p>
              <p className="mt-1 text-sm">{result.message}</p>
            </div>
            <div className="card">
              <p className="mb-2 text-sm font-medium">Prompt that will be sent once a provider is connected</p>
              <p className="whitespace-pre-wrap rounded-lg bg-background p-3 font-mono text-xs">{result.prompt}</p>
            </div>
          </div>
        )}
        {result?.kind === "completed" && (
          // eslint-disable-next-line @next/next/no-img-element -- provider URLs are arbitrary remote hosts
          <img src={result.imageUrl} alt="Generated design" className="card w-full p-2" />
        )}
        {result?.kind === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">{result.message}</div>
        )}
        {!result && (
          <div className="card flex min-h-60 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <p>Fill in the brief and press Generate.</p>
            <p className="max-w-sm text-xs">Image generation isn&apos;t connected yet: your brief and uploads will be saved, but no image will be created until a provider is added.</p>
          </div>
        )}
      </div>
    </div>
  );
}

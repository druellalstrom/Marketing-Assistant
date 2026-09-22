"use client";

import { preservingSubmit } from "@/components/use-preserving-submit";
import { useActionState, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { saveBrandKit, type FormState } from "./actions";

interface Defaults {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  brand_voice: string | null;
  tagline: string | null;
  keywords: string[];
  logo_path: string | null;
}

export function BrandKitForm({ defaults, userId, businessName }: { defaults: Defaults | null; userId: string; businessName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBrandKit, {});
  const [colors, setColors] = useState({
    primary_color: defaults?.primary_color ?? "#4F46E5",
    secondary_color: defaults?.secondary_color ?? "#F8FAFC",
    accent_color: defaults?.accent_color ?? "#F59E0B",
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form onSubmit={preservingSubmit(action)} className="card space-y-4">
        <fieldset>
          <legend className="label">Brand colours</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(colors) as (keyof typeof colors)[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="color" aria-label={`${k.replace("_color", "")} colour picker`} value={colors[k]} onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value.toUpperCase() }))} className="h-10 w-12 cursor-pointer rounded border border-border" />
                <input name={k} value={colors[k]} onChange={(e) => setColors((c) => ({ ...c, [k]: e.target.value }))} className="input font-mono" pattern="#[0-9A-Fa-f]{6}" aria-label={`${k.replace("_color", "")} colour hex`} />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="heading_font">Heading font</label>
            <input className="input" id="heading_font" name="heading_font" maxLength={100} defaultValue={defaults?.heading_font ?? ""} placeholder="e.g. Playfair Display" />
          </div>
          <div>
            <label className="label" htmlFor="body_font">Body font</label>
            <input className="input" id="body_font" name="body_font" maxLength={100} defaultValue={defaults?.body_font ?? ""} placeholder="e.g. Inter" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tagline">Tagline</label>
          <input className="input" id="tagline" name="tagline" maxLength={200} defaultValue={defaults?.tagline ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="brand_voice">Brand voice</label>
          <textarea className="input min-h-24" id="brand_voice" name="brand_voice" maxLength={2000} defaultValue={defaults?.brand_voice ?? ""} placeholder="e.g. Warm, down-to-earth and a little witty. We never use jargon." />
        </div>
        <div>
          <label className="label" htmlFor="keywords">Brand keywords (comma-separated)</label>
          <input className="input" id="keywords" name="keywords" maxLength={1000} defaultValue={defaults?.keywords.join(", ") ?? ""} placeholder="cozy, handmade, small-batch" />
        </div>
        <FileUpload name="logo_path" label="Logo" userId={userId} folder="brand" defaultPath={defaults?.logo_path} />
        {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700" role="status">Brand kit saved.</p>}
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save brand kit"}</button>
      </form>

      <aside className="card h-fit" aria-label="Preview">
        <p className="mb-3 text-sm text-muted">Preview</p>
        <div className="overflow-hidden rounded-lg border border-border" style={{ background: colors.secondary_color }}>
          <div className="p-4" style={{ background: colors.primary_color }}>
            <p className="text-lg font-bold" style={{ color: colors.secondary_color }}>{businessName}</p>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-sm" style={{ color: colors.primary_color }}>Your brand colours in action.</p>
            <span className="inline-block rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: colors.accent_color }}>Shop now</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

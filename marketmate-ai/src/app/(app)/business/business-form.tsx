"use client";

import { preservingSubmit } from "@/components/use-preserving-submit";
import { useActionState } from "react";
import { saveBusiness, type FormState } from "./actions";

interface Defaults {
  name?: string;
  industry?: string | null;
  description?: string | null;
  products?: string | null;
  target_audience?: string | null;
  location?: string | null;
  website?: string | null;
  social_handles?: Record<string, string>;
}

export function BusinessForm({ defaults }: { defaults: Defaults | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBusiness, {});
  const d = defaults ?? {};
  const field = (name: keyof Defaults, label: string, opts: { textarea?: boolean; required?: boolean; max: number; placeholder?: string }) => (
    <div>
      <label className="label" htmlFor={name}>{label}{opts.required && <span className="text-red-600"> *</span>}</label>
      {opts.textarea ? (
        <textarea id={name} name={name} className="input min-h-24" maxLength={opts.max} defaultValue={(d[name] as string) ?? ""} placeholder={opts.placeholder} />
      ) : (
        <input id={name} name={name} className="input" required={opts.required} maxLength={opts.max} defaultValue={(d[name] as string) ?? ""} placeholder={opts.placeholder} />
      )}
    </div>
  );

  return (
    <form onSubmit={preservingSubmit(action)} className="card max-w-3xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Business name", { required: true, max: 200 })}
        {field("industry", "Industry", { max: 200, placeholder: "e.g. Handmade candles" })}
      </div>
      {field("description", "What your business does", { textarea: true, max: 3000 })}
      {field("products", "Products / services (with prices if you like)", { textarea: true, max: 3000 })}
      {field("target_audience", "Who your customers are", { textarea: true, max: 2000 })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("location", "Location", { max: 200 })}
        {field("website", "Website", { max: 300, placeholder: "https://" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {(["instagram", "tiktok", "facebook"] as const).map((k) => (
          <div key={k}>
            <label className="label capitalize" htmlFor={k}>{k}</label>
            <input id={k} name={k} className="input" maxLength={200} defaultValue={d.social_handles?.[k] ?? ""} placeholder="@handle" />
          </div>
        ))}
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700" role="status">Saved. AI tools will now use this profile.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

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
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  social_handles?: Record<string, string>;
}

const SOCIALS: [key: string, label: string][] = [
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"],
  ["x", "X (Twitter)"],
  ["pinterest", "Pinterest"],
  ["youtube", "YouTube"],
];

export function BusinessForm({ defaults }: { defaults: Defaults | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBusiness, {});
  const d = defaults ?? {};
  const field = (name: keyof Defaults, label: string, opts: { textarea?: boolean; required?: boolean; max: number; placeholder?: string; type?: string; autoComplete?: string }) => (
    <div>
      <label className="label" htmlFor={name}>{label}{opts.required && <span className="text-red-600"> *</span>}</label>
      {opts.textarea ? (
        <textarea id={name} name={name} className="input min-h-24" maxLength={opts.max} defaultValue={(d[name] as string) ?? ""} placeholder={opts.placeholder} />
      ) : (
        <input id={name} name={name} type={opts.type ?? "text"} autoComplete={opts.autoComplete} className="input" required={opts.required} maxLength={opts.max} defaultValue={(d[name] as string) ?? ""} placeholder={opts.placeholder} />
      )}
    </div>
  );

  return (
    <form onSubmit={preservingSubmit(action)} className="space-y-6" noValidate>
      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold">About the business</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Business name", { required: true, max: 200, autoComplete: "organization" })}
          {field("industry", "Industry", { max: 200, placeholder: "e.g. Handmade candles" })}
        </div>
        {field("description", "Description", { textarea: true, max: 3000, placeholder: "What you do and what makes you different" })}
        {field("products", "Products / services", { textarea: true, max: 3000, placeholder: "One per line, with prices if you like" })}
        {field("target_audience", "Target audience", { textarea: true, max: 2000, placeholder: "Who buys from you" })}
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 text-sm font-semibold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("location", "Location", { max: 200, placeholder: "e.g. Bridgetown, Barbados" })}
          {field("phone", "Phone", { max: 40, type: "tel", autoComplete: "tel" })}
          {field("email", "Email", { max: 254, type: "email", autoComplete: "email" })}
          {field("website", "Website", { max: 300, placeholder: "https://", autoComplete: "url" })}
        </div>
      </fieldset>

      <fieldset className="card">
        <legend className="px-1 text-sm font-semibold">Social media accounts</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOCIALS.map(([k, label]) => (
            <div key={k}>
              <label className="label" htmlFor={k}>{label}</label>
              <input id={k} name={k} className="input" maxLength={200} defaultValue={d.social_handles?.[k] ?? ""} placeholder="@handle or link" />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700" role="status">Saved. Every AI tool now uses this profile.</p>}
      </div>
    </form>
  );
}

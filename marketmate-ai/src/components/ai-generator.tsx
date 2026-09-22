"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ToolField } from "@/lib/ai/tool-definitions";

interface Props {
  toolId: string;
  fields: readonly ToolField[];
  aiConfigured: boolean;
}

interface GenerateResponse {
  text?: string;
  error?: string;
  saveError?: string | null;
  usedBusinessProfile?: boolean;
}

export function AiGenerator({ toolId, fields, aiConfigured }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const input: Record<string, string> = {};
    for (const f of fields) input[f.name] = String(form.get(f.name) ?? "");

    setPending(true);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, input }),
      });
      const data = (await res.json().catch(() => ({ error: `Request failed (${res.status}).` }))) as GenerateResponse;
      setResult(res.ok ? data : { error: data.error ?? `Request failed (${res.status}).` });
      if (res.ok) router.refresh(); // update the saved-history list
    } catch {
      setResult({ error: "Network error — please try again." });
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!result?.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <form onSubmit={onSubmit} className="card space-y-4">
        {!aiConfigured && (
          <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
            AI is not connected: set <code>ANTHROPIC_API_KEY</code> on the server to enable generation.
          </p>
        )}
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={f.name}>
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea id={f.name} name={f.name} className="input min-h-28" required={f.required} maxLength={f.maxLength} placeholder={f.placeholder} />
            ) : f.type === "select" ? (
              <select id={f.name} name={f.name} className="input" required={f.required} defaultValue={f.required ? f.options?.[0] : ""}>
                {!f.required && <option value="">— Any —</option>}
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={f.name} name={f.name} className="input" required={f.required} maxLength={f.maxLength} placeholder={f.placeholder} />
            )}
            {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
          </div>
        ))}
        <button className="btn-primary w-full" disabled={pending || !aiConfigured}>
          {pending ? "Generating… (this can take up to a minute)" : "Generate"}
        </button>
      </form>

      <div aria-live="polite">
        {result?.error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">{result.error}</div>
        )}
        {result?.text && (
          <div className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {result.saveError ?? "Saved to your history."}
                {result.usedBusinessProfile === false && " Tip: add a business profile for more tailored results."}
              </p>
              <button onClick={copy} className="btn-secondary">{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.text}</div>
          </div>
        )}
        {!result && !pending && (
          <div className="card flex min-h-40 items-center justify-center text-sm text-muted">
            Your generated content will appear here.
          </div>
        )}
        {pending && (
          <div className="card flex min-h-40 animate-pulse items-center justify-center text-sm text-muted">
            Writing…
          </div>
        )}
      </div>
    </div>
  );
}

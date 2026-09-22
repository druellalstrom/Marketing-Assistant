"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PrefillKey, ToolField } from "@/lib/ai/tool-definitions";
import { deleteGenerated, updateGenerated } from "@/components/history-actions";
import { ResultActions } from "@/components/result-actions";

interface Props {
  toolId: string;
  fields: readonly ToolField[];
  aiConfigured: boolean;
  prefill: Partial<Record<PrefillKey, string>>;
  disclaimer?: string;
  path: string;
}

interface Generated {
  id: string | null;
  table: "social_content" | "marketing_plans" | "campaigns";
  title: string;
  savedBody: string;
  saveError: string | null;
  usedBusinessProfile: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done" };

function initialValue(f: ToolField, prefill: Props["prefill"]): string {
  const pre = f.prefill ? prefill[f.prefill] : undefined;
  if (f.type === "select") {
    // Only pre-select a profile value if it's one of the options.
    if (pre && f.options?.includes(pre)) return pre;
    return f.defaultValue ?? (f.required ? (f.options?.[0] ?? "") : (f.options?.[0] ?? ""));
  }
  if (f.type === "checkboxes") {
    const allowed = new Set(f.options);
    const fromProfile = (pre ?? "").split(",").map((x) => x.trim()).filter((x) => allowed.has(x));
    return fromProfile.length ? fromProfile.join(", ") : (f.defaultValue ?? "");
  }
  return pre ?? f.defaultValue ?? "";
}

export function AiGenerator({ toolId, fields, aiConfigured, prefill, disclaimer, path }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initialValue(f, prefill)])),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const toggle = (name: string, option: string) => {
    const current = new Set((values[name] ?? "").split(",").map((x) => x.trim()).filter(Boolean));
    if (current.has(option)) current.delete(option);
    else current.add(option);
    const f = fields.find((x) => x.name === name);
    set(name, (f?.options ?? []).filter((o) => current.has(o)).join(", "));
  };

  const missing = fields.filter((f) => f.required && !(values[f.name] ?? "").trim());

  async function generate() {
    if (missing.length) {
      setStatus({ kind: "error", message: `Please fill in: ${missing.map((f) => f.label).join(", ")}.` });
      return;
    }
    setStatus({ kind: "loading" });
    setNotice(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, input: values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? `Request failed (${res.status}).` });
        return;
      }
      setGenerated({
        id: data.savedId ?? null,
        table: data.savedTable,
        title: data.title,
        savedBody: data.text,
        saveError: data.saveError ?? null,
        usedBusinessProfile: Boolean(data.usedBusinessProfile),
      });
      setDraft(data.text);
      setTitle(data.title);
      setStatus({ kind: "done" });
      router.refresh(); // update the history list
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setStatus({ kind: "error", message: "Network error — check your connection and try again." });
    }
  }

  async function saveEdits() {
    if (!generated?.id) return;
    setSaving(true);
    const res = await updateGenerated(generated.table, generated.id, { title, body: draft }, path);
    setSaving(false);
    if (res.ok) {
      setGenerated({ ...generated, savedBody: draft, title });
      setNotice({ ok: true, text: "Changes saved." });
      router.refresh();
    } else {
      setNotice({ ok: false, text: res.error ?? "Could not save changes." });
    }
  }

  async function remove() {
    if (!generated?.id || !confirm("Delete this from your library?")) return;
    const res = await deleteGenerated(generated.table, generated.id, path);
    if (res.ok) {
      setGenerated(null);
      setDraft("");
      setStatus({ kind: "idle" });
      router.refresh();
    } else {
      setNotice({ ok: false, text: "Could not delete. Please try again." });
    }
  }

  const dirty = generated !== null && (draft !== generated.savedBody || title !== generated.title);
  const loading = status.kind === "loading";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        className="card space-y-4"
        noValidate
      >
        {!aiConfigured && (
          <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
            AI is not connected: set <code>ANTHROPIC_API_KEY</code> on the server to enable generation.
          </p>
        )}
        {fields.map((f) => (
          <div key={f.name}>
            {f.type === "checkboxes" ? (
              <fieldset>
                <legend className="label">
                  {f.label}
                  {f.required && <span className="text-red-600"> *</span>}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {f.options?.map((o) => {
                    const checked = (values[f.name] ?? "").split(",").map((x) => x.trim()).includes(o);
                    return (
                      <label key={o} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${checked ? "border-brand bg-brand/10 text-brand" : "border-border"}`}>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(f.name, o)} />
                        {o}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <>
                <label className="label" htmlFor={`f-${f.name}`}>
                  {f.label}
                  {f.required && <span className="text-red-600"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea id={`f-${f.name}`} className="input min-h-24" maxLength={f.maxLength} placeholder={f.placeholder} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} aria-required={f.required} />
                ) : f.type === "select" ? (
                  <select id={`f-${f.name}`} className="input" value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                    {!f.required && <option value="">— Any —</option>}
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={`f-${f.name}`} className="input" maxLength={f.maxLength} placeholder={f.placeholder} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} aria-required={f.required} />
                )}
              </>
            )}
            {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
            {f.prefill && prefill[f.prefill] && values[f.name] === prefill[f.prefill] && (
              <p className="mt-1 text-xs text-muted">From your business profile</p>
            )}
          </div>
        ))}
        <button className="btn-primary w-full" disabled={loading || !aiConfigured}>
          {loading ? "Generating… this can take up to a minute" : generated ? "Generate new version" : "Generate"}
        </button>
      </form>

      <div ref={resultRef} aria-live="polite" className="min-w-0 space-y-3">
        {status.kind === "error" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <span>{status.message}</span>
            {missing.length === 0 && aiConfigured && (
              <button type="button" className="btn-secondary" onClick={() => void generate()}>Retry</button>
            )}
          </div>
        )}
        {loading && (
          <div className="card flex min-h-40 animate-pulse items-center justify-center text-sm text-muted">Writing…</div>
        )}
        {generated && !loading && (
          <div className="card space-y-3">
            {disclaimer && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{disclaimer}</p>}
            <p className="text-sm text-muted">
              {generated.saveError ?? "Saved to your library. Edit below, then save your changes."}
              {!generated.usedBusinessProfile && " Tip: add a business profile for more tailored results."}
            </p>
            <div>
              <label className="label" htmlFor="result-title">Title</label>
              <input id="result-title" className="input" value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="result-body">Content</label>
              <textarea id="result-body" className="input min-h-96 font-mono text-[13px] leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <ResultActions
              text={draft}
              filename={title}
              onRegenerate={() => void generate()}
              regenerating={loading}
              onSave={generated.id ? () => void saveEdits() : undefined}
              saving={saving}
              dirty={dirty}
              onDelete={generated.id ? () => void remove() : undefined}
            />
            {notice && <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`} role="status">{notice.text}</p>}
          </div>
        )}
        {!generated && !loading && status.kind !== "error" && (
          <div className="card flex min-h-40 items-center justify-center p-8 text-center text-sm text-muted">
            Fill in the form and press Generate. Results are saved to your library automatically.
          </div>
        )}
      </div>
    </div>
  );
}

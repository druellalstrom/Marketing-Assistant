"use client";

import { useId, useState, type ReactNode } from "react";
import { CURRENCIES, currencyInfo, UNITS } from "@/lib/pricing/money";

/** Large, high-contrast building blocks for the Smart Pricing Calculator. */

const BIG_INPUT = "input h-14 text-xl tabular-nums";

/** Parses what the user typed: "" → null, "1,250.50" → 1250.5, nonsense → NaN. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s$£€]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * A number box that keeps what the user is typing (so "1." or "" don't jump
 * around) and reports a number, null for empty, or NaN for nonsense.
 */
export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  ariaLabel,
  prefix,
  suffix,
  className = "",
  describedBy,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState(value === null || Number.isNaN(value) ? "" : String(value));
  // Follow outside changes (example, reset, "double my cost") without fighting the user's typing.
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    const current = parseNumber(text);
    if (!Object.is(current, value) && !(value === null && current !== null && Number.isNaN(current))) {
      setText(value === null || Number.isNaN(value) ? "" : String(value));
    }
  }
  const parsed = parseNumber(text);
  const nonsense = parsed !== null && Number.isNaN(parsed);
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-slate-600">{prefix}</span>}
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || nonsense || undefined}
        aria-describedby={describedBy}
        className={`${BIG_INPUT} ${prefix ? (prefix.length > 3 ? "pl-20" : "pl-16") : ""} ${suffix ? "pr-12" : ""} ${invalid || nonsense ? "border-red-500 ring-2 ring-red-100" : ""}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-600">{suffix}</span>}
      {nonsense && <p className="mt-1 text-base font-medium text-red-700">Please type a number, like 25 or 12.50.</p>}
    </div>
  );
}

/** Money box showing the currency, e.g. "BBD $ | 200". */
export function MoneyInput(props: Omit<Parameters<typeof NumberInput>[0], "prefix"> & { currency: string }) {
  const { currency, ...rest } = props;
  const sym = currencyInfo(currency).symbol;
  return <NumberInput placeholder="0.00" {...rest} prefix={`${currency} ${sym}`.trim()} />;
}

/** A labelled question with a plain-English hint under the label. */
export function Field({ label, help, htmlFor, children, error }: { label: string; help?: ReactNode; htmlFor?: string; children: ReactNode; error?: string | null }) {
  const helpId = useId();
  return (
    <div>
      <label className="mb-1 block text-lg font-semibold text-navy" htmlFor={htmlFor}>{label}</label>
      {help && <p id={helpId} className="mb-2 text-base text-slate-600">{help}</p>}
      {children}
      {error && <p className="mt-1.5 text-base font-medium text-red-700" role="alert">{error}</p>}
    </div>
  );
}

/** A numbered step card with an emoji. */
export function StepCard({ n, emoji, title, subtitle, children, id }: { n?: number; emoji: string; title: string; subtitle?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card space-y-5 p-5 sm:p-7" aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <div>
        <h2 id={id ? `${id}-title` : undefined} className="flex items-center gap-3 text-xl font-bold text-navy sm:text-2xl">
          {n !== undefined && <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-lg text-white">{n}</span>}
          <span aria-hidden className="text-2xl">{emoji}</span>
          <span>{title}</span>
        </h2>
        {subtitle && <p className="mt-2 text-base text-slate-600 sm:text-lg">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/** Big radio-style choice buttons. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = "sm:grid-cols-3",
}: {
  label: string;
  options: { value: T; title: string; detail?: string; emoji?: string }[];
  value: T;
  onChange: (v: T) => void;
  columns?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid grid-cols-1 gap-3 ${columns}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-16 rounded-2xl border-2 p-4 text-left transition ${active ? "border-brand bg-pink-50 shadow-sm" : "border-slate-300 bg-white hover:border-slate-500"}`}
          >
            <span className="flex items-center gap-2 text-lg font-bold text-navy">
              {o.emoji && <span aria-hidden>{o.emoji}</span>}
              {o.title}
              {active && <span className="ml-auto text-base text-brand-strong" aria-hidden>✓</span>}
            </span>
            {o.detail && <span className="mt-1 block text-base text-slate-600">{o.detail}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CurrencySelect({ id, value, onChange, ariaLabel }: { id?: string; value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <select id={id} aria-label={ariaLabel} className="input h-14 text-lg" value={value} onChange={(e) => onChange(e.target.value)}>
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
    </select>
  );
}

export function UnitSelect({ id, value, onChange, units = UNITS, ariaLabel }: { id?: string; value: string; onChange: (v: string) => void; units?: typeof UNITS; ariaLabel?: string }) {
  const groups: [string, string][] = [["count", "Count them"], ["mass", "Weigh them"], ["volume", "Liquids"], ["length", "Length (fabric, ribbon…)"]];
  return (
    <select id={id} aria-label={ariaLabel} className="input h-14 text-lg" value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map(([dim, title]) => {
        const list = units.filter((u) => u.dimension === dim);
        return list.length ? (
          <optgroup key={dim} label={title}>
            {list.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

/** A big result number with a label, for the answer card. */
export function BigNumber({ label, value, note, tone = "navy", size = "lg" }: { label: string; value: string; note?: ReactNode; tone?: "navy" | "pink" | "green" | "red"; size?: "lg" | "xl" }) {
  const color = { navy: "text-navy", pink: "text-brand-strong", green: "text-green-800", red: "text-red-700" }[tone];
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`font-extrabold tabular-nums [overflow-wrap:anywhere] ${color} ${size === "xl" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>{value}</p>
      {note && <p className="mt-0.5 text-base text-slate-700">{note}</p>}
    </div>
  );
}

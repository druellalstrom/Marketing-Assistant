/** MarketMate AI wordmark with an "M" mark built from two overlapping strokes. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {/* Solid strokes (no gradient defs) so every copy renders even when another copy is hidden. */}
      <rect width="48" height="48" rx="12" fill="#ffffff" fillOpacity="0.08" />
      <path d="M9 37V13.5c0-1.4 1.7-2 2.6-1L24 26" fill="none" stroke="#EC4899" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 26l12.4-13.5c.9-1 2.6-.4 2.6 1V37" fill="none" stroke="#A78BFA" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="37" r="3.4" fill="#F59E0B" />
    </svg>
  );
}

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className="h-11 w-11 shrink-0" />
      <span className="leading-tight">
        <span className={`block text-xl font-bold tracking-tight ${tone === "light" ? "text-white" : "text-navy"}`}>
          MarketMate <span className="text-pink">AI</span>
        </span>
        <span className={`block text-[0.8125rem] ${tone === "light" ? "text-slate-300" : "text-muted"}`}>Your AI Marketing Department</span>
      </span>
    </span>
  );
}

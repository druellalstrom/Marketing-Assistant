"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Accessible click-to-open menu: closes on outside click, Escape, or navigation. */
export function Dropdown({
  button,
  label,
  children,
  align = "right",
  panelClassName = "w-80",
}: {
  button: React.ReactNode;
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center rounded-xl px-1.5 hover:bg-slate-100"
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-2 shadow-[0_12px_40px_-12px_rgba(23,37,84,0.35)] ${align === "right" ? "right-0" : "left-0"} ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

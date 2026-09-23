"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { LogoMark } from "./logo";

/** Hamburger + slide-in navy drawer for screens narrower than the desktop sidebar. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex items-center gap-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-navy"
      >
        <Menu aria-hidden className="h-6 w-6" />
      </button>
      <span className="flex items-center gap-2 font-bold text-navy sm:hidden">
        <span className="rounded-lg bg-navy p-0.5"><LogoMark className="h-8 w-8" /></span>
      </span>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Main menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] bg-navy shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
            >
              <X aria-hidden className="h-6 w-6" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

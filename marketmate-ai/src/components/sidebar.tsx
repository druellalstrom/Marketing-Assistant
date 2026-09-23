"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Sparkles } from "lucide-react";
import { Logo } from "@/components/shell/logo";
import { activeNavHref, NAV_ITEMS } from "@/components/shell/nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const active = activeNavHref(usePathname());
  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-6 3xl:px-4" aria-label="Main">
      <Link href="/dashboard" className="px-2" onClick={onNavigate}>
        <Logo />
      </Link>
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = active === href;
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3.5 rounded-xl px-4 text-base font-medium transition ${
                  isActive
                    ? "bg-pink text-white shadow-[0_6px_20px_-6px_rgba(236,72,153,0.7)]"
                    : "text-slate-200 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon aria-hidden className="h-5 w-5 shrink-0" strokeWidth={2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="relative mt-auto overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
        <svg aria-hidden viewBox="0 0 200 60" className="pointer-events-none absolute -right-6 -top-2 h-16 w-40 opacity-40">
          <path d="M0 50 C 50 10, 90 60, 140 20 S 190 10, 200 5" fill="none" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="relative text-[0.9375rem] font-medium italic leading-snug text-slate-100">
          Big dreams need a plan and the right tools.
          <Heart aria-hidden className="ml-1 inline h-4 w-4 fill-pink text-pink" />
        </p>
        <Link
          href="/assistant"
          onClick={onNavigate}
          className="relative mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-brand px-3 text-[0.9375rem] font-semibold text-white hover:bg-brand-strong"
        >
          <Sparkles aria-hidden className="h-4 w-4 text-gold" />
          MarketMate AI is here to help!
        </Link>
      </div>
    </nav>
  );
}

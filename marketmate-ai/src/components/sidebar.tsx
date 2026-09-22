"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brush,
  Building2,
  Calculator,
  CalendarDays,
  FolderOpen,
  Hash,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Megaphone,
  MessageSquareText,
  Palette,
  PenLine,
  Repeat2,
  Sparkles,
  Swords,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

const NAV: { heading?: string; items: [href: string, label: string, Icon: LucideIcon][] }[] = [
  {
    items: [
      ["/dashboard", "Dashboard", LayoutDashboard],
      ["/assistant", "AI Assistant", Sparkles],
      ["/library", "Saved work", FolderOpen],
    ],
  },
  { heading: "Business", items: [["/calculator", "Pricing calculator", Calculator]] },
  {
    heading: "Social Media Center",
    items: [
      ["/social/captions", "Captions", MessageSquareText],
      ["/social/hashtags", "Hashtags", Hash],
      ["/social/ideas", "Content ideas", Lightbulb],
      ["/social/repurpose", "Repurpose", Repeat2],
      ["/social/calendar", "Content calendar", CalendarDays],
    ],
  },
  {
    heading: "Marketing Strategy",
    items: [
      ["/strategy/audience", "Audience analysis", Users],
      ["/strategy/personas", "Customer personas", UserRound],
      ["/strategy/plan", "Marketing plan", Target],
      ["/strategy/campaigns", "Campaign ideas", Megaphone],
      ["/strategy/competitors", "Competitor analysis", Swords],
    ],
  },
  {
    heading: "Create",
    items: [
      ["/studio", "Content studio", PenLine],
      ["/design-studio", "Design Studio", Brush],
    ],
  },
  {
    heading: "Your brand",
    items: [
      ["/business", "Business profile", Building2],
      ["/brand-kit", "Brand kit", Palette],
    ],
  },
];

export function Sidebar({ email, signOut }: { email: string | null; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm" aria-label="Main">
      <Link href="/dashboard" className="px-2">
        <span className="block text-lg font-bold text-brand">MarketMate AI</span>
        <span className="block text-xs text-muted">Your AI Marketing Department</span>
      </Link>
      {NAV.map((group, i) => (
        <div key={i}>
          {group.heading && (
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.heading}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(([href, label, Icon]) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${active ? "bg-brand/10 font-medium text-brand" : "hover:bg-background"}`}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-border pt-3">
        {email ? (
          <form action={signOut}>
            <p className="truncate px-2 text-xs text-muted" title={email}>{email}</p>
            <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background">
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="block rounded-md px-2 py-1.5 hover:bg-background">Sign in</Link>
        )}
      </div>
    </nav>
  );
}

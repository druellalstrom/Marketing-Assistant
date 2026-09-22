"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { heading?: string; items: [href: string, label: string][] }[] = [
  { items: [["/dashboard", "Dashboard"], ["/calculator", "Pricing calculator"]] },
  {
    heading: "Social Media Center",
    items: [
      ["/social/captions", "Captions"],
      ["/social/hashtags", "Hashtags"],
      ["/social/ideas", "Content ideas"],
      ["/social/repurpose", "Repurpose"],
      ["/social/calendar", "Content calendar"],
    ],
  },
  {
    heading: "Marketing Strategy",
    items: [
      ["/strategy/audience", "Audience analysis"],
      ["/strategy/personas", "Customer personas"],
      ["/strategy/plan", "Marketing plan"],
      ["/strategy/campaigns", "Campaign ideas"],
    ],
  },
  { heading: "Create", items: [["/studio", "Content studio"], ["/design-studio", "Design Studio"]] },
  { heading: "Your brand", items: [["/business", "Business profile"], ["/brand-kit", "Brand kit"]] },
];

export function Sidebar({ email, signOut }: { email: string | null; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-4 text-sm">
      <Link href="/dashboard" className="text-lg font-bold text-brand">MarketMate AI</Link>
      {NAV.map((group, i) => (
        <div key={i}>
          {group.heading && (
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.heading}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(([href, label]) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-2 py-1.5 ${
                      active ? "bg-brand/10 font-medium text-brand" : "hover:bg-background"
                    }`}
                  >
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
            <button className="mt-1 w-full rounded-md px-2 py-1.5 text-left hover:bg-background">Sign out</button>
          </form>
        ) : (
          <Link href="/login" className="block rounded-md px-2 py-1.5 hover:bg-background">Sign in</Link>
        )}
      </div>
    </nav>
  );
}

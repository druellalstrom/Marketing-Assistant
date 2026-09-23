import Link from "next/link";
import { Bell, Building2, CalendarClock, ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";
import type { Notification } from "@/lib/dashboard/notifications";
import { initialsOf } from "@/lib/dashboard/account";
import { Dropdown } from "./dropdown";
import { MobileNav } from "./mobile-nav";

interface Props {
  account: { displayName: string; email: string | null; businessName: string | null } | null;
  notifications: Notification[];
  signOut: () => Promise<void>;
}

function SearchForm({ className = "" }: { className?: string }) {
  return (
    <form action="/search" method="get" role="search" className={`relative ${className}`}>
      <label htmlFor="global-search" className="sr-only">Search MarketMate</label>
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
      <input
        id="global-search"
        name="q"
        type="search"
        maxLength={100}
        placeholder="Search anything… (e.g. posters, pricing, campaigns)"
        className="h-12 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base text-foreground shadow-sm outline-none placeholder:text-slate-500 focus:border-brand focus:ring-4 focus:ring-pink-100"
      />
    </form>
  );
}

export function Header({ account, notifications, signOut }: Props) {
  const count = notifications.length;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <MobileNav />
        <SearchForm className="hidden flex-1 md:block md:max-w-xl" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {account ? (
            <>
              <Dropdown
                label={count ? `Notifications, ${count} new` : "Notifications"}
                button={
                  <span className="relative inline-flex h-11 w-11 items-center justify-center text-navy">
                    <Bell aria-hidden className="h-6 w-6" />
                    {count > 0 && (
                      <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white ring-2 ring-background">
                        {count}
                      </span>
                    )}
                  </span>
                }
              >
                <p className="px-3 pb-2 pt-1 text-base font-semibold">Notifications</p>
                {count === 0 ? (
                  <p className="px-3 pb-3 text-[0.9375rem] text-muted">You&apos;re all caught up. Posts due in the next 7 days will show here.</p>
                ) : (
                  <ul className="max-h-96 space-y-1 overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link href={n.href} className="flex gap-3 rounded-xl p-3 text-[0.9375rem] leading-snug hover:bg-pink-50">
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.kind === "overdue" ? "bg-red-100 text-red-700" : n.kind === "setup" ? "bg-violet-100 text-purple" : "bg-pink-100 text-brand-strong"}`}>
                            {n.kind === "setup" ? <Building2 aria-hidden className="h-4 w-4" /> : <CalendarClock aria-hidden className="h-4 w-4" />}
                          </span>
                          <span>{n.text}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Dropdown>

              <Dropdown
                label="Account menu"
                panelClassName="w-64"
                button={
                  <span className="flex items-center gap-3 pl-1 text-left">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink to-purple text-sm font-bold text-white">
                      {initialsOf(account.displayName)}
                    </span>
                    <span className="hidden leading-tight sm:block">
                      <span className="block text-[0.9375rem] text-foreground">Hello, <strong>{account.displayName.split(" ")[0]}</strong></span>
                      <span className="block text-sm text-muted">{account.businessName ?? "Business Owner"}</span>
                    </span>
                    <ChevronDown aria-hidden className="hidden h-4 w-4 text-muted sm:block" />
                  </span>
                }
              >
                <div className="border-b border-border px-3 pb-2 pt-1">
                  <p className="font-semibold">{account.displayName}</p>
                  {account.email && <p className="truncate text-sm text-muted">{account.email}</p>}
                </div>
                <ul className="py-1 text-[0.9375rem]">
                  <li><Link href="/business" className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-pink-50"><Building2 aria-hidden className="h-5 w-5 text-muted" /> Business profile</Link></li>
                  <li><Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-xl px-3 hover:bg-pink-50"><Settings aria-hidden className="h-5 w-5 text-muted" /> Settings</Link></li>
                </ul>
                <form action={signOut} className="border-t border-border pt-1">
                  <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.9375rem] hover:bg-pink-50">
                    <LogOut aria-hidden className="h-5 w-5 text-muted" /> Sign out
                  </button>
                </form>
              </Dropdown>
            </>
          ) : (
            <Link href="/login" className="btn-secondary"><UserRound aria-hidden className="h-4 w-4" /> Sign in</Link>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchForm />
      </div>
    </header>
  );
}

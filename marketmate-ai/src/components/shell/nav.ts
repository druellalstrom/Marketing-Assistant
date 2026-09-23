import {
  Brush,
  Building2,
  CalendarDays,
  Calculator,
  FolderOpen,
  LayoutDashboard,
  MessageCircleHeart,
  Palette,
  PenLine,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Path prefixes that make this item active; the longest match wins. */
  match: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, match: ["/dashboard"] },
  { href: "/assistant", label: "AI Assistant", Icon: Sparkles, match: ["/assistant"] },
  { href: "/design-studio", label: "Design Studio", Icon: Brush, match: ["/design-studio", "/library/designs"] },
  { href: "/social", label: "Social Media", Icon: MessageCircleHeart, match: ["/social"] },
  { href: "/calculator", label: "Pricing & Business", Icon: Calculator, match: ["/calculator"] },
  { href: "/strategy", label: "Marketing Strategy", Icon: TrendingUp, match: ["/strategy"] },
  { href: "/studio", label: "Content Studio", Icon: PenLine, match: ["/studio"] },
  { href: "/social/calendar", label: "Content Calendar", Icon: CalendarDays, match: ["/social/calendar"] },
  { href: "/library", label: "My Projects", Icon: FolderOpen, match: ["/library"] },
  { href: "/brand-kit", label: "Brand Kit", Icon: Palette, match: ["/brand-kit"] },
  { href: "/business", label: "Business Profile", Icon: Building2, match: ["/business"] },
  { href: "/settings", label: "Settings", Icon: Settings, match: ["/settings"] },
];

/** The nav item for a path: the one with the longest matching prefix. */
export function activeNavHref(pathname: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const item of NAV_ITEMS) {
    for (const m of item.match) {
      if ((pathname === m || pathname.startsWith(`${m}/`)) && (!best || m.length > best.len)) {
        best = { href: item.href, len: m.length };
      }
    }
  }
  return best?.href ?? null;
}

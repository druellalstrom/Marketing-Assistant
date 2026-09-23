import { AtSign, BarChart3, Hash, Heart, Megaphone, MousePointer2, ShoppingBag, Tag, Target } from "lucide-react";

/**
 * Subtle marketing iconography behind page content (low opacity, decorative
 * only, hidden from assistive tech, and hidden on small screens).
 */
const ICONS = [
  { Icon: Megaphone, className: "right-[4%] top-[18%] h-16 w-16 -rotate-12" },
  { Icon: Hash, className: "right-[32%] top-[6%] h-10 w-10 rotate-6" },
  { Icon: Target, className: "right-[10%] bottom-[18%] h-14 w-14" },
  { Icon: BarChart3, className: "left-[46%] bottom-[6%] h-12 w-12" },
  { Icon: Heart, className: "left-[30%] top-[40%] h-8 w-8 rotate-12" },
  { Icon: ShoppingBag, className: "right-[40%] bottom-[30%] h-10 w-10 -rotate-6" },
  { Icon: Tag, className: "left-[62%] top-[55%] h-9 w-9 rotate-45" },
  { Icon: AtSign, className: "left-[70%] top-[28%] h-8 w-8" },
  { Icon: MousePointer2, className: "right-[22%] top-[70%] h-8 w-8 -rotate-12" },
];

export function MarketingDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
      {ICONS.map(({ Icon, className }, i) => (
        <Icon key={i} className={`absolute text-navy opacity-[0.045] ${className}`} strokeWidth={1.75} />
      ))}
    </div>
  );
}

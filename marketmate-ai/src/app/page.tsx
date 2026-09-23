import Link from "next/link";
import { Brush, Calculator, CalendarDays, FolderOpen, MessageSquareText, PenLine, Sparkles, Target, type LucideIcon } from "lucide-react";

const FEATURES: [Icon: LucideIcon, title: string, body: string][] = [
  [Calculator, "Pricing & business calculator", "True cost per unit, retail and wholesale prices, profit, margin, markup and break-even — accurate math, clearly explained."],
  [Sparkles, "AI Marketing Assistant", "Ask about pricing, promotions, personas or posts. It knows your business and uses the calculator for real numbers."],
  [MessageSquareText, "Social Media Center", "Captions, hashtags, content ideas and repurposing for Instagram, Facebook, TikTok and LinkedIn."],
  [CalendarDays, "Content calendar", "Plan dates, platforms, captions and calls to action, and track each post from idea to posted."],
  [Target, "Marketing strategy", "Audience analysis, customer personas, marketing plans, campaign ideas and competitor positioning."],
  [PenLine, "Content Creation Studio", "Product descriptions, ads, emails, scripts, website copy and launch announcements in your tone."],
  [Brush, "Design Studio", "Posters, flyers, social graphics and business cards from one brief, with AI-written copy. Image generation coming soon."],
  [FolderOpen, "Saved work", "Everything is saved to your account — open, edit, duplicate, rename or delete any time."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold text-brand">MarketMate AI</span>
        <nav className="flex gap-2">
          <Link href="/login" className="btn-secondary">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="mt-16 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Your AI Marketing Department</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">Create. Market. Sell. Grow.</h1>
        <p className="mt-5 text-lg text-muted">
          MarketMate takes a small business from product to pricing, branding, strategy, content and campaigns — in one place, tailored to your brand.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary px-5 py-2.5">Create your free account</Link>
          <Link href="/calculator" className="btn-secondary px-5 py-2.5">Try the pricing calculator</Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
        {FEATURES.map(([Icon, title, body]) => (
          <div key={title} className="card">
            <span className="inline-flex rounded-lg bg-brand/10 p-2 text-brand"><Icon aria-hidden className="h-5 w-5" /></span>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 card">
        <h2 className="text-lg font-semibold">From product to campaign</h2>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-7">
          {["Product", "Pricing", "Branding", "Strategy", "Content", "Advertisement", "Campaign"].map((step, i) => (
            <li key={step} className="rounded-lg bg-background p-3">
              <span className="text-sm text-muted">Step {i + 1}</span>
              <p className="font-medium">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

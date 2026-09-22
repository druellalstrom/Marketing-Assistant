import Link from "next/link";

const features = [
  ["Pricing calculator", "Cost per unit, retail & wholesale pricing, margins and break-even."],
  ["Social Media Center", "Captions, hashtags, content ideas, repurposing and a content calendar."],
  ["Marketing strategy", "Audience analysis, customer personas, marketing plans and campaigns."],
  ["Content studio", "Product descriptions, emails, blog posts, ad copy and video scripts."],
  ["Brand kit", "Your colours, fonts and voice — used by every AI tool."],
  ["Design Studio", "Brief-to-graphic workflow (image generation coming soon)."],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">MarketMate AI</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
        Price it right. Market it well.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        An all-in-one marketing assistant for small businesses: accurate pricing math, AI-written
        social content and strategy, all tailored to your brand.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="btn-primary">Create free account</Link>
        <Link href="/login" className="btn-secondary">Sign in</Link>
        <Link href="/calculator" className="btn-secondary">Try the pricing calculator</Link>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, body]) => (
          <div key={title} className="card">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

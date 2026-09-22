# MarketMate AI

An all-in-one marketing assistant for small businesses: accurate pricing math,
AI-written social content and marketing strategy, all tailored to your brand.

The app lives in [`marketmate-ai/`](marketmate-ai/) — see its
[README](marketmate-ai/README.md) for setup, environment variables and scripts.

## Features

- **Pricing & business calculator** — cost per unit, suggested retail and wholesale
  prices (including sales fees), profit per unit, margin, markup and break-even.
- **Social Media Center** — caption generator, hashtag generator, content ideas,
  content repurposing and a content calendar.
- **Marketing strategy** — target audience analysis, customer personas, a 90-day
  marketing plan and campaign ideas.
- **Content Creation Studio** — product descriptions, emails, blog posts, ad copy
  and short video scripts.
- **Business profile & brand kit** — colours, fonts, logo and brand voice, used by
  every AI tool.
- **Dashboard** — setup checklist, connection status and recent activity.
- **Design Studio** — brief-to-graphic workflow. Image generation is **not connected
  yet**; briefs and uploads are saved, but no image is produced until a provider is added.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth,
Storage, Row Level Security) · Anthropic API (server-side only).

## Quick start

```bash
cd marketmate-ai
npm install
cp .env.example .env.local   # add your Supabase and Anthropic keys
npm run dev
```

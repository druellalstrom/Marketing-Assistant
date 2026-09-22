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
- **Marketing strategy** — target audience analysis, customer personas, marketing plans,
  campaign ideas and competitor analysis (based only on information you provide).
- **Content Creation Studio** — product descriptions, ads, email campaigns, TikTok scripts,
  social posts, website copy, CTAs and launch announcements, with tone, length and objective.
- **Business profile & brand kit** — colours, fonts, logo and brand voice, used by
  every AI tool.
- **AI Marketing Assistant** — chat that knows your business, uses the calculator for real
  pricing numbers, and saves business details you mention to your profile.
- **Saved work** — every design, post, calculation, plan and campaign: open, edit, duplicate,
  rename, delete.
- **Dashboard** — quick actions, business profile, recent projects and upcoming posts.
- **Design Studio** — posters, flyers, social graphics, ads, business cards and banners from
  one brief, with AI-written copy. Image generation is **not connected yet**; briefs, copy and
  uploads are saved, but no image is produced until a provider is added.

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

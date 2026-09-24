# MarketMate AI

**Your AI Marketing Department** — Create. Market. Sell. Grow.

Pricing, strategy, content and campaigns for small businesses.
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Google Gemini API (Anthropic optional).

## Setup

1. **Install:** `npm install`
2. **Create a Supabase project** at supabase.com.
3. **Apply the database schema:** either link the CLI and push
   (`npx supabase link --project-ref <ref>` then `npx supabase db push`), or run both files in
   `supabase/migrations/` (in name order) in the Supabase SQL editor.
4. **Auth URLs:** in Supabase → Authentication → URL Configuration, set the Site URL to
   your app URL and add `<your-url>/auth/confirm` to the redirect URLs.
5. **Environment:** `cp .env.example .env.local` and fill in:
   | Variable | Where it's used | Secret? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | browser + server | No (public by design, protected by RLS) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | browser + server | No (public by design) |
   | `NEXT_PUBLIC_SITE_URL` | auth email links | No |
   | `GEMINI_API_KEY` | server-only API routes (get one at https://aistudio.google.com/apikey) | **Yes** — never prefix with `NEXT_PUBLIC_` |
   | `GEMINI_MODEL` (optional) | defaults to `gemini-flash-latest` | No |
   | `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` (optional) | used only if `GEMINI_API_KEY` is empty or `AI_PROVIDER=anthropic` | **Yes** (key) |
   | `AI_PROVIDER` (optional) | `gemini` or `anthropic` to force one; default picks Gemini when its key is set | No |
   | `IMAGE_PROVIDER` | Design Studio; only `none` exists today | No |

   Gemini's free tier is rate-limited (the app shows a "wait a minute and try again" message), and
   Google may use free-tier prompts and responses to improve its products — use a paid tier for
   sensitive business data.

   No Supabase service-role key is used anywhere; every query runs as the signed-in user under RLS.
6. **Run:** `npm run dev` → http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (pricing math, AI validation/prompts, Gemini and Anthropic clients against mock APIs, calendar, Design Studio) |
| `npm run test:db` | Applies the migration to a throwaway **local** Postgres (with a Supabase stub) and checks cross-user isolation. Needs `psql` with superuser access. |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |

## Modules

| Module | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | Quick actions, business profile, recent projects, content, designs, pricing, plans, calendar |
| AI Marketing Assistant | `/assistant` | Knows the business profile; uses the calculator for pricing and can save business details to the profile |
| Saved work | `/library` | Designs, Social Media, Pricing, Marketing Plans, Campaigns, Content — open, edit, duplicate, rename, delete |
| Pricing calculator | `/calculator` | Production-run costs (total or per unit) → cost per unit, retail/wholesale price, profit, margin, markup, break-even |
| Social Media Center | `/social/*` | Captions, hashtags, content ideas, repurposing, content calendar |
| Marketing Strategy | `/strategy/*` | Audience analysis, personas, marketing plan, campaigns, competitor analysis (user-provided info only) |
| Content Creation Studio | `/studio` | 11 content types × tone × length × objective |
| Design Studio | `/design-studio` | Full brief + uploads + AI copy. **Image generation not connected** |
| Business profile / Brand kit | `/business`, `/brand-kit` | Used automatically by every AI feature |

## How it's put together

- `src/lib/pricing/` — pure calculator functions (production cost, target-margin pricing with fees,
  margin/markup, break-even). The UI, the save action and the AI assistant all call these; the
  server recomputes results rather than trusting the browser.
- `supabase/migrations/` — 11 tables (`users`, `businesses`, `brand_kits`, `projects`, `designs`,
  `social_content`, `pricing_calculations`, `marketing_plans`, `campaigns`,
  `content_calendar_entries`, `assistant_messages`). Isolation is enforced twice: RLS policies
  (`user_id = auth.uid()`) and composite foreign keys `(parent_id, user_id)` so a row can only
  reference a parent owned by the same user. A private `design-uploads` storage bucket only allows
  access to `<user_id>/…` paths.
- `src/lib/ai/` — tool definitions (form fields, shared with the UI), server-only prompts, the
  AI clients (`gemini.ts` / `anthropic.ts`), `provider.ts` which picks one from the environment,
  and the assistant's tool loop (function calling on either provider).
  Browsers call `POST /api/ai/generate` and `/api/assistant`; the routes check the session, validate
  input, add the business profile + brand kit to the prompt, call the AI provider, and save results under RLS.
- `src/lib/design/` — Design Studio brief schema, image-prompt builder, and the provider
  interface. **Only `NotConnectedProvider` exists**: it never returns an image and the UI says so.
  To connect Pollinations.ai or a paid API, implement `ImageProvider` and register it in
  `getImageProvider()`.
- `src/proxy.ts` — Next 16's replacement for middleware: refreshes the Supabase session and
  redirects signed-out users away from protected pages.

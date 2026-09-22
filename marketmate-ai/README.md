# MarketMate AI

Pricing, marketing strategy and social content for small businesses.
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Anthropic API.

## Setup

1. **Install:** `npm install`
2. **Create a Supabase project** at supabase.com.
3. **Apply the database schema:** either link the CLI and push
   (`npx supabase link --project-ref <ref>` then `npx supabase db push`), or paste
   `supabase/migrations/20260922000000_init.sql` into the Supabase SQL editor and run it.
4. **Auth URLs:** in Supabase → Authentication → URL Configuration, set the Site URL to
   your app URL and add `<your-url>/auth/confirm` to the redirect URLs.
5. **Environment:** `cp .env.example .env.local` and fill in:
   | Variable | Where it's used | Secret? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | browser + server | No (public by design, protected by RLS) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | browser + server | No (public by design) |
   | `NEXT_PUBLIC_SITE_URL` | auth email links | No |
   | `ANTHROPIC_API_KEY` | server-only API route | **Yes** — never prefix with `NEXT_PUBLIC_` |
   | `ANTHROPIC_MODEL` (optional) | defaults to `claude-opus-5` | No |
   | `IMAGE_PROVIDER` | Design Studio; only `none` exists today | No |

   No Supabase service-role key is used anywhere; every query runs as the signed-in user under RLS.
6. **Run:** `npm run dev` → http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests (pricing math, AI validation/prompts, Anthropic client against a mock API, calendar, Design Studio) |
| `npm run test:db` | Applies the migration to a throwaway **local** Postgres (with a Supabase stub) and checks cross-user isolation. Needs `psql` with superuser access. |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |

## How it's put together

- `src/lib/pricing/` — pure calculator functions (cost per unit, target-margin pricing with fees,
  margin/markup, break-even). The UI and the save action both call these; the server recomputes
  results rather than trusting the browser.
- `supabase/migrations/` — 9 tables (`users`, `businesses`, `brand_kits`, `projects`, `designs`,
  `social_content`, `pricing_calculations`, `marketing_plans`, `content_calendar_entries`).
  Isolation is enforced twice: RLS policies (`user_id = auth.uid()`) and composite foreign keys
  `(parent_id, user_id)` so a row can only reference a parent owned by the same user.
  A private `design-uploads` storage bucket only allows access to `<user_id>/…` paths.
- `src/lib/ai/` — tool definitions (form fields, shared with the UI), server-only prompts and
  Anthropic client. Browsers call `POST /api/ai/generate`; the route checks the session,
  validates input against the tool definition, adds the business profile + brand kit to the
  prompt, calls Anthropic, and saves the result under RLS.
- `src/lib/design/` — Design Studio brief schema, image-prompt builder, and the provider
  interface. **Only `NotConnectedProvider` exists**: it never returns an image and the UI says so.
  To connect Pollinations.ai or a paid API, implement `ImageProvider` and register it in
  `getImageProvider()`.
- `src/proxy.ts` — Next 16's replacement for middleware: refreshes the Supabase session and
  redirects signed-out users away from protected pages.

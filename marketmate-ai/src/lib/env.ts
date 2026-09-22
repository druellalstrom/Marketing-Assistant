/**
 * Environment access. Nothing here is hardcoded — values come from .env.local
 * (local dev) or your hosting provider's environment settings.
 *
 * NEXT_PUBLIC_* values are intentionally exposed to the browser: the Supabase
 * URL and publishable (anon) key are designed to be public and are safe only
 * because every table is protected by Row Level Security.
 *
 * Secrets (ANTHROPIC_API_KEY) are read only in server-only modules.
 */

export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase's newer "publishable" key, falling back to the legacy anon key name.
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

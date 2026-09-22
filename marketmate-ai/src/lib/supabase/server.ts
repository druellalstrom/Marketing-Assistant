import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the signed-in user's session cookie, so every query runs under RLS as
 * that user. Returns null when Supabase isn't configured.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  // Always render per request: auth state must never be baked into a static page,
  // even when the build runs without Supabase env vars.
  await connection();
  const env = getSupabasePublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Returns the verified signed-in user (getUser() validates the JWT with
 * Supabase Auth), or null if signed out / Supabase not configured.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

/** For pages that need a user: redirects to /login when signed out. */
export async function requireAuth(nextPath = "/dashboard"): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return ctx;
}

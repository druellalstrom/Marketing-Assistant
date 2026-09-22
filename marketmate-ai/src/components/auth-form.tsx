"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/(auth)/actions";

interface Props {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  supabaseConfigured: boolean;
}

export function AuthForm({ mode, action, next, supabaseConfigured }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="card space-y-4">
      {!supabaseConfigured && (
        <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
          Supabase isn&apos;t configured yet, so accounts are disabled. Add your Supabase URL and
          publishable key to <code>.env.local</code> (see <code>.env.example</code>).
        </p>
      )}
      {next && <input type="hidden" name="next" value={next} />}
      {isSignup && (
        <div>
          <label className="label" htmlFor="full_name">Your name</label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700" role="status">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending || !supabaseConfigured}>
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>Already have an account? <Link className="text-brand underline" href="/login">Sign in</Link></>
        ) : (
          <>New here? <Link className="text-brand underline" href="/signup">Create an account</Link></>
        )}
      </p>
    </form>
  );
}

import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/env";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      {typeof error === "string" && (
        <p className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p>
      )}
      <AuthForm
        mode="login"
        action={signIn}
        next={typeof next === "string" ? next : undefined}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </>
  );
}

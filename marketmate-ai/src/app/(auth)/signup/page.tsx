import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/env";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Create your account</h1>
      <AuthForm mode="signup" action={signUp} supabaseConfigured={isSupabaseConfigured()} />
    </>
  );
}

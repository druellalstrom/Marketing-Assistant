import type { Metadata } from "next";
import { CheckCircle2, Database, ImageIcon, LogOut, PenLine } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { aiProviderLabel, isAiConfigured } from "@/lib/ai/provider";
import { getImageProvider } from "@/lib/design/provider";
import { requireAuth } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";
import { NameForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireAuth("/settings");
  const { data: profile } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();
  const aiReady = isAiConfigured();
  const aiLabel = aiProviderLabel();
  const imagesReady = getImageProvider().connected;

  const status = (ok: boolean) =>
    ok ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">Connected <CheckCircle2 aria-hidden className="h-4 w-4" /></span>
    ) : (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">Not connected</span>
    );

  return (
    <>
      <PageHeader title="Settings" description="Your account, password and connected services." />
      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card space-y-4" aria-labelledby="account-title">
          <h2 id="account-title" className="text-xl font-bold text-navy">Account</h2>
          <p className="text-[0.9375rem]"><span className="text-muted">Signed in as</span> <strong>{user.email}</strong></p>
          <NameForm defaultName={profile?.full_name ?? ""} />
        </section>

        <section className="card space-y-4" aria-labelledby="password-title">
          <h2 id="password-title" className="text-xl font-bold text-navy">Password</h2>
          <PasswordForm />
        </section>

        <section id="connections" className="card scroll-mt-24 space-y-4 lg:col-span-2" aria-labelledby="conn-title">
          <h2 id="conn-title" className="text-xl font-bold text-navy">Connections</h2>
          <p className="text-[0.9375rem] text-muted">
            These services are connected by whoever runs your MarketMate server, using private settings (environment
            variables) that are never shown in the browser.
          </p>
          <ul className="space-y-3">
            <li className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Database aria-hidden className="h-6 w-6 text-green-700" />
                <span className="flex-1 text-base font-semibold">Database &amp; accounts (Supabase)</span>
                {status(true)}
              </div>
            </li>
            <li className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <PenLine aria-hidden className="h-6 w-6 text-brand" />
                <span className="flex-1 text-base font-semibold">AI writing{aiReady ? ` (${aiLabel})` : ""}</span>
                {status(aiReady)}
              </div>
              {!aiReady && (
                <ol className="mt-3 list-decimal space-y-1 pl-6 text-[0.9375rem] text-slate-700">
                  <li>Create a free Gemini API key at <a className="font-semibold text-brand-strong underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.</li>
                  <li>Add <code className="rounded bg-slate-100 px-1.5">GEMINI_API_KEY=your-key</code> to <code className="rounded bg-slate-100 px-1.5">.env.local</code> (or your hosting provider&apos;s environment settings).</li>
                  <li>Restart the app. This page will then show &quot;Connected&quot;.</li>
                </ol>
              )}
            </li>
            <li className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <ImageIcon aria-hidden className="h-6 w-6 text-purple" />
                <span className="flex-1 text-base font-semibold">Image generation (Design Studio)</span>
                {status(imagesReady)}
              </div>
              {!imagesReady && (
                <p className="mt-3 text-[0.9375rem] text-slate-700">
                  No image provider is built in yet. A developer adds one (for example Pollinations.ai or a paid image API)
                  in <code className="rounded bg-slate-100 px-1.5">src/lib/design/provider.ts</code> and sets{" "}
                  <code className="rounded bg-slate-100 px-1.5">IMAGE_PROVIDER</code>. Until then, Design Studio saves your
                  briefs and writes the copy, but doesn&apos;t create images.
                </p>
              )}
            </li>
          </ul>
        </section>

        <section className="card lg:col-span-2" aria-labelledby="signout-title">
          <h2 id="signout-title" className="text-xl font-bold text-navy">Sign out</h2>
          <p className="mt-1 text-[0.9375rem] text-muted">Your work stays saved to your account.</p>
          <form action={signOut} className="mt-4">
            <button className="btn-secondary"><LogOut aria-hidden className="h-5 w-5" /> Sign out</button>
          </form>
        </section>
      </div>
    </>
  );
}

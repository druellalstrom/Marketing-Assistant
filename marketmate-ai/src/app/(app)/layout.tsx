import { connection } from "next/server";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { isSupabaseConfigured } from "@/lib/env";
import { getAuthContext } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection(); // the sidebar shows who is signed in, so never prerender
  const configured = isSupabaseConfigured();
  const auth = configured ? await getAuthContext() : null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <details className="md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4">
            <span className="font-bold text-brand">MarketMate AI</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
              <Menu aria-hidden className="h-4 w-4" /> Menu
            </span>
          </summary>
          <Sidebar email={auth?.user.email ?? null} signOut={signOut} />
        </details>
        <div className="hidden h-full md:block">
          <Sidebar email={auth?.user.email ?? null} signOut={signOut} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        {!configured && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Setup needed:</strong> Supabase is not configured, so sign-in and saving are
            disabled. The pricing calculator still works. Add your keys to <code>.env.local</code>{" "}
            (see <code>.env.example</code>).
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

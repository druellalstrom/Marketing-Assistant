import { connection } from "next/server";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/shell/header";
import { MarketingDecor } from "@/components/shell/decor";
import { isSupabaseConfigured } from "@/lib/env";
import { getAuthContext } from "@/lib/supabase/server";
import { getShellData, type ShellData } from "@/lib/data/shell";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection(); // the header shows who is signed in, so never prerender
  const configured = isSupabaseConfigured();
  const auth = configured ? await getAuthContext() : null;
  const today = new Date().toISOString().slice(0, 10);
  let shell: ShellData | null = null;
  if (auth) {
    try {
      shell = await getShellData(auth.supabase, auth.user, today);
    } catch {
      // Header data is non-essential; pages still render if it fails.
      shell = { account: { displayName: auth.user.email ?? "there", email: auth.user.email ?? null, businessName: null }, notifications: [] };
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 bg-navy lg:block 3xl:w-72">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header account={shell?.account ?? null} notifications={shell?.notifications ?? []} signOut={signOut} />
        <main className="relative isolate mx-auto w-full max-w-[110rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <MarketingDecor />
          {!configured && (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[0.9375rem] text-amber-950">
              <strong>Setup needed:</strong> Supabase is not configured, so sign-in and saving are
              disabled. The pricing calculator still works. Add your keys to <code>.env.local</code>{" "}
              (see <code>.env.example</code>).
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

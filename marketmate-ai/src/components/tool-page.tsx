import Link from "next/link";
import { AiGenerator } from "@/components/ai-generator";
import { PageHeader } from "@/components/page-header";
import { deleteHistoryItem } from "@/components/history-actions";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { getTool, type ToolId } from "@/lib/ai/tool-definitions";
import { getPrimaryBusiness } from "@/lib/data/business";
import { getToolHistory } from "@/lib/data/history";
import { requireAuth } from "@/lib/supabase/server";

/** Shared server page for every AI tool: form, result, and saved history. */
export async function ToolPage({ toolId, path, children }: { toolId: ToolId; path: string; children?: React.ReactNode }) {
  const { supabase } = await requireAuth(path);
  const tool = getTool(toolId);
  const [history, business] = await Promise.all([
    getToolHistory(supabase, tool.storage),
    getPrimaryBusiness(supabase),
  ]);

  return (
    <>
      <PageHeader title={tool.title} description={tool.description} />
      {children}
      {!business && (
        <p className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">
          Results are generic until you{" "}
          <Link href="/business" className="text-brand underline">add your business profile</Link>.
        </p>
      )}
      <AiGenerator toolId={tool.id} fields={tool.fields} aiConfigured={isAnthropicConfigured()} />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nothing generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="card p-0">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
                    <span className="font-medium">{h.title ?? tool.title}</span>
                    <span className="text-xs text-muted">
                      {h.platform ? `${h.platform} · ` : ""}
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </summary>
                  <div className="border-t border-border p-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{h.body}</div>
                    <form action={deleteHistoryItem.bind(null, tool.storage.table, h.id, path)} className="mt-3">
                      <button className="text-sm text-red-600 hover:underline">Delete</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

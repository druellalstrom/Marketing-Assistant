import Link from "next/link";
import { AiGenerator } from "@/components/ai-generator";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteHistoryItem } from "@/components/history-actions";
import { isAiConfigured } from "@/lib/ai/provider";
import { getTool, type ToolId } from "@/lib/ai/tool-definitions";
import { getBusinessContext, prefillFrom } from "@/lib/data/business";
import { getToolHistory } from "@/lib/data/history";
import { libraryHref } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";

/** Shared server page for every AI tool: form, editable result, and saved history. */
export async function ToolPage({ toolId, path, children }: { toolId: ToolId; path: string; children?: React.ReactNode }) {
  const { supabase } = await requireAuth(path);
  const tool = getTool(toolId);
  const [history, { business, brandKit }] = await Promise.all([
    getToolHistory(supabase, tool.storage),
    getBusinessContext(supabase),
  ]);

  return (
    <>
      <PageHeader title={tool.title} description={tool.description} />
      {children}
      {!business && (
        <p className="mb-4 rounded-lg border border-border bg-card p-3 text-sm">
          Results are generic until you{" "}
          <Link href="/business" className="text-brand underline">add your business profile</Link> — then these forms fill themselves in.
        </p>
      )}
      <AiGenerator
        key={toolId}
        toolId={tool.id}
        fields={tool.fields}
        aiConfigured={isAiConfigured()}
        prefill={prefillFrom(business, brandKit)}
        disclaimer={tool.disclaimer}
        path={path}
      />

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent</h2>
          <Link href="/library" className="text-sm text-brand hover:underline">All saved work →</Link>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nothing generated yet.</p>
        ) : (
          <ul className="card divide-y divide-border p-0">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Link href={libraryHref(tool.storage.table, h.id)} className="min-w-0 flex-1 truncate font-medium hover:text-brand hover:underline">
                  {h.title ?? tool.title}
                </Link>
                <span className="text-sm text-muted">
                  {h.platform ? `${h.platform} · ` : ""}
                  {new Date(h.updated_at).toLocaleDateString()}
                </span>
                <Link href={libraryHref(tool.storage.table, h.id)} className="text-brand hover:underline">Open</Link>
                <form action={deleteHistoryItem.bind(null, tool.storage.table, h.id, path)}>
                  <ConfirmButton message="Delete this from your library?" className="text-red-600 hover:underline">Delete</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

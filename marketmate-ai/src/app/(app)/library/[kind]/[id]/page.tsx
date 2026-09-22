import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton } from "@/components/confirm-button";
import { isLibraryKind, LIBRARY_KINDS, SOCIAL_CONTENT_TYPES } from "@/lib/library";
import { requireAuth } from "@/lib/supabase/server";
import { deleteItem, duplicateItem } from "../../actions";
import { RenameButton } from "../../rename-button";
import { ItemEditor } from "./item-editor";

export const metadata: Metadata = { title: "Saved item" };

const humanize = (s: string) => s.replace(/_/g, " ");

export default async function LibraryItemPage({ params }: PageProps<"/library/[kind]/[id]">) {
  const { kind, id } = await params;
  if (!isLibraryKind(kind) || !z.uuid().safeParse(id).success) notFound();
  if (kind === "pricing") redirect(`/calculator?load=${id}`);
  const { supabase } = await requireAuth(`/library/${kind}/${id}`);

  const { table } = LIBRARY_KINDS[kind];
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (!data) notFound(); // RLS: other users' items are indistinguishable from missing ones

  const row = data as Record<string, unknown>;
  const tabFor = kind === "content"
    ? ((SOCIAL_CONTENT_TYPES as readonly string[]).includes(String(row.content_type)) ? "social" : "content")
    : kind;
  const back = `/library?tab=${tabFor}`;
  const onDuplicate = duplicateItem.bind(null, kind, id);
  const onDelete = deleteItem.bind(null, kind, id, back);
  const updated = new Date(String(row.updated_at)).toLocaleString();

  if (kind === "designs") {
    const brief = (row.brief ?? {}) as Record<string, unknown>;
    const colors = (brief.colors ?? {}) as Record<string, string>;
    const details: [string, unknown][] = [
      ["Format", brief.designType],
      ["Style", brief.style],
      ["Business", brief.businessName],
      ["Product / service", brief.productName],
      ["Description", brief.description],
      ["Price", brief.price],
      ["Promotion", brief.promotion],
      ["Contact", brief.contact],
      ["Social handles", brief.handles],
      ["Target audience", brief.targetAudience],
      ["Headline", brief.headline],
      ["Call to action", brief.callToAction],
      ["Extra direction", brief.details],
    ];
    return (
      <>
        <Link href={back} className="mb-3 inline-block text-sm text-brand hover:underline">← Saved work</Link>
        <PageHeader title={String(row.title)} description={`Design brief · updated ${updated}`} />
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/design-studio?load=${id}`} className="btn-primary">Open in Design Studio</Link>
          <RenameButton kind="designs" id={id} title={String(row.title)} />
          <form action={onDuplicate}><button className="btn-secondary">Duplicate</button></form>
          <form action={onDelete}><ConfirmButton message="Delete this design brief?" className="btn-secondary text-red-600">Delete</ConfirmButton></form>
        </div>
        {row.status === "not_connected" && (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            No image was generated: image generation is not connected yet. The brief, copy and uploads are saved.
          </p>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 font-semibold">Brief</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(v)}</dd></div>
              ))}
              {Object.keys(colors).length > 0 && (
                <div className="contents">
                  <dt className="text-muted">Colours</dt>
                  <dd className="flex gap-2">{Object.values(colors).map((c) => <span key={c} className="h-6 w-6 rounded border border-border" style={{ background: c }} title={c} />)}</dd>
                </div>
              )}
              <div className="contents"><dt className="text-muted">Uploads</dt><dd>{(row.upload_paths as string[] | null)?.length ?? 0} image(s)</dd></div>
            </dl>
          </section>
          <section className="space-y-4">
            {typeof brief.copy === "string" && brief.copy && (
              <div className="card">
                <h2 className="mb-2 font-semibold">Marketing copy</h2>
                <div className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm">{brief.copy}</div>
              </div>
            )}
            {typeof brief.prompt === "string" && (
              <div className="card">
                <h2 className="mb-2 font-semibold">Image prompt</h2>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg bg-background p-3 font-mono text-xs">{brief.prompt}</p>
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  const title = String(row.title ?? row.name ?? "Untitled");
  const subtitle = kind === "content"
    ? [humanize(String(row.content_type)), row.platform].filter(Boolean).join(" · ")
    : kind === "plans"
      ? humanize(String(row.plan_type))
      : `${humanize(String(row.campaign_type))} campaign`;

  return (
    <>
      <Link href={back} className="mb-3 inline-block text-sm text-brand hover:underline">← Saved work</Link>
      <PageHeader title={title} description={`${subtitle} · updated ${updated}`} />
      {row.plan_type === "competitor_analysis" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          AI analysis of the competitor information you provided — not independently verified.
        </p>
      )}
      <ItemEditor
        table={table as "social_content" | "marketing_plans" | "campaigns"}
        id={id}
        title={title}
        body={String(row.body ?? "")}
        campaign={kind === "campaigns" ? { status: String(row.status), start_date: (row.start_date as string) ?? null, end_date: (row.end_date as string) ?? null } : undefined}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </>
  );
}

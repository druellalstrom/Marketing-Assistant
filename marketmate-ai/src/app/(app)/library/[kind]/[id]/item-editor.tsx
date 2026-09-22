"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ResultActions } from "@/components/result-actions";
import { updateGenerated } from "@/components/history-actions";
import { updateCampaignDetails } from "../../item-actions";

interface Props {
  table: "social_content" | "marketing_plans" | "campaigns";
  id: string;
  title: string;
  body: string;
  campaign?: { status: string; start_date: string | null; end_date: string | null };
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ItemEditor({ table, id, title: initialTitle, body: initialBody, campaign, onDuplicate, onDelete }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saved, setSaved] = useState({ title: initialTitle, body: initialBody });
  const [meta, setMeta] = useState(campaign);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const dirty = title !== saved.title || body !== saved.body || (campaign !== undefined && JSON.stringify(meta) !== JSON.stringify(campaign));

  function save() {
    start(async () => {
      const res = await updateGenerated(table, id, { title, body });
      let metaRes: { ok: boolean; error?: string } = { ok: true };
      if (res.ok && table === "campaigns" && meta) metaRes = await updateCampaignDetails(id, meta);
      if (res.ok && metaRes.ok) {
        setSaved({ title, body });
        setNotice({ ok: true, text: "Changes saved." });
        router.refresh();
      } else {
        setNotice({ ok: false, text: res.error ?? metaRes.error ?? "Could not save." });
      }
    });
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label" htmlFor="item-title">Title</label>
        <input id="item-title" className="input" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {meta && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="c-status">Status</label>
            <select id="c-status" className="input capitalize" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
              {["idea", "planned", "active", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-start">Start date</label>
            <input id="c-start" type="date" className="input" value={meta.start_date ?? ""} onChange={(e) => setMeta({ ...meta, start_date: e.target.value || null })} />
          </div>
          <div>
            <label className="label" htmlFor="c-end">End date</label>
            <input id="c-end" type="date" className="input" value={meta.end_date ?? ""} onChange={(e) => setMeta({ ...meta, end_date: e.target.value || null })} />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="item-body">Content</label>
        <textarea id="item-body" className="input min-h-[28rem] font-mono text-[13px] leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <ResultActions
        text={body}
        filename={title}
        onSave={save}
        saving={saving}
        dirty={dirty}
        onDuplicate={onDuplicate}
        onDelete={() => {
          if (confirm("Delete this item? This can't be undone.")) onDelete();
        }}
      />
      {notice && <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`} role="status">{notice.text}</p>}
    </div>
  );
}

"use client";

import { preservingSubmit } from "@/components/use-preserving-submit";
import { useActionState, useEffect, useRef } from "react";
import { PLATFORMS } from "@/lib/ai/tool-definitions";
import { CALENDAR_CONTENT_TYPES, CALENDAR_STATUSES } from "@/lib/calendar/month";
import { saveCalendarEntry, type CalendarFormState } from "./actions";

export interface CalendarEntryValues {
  id?: string;
  title?: string;
  platform?: string;
  scheduled_for?: string;
  status?: string;
  content_type?: string | null;
  topic?: string | null;
  caption?: string | null;
  cta?: string | null;
  notes?: string | null;
  social_content_id?: string | null;
}

interface Props {
  defaults: CalendarEntryValues;
  content: { id: string; title: string | null }[];
  onDone?: () => void;
  heading?: string;
}

export function EntryForm({ defaults, content, onDone, heading }: Props) {
  const [state, action, pending] = useActionState<CalendarFormState, FormData>(saveCalendarEntry, {});
  const formRef = useRef<HTMLFormElement>(null);
  const editing = Boolean(defaults.id);
  const idp = defaults.id ?? "new";

  useEffect(() => {
    if (!state.ok) return;
    if (editing) onDone?.();
    else formRef.current?.reset();
  }, [state.savedAt, state.ok, editing, onDone]);

  return (
    <form ref={formRef} onSubmit={preservingSubmit(action)} className="space-y-3">
      {heading && <h2 className="font-semibold">{heading}</h2>}
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <div>
        <label className="label" htmlFor={`title-${idp}`}>Title</label>
        <input className="input" id={`title-${idp}`} name="title" required maxLength={300} defaultValue={defaults.title} placeholder="e.g. Behind-the-scenes pour" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`date-${idp}`}>Date</label>
          <input className="input" id={`date-${idp}`} name="scheduled_for" type="date" required defaultValue={defaults.scheduled_for} />
        </div>
        <div>
          <label className="label" htmlFor={`platform-${idp}`}>Platform</label>
          <select className="input" id={`platform-${idp}`} name="platform" defaultValue={defaults.platform ?? "Instagram"}>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`ctype-${idp}`}>Content type</label>
          <select className="input" id={`ctype-${idp}`} name="content_type" defaultValue={defaults.content_type ?? "Post"}>
            {CALENDAR_CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`status-${idp}`}>Status</label>
          <select className="input capitalize" id={`status-${idp}`} name="status" defaultValue={defaults.status ?? "planned"}>
            {CALENDAR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`topic-${idp}`}>Topic</label>
        <input className="input" id={`topic-${idp}`} name="topic" maxLength={500} defaultValue={defaults.topic ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`caption-${idp}`}>Caption</label>
        <textarea className="input min-h-24" id={`caption-${idp}`} name="caption" maxLength={5000} defaultValue={defaults.caption ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`cta-${idp}`}>Call to action</label>
        <input className="input" id={`cta-${idp}`} name="cta" maxLength={300} defaultValue={defaults.cta ?? ""} placeholder="e.g. Tap the link in bio" />
      </div>
      {content.length > 0 && (
        <div>
          <label className="label" htmlFor={`link-${idp}`}>Link saved content (optional)</label>
          <select className="input" id={`link-${idp}`} name="social_content_id" defaultValue={defaults.social_content_id ?? ""}>
            <option value="">— None —</option>
            {content.map((c) => <option key={c.id} value={c.id}>{c.title ?? "Untitled"}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor={`notes-${idp}`}>Notes</label>
        <textarea className="input min-h-16" id={`notes-${idp}`} name="notes" maxLength={5000} defaultValue={defaults.notes ?? ""} />
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.ok && !editing && <p className="text-sm text-green-700" role="status">Added.</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add to calendar"}</button>
        {editing && onDone && <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  );
}

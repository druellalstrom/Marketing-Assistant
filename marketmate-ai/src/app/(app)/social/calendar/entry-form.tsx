"use client";

import { preservingSubmit } from "@/components/use-preserving-submit";
import { useActionState, useEffect, useRef } from "react";
import { PLATFORMS } from "@/lib/ai/tool-definitions";
import { CALENDAR_STATUSES as STATUSES } from "@/lib/calendar/month";
import { addCalendarEntry, type CalendarFormState } from "./actions";



export function EntryForm({ defaultDate, content }: { defaultDate: string; content: { id: string; title: string | null }[] }) {
  const [state, action, pending] = useActionState<CalendarFormState, FormData>(addCalendarEntry, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={preservingSubmit(action)} className="card space-y-3">
      <h2 className="font-semibold">Add a post</h2>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input className="input" id="title" name="title" required maxLength={300} placeholder="e.g. Behind-the-scenes Reel" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="scheduled_for">Date</label>
          <input className="input" id="scheduled_for" name="scheduled_for" type="date" required defaultValue={defaultDate} />
        </div>
        <div>
          <label className="label" htmlFor="platform">Platform</label>
          <select className="input" id="platform" name="platform">
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select className="input" id="status" name="status" defaultValue="planned">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {content.length > 0 && (
        <div>
          <label className="label" htmlFor="social_content_id">Link generated content (optional)</label>
          <select className="input" id="social_content_id" name="social_content_id" defaultValue="">
            <option value="">— None —</option>
            {content.map((c) => <option key={c.id} value={c.id}>{c.title ?? "Untitled"}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea className="input min-h-20" id="notes" name="notes" maxLength={5000} />
      </div>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700" role="status">Added.</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Adding…" : "Add to calendar"}</button>
    </form>
  );
}

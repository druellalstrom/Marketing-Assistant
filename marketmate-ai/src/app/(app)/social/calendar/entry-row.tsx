"use client";

import { useCallback, useState } from "react";
import { EntryForm, type CalendarEntryValues } from "./entry-form";
import { deleteCalendarEntry, duplicateCalendarEntry } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  idea: "bg-slate-200 text-slate-800",
  planned: "bg-blue-100 text-blue-800",
  drafted: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-800",
  posted: "bg-green-100 text-green-800",
};

export function EntryRow({ entry, content }: { entry: Required<Pick<CalendarEntryValues, "id" | "title" | "platform" | "scheduled_for" | "status">> & CalendarEntryValues; content: { id: string; title: string | null }[] }) {
  const [editing, setEditing] = useState(false);
  const close = useCallback(() => setEditing(false), []);

  if (editing) {
    return (
      <li className="card">
        <EntryForm defaults={entry} content={content} onDone={close} heading="Edit post" />
      </li>
    );
  }
  return (
    <li className="card space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{entry.title}</p>
          <p className="text-xs text-muted">
            {entry.scheduled_for} · {entry.platform}
            {entry.content_type ? ` · ${entry.content_type}` : ""}
            {entry.topic ? ` · ${entry.topic}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[entry.status]}`}>{entry.status}</span>
      </div>
      {entry.caption && <p className="line-clamp-3 whitespace-pre-wrap text-muted">{entry.caption}</p>}
      {entry.cta && <p className="text-xs"><span className="text-muted">CTA:</span> {entry.cta}</p>}
      <div className="flex flex-wrap gap-3 pt-1">
        <button type="button" className="text-brand hover:underline" onClick={() => setEditing(true)}>Edit</button>
        <form action={duplicateCalendarEntry.bind(null, entry.id)}><button className="text-brand hover:underline">Duplicate</button></form>
        <form action={deleteCalendarEntry.bind(null, entry.id)} onSubmit={(e) => { if (!confirm("Delete this post?")) e.preventDefault(); }}>
          <button className="text-red-600 hover:underline">Delete</button>
        </form>
      </div>
    </li>
  );
}

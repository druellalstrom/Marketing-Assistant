"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LibraryKind } from "@/lib/library";
import { renameItem } from "./actions";

export function RenameButton({ kind, id, title }: { kind: LibraryKind; id: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return <button type="button" className="text-brand hover:underline" onClick={() => setEditing(true)}>Rename</button>;
  }
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await renameItem(kind, id, value);
          if (res.ok) {
            setEditing(false);
            setError(null);
            router.refresh();
          } else setError(res.error ?? "Could not rename.");
        });
      }}
    >
      <label className="sr-only" htmlFor={`rename-${id}`}>New name</label>
      <input id={`rename-${id}`} className="input min-w-48 flex-1 py-1" value={value} maxLength={200} onChange={(e) => setValue(e.target.value)} autoFocus />
      <button className="btn-primary py-1" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      <button type="button" className="btn-secondary py-1" onClick={() => { setEditing(false); setValue(title); setError(null); }}>Cancel</button>
      {error && <span className="w-full text-sm text-red-600" role="alert">{error}</span>}
    </form>
  );
}

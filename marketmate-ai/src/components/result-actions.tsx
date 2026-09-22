"use client";

import { useState } from "react";

interface Props {
  text: string;
  filename: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onSave?: () => void;
  saving?: boolean;
  dirty?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

function slug(name: string) {
  return (name || "marketmate").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "marketmate";
}

/** Shared toolbar for generated content: save, regenerate, copy, export, duplicate, delete. */
export function ResultActions({ text, filename, onRegenerate, regenerating, onSave, saving, dirty, onDelete, onDuplicate }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function exportFile(ext: "md" | "txt") {
    const blob = new Blob([text], { type: ext === "md" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(filename)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {onSave && (
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      )}
      {onRegenerate && (
        <button type="button" className="btn-secondary" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      )}
      <button type="button" className="btn-secondary" onClick={() => void copy()} disabled={!text}>
        {copied ? "Copied" : "Copy"}
      </button>
      <details className="relative">
        <summary className="btn-secondary cursor-pointer list-none">Export</summary>
        <div className="absolute z-10 mt-1 flex w-40 flex-col rounded-lg border border-border bg-card p-1 shadow-md">
          <button type="button" className="rounded px-3 py-2 text-left text-sm hover:bg-background" onClick={() => exportFile("md")}>Markdown (.md)</button>
          <button type="button" className="rounded px-3 py-2 text-left text-sm hover:bg-background" onClick={() => exportFile("txt")}>Plain text (.txt)</button>
        </div>
      </details>
      {onDuplicate && (
        <button type="button" className="btn-secondary" onClick={onDuplicate}>Duplicate</button>
      )}
      {onDelete && (
        <button type="button" className="btn-secondary text-red-600" onClick={onDelete}>Delete</button>
      )}
    </div>
  );
}

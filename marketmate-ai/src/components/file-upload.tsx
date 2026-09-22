"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const UPLOAD_BUCKET = "design-uploads";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

interface Props {
  name: string;
  label: string;
  userId: string;
  folder: string;
  defaultPath?: string | null;
  onChange?: (path: string) => void;
}

/**
 * Uploads an image to the private design-uploads bucket under "<userId>/<folder>/".
 * Storage policies only allow writes into the signed-in user's own folder.
 * The resulting object path is submitted with the form via a hidden input.
 */
export function FileUpload({ name, label, userId, folder, defaultPath, onChange }: Props) {
  const [path, setPath] = useState(defaultPath ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) return setStatus("Use a PNG, JPG, WebP or SVG image.");
    if (file.size > MAX_BYTES) return setStatus("Images must be 10 MB or smaller.");
    const supabase = createClient();
    if (!supabase) return setStatus("Uploads need Supabase to be configured.");

    setBusy(true);
    setStatus("Uploading…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const objectPath = `${userId}/${folder}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(objectPath, file, { contentType: file.type });
    setBusy(false);
    if (error) return setStatus(`Upload failed: ${error.message}`);
    setPath(objectPath);
    onChange?.(objectPath);
    setStatus("Uploaded.");
  }

  function clear() {
    setPath("");
    onChange?.("");
    setStatus(null);
  }

  return (
    <div>
      <label className="label" htmlFor={`${name}-file`}>{label}</label>
      <input id={`${name}-file`} type="file" accept={TYPES.join(",")} onChange={onFile} disabled={busy} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-brand" />
      <input type="hidden" name={name} value={path} />
      {path && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="truncate">Stored privately: {path.split("/").pop()}</span>
          <button type="button" onClick={clear} className="text-red-600 hover:underline">Remove</button>
        </p>
      )}
      {status && <p className="mt-1 text-xs text-muted" role="status">{status}</p>}
    </div>
  );
}

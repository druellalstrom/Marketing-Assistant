import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Generated images live in the same private bucket as uploads: "<user_id>/generated/<uuid>.<ext>". */
export const DESIGN_BUCKET = "design-uploads";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Saves a generated image under the user's folder (RLS-enforced) and returns its path. */
export async function saveGeneratedImage(
  supabase: SupabaseClient,
  userId: string,
  image: { bytes: Uint8Array; contentType: string },
): Promise<string | null> {
  const path = `${userId}/generated/${crypto.randomUUID()}.${EXT[image.contentType] ?? "png"}`;
  const { error } = await supabase.storage.from(DESIGN_BUCKET).upload(path, image.bytes, {
    contentType: image.contentType,
    upsert: false,
  });
  return error ? null : path;
}

/** Short-lived links for showing and downloading a private image. */
export async function designImageUrls(
  supabase: SupabaseClient,
  path: string,
  downloadName = "design",
): Promise<{ imageUrl: string; downloadUrl: string } | null> {
  const ext = path.split(".").pop() ?? "png";
  const bucket = supabase.storage.from(DESIGN_BUCKET);
  const [view, download] = await Promise.all([
    bucket.createSignedUrl(path, 3600),
    bucket.createSignedUrl(path, 3600, { download: `${downloadName.replace(/[^\w\- ]+/g, "").trim() || "design"}.${ext}` }),
  ]);
  if (!view.data || !download.data) return null;
  return { imageUrl: view.data.signedUrl, downloadUrl: download.data.signedUrl };
}

/** Deletes an image file once no saved design (e.g. a duplicate) still points at it. */
export async function removeDesignImageIfUnused(supabase: SupabaseClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { count, error } = await supabase.from("designs").select("id", { count: "exact", head: true }).eq("output_path", path);
  if (error || (count ?? 0) > 0) return;
  await supabase.storage.from(DESIGN_BUCKET).remove([path]);
}

const REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Loads the brief's uploads (logo, product photo, reference) from private storage for providers that use them. */
export async function loadReferenceImages(
  supabase: SupabaseClient,
  uploads: { logo?: string; productPhoto?: string; reference?: string },
): Promise<{ role: "logo" | "productPhoto" | "reference"; bytes: Uint8Array; contentType: string }[]> {
  const entries = (["logo", "productPhoto", "reference"] as const).filter((role) => uploads[role]);
  const loaded = await Promise.all(
    entries.map(async (role) => {
      const { data } = await supabase.storage.from(DESIGN_BUCKET).download(uploads[role]!);
      if (!data || !REFERENCE_TYPES.includes(data.type)) return null; // e.g. SVG logos can't be sent
      return { role, bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    }),
  );
  return loaded.filter((r) => r !== null);
}

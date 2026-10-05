import "server-only";

import type { DesignBrief } from "./brief";
import type { ImageGenerationResult, ImageProvider } from "./provider";

/**
 * Cloudflare Workers AI image generation. The free plan includes a daily
 * allowance ("neurons"), no card needed. Server-only: CLOUDFLARE_API_TOKEN
 * never reaches the browser.
 *
 * The default model, FLUX.1 [schnell], always returns a square image.
 * CLOUDFLARE_IMAGE_MODEL can pick another Workers AI text-to-image model;
 * both JSON (base64) and raw-image responses are handled.
 */
export const CLOUDFLARE_IMAGE_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

const MAX_PROMPT_CHARS = 2048;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches the storage bucket limit
const TIMEOUT_MS = 100_000;

/** Detects PNG/JPEG/WebP from the first bytes (Cloudflare doesn't label base64 output). */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export class CloudflareImageProvider implements ImageProvider {
  readonly id = "cloudflare";
  readonly label = "Cloudflare Workers AI";
  readonly note = "This free model always makes square images, whatever format you pick.";
  readonly connected = true;
  readonly usesUploads = false;

  async generate(prompt: string, brief: DesignBrief): Promise<ImageGenerationResult> {
    const fail = (error: string): ImageGenerationResult => ({ status: "failed", error, provider: this.id });
    const base = (process.env.CLOUDFLARE_API_BASE_URL || "https://api.cloudflare.com/client/v4").replace(/\/$/, "");
    const url = `${base}/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "")}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`;
    // FLUX can't change shape, so describe the intended layout in words.
    const text = `${prompt} Composition for a ${brief.designType} layout.`.slice(0, MAX_PROMPT_CHARS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      return fail(
        err instanceof Error && err.name === "TimeoutError"
          ? "Cloudflare took too long to make the image. Please try again."
          : "Couldn't reach Cloudflare. Please try again.",
      );
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!res.ok) {
      const detail = contentType === "application/json" ? JSON.stringify(await res.json().catch(() => ({}))) : "";
      console.warn(`Cloudflare Workers AI error ${res.status} (model ${CLOUDFLARE_IMAGE_MODEL}): ${detail.slice(0, 600)}`);
      if (/daily free allocation|neurons/i.test(detail)) {
        return fail("Today's free Cloudflare image allowance is used up. It resets daily, so please try again tomorrow.");
      }
      if (res.status === 401 || res.status === 403) {
        return fail("Cloudflare rejected the API token. Check CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID on the server.");
      }
      if (res.status === 404) return fail(`Cloudflare couldn't find the model or account. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_IMAGE_MODEL.`);
      if (res.status === 429) return fail("Cloudflare is limiting requests right now. Please wait a minute and try again.");
      if (res.status >= 500) return fail("Cloudflare's image service is busy right now. Please try again in a moment.");
      return fail(`Cloudflare couldn't make an image from this brief (error ${res.status}). Try simplifying it.`);
    }

    let bytes: Uint8Array;
    if (contentType.startsWith("image/")) {
      bytes = new Uint8Array(await res.arrayBuffer()); // some models return the image itself
    } else {
      const body = (await res.json().catch(() => null)) as { result?: { image?: unknown } } | null;
      const b64 = body?.result?.image;
      if (typeof b64 !== "string" || !b64) return fail("Cloudflare didn't return an image. Please try again.");
      bytes = new Uint8Array(Buffer.from(b64, "base64"));
    }
    if (bytes.byteLength === 0) return fail("Cloudflare returned an empty image. Please try again.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fail("The generated image was too large to save.");
    const type = sniffImageType(bytes);
    if (!type) return fail("Cloudflare didn't return a usable image. Please try again.");
    return { status: "completed", image: { bytes, contentType: type }, provider: this.id };
  }
}

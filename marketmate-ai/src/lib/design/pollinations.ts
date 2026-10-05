import "server-only";

import { DESIGN_DIMENSIONS, type DesignBrief } from "./brief";
import type { ImageGenerationResult, ImageProvider } from "./provider";

/**
 * Pollinations.ai image generation (https://enter.pollinations.ai).
 * Server-only: POLLINATIONS_API_KEY (a secret sk_ key) never reaches the browser.
 * Optional POLLINATIONS_MODEL picks a model; Pollinations' default is its cheapest.
 */

const MAX_PROMPT_CHARS = 1800; // the prompt travels in the URL path
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches the storage bucket limit
const TIMEOUT_MS = 120_000;
/** Formats the private storage bucket accepts. SVG is refused on purpose. */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export class PollinationsProvider implements ImageProvider {
  readonly id = "pollinations";
  readonly label = "Pollinations.ai";
  readonly note = null;
  readonly connected = true;
  readonly usesUploads = false;

  async generate(prompt: string, brief: DesignBrief): Promise<ImageGenerationResult> {
    const fail = (error: string): ImageGenerationResult => ({ status: "failed", error, provider: this.id });
    const base = (process.env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai").replace(/\/$/, "");
    const { width, height } = DESIGN_DIMENSIONS[brief.designType];
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(Math.floor(Math.random() * 2_147_483_647)),
      safe: "true",
    });
    if (process.env.POLLINATIONS_MODEL) params.set("model", process.env.POLLINATIONS_MODEL);
    const url = `${base}/image/${encodeURIComponent(prompt.slice(0, MAX_PROMPT_CHARS))}?${params}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      return fail(
        err instanceof Error && err.name === "TimeoutError"
          ? "Pollinations took too long to make the image. Please try again."
          : "Couldn't reach Pollinations. Please try again.",
      );
    }

    if (!res.ok) {
      await res.body?.cancel();
      if (res.status === 401) return fail("Pollinations rejected the API key. Check POLLINATIONS_API_KEY on the server.");
      if (res.status === 402) {
        return fail("Your Pollinations account is out of Pollen credits. Check your balance at enter.pollinations.ai, then try again.");
      }
      if (res.status === 429) return fail("Pollinations is limiting requests right now. Please wait a minute and try again.");
      if (res.status >= 500) return fail("Pollinations is busy right now. Please try again in a moment.");
      return fail(`Pollinations couldn't make an image from this brief (error ${res.status}). Try simplifying it.`);
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ACCEPTED_TYPES.includes(contentType)) {
      await res.body?.cancel();
      return fail("Pollinations didn't return a usable image. Please try again.");
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES) {
      await res.body?.cancel();
      return fail("The generated image was too large to save.");
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return fail("Pollinations returned an empty image. Please try again.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fail("The generated image was too large to save.");
    return { status: "completed", image: { bytes, contentType }, provider: this.id };
  }
}

import "server-only";

import type { DesignBrief } from "./brief";
import { GeminiImageProvider } from "./gemini-image";
import { PollinationsProvider } from "./pollinations";

/**
 * Image generation provider interface. IMAGE_PROVIDER picks the provider:
 * "gemini" (uses GEMINI_API_KEY), "pollinations" (needs POLLINATIONS_API_KEY)
 * or "none" (the default), which never produces an image and says so.
 */

/** A user upload passed to providers that can use images as input. */
export interface ReferenceImage {
  role: "logo" | "productPhoto" | "reference";
  bytes: Uint8Array;
  contentType: string;
}

export type ImageGenerationResult =
  | { status: "completed"; image: { bytes: Uint8Array; contentType: string }; provider: string }
  | { status: "failed"; error: string; provider: string }
  | { status: "not_connected"; message: string; provider: null };

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  /** Whether the provider can see the user's uploaded logo/photos. */
  readonly usesUploads: boolean;
  generate(prompt: string, brief: DesignBrief, references?: ReferenceImage[]): Promise<ImageGenerationResult>;
}

export const NOT_CONNECTED_MESSAGE =
  "Image generation is not connected yet. Your design brief has been saved, but no image was created. Set IMAGE_PROVIDER=gemini (uses your Gemini key) or IMAGE_PROVIDER=pollinations to enable this.";

export class NotConnectedProvider implements ImageProvider {
  readonly id = "none";
  readonly label = "not connected";
  readonly connected = false;
  readonly usesUploads = false;
  async generate(): Promise<ImageGenerationResult> {
    return { status: "not_connected", message: NOT_CONNECTED_MESSAGE, provider: null };
  }
}

export function getImageProvider(): ImageProvider {
  const configured = (process.env.IMAGE_PROVIDER ?? "none").toLowerCase();
  // Each provider needs its key; without one, stay honestly not connected.
  if (configured === "gemini" && process.env.GEMINI_API_KEY) return new GeminiImageProvider();
  if (configured === "pollinations" && process.env.POLLINATIONS_API_KEY) return new PollinationsProvider();
  return new NotConnectedProvider();
}

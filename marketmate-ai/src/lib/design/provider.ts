import "server-only";

import type { DesignBrief } from "./brief";
import { PollinationsProvider } from "./pollinations";

/**
 * Image generation provider interface. IMAGE_PROVIDER picks the provider:
 * "pollinations" (needs POLLINATIONS_API_KEY) or "none" (the default), which
 * never produces an image and says so.
 */

export type ImageGenerationResult =
  | { status: "completed"; image: { bytes: Uint8Array; contentType: string }; provider: string }
  | { status: "failed"; error: string; provider: string }
  | { status: "not_connected"; message: string; provider: null };

export interface ImageProvider {
  readonly id: string;
  readonly connected: boolean;
  /** Whether the provider can see the user's uploaded logo/photos. */
  readonly usesUploads: boolean;
  generate(prompt: string, brief: DesignBrief): Promise<ImageGenerationResult>;
}

export const NOT_CONNECTED_MESSAGE =
  "Image generation is not connected yet. Your design brief has been saved, but no image was created. Connect an image provider (set IMAGE_PROVIDER=pollinations and POLLINATIONS_API_KEY) to enable this.";

export class NotConnectedProvider implements ImageProvider {
  readonly id = "none";
  readonly connected = false;
  readonly usesUploads = false;
  async generate(): Promise<ImageGenerationResult> {
    return { status: "not_connected", message: NOT_CONNECTED_MESSAGE, provider: null };
  }
}

export function getImageProvider(): ImageProvider {
  const configured = (process.env.IMAGE_PROVIDER ?? "none").toLowerCase();
  // Pollinations needs its key; without one, stay honestly not connected.
  if (configured === "pollinations" && process.env.POLLINATIONS_API_KEY) return new PollinationsProvider();
  return new NotConnectedProvider();
}

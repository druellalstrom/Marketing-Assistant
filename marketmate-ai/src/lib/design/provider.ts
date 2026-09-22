import "server-only";

import type { DesignBrief } from "./brief";

/**
 * Image generation provider interface.
 *
 * NOT CONNECTED YET: the only implementation is `NotConnectedProvider`, which
 * never produces an image and says so. To connect Pollinations.ai or a paid
 * provider, implement `ImageProvider` in a new file, add its id to
 * `getImageProvider`, and set IMAGE_PROVIDER in the environment.
 */

export type ImageGenerationResult =
  | { status: "completed"; imageUrl: string; provider: string }
  | { status: "failed"; error: string; provider: string }
  | { status: "not_connected"; message: string; provider: null };

export interface ImageProvider {
  readonly id: string;
  readonly connected: boolean;
  generate(prompt: string, brief: DesignBrief): Promise<ImageGenerationResult>;
}

export const NOT_CONNECTED_MESSAGE =
  "Image generation is not connected yet. Your design brief has been saved, but no image was created. Connect an image provider (e.g. Pollinations.ai or a paid API) to enable this.";

export class NotConnectedProvider implements ImageProvider {
  readonly id = "none";
  readonly connected = false;
  async generate(): Promise<ImageGenerationResult> {
    return { status: "not_connected", message: NOT_CONNECTED_MESSAGE, provider: null };
  }
}

export function getImageProvider(): ImageProvider {
  const configured = (process.env.IMAGE_PROVIDER ?? "none").toLowerCase();
  switch (configured) {
    // case "pollinations": return new PollinationsProvider();   // ← add when connecting
    case "none":
    default:
      return new NotConnectedProvider();
  }
}

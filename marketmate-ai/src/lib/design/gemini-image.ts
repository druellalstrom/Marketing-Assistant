import "server-only";

import { FinishReason, type GenerateContentResponse, type Part } from "@google/genai";
import { AiGenerationError } from "@/lib/ai/errors";
import { generateWithFallback, modelChain } from "@/lib/ai/gemini";
import { DESIGN_DIMENSIONS, type DesignBrief } from "./brief";
import type { ImageGenerationResult, ImageProvider, ReferenceImage } from "./provider";

/**
 * Google Gemini image generation (the model behind posters in the Gemini app).
 * Uses the same server-only GEMINI_API_KEY as AI writing. GEMINI_IMAGE_MODEL
 * overrides the model.
 */
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
/** Backups when the image model is overloaded or out of quota (comma-separated GEMINI_IMAGE_FALLBACK_MODELS). */
export const GEMINI_IMAGE_MODELS = modelChain(GEMINI_IMAGE_MODEL, process.env.GEMINI_IMAGE_FALLBACK_MODELS, []);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // matches the storage bucket limit
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DECLINED: string[] = [
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
  FinishReason.IMAGE_RECITATION,
];
const REFERENCE_LABEL: Record<ReferenceImage["role"], string> = {
  logo: "The business logo (use it on the design):",
  productPhoto: "The product photo (use it as the hero image):",
  reference: "A reference image (match its look and feel):",
};

export class GeminiImageProvider implements ImageProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  readonly connected = true;
  readonly usesUploads = true;

  async generate(prompt: string, brief: DesignBrief, references: ReferenceImage[] = []): Promise<ImageGenerationResult> {
    const fail = (error: string): ImageGenerationResult => ({ status: "failed", error, provider: this.id });
    const parts: Part[] = [{ text: prompt }];
    for (const ref of references) {
      parts.push({ text: REFERENCE_LABEL[ref.role] });
      parts.push({ inlineData: { mimeType: ref.contentType, data: Buffer.from(ref.bytes).toString("base64") } });
    }

    let response: GenerateContentResponse;
    try {
      ({ response } = await generateWithFallback(
        GEMINI_IMAGE_MODELS,
        {
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: { aspectRatio: DESIGN_DIMENSIONS[brief.designType].aspectRatio },
          },
        },
        "GEMINI_IMAGE_MODEL",
      ));
    } catch (err) {
      if (err instanceof AiGenerationError) return fail(err.message);
      return fail("Image generation failed. Please try again.");
    }

    const candidate = response.candidates?.[0];
    if (response.promptFeedback?.blockReason || (candidate?.finishReason && DECLINED.includes(candidate.finishReason))) {
      return fail("Gemini declined to make this image. Try rephrasing the brief.");
    }
    const image = candidate?.content?.parts?.find((p) => p.inlineData?.data && ACCEPTED_TYPES.includes(p.inlineData.mimeType ?? ""));
    if (!image?.inlineData?.data) {
      return fail("Gemini didn't return an image this time. Please try again, or simplify the brief.");
    }
    const bytes = new Uint8Array(Buffer.from(image.inlineData.data, "base64"));
    if (bytes.byteLength === 0) return fail("Gemini returned an empty image. Please try again.");
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fail("The generated image was too large to save.");
    return { status: "completed", image: { bytes, contentType: image.inlineData.mimeType! }, provider: this.id };
  }
}

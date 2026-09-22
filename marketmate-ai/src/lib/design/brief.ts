import { z } from "zod";

/** Client-safe Design Studio definitions shared by the form and the API route. */

export const DESIGN_TYPES = [
  "Instagram post (1:1)",
  "Instagram / TikTok story (9:16)",
  "Facebook post",
  "Pinterest pin (2:3)",
  "Flyer / poster",
  "Product label",
  "Price tag / menu card",
  "Banner / header",
] as const;

export const DESIGN_STYLES = [
  "Clean & minimal",
  "Bold & colourful",
  "Luxury / elegant",
  "Playful & fun",
  "Rustic / handmade",
  "Modern & techy",
  "Vintage / retro",
] as const;

const hex = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Colours must be hex values like #FF8800.");

export const designBriefSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    designType: z.enum(DESIGN_TYPES),
    style: z.enum(DESIGN_STYLES),
    businessName: z.string().trim().min(1, "Business name is required.").max(200),
    productName: z.string().trim().min(1, "Product is required.").max(200),
    price: z.string().trim().max(50).optional(),
    headline: z.string().trim().max(200).optional(),
    callToAction: z.string().trim().max(100).optional(),
    details: z.string().trim().max(2000).optional(),
    colors: z.object({ primary: hex, secondary: hex, accent: hex }),
    /** Storage object paths in the private design-uploads bucket ("<user_id>/…"). */
    uploads: z
      .object({
        logo: z.string().max(500).optional(),
        productPhoto: z.string().max(500).optional(),
        reference: z.string().max(500).optional(),
      })
      .default({}),
  })
  .strict();

export type DesignBrief = z.infer<typeof designBriefSchema>;

/**
 * Turns a brief into the text prompt an image model would receive. Pure and
 * provider-agnostic so it can be reviewed now and reused when a provider is connected.
 */
export function buildImagePrompt(brief: DesignBrief): string {
  const parts = [
    `${brief.designType} marketing graphic for "${brief.businessName}".`,
    `Feature the product: ${brief.productName}.`,
    brief.price ? `Show the price "${brief.price}" clearly.` : null,
    brief.headline ? `Headline text: "${brief.headline}".` : null,
    brief.callToAction ? `Call to action: "${brief.callToAction}".` : null,
    `Style: ${brief.style}.`,
    `Brand colours: primary ${brief.colors.primary}, secondary ${brief.colors.secondary}, accent ${brief.colors.accent}.`,
    brief.details ? `Additional direction: ${brief.details}` : null,
    brief.uploads.logo ? "Incorporate the supplied logo." : null,
    brief.uploads.productPhoto ? "Use the supplied product photo as the hero image." : null,
    brief.uploads.reference ? "Match the look of the supplied reference image." : null,
    "Professional, print-quality layout with legible text and balanced spacing.",
  ];
  return parts.filter(Boolean).join(" ");
}

/** Upload paths must live in the caller's own folder of the bucket. */
export function uploadsBelongToUser(brief: DesignBrief, userId: string): boolean {
  return Object.values(brief.uploads).every(
    (p) => p === undefined || (p.startsWith(`${userId}/`) && !p.includes("..")),
  );
}

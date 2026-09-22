import { z } from "zod";

/** Client-safe Design Studio definitions shared by the form and the API route. */

export const DESIGN_TYPES = [
  "Promotional poster",
  "Social media graphic",
  "Flyer",
  "Product advertisement",
  "Business card",
  "Instagram post (1:1)",
  "Instagram / TikTok story (9:16)",
  "Facebook post",
  "Promotional banner",
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
    productName: z.string().trim().min(1, "Product or service is required.").max(200),
    description: z.string().trim().max(2000).optional(),
    price: z.string().trim().max(50).optional(),
    promotion: z.string().trim().max(300).optional(),
    contact: z.string().trim().max(300).optional(),
    handles: z.string().trim().max(300).optional(),
    targetAudience: z.string().trim().max(500).optional(),
    headline: z.string().trim().max(200).optional(),
    callToAction: z.string().trim().max(100).optional(),
    details: z.string().trim().max(2000).optional(),
    /** Marketing copy (AI-generated and/or edited by the user) to place on the design. */
    copy: z.string().trim().max(5000).optional(),
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
    brief.description ? `About the product: ${brief.description}` : null,
    brief.price ? `Show the price "${brief.price}" clearly.` : null,
    brief.promotion ? `Highlight the promotion: "${brief.promotion}".` : null,
    brief.headline ? `Headline text: "${brief.headline}".` : null,
    brief.callToAction ? `Call to action: "${brief.callToAction}".` : null,
    brief.targetAudience ? `Designed to appeal to: ${brief.targetAudience}.` : null,
    brief.contact ? `Include contact details: ${brief.contact}.` : null,
    brief.handles ? `Include social handles: ${brief.handles}.` : null,
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

import { z } from "zod";

/** Validation for the business profile (shared by the form action and the AI assistant). */
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const SOCIAL_KEYS = ["instagram", "facebook", "tiktok", "linkedin", "x", "pinterest", "youtube"] as const;

export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^[+()\d\s.-]{6,40}$/.test(v), "Phone can only contain digits, spaces and + ( ) - .");

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address.");

export const websiteSchema = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null))
  .refine((v) => v === null || z.url({ protocol: /^https?$/ }).safeParse(v).success, "Enter a valid website address.");

export const businessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(200),
  industry: optional(200),
  description: optional(3000),
  products: optional(3000),
  target_audience: optional(2000),
  location: optional(200),
  phone: phoneSchema,
  email: emailSchema,
  website: websiteSchema,
  instagram: optional(200),
  facebook: optional(200),
  tiktok: optional(200),
  linkedin: optional(200),
  x: optional(200),
  pinterest: optional(200),
  youtube: optional(200),
});

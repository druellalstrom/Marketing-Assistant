/**
 * Client-safe definitions of every AI tool: its form fields and where the
 * result is stored. Prompts live server-side in ./prompts.ts, and the API route
 * validates requests against these same field definitions (./validation.ts).
 */

export type FieldType = "text" | "textarea" | "select" | "checkboxes";

/** Business-profile values a field can be pre-filled from. */
export type PrefillKey = "businessName" | "industry" | "products" | "location" | "targetAudience" | "platforms" | "brandTone";

export interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  maxLength?: number;
  help?: string;
  prefill?: PrefillKey;
  defaultValue?: string;
}

export type StorageTarget =
  | { table: "social_content"; contentType: string; contentTypeFrom?: { field: string; map: Record<string, string> } }
  | { table: "marketing_plans"; planType: string }
  | { table: "campaigns"; campaignTypeFrom: { field: string; map: Record<string, string> } };

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  section: "social" | "strategy" | "studio" | "design";
  fields: readonly ToolField[];
  storage: StorageTarget;
  /** Which field (if any) holds the platform, stored alongside social content. */
  platformField?: string;
  /** Shown above results to label what kind of information this is. */
  disclaimer?: string;
}

export const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "X (Twitter)", "Pinterest", "YouTube", "Threads"] as const;
export const TONES = ["Professional", "Friendly", "Luxury", "Fun", "Bold", "Minimal", "Persuasive", "Casual"] as const;
export const LENGTHS = ["Short", "Medium", "Long"] as const;
export const OBJECTIVES = ["Sell", "Educate", "Engage", "Announce", "Promote", "Build awareness"] as const;

export const CAMPAIGN_TYPES: Record<string, string> = {
  "Product launch": "product_launch",
  "Sale / discount": "sale",
  Holiday: "holiday",
  "Seasonal promotion": "seasonal",
  "Brand awareness": "brand_awareness",
  "Customer retention": "customer_retention",
  "New customer acquisition": "customer_acquisition",
};

/** Content Creation Studio types → social_content.content_type. */
export const STUDIO_CONTENT_TYPES: Record<string, string> = {
  "Product description": "product_description",
  Advertisement: "ad_copy",
  "Email campaign": "email",
  "TikTok script": "video_script",
  "Instagram caption": "caption",
  "Facebook post": "social_post",
  "LinkedIn post": "social_post",
  "Website copy": "website_copy",
  "Promotional message": "promo_message",
  "Call-to-action": "cta",
  "Product launch announcement": "launch_announcement",
};

// ---- shared fields ----
const platform: ToolField = { name: "platform", label: "Platform", type: "select", required: true, options: PLATFORMS };
const tone: ToolField = { name: "tone", label: "Tone", type: "select", options: TONES, prefill: "brandTone" };
const businessName: ToolField = { name: "business_name", label: "Business name", type: "text", maxLength: 200, prefill: "businessName" };
const industry: ToolField = { name: "industry", label: "Industry / business type", type: "text", maxLength: 200, prefill: "industry", placeholder: "e.g. Handmade candles" };
const product = (required = true): ToolField => ({
  name: "product",
  label: "Product or service",
  type: "textarea",
  required,
  maxLength: 2000,
  prefill: "products",
  placeholder: "e.g. Lavender soy candle, 40-hour burn, $24",
});
const location: ToolField = { name: "location", label: "Location", type: "text", maxLength: 200, prefill: "location", placeholder: "e.g. Bridgetown, Barbados" };
const audience = (required = false): ToolField => ({
  name: "target_audience",
  label: "Target audience",
  type: "textarea",
  required,
  maxLength: 1500,
  prefill: "targetAudience",
  placeholder: "e.g. Women 25–45 who love self-care and gifting",
});
const budget: ToolField = { name: "budget", label: "Budget", type: "text", maxLength: 100, placeholder: "e.g. $300 per month" };
const duration: ToolField = { name: "duration", label: "Campaign duration", type: "select", options: ["2 weeks", "1 month", "3 months", "6 months"] };
const currentPlatforms: ToolField = {
  name: "platforms",
  label: "Current social platforms",
  type: "checkboxes",
  options: ["Instagram", "Facebook", "TikTok", "LinkedIn", "X (Twitter)", "Pinterest", "YouTube", "WhatsApp", "Website", "Email list"],
  prefill: "platforms",
};
const competitorsOptional: ToolField = {
  name: "competitors",
  label: "Competitors (optional)",
  type: "textarea",
  maxLength: 2000,
  placeholder: "Names and anything you know about them",
  help: "Only what you enter here is used — MarketMate doesn't look up competitors online.",
};

export const TOOL_DEFINITIONS = {
  // ---- Social Media Center ----
  caption: {
    id: "caption",
    title: "Caption generator",
    description: "Platform-ready captions with a hook and a clear call to action.",
    section: "social",
    fields: [
      platform,
      product(),
      audience(),
      tone,
      { name: "objective", label: "Campaign objective", type: "select", options: ["Sales", "Engagement", "Awareness", "Website traffic", "Product launch", "Community building"] },
      { name: "variations", label: "Number of variations", type: "select", options: ["3", "1", "5"] },
    ],
    storage: { table: "social_content", contentType: "caption" },
    platformField: "platform",
  },
  hashtags: {
    id: "hashtags",
    title: "Hashtag generator",
    description: "A tiered mix of broad, niche, local and campaign hashtags.",
    section: "social",
    fields: [
      platform,
      product(),
      industry,
      location,
      { name: "campaign", label: "Campaign (optional)", type: "text", maxLength: 200, placeholder: "e.g. Holiday gift sale" },
    ],
    storage: { table: "social_content", contentType: "hashtags" },
    platformField: "platform",
  },
  content_ideas: {
    id: "content_ideas",
    title: "Content ideas",
    description: "Post ideas built around engagement, relevance and platform best practices.",
    section: "social",
    fields: [
      platform,
      { ...industry, required: true },
      audience(),
      product(false),
      { name: "goal", label: "Marketing goal", type: "select", required: true, options: ["Grow followers", "Increase sales", "Build brand awareness", "Boost engagement", "Launch a product", "Build trust"] },
      { name: "count", label: "How many ideas", type: "select", options: ["10", "5", "20"] },
    ],
    storage: { table: "social_content", contentType: "content_idea" },
    platformField: "platform",
  },
  repurpose: {
    id: "repurpose",
    title: "Content repurposing",
    description: "Turn one piece of content into posts for other channels.",
    section: "social",
    fields: [
      { name: "source", label: "Original content", type: "textarea", required: true, maxLength: 8000, placeholder: "Paste a caption, blog post, email or video script" },
      {
        name: "targets",
        label: "Turn it into",
        type: "checkboxes",
        required: true,
        options: ["Instagram caption", "Facebook post", "TikTok script", "LinkedIn post", "Email", "Short advertisement"],
        defaultValue: "Instagram caption, Facebook post, TikTok script",
      },
      tone,
    ],
    storage: { table: "social_content", contentType: "repurposed" },
  },

  // ---- Marketing Strategy ----
  audience_analysis: {
    id: "audience_analysis",
    title: "Target audience analysis",
    description: "Demographics, needs, pain points, motivations, interests and behaviour.",
    section: "strategy",
    fields: [businessName, { ...industry, required: true }, product(), location, audience(), { name: "objective", label: "Marketing objective", type: "text", maxLength: 500 }, competitorsOptional],
    storage: { table: "marketing_plans", planType: "audience_analysis" },
  },
  personas: {
    id: "personas",
    title: "Customer personas",
    description: "Realistic buyer personas: goals, pain points, buying behaviour and platforms.",
    section: "strategy",
    fields: [businessName, industry, product(), location, audience(), { name: "count", label: "Number of personas", type: "select", options: ["2", "1", "3"] }],
    storage: { table: "marketing_plans", planType: "persona" },
  },
  marketing_plan: {
    id: "marketing_plan",
    title: "Marketing plan",
    description: "Objectives, strategy, channels, content, promotions, timeline and KPIs.",
    section: "strategy",
    fields: [
      businessName,
      { ...industry, required: true },
      product(),
      location,
      audience(),
      budget,
      { name: "objective", label: "Marketing objective", type: "textarea", required: true, maxLength: 1000, placeholder: "e.g. Reach $5k/month in online sales" },
      currentPlatforms,
      competitorsOptional,
      { ...duration, label: "Plan duration", options: ["3 months", "1 month", "6 months"] },
    ],
    storage: { table: "marketing_plans", planType: "marketing_plan" },
  },
  campaigns: {
    id: "campaigns",
    title: "Campaign ideas",
    description: "Campaigns for launches, sales, holidays, seasons, awareness, retention and new customers.",
    section: "strategy",
    fields: [
      { name: "campaign_type", label: "Campaign type", type: "select", required: true, options: Object.keys(CAMPAIGN_TYPES) },
      businessName,
      product(),
      audience(),
      { name: "objective", label: "Objective", type: "textarea", maxLength: 1000 },
      { name: "occasion", label: "Holiday / season / date (optional)", type: "text", maxLength: 200, placeholder: "e.g. Mother's Day, back to school" },
      budget,
      duration,
      currentPlatforms,
    ],
    storage: { table: "campaigns", campaignTypeFrom: { field: "campaign_type", map: CAMPAIGN_TYPES } },
  },
  competitor_analysis: {
    id: "competitor_analysis",
    title: "Competitor analysis",
    description: "Positioning analysis of competitors you name, based only on what you tell it.",
    section: "strategy",
    fields: [
      businessName,
      { ...industry, required: true },
      product(),
      location,
      { name: "competitors", label: "Competitors", type: "textarea", required: true, maxLength: 3000, placeholder: "One per line, with anything you know: prices, products, strengths, where they sell" },
    ],
    storage: { table: "marketing_plans", planType: "competitor_analysis" },
    disclaimer:
      "AI analysis of the competitor information you provided. MarketMate does not research competitors online, so nothing here is verified.",
  },

  // ---- Content Creation Studio ----
  content: {
    id: "content",
    title: "Content Creation Studio",
    description: "Product descriptions, ads, emails, scripts, social posts, website copy and more.",
    section: "studio",
    fields: [
      { name: "content_type", label: "What to create", type: "select", required: true, options: Object.keys(STUDIO_CONTENT_TYPES) },
      { ...product(), label: "Product, service or topic" },
      { name: "details", label: "Key details (optional)", type: "textarea", maxLength: 3000, placeholder: "Features, price, offer, dates, links — anything the copy should include" },
      audience(),
      { ...tone, options: TONES },
      { name: "length", label: "Length", type: "select", options: ["Medium", "Short", "Long"] },
      { name: "objective", label: "Objective", type: "select", options: OBJECTIVES },
      { name: "cta", label: "Call to action (optional)", type: "text", maxLength: 200, placeholder: "e.g. Shop now at glow.example" },
    ],
    storage: {
      table: "social_content",
      contentType: "other",
      contentTypeFrom: { field: "content_type", map: STUDIO_CONTENT_TYPES },
    },
  },

  // ---- Design Studio (marketing copy for a design; image generation is separate) ----
  design_copy: {
    id: "design_copy",
    title: "Design copy",
    description: "Headline, supporting text and call to action for a design.",
    section: "design",
    fields: [
      { name: "design_type", label: "Design type", type: "text", required: true, maxLength: 100 },
      { ...businessName, required: true },
      { ...product(), maxLength: 500 },
      { name: "description", label: "Product description", type: "textarea", maxLength: 2000 },
      { name: "price", label: "Price", type: "text", maxLength: 50 },
      { name: "promotion", label: "Promotion", type: "text", maxLength: 300 },
      { name: "contact", label: "Contact information", type: "text", maxLength: 300 },
      { name: "handles", label: "Social media handles", type: "text", maxLength: 300 },
      { name: "target_audience", label: "Target audience", type: "text", maxLength: 500 },
      { name: "style", label: "Style", type: "text", maxLength: 100 },
    ],
    storage: { table: "social_content", contentType: "design_copy" },
  },
} as const satisfies Record<string, ToolDefinition>;

export type ToolId = keyof typeof TOOL_DEFINITIONS;

export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TOOL_DEFINITIONS, value);
}

export function getTool(id: ToolId): ToolDefinition {
  return TOOL_DEFINITIONS[id];
}

/** The social_content.content_type a generation is stored under. */
export function resolveContentType(tool: ToolDefinition, input: Record<string, string>): string | null {
  if (tool.storage.table !== "social_content") return null;
  const from = tool.storage.contentTypeFrom;
  return (from && from.map[input[from.field]]) || tool.storage.contentType;
}

/** The platform a generation is stored under, if the tool has one. */
export function resolvePlatform(tool: ToolDefinition, input: Record<string, string>): string | null {
  if (tool.platformField) return input[tool.platformField] ?? null;
  const type = input.content_type ?? "";
  const match = ["Instagram", "Facebook", "TikTok", "LinkedIn"].find((p) => type.startsWith(p));
  return match ?? null;
}

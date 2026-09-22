/**
 * Client-safe definitions of every AI tool: its form fields and where the
 * result is stored. Prompts live server-side in ./prompts.ts, and the API route
 * validates requests against these same field definitions (./validation.ts).
 */

export type FieldType = "text" | "textarea" | "select";

export interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  maxLength?: number;
  help?: string;
}

export type StorageTarget =
  | { table: "social_content"; contentType: string }
  | { table: "marketing_plans"; planType: string };

export interface ToolDefinition {
  id: string;
  title: string;
  description: string;
  section: "social" | "strategy" | "studio";
  fields: readonly ToolField[];
  storage: StorageTarget;
  /** Which field (if any) holds the platform, stored alongside social content. */
  platformField?: string;
}

export const PLATFORMS = [
  "Instagram",
  "TikTok",
  "Facebook",
  "LinkedIn",
  "X (Twitter)",
  "Pinterest",
  "YouTube",
  "Threads",
] as const;

export const TONES = [
  "Friendly",
  "Professional",
  "Playful",
  "Luxurious",
  "Bold",
  "Inspirational",
  "Educational",
] as const;

const platform: ToolField = {
  name: "platform",
  label: "Platform",
  type: "select",
  required: true,
  options: PLATFORMS,
};
const tone: ToolField = { name: "tone", label: "Tone", type: "select", options: TONES };
const productOrTopic: ToolField = {
  name: "topic",
  label: "Product, offer or topic",
  type: "textarea",
  required: true,
  maxLength: 2000,
  placeholder: "e.g. Our new lavender soy candle, 40-hour burn, $24",
};

export const TOOL_DEFINITIONS = {
  // ---- Social Media Center ----
  caption: {
    id: "caption",
    title: "Caption generator",
    description: "Scroll-stopping captions with a hook and call to action.",
    section: "social",
    fields: [
      platform,
      productOrTopic,
      tone,
      { name: "goal", label: "Goal", type: "select", options: ["Sales", "Engagement", "Awareness", "Traffic", "Community"] },
      { name: "variations", label: "Number of variations", type: "select", options: ["1", "3", "5"] },
    ],
    storage: { table: "social_content", contentType: "caption" },
    platformField: "platform",
  },
  hashtags: {
    id: "hashtags",
    title: "Hashtag generator",
    description: "A tiered mix of broad, niche and local hashtags.",
    section: "social",
    fields: [
      platform,
      productOrTopic,
      { name: "location", label: "Location (optional)", type: "text", maxLength: 120, placeholder: "e.g. Austin, TX" },
    ],
    storage: { table: "social_content", contentType: "hashtags" },
    platformField: "platform",
  },
  content_ideas: {
    id: "content_ideas",
    title: "Content ideas",
    description: "Fresh post ideas mapped to content pillars.",
    section: "social",
    fields: [
      platform,
      { name: "topic", label: "Focus (optional)", type: "textarea", maxLength: 2000, placeholder: "e.g. holiday season, a new launch, behind the scenes" },
      { name: "count", label: "How many ideas", type: "select", options: ["5", "10", "20"] },
    ],
    storage: { table: "social_content", contentType: "content_idea" },
    platformField: "platform",
  },
  repurpose: {
    id: "repurpose",
    title: "Content repurposing",
    description: "Turn one piece of content into posts for other platforms.",
    section: "social",
    fields: [
      { name: "source", label: "Original content", type: "textarea", required: true, maxLength: 8000, placeholder: "Paste a caption, blog post, email or video script" },
      { name: "targets", label: "Repurpose for", type: "text", required: true, maxLength: 200, placeholder: "e.g. TikTok script, LinkedIn post, email" },
    ],
    storage: { table: "social_content", contentType: "repurposed" },
  },

  // ---- Marketing Strategy ----
  audience_analysis: {
    id: "audience_analysis",
    title: "Target audience analysis",
    description: "Who buys, why they buy, and where to reach them.",
    section: "strategy",
    fields: [
      { name: "offer", label: "What you sell", type: "textarea", required: true, maxLength: 2000 },
      { name: "current_customers", label: "Who buys today (optional)", type: "textarea", maxLength: 2000 },
      { name: "price_point", label: "Price point (optional)", type: "text", maxLength: 100 },
    ],
    storage: { table: "marketing_plans", planType: "audience_analysis" },
  },
  personas: {
    id: "personas",
    title: "Customer personas",
    description: "Detailed buyer personas with goals, objections and messaging.",
    section: "strategy",
    fields: [
      { name: "offer", label: "What you sell", type: "textarea", required: true, maxLength: 2000 },
      { name: "audience_notes", label: "What you know about your audience (optional)", type: "textarea", maxLength: 2000 },
      { name: "count", label: "Number of personas", type: "select", options: ["1", "2", "3"] },
    ],
    storage: { table: "marketing_plans", planType: "persona" },
  },
  marketing_plan: {
    id: "marketing_plan",
    title: "Marketing plan",
    description: "A practical 30/60/90-day plan with channels and weekly actions.",
    section: "strategy",
    fields: [
      { name: "goal", label: "Main goal", type: "textarea", required: true, maxLength: 1000, placeholder: "e.g. Reach $5k/month in online sales" },
      { name: "budget", label: "Monthly marketing budget", type: "text", maxLength: 100, placeholder: "e.g. $200" },
      { name: "time", label: "Hours per week available", type: "text", maxLength: 100 },
      { name: "channels", label: "Channels you use now (optional)", type: "text", maxLength: 300 },
    ],
    storage: { table: "marketing_plans", planType: "marketing_plan" },
  },
  campaigns: {
    id: "campaigns",
    title: "Campaign ideas",
    description: "Campaign concepts with hooks, offers and timelines.",
    section: "strategy",
    fields: [
      { name: "objective", label: "Campaign objective", type: "textarea", required: true, maxLength: 1000 },
      { name: "occasion", label: "Season or occasion (optional)", type: "text", maxLength: 200 },
      { name: "budget", label: "Budget (optional)", type: "text", maxLength: 100 },
    ],
    storage: { table: "marketing_plans", planType: "campaign" },
  },

  // ---- Content Creation Studio ----
  product_description: {
    id: "product_description",
    title: "Product description",
    description: "Benefit-led product copy for your store or marketplace.",
    section: "studio",
    fields: [
      { name: "product", label: "Product name", type: "text", required: true, maxLength: 200 },
      { name: "details", label: "Features, materials, sizes, price", type: "textarea", required: true, maxLength: 3000 },
      { name: "channel", label: "Where it will appear", type: "select", options: ["Website", "Etsy", "Amazon", "Shopify", "Instagram Shop"] },
      tone,
    ],
    storage: { table: "social_content", contentType: "product_description" },
  },
  email: {
    id: "email",
    title: "Email",
    description: "Newsletters, launch emails and promotions with subject lines.",
    section: "studio",
    fields: [
      { name: "email_type", label: "Email type", type: "select", required: true, options: ["Newsletter", "Product launch", "Sale / promotion", "Welcome", "Abandoned cart", "Re-engagement"] },
      { name: "topic", label: "What it's about", type: "textarea", required: true, maxLength: 3000 },
      tone,
    ],
    storage: { table: "social_content", contentType: "email" },
  },
  blog_post: {
    id: "blog_post",
    title: "Blog post",
    description: "An SEO-friendly blog post draft with headings.",
    section: "studio",
    fields: [
      { name: "topic", label: "Topic or title", type: "text", required: true, maxLength: 300 },
      { name: "keywords", label: "Keywords (optional)", type: "text", maxLength: 300 },
      { name: "length", label: "Length", type: "select", options: ["Short (~500 words)", "Medium (~900 words)", "Long (~1500 words)"] },
      tone,
    ],
    storage: { table: "social_content", contentType: "blog_post" },
  },
  ad_copy: {
    id: "ad_copy",
    title: "Ad copy",
    description: "Headlines, primary text and CTAs for paid ads.",
    section: "studio",
    fields: [
      { name: "ad_platform", label: "Ad platform", type: "select", required: true, options: ["Meta (Facebook/Instagram)", "Google Search", "TikTok", "Pinterest"] },
      { name: "offer", label: "Offer", type: "textarea", required: true, maxLength: 2000 },
      { name: "audience", label: "Audience (optional)", type: "text", maxLength: 300 },
    ],
    storage: { table: "social_content", contentType: "ad_copy" },
    platformField: "ad_platform",
  },
  video_script: {
    id: "video_script",
    title: "Short video script",
    description: "Reels/TikTok scripts with hook, shots and on-screen text.",
    section: "studio",
    fields: [
      { name: "topic", label: "Video topic", type: "textarea", required: true, maxLength: 2000 },
      { name: "duration", label: "Length", type: "select", options: ["15 seconds", "30 seconds", "60 seconds"] },
      tone,
    ],
    storage: { table: "social_content", contentType: "video_script" },
  },
} as const satisfies Record<string, ToolDefinition>;

export type ToolId = keyof typeof TOOL_DEFINITIONS;

export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TOOL_DEFINITIONS, value);
}

export function getTool(id: ToolId): ToolDefinition {
  return TOOL_DEFINITIONS[id];
}

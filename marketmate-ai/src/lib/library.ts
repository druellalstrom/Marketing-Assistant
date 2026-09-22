/** Saved-work kinds, their tables and URLs (client-safe). */
export const LIBRARY_KINDS = {
  content: { table: "social_content", titleColumn: "title", label: "Content" },
  plans: { table: "marketing_plans", titleColumn: "title", label: "Marketing plans" },
  campaigns: { table: "campaigns", titleColumn: "name", label: "Campaigns" },
  pricing: { table: "pricing_calculations", titleColumn: "product_name", label: "Pricing" },
  designs: { table: "designs", titleColumn: "title", label: "Designs" },
} as const;

export type LibraryKind = keyof typeof LIBRARY_KINDS;

export function isLibraryKind(v: unknown): v is LibraryKind {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(LIBRARY_KINDS, v);
}

/** social_content types shown under "Social Media"; everything else is "Content". */
export const SOCIAL_CONTENT_TYPES = ["caption", "hashtags", "content_idea", "repurposed", "social_post"] as const;

/** Library tabs as described in the product spec. */
export const LIBRARY_TABS = [
  { id: "designs", label: "Designs" },
  { id: "social", label: "Social Media" },
  { id: "pricing", label: "Pricing" },
  { id: "plans", label: "Marketing Plans" },
  { id: "campaigns", label: "Campaigns" },
  { id: "content", label: "Content" },
] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number]["id"];

const KIND_BY_TABLE: Record<string, LibraryKind> = Object.fromEntries(
  Object.entries(LIBRARY_KINDS).map(([k, v]) => [v.table, k as LibraryKind]),
);

export function libraryHref(table: string, id: string): string {
  const kind = KIND_BY_TABLE[table];
  if (kind === "pricing") return `/calculator?load=${id}`;
  return `/library/${kind}/${id}`;
}

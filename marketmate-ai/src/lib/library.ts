/** Saved-work kinds, their tables and URLs (client-safe). */
export const LIBRARY_KINDS = {
  content: { table: "social_content", label: "Content" },
  plans: { table: "marketing_plans", label: "Marketing plans" },
  campaigns: { table: "campaigns", label: "Campaigns" },
  pricing: { table: "pricing_calculations", label: "Pricing" },
  designs: { table: "designs", label: "Designs" },
} as const;

export type LibraryKind = keyof typeof LIBRARY_KINDS;

const KIND_BY_TABLE: Record<string, LibraryKind> = Object.fromEntries(
  Object.entries(LIBRARY_KINDS).map(([k, v]) => [v.table, k as LibraryKind]),
);

export function libraryHref(table: string, id: string): string {
  const kind = KIND_BY_TABLE[table];
  if (kind === "pricing") return `/calculator?load=${id}`;
  return `/library/${kind}/${id}`;
}

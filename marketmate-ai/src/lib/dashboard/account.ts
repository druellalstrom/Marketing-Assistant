/** Display name helpers (pure). */
export function displayNameFor(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = fullName?.trim();
  if (name) return name;
  const local = (email ?? "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : "there";
}

export function firstNameOf(displayName: string): string {
  return displayName.split(/\s+/)[0] || displayName;
}

export function initialsOf(displayName: string): string {
  const parts = displayName.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

import { describe, expect, it } from "vitest";
import { activeNavHref, NAV_ITEMS } from "./nav";

describe("activeNavHref", () => {
  it("picks the longest matching prefix", () => {
    expect(activeNavHref("/social/calendar")).toBe("/social/calendar");
    expect(activeNavHref("/social/captions")).toBe("/social");
    expect(activeNavHref("/strategy/plan")).toBe("/strategy");
    expect(activeNavHref("/library/designs/abc")).toBe("/design-studio");
    expect(activeNavHref("/library/content/abc")).toBe("/library");
    expect(activeNavHref("/dashboard")).toBe("/dashboard");
  });
  it("does not match partial segments or unknown paths", () => {
    expect(activeNavHref("/socials")).toBeNull();
    expect(activeNavHref("/search")).toBeNull();
  });
  it("has the 12 navigation items from the design", () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual([
      "Dashboard", "AI Assistant", "Design Studio", "Social Media", "Pricing & Business", "Marketing Strategy",
      "Content Studio", "Content Calendar", "My Projects", "Brand Kit", "Business Profile", "Settings",
    ]);
  });
});

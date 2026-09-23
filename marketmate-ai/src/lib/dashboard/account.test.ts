import { describe, expect, it } from "vitest";
import { displayNameFor, firstNameOf, initialsOf } from "./account";
import { buildNotifications } from "./notifications";

describe("account display", () => {
  it("prefers the full name, else a tidy email name", () => {
    expect(displayNameFor("Druell Alstrom", "x@y.z")).toBe("Druell Alstrom");
    expect(displayNameFor(null, "druell.alstrom@example.com")).toBe("Druell Alstrom");
    expect(displayNameFor("  ", null)).toBe("there");
    expect(firstNameOf("Druell Alstrom")).toBe("Druell");
    expect(initialsOf("Druell Alstrom")).toBe("DA");
    expect(initialsOf("Glow")).toBe("G");
  });
});

describe("buildNotifications", () => {
  const base = { id: "", title: "Reel", platform: "Instagram", status: "planned" };
  it("lists overdue, today and next-7-day posts, skipping posted and far-future ones", () => {
    const n = buildNotifications({
      today: "2026-09-23",
      hasBusiness: true,
      entries: [
        { ...base, id: "a", scheduled_for: "2026-09-20" },
        { ...base, id: "b", scheduled_for: "2026-09-23" },
        { ...base, id: "c", scheduled_for: "2026-09-30" },
        { ...base, id: "d", scheduled_for: "2026-10-01" },
        { ...base, id: "e", scheduled_for: "2026-09-21", status: "posted" },
      ],
    });
    expect(n.map((x) => [x.id, x.kind])).toEqual([["a", "overdue"], ["b", "today"], ["c", "upcoming"]]);
    expect(n[0].href).toBe("/social/calendar?month=2026-09");
  });
  it("adds a setup reminder when there is no business profile", () => {
    expect(buildNotifications({ today: "2026-09-23", hasBusiness: false, entries: [] })[0].kind).toBe("setup");
    expect(buildNotifications({ today: "2026-09-23", hasBusiness: true, entries: [] })).toEqual([]);
  });
});

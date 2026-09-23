import { describe, expect, it } from "vitest";
import { progressTasks, startOfMonth, startOfWeeksAgo, weeklyCounts } from "./stats";

// Wednesday 23 Sep 2026 → current week starts Monday 21 Sep.
const now = new Date("2026-09-23T15:00:00Z");

describe("weeklyCounts", () => {
  it("buckets timestamps into Monday-starting weeks, oldest first", () => {
    const b = weeklyCounts(
      ["2026-09-21T00:00:00Z", "2026-09-23T10:00:00Z", "2026-09-20T23:59:59Z", "2026-08-03T12:00:00Z", "2026-07-01T00:00:00Z", "not-a-date"],
      now,
    );
    expect(b).toHaveLength(8);
    expect(b[0].weekStart).toBe("2026-08-03");
    expect(b.at(-1)).toEqual({ weekStart: "2026-09-21", label: "Sep 21", count: 2 });
    expect(b.at(-2)!.count).toBe(1); // Sunday 20 Sep belongs to the week of 14 Sep
    expect(b[0].count).toBe(1);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(4); // July is outside the window; junk ignored
  });

  it("returns zeros with no data", () => {
    expect(weeklyCounts([], now).every((x) => x.count === 0)).toBe(true);
  });

  it("computes window and month starts", () => {
    expect(startOfWeeksAgo(now, 8)).toBe("2026-08-03T00:00:00.000Z");
    expect(startOfMonth(now)).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("progressTasks", () => {
  it("reflects real completion", () => {
    const none = progressTasks({ hasBusiness: false, hasBrandKit: false, pricingCount: 0, contentCount: 0, calendarCount: 0 });
    expect(none.completed).toBe(0);
    expect(none.tasks.map((t) => t.label)).toEqual([
      "Add your business profile", "Set up your brand kit", "Price a product", "Generate your first content", "Plan a post in the calendar",
    ]);
    const some = progressTasks({ hasBusiness: true, hasBrandKit: false, pricingCount: 2, contentCount: 0, calendarCount: 1 });
    expect(some.completed).toBe(3);
    expect(some.tasks.filter((t) => t.done).map((t) => t.key)).toEqual(["business", "price", "calendar"]);
  });
});

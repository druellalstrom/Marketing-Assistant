import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, monthGrid, monthRange, parseMonth } from "./month";

describe("calendar month helpers", () => {
  const fallback = { year: 2026, month: 9 };

  it("parses month params and rejects junk", () => {
    expect(parseMonth("2026-10", fallback)).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-13", fallback)).toEqual(fallback);
    expect(parseMonth("oct", fallback)).toEqual(fallback);
    expect(parseMonth(undefined, fallback)).toEqual(fallback);
  });

  it("adds months across year boundaries", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, 14)).toEqual({ year: 2027, month: 7 });
  });

  it("knows month lengths including leap years", () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2026, month: 9 })).toBe(30);
    expect(monthRange({ year: 2026, month: 2 })).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("builds a Monday-first grid", () => {
    // 1 Sept 2026 is a Tuesday → one leading blank.
    const grid = monthGrid({ year: 2026, month: 9 });
    expect(grid[0]).toEqual([null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    // 1 June 2026 is a Monday → no leading blanks.
    expect(monthGrid({ year: 2026, month: 6 })[0][0]).toBe("2026-06-01");
  });
});

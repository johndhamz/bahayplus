import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  daysInMonth,
  formatManilaDate,
  isIsoDate,
  isLeapYear,
  manilaDateOf,
  manilaWallTimeToUtc,
} from "@bahayplus/types/dates";

describe("dates", () => {
  it("knows leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
  });

  it("validates ISO calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("26-1-1")).toBe(false);
  });

  it("computes the Manila calendar date of a UTC instant", () => {
    // 2026-10-24T16:30Z is 00:30 on Oct 25 in Manila (UTC+8)
    expect(manilaDateOf(new Date("2026-10-24T16:30:00Z"))).toBe("2026-10-25");
    expect(manilaDateOf(new Date("2026-10-24T15:59:59Z"))).toBe("2026-10-24");
  });

  it("converts Manila wall time to UTC", () => {
    expect(manilaWallTimeToUtc("2026-11-01", 9).toISOString()).toBe("2026-11-01T01:00:00.000Z");
    expect(manilaWallTimeToUtc("2026-11-01", 0).toISOString()).toBe("2026-10-31T16:00:00.000Z");
  });

  it("adds months clamping to month end, preserving the anchor day", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsClamped("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonthsClamped("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("adds days and measures distances across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2026-10-24", "2026-11-03")).toBe(10);
    expect(daysBetween("2026-11-03", "2026-10-24")).toBe(-10);
  });

  it("formats calendar dates without shifting the day", () => {
    expect(formatManilaDate("2026-01-01")).toMatch(/Jan.*1.*2026/);
  });
});

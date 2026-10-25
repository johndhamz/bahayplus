import { describe, expect, it } from "vitest";
import { isRetryableStatus, renderEmail, retryDelaySeconds } from "@bahayplus/modules/notifications";
import { manilaDayOf, monthGrid, monthRange, shiftMonth } from "@bahayplus/modules/scheduling";
import { MarkReadInput, UpdatePreferencesInput } from "@bahayplus/validation/notifications/notifications";
import { AssignCalendarItemInput, CalendarQuery } from "@bahayplus/validation/scheduling/calendar";
import { UrgentSearchInput } from "@bahayplus/validation/marketplace/urgent";

describe("delivery retry policy", () => {
  it("backs off exponentially from 30 seconds and caps at one hour", () => {
    expect([1, 2, 3, 4].map(retryDelaySeconds)).toEqual([30, 60, 120, 240]);
    expect(retryDelaySeconds(20)).toBe(3600);
  });
  it("retries timeouts, rate limits and server errors only", () => {
    expect([408, 429, 500, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 422].some(isRetryableStatus)).toBe(false);
  });
});

describe("email rendering", () => {
  const message = {
    deliveryId: "d",
    attempt: 1,
    to: "a@b.ph",
    title: 'Bill <script>alert("x")</script>',
    body: "Due Nov 1 & 2",
    link: "/app/h/1/bills/2",
    kind: "bill.reminder",
  };
  it("escapes user-controlled text and makes links absolute", () => {
    const email = renderEmail(message, "https://bahayplus.ph");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Due Nov 1 &amp; 2");
    expect(email.text).toContain("https://bahayplus.ph/app/h/1/bills/2");
    expect(email.text).toContain("https://bahayplus.ph/account/notifications/settings");
    expect(email.subject).toBe(message.title);
  });
});

describe("calendar month math (Asia/Manila)", () => {
  it("handles month lengths and leap years", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(monthRange("2026-12").to).toBe("2026-12-31");
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("buckets timed items by Manila date, not UTC date", () => {
    // 16:30 UTC on Oct 31 is 00:30 on Nov 1 in Manila.
    expect(manilaDayOf({ allDayOn: null, startsAt: "2026-10-31T16:30:00Z" })).toBe("2026-11-01");
    expect(manilaDayOf({ allDayOn: null, startsAt: "2026-10-31T15:59:00Z" })).toBe("2026-10-31");
    expect(manilaDayOf({ allDayOn: "2026-11-05", startsAt: null })).toBe("2026-11-05");
  });
  it("builds a Monday-first grid", () => {
    const grid = monthGrid("2026-11"); // Nov 1 2026 is a Sunday
    expect(grid[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});

describe("Phase 8 contracts", () => {
  it("drops invalid calendar filters instead of failing", () => {
    expect(CalendarQuery.parse({ month: "2026-13", category: "nope", property: "x", scope: "everyone" })).toEqual({
      month: undefined,
      category: undefined,
      property: undefined,
      member: undefined,
      scope: "household",
    });
    expect(CalendarQuery.parse({ month: "2026-11", category: "pets", member: "unassigned" })).toMatchObject({
      month: "2026-11",
      category: "pets",
      member: "unassigned",
    });
  });
  it("validates calendar item keys and unassignment", () => {
    const householdId = "20000000-0000-4000-8000-000000000001";
    expect(
      AssignCalendarItemInput.parse({ householdId, itemKey: `booking:${householdId}`, userId: "" }).userId,
    ).toBeNull();
    expect(
      AssignCalendarItemInput.safeParse({ householdId, itemKey: "booking:'; drop table", userId: "" }).success,
    ).toBe(false);
  });
  it("refuses SMS/push preferences and requires an urgent category", () => {
    expect(
      UpdatePreferencesInput.safeParse({ preferences: [{ category: "bills", channel: "sms", enabled: true }] }).success,
    ).toBe(false);
    expect(
      UpdatePreferencesInput.safeParse({ preferences: [{ category: "bills", channel: "email", enabled: false }] })
        .success,
    ).toBe(true);
    expect(MarkReadInput.safeParse({ all: true }).success).toBe(true);
    expect(UrgentSearchInput.safeParse({ category: "aircon", province: "Metro Manila" }).success).toBe(false);
    expect(UrgentSearchInput.safeParse({ category: "locksmith", province: "Metro Manila" }).success).toBe(true);
  });
});

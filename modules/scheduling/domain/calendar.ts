import type { CalendarCategory } from "@bahayplus/validation/scheduling/calendar";

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  bills: "Utility bills",
  assets: "Asset maintenance",
  pets: "Pet care",
  vehicles: "Vehicles",
  bookings: "Service bookings",
  projects: "Renovation",
};

/** First and last Manila calendar dates of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The Manila calendar date an item belongs to: its all-day date, or its start instant in Manila. */
export function manilaDayOf(item: { allDayOn: string | null; startsAt: string | null }): string {
  if (item.allDayOn) return item.allDayOn;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(item.startsAt!));
}

/**
 * Month grid (Monday-first) as weeks of ISO dates; days outside the month are null.
 */
export function monthGrid(month: string): (string | null)[][] {
  const { to } = monthRange(month);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  const days = Number(to.slice(8));
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

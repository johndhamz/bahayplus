/**
 * Time rules for Bahay+:
 *  - Instants are stored and transported as UTC ISO strings.
 *  - Calendar dates (due dates, birthdays) are "YYYY-MM-DD" strings interpreted in Asia/Manila.
 *  - Never derive a Manila date from the machine's local timezone.
 */
export const APP_TIME_ZONE = "Asia/Manila" as const;

export type IsoDate = string; // YYYY-MM-DD (Manila calendar date)

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month1to12: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month1to12 - 1]!;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isIsoDate(value: string): value is IsoDate {
  return parseIsoDate(value) !== null;
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const manilaDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Manila calendar date of an instant. */
export function manilaDateOf(instant: Date): IsoDate {
  return manilaDateParts.format(instant);
}

/** Add whole days to a calendar date (no timezone involved). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const p = parseIsoDate(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Add calendar months, clamping to the last day of the target month
 * (Jan 31 + 1 month = Feb 28/29). `anchorDay` preserves the intended day across short months.
 */
export function addMonthsClamped(date: IsoDate, months: number, anchorDay?: number): IsoDate {
  const p = parseIsoDate(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  const total = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(anchorDay ?? p.day, daysInMonth(year, month));
  return toIsoDate(year, month, day);
}

/** Difference in whole days, b - a. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  if (!pa || !pb) throw new RangeError("Invalid ISO date");
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

/** UTC instant for a wall-clock time in Manila. Manila is UTC+8 with no DST. */
export function manilaWallTimeToUtc(date: IsoDate, hour = 0, minute = 0): Date {
  const p = parseIsoDate(date);
  if (!p) throw new RangeError(`Invalid ISO date: ${date}`);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, hour - 8, minute));
}

const displayDate = new Intl.DateTimeFormat("en-PH", { timeZone: APP_TIME_ZONE, dateStyle: "medium" });
const displayDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatManilaDate(value: IsoDate | Date): string {
  if (typeof value === "string") {
    const p = parseIsoDate(value);
    if (!p) return value;
    // Noon UTC keeps the same calendar day in Manila.
    return displayDate.format(new Date(Date.UTC(p.year, p.month - 1, p.day, 4)));
  }
  return displayDate.format(value);
}

export function formatManilaDateTime(value: Date | string): string {
  return displayDateTime.format(typeof value === "string" ? new Date(value) : value);
}

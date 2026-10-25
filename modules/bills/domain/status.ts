import { daysBetween, daysInMonth, parseIsoDate, toIsoDate, type IsoDate } from "@bahayplus/types/dates";
import type { BillType, PaymentMethod } from "@bahayplus/validation/finance/bills";

export type StoredBillStatus = "awaiting_amount" | "unpaid" | "partially_paid" | "paid";
export type BillDisplayStatus = StoredBillStatus | "overdue";

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  electricity: "Electricity",
  water: "Water",
  internet: "Internet",
  telecom: "Mobile / telecom",
  association_dues: "HOA / condo dues",
  rent: "Rent",
  insurance: "Insurance",
  custom: "Other bill",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  over_the_counter: "Over the counter",
  credit_card: "Credit card",
  debit_card: "Debit card",
  cash: "Cash",
  auto_debit: "Auto-debit",
  other: "Other",
};

/** Common Philippine billers, offered as suggestions (users can type any biller). */
export const BILLER_SUGGESTIONS: Partial<Record<BillType, string[]>> = {
  electricity: ["Meralco", "VECO", "Davao Light", "BENECO"],
  water: ["Maynilad", "Manila Water", "Laguna Water", "Davao City Water District"],
  internet: ["PLDT Home", "Globe At Home", "Converge", "Sky Fiber"],
  telecom: ["Globe", "Smart", "DITO", "TNT"],
};

/** Mirrors private.clamped_day: day `dueDay` of the month, clamped to month end (31 → Feb 28/29). */
export function dueDateForMonth(year: number, month: number, dueDay: number): IsoDate {
  return toIsoDate(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

/** Overdue is derived at read time from the Manila calendar date, never stored. */
export function billDisplayStatus(
  bill: { status: StoredBillStatus; dueOn: IsoDate },
  today: IsoDate,
): BillDisplayStatus {
  if (bill.status !== "paid" && daysBetween(today, bill.dueOn) < 0) return "overdue";
  return bill.status;
}

export function billBalance(bill: { amountDueCentavos: number | null; amountPaidCentavos: number }) {
  if (bill.amountDueCentavos === null) return { remainingCentavos: null, creditCentavos: 0 };
  const diff = bill.amountDueCentavos - bill.amountPaidCentavos;
  return { remainingCentavos: Math.max(diff, 0), creditCentavos: Math.max(-diff, 0) };
}

export function reminderOffsetLabel(offset: number): string {
  if (offset === 0) return "On the due date";
  if (offset > 0) return `${offset} day${offset === 1 ? "" : "s"} before`;
  return `${-offset} day${offset === -1 ? "" : "s"} after (overdue follow-up)`;
}

export function periodLabel(periodKey: string): string {
  const p = parseIsoDate(`${periodKey}-01`);
  if (!p) return periodKey;
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(p.year, p.month - 1, 1)),
  );
}

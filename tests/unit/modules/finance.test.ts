import { describe, expect, it } from "vitest";
import {
  billBalance,
  billDisplayStatus,
  dueDateForMonth,
  periodLabel,
  reminderOffsetLabel,
} from "@bahayplus/modules/bills";
import { budgetProgress, percentLabel } from "@bahayplus/modules/budgets";
import { CreateBillAccountInput, RecordBillPaymentInput } from "@bahayplus/validation/finance/bills";
import { SaveBudgetInput } from "@bahayplus/validation/finance/budgets";

const HH = "20000000-0000-4000-8000-000000000001";

describe("due dates", () => {
  it("clamps to month end, including leap years", () => {
    expect(dueDateForMonth(2026, 2, 31)).toBe("2026-02-28");
    expect(dueDateForMonth(2028, 2, 31)).toBe("2028-02-29");
    expect(dueDateForMonth(2028, 2, 29)).toBe("2028-02-29");
    expect(dueDateForMonth(2026, 4, 31)).toBe("2026-04-30");
    expect(dueDateForMonth(2026, 12, 15)).toBe("2026-12-15");
  });
});

describe("bill status", () => {
  it("derives overdue from the Manila date only for unpaid bills", () => {
    expect(billDisplayStatus({ status: "unpaid", dueOn: "2026-10-24" }, "2026-10-25")).toBe("overdue");
    expect(billDisplayStatus({ status: "unpaid", dueOn: "2026-10-25" }, "2026-10-25")).toBe("unpaid");
    expect(billDisplayStatus({ status: "partially_paid", dueOn: "2026-10-01" }, "2026-10-25")).toBe("overdue");
    expect(billDisplayStatus({ status: "awaiting_amount", dueOn: "2026-10-01" }, "2026-10-25")).toBe("overdue");
    expect(billDisplayStatus({ status: "paid", dueOn: "2026-10-01" }, "2026-10-25")).toBe("paid");
  });

  it("computes remaining balance and credit after statement corrections", () => {
    expect(billBalance({ amountDueCentavos: 245_075, amountPaidCentavos: 100_000 })).toEqual({
      remainingCentavos: 145_075,
      creditCentavos: 0,
    });
    expect(billBalance({ amountDueCentavos: 90_000, amountPaidCentavos: 100_000 })).toEqual({
      remainingCentavos: 0,
      creditCentavos: 10_000,
    });
    expect(billBalance({ amountDueCentavos: null, amountPaidCentavos: 0 })).toEqual({
      remainingCentavos: null,
      creditCentavos: 0,
    });
  });

  it("labels reminder offsets and periods", () => {
    expect(reminderOffsetLabel(7)).toBe("7 days before");
    expect(reminderOffsetLabel(1)).toBe("1 day before");
    expect(reminderOffsetLabel(0)).toBe("On the due date");
    expect(reminderOffsetLabel(-3)).toBe("3 days after (overdue follow-up)");
    expect(periodLabel("2026-02")).toBe("February 2026");
  });
});

describe("budget progress", () => {
  it("uses integer basis points and warns from 80%", () => {
    expect(budgetProgress(null, 500)).toEqual({ state: "no_limit", basisPoints: null });
    expect(budgetProgress(300_000, 245_075)).toEqual({ state: "warning", basisPoints: 8169 });
    expect(budgetProgress(300_000, 100_000)).toEqual({ state: "on_track", basisPoints: 3333 });
    expect(budgetProgress(300_000, 300_000)).toEqual({ state: "warning", basisPoints: 10_000 });
    expect(budgetProgress(300_000, 300_001)).toMatchObject({ state: "over" });
    expect(budgetProgress(0, 0)).toEqual({ state: "on_track", basisPoints: 0 });
    expect(percentLabel(8169)).toBe("81%");
  });
});

describe("finance contracts", () => {
  const base = {
    householdId: HH,
    billType: "electricity",
    providerName: "Meralco",
    amountType: "variable",
    dueDay: "15",
  };

  it("keeps only the last 4 characters of an account number and de-duplicates reminder offsets", () => {
    const v = CreateBillAccountInput.parse({
      ...base,
      accountNumberLast4: "1234-5678-9012",
      reminderOffsets: [0, 7, 7, -3],
    });
    expect(v.accountNumberLast4).toBe("9012");
    expect(v.reminderOffsets).toEqual([7, 0, -3]);
  });

  it("requires a fixed amount for fixed bills and a due day for recurring ones", () => {
    expect(CreateBillAccountInput.safeParse({ ...base, amountType: "fixed" }).success).toBe(false);
    expect(CreateBillAccountInput.safeParse({ ...base, dueDay: "" }).success).toBe(false);
    expect(CreateBillAccountInput.safeParse({ ...base, isRecurring: false, dueDay: "" }).success).toBe(true);
    expect(CreateBillAccountInput.safeParse({ ...base, dueDay: "32" }).success).toBe(false);
  });

  it("parses payment amounts exactly and rejects zero", () => {
    const p = RecordBillPaymentInput.parse({
      billId: HH,
      amountCentavos: "₱2,450.75",
      paidOn: "2026-10-25",
      method: "gcash",
      idempotencyKey: "abcdefgh",
    });
    expect(p.amountCentavos).toBe(245_075);
    expect(
      RecordBillPaymentInput.safeParse({
        billId: HH,
        amountCentavos: "0",
        paidOn: "2026-10-25",
        method: "gcash",
        idempotencyKey: "abcdefgh",
      }).success,
    ).toBe(false);
  });

  it("drops empty budget lines", () => {
    const v = SaveBudgetInput.parse({
      householdId: HH,
      month: "2026-10",
      lines: [
        { categoryId: HH, limitCentavos: "" },
        { categoryId: HH, limitCentavos: "5,000" },
      ],
    });
    expect(v.lines).toEqual([{ categoryId: HH, limitCentavos: 500_000 }]);
  });
});

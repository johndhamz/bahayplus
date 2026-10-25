import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptHouseholdInvitation, createHousehold, inviteHouseholdMember } from "@bahayplus/modules/households";
import {
  cancelBillReminder,
  createBill,
  createBillAccount,
  getBill,
  listBillPayments,
  listBillReminders,
  listBills,
  recordBillPayment,
  setBillAmount,
  voidBillPayment,
} from "@bahayplus/modules/bills";
import {
  budgetVsActual,
  createExpense,
  listCategories,
  listExpenses,
  saveBudget,
  voidExpense,
} from "@bahayplus/modules/budgets";
import { listFiles, prepareUpload, registerFile } from "@bahayplus/modules/files";
import { manilaDateOf } from "@bahayplus/types/dates";
import { clearJobRuns } from "../support/db";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

const today = manilaDateOf(new Date());
const thisMonth = today.slice(0, 7);
const pay = (user: TestUser, billId: string, amount: string, key = randomUUID(), extra: Record<string, unknown> = {}) =>
  recordBillPayment(user.ctx, {
    billId,
    amountCentavos: amount,
    paidOn: today,
    method: "gcash",
    reference: "",
    idempotencyKey: key,
    ...extra,
  });

async function billFor(user: TestUser, householdId: string, accountId: string, periodKey: string) {
  const bills = unwrap(await listBills(user.ctx, householdId, { accountId, limit: 500 }));
  const bill = bills.find((b) => b.periodKey === periodKey);
  if (!bill) throw new Error(`no bill for ${periodKey}: ${bills.map((b) => b.periodKey).join(",")}`);
  return bill;
}

let owner: TestUser;
let member: TestUser; // bills.view only
let limited: TestUser; // no finance access
let outsider: TestUser;
let household: string;
let fixedAccount: string; // ₱1,500.00 HOA dues, due day 31, from Jan 2026
let variableAccount: string; // Meralco, due day 15

beforeAll(async () => {
  // The job ledger persists across test runs; clear the simulated dates used below.
  await clearJobRuns(["2028-03-10", "2026-03-01", "2026-03-02"]);
  [owner, member, limited, outsider] = await Promise.all([
    createTestUser("bill-owner"),
    createTestUser("bill-member"),
    createTestUser("bill-limited"),
    createTestUser("bill-outsider"),
  ]);
  household = unwrap(await createHousehold(owner.ctx, { name: "Bills test" })).householdId;
  unwrap(await createHousehold(outsider.ctx, { name: "Outsider home" }));
  for (const [user, role] of [
    [member, "member"],
    [limited, "limited"],
  ] as const) {
    const inv = unwrap(await inviteHouseholdMember(owner.ctx, { householdId: household, email: user.email, role }));
    unwrap(await acceptHouseholdInvitation(user.ctx, { token: inv.token }));
  }
  fixedAccount = unwrap(
    await createBillAccount(owner.ctx, {
      householdId: household,
      billType: "association_dues",
      providerName: "Greenview HOA",
      amountType: "fixed",
      fixedAmountCentavos: "1,500",
      dueDay: "31",
      startsOn: "2026-01-01",
      accountNumberLast4: "ACC-0099-8812",
    }),
  ).accountId;
  variableAccount = unwrap(
    await createBillAccount(owner.ctx, {
      householdId: household,
      billType: "electricity",
      providerName: "Meralco",
      amountType: "variable",
      dueDay: "15",
      startsOn: `${thisMonth}-01`,
    }),
  ).accountId;
});
afterAll(cleanupTestUsers);

describe("billing periods", () => {
  it("catches up from the start month, clamps month-end due dates and stores only the last 4 digits", async () => {
    const bills = unwrap(await listBills(owner.ctx, household, { accountId: fixedAccount, limit: 500 }));
    const keys = bills.map((b) => b.periodKey);
    expect(keys).toContain("2026-01");
    expect(keys).toContain(thisMonth);
    expect(new Set(keys).size).toBe(keys.length);
    expect(bills.find((b) => b.periodKey === "2026-02")?.dueOn).toBe("2026-02-28");
    expect(bills.find((b) => b.periodKey === "2026-04")?.dueOn).toBe("2026-04-30");
    expect(bills.find((b) => b.periodKey === "2026-01")?.dueOn).toBe("2026-01-31");
    const { data } = await adminClient()
      .from("bill_accounts")
      .select("account_number_last4")
      .eq("id", fixedAccount)
      .single();
    expect(data?.account_number_last4).toBe("8812");
  });

  it("is idempotent: generating again creates no duplicates", async () => {
    const before = unwrap(await listBills(owner.ctx, household, { accountId: fixedAccount, limit: 500 })).length;
    const { error } = await adminClient().rpc("run_daily_bill_jobs", { p_today: today });
    expect(error).toBeNull();
    await adminClient().rpc("run_daily_bill_jobs", { p_today: today });
    const after = unwrap(await listBills(owner.ctx, household, { accountId: fixedAccount, limit: 500 })).length;
    expect(after).toBe(before);
  });

  it("catches up missed scheduler runs once, including leap-year February", async () => {
    const admin = adminClient();
    const first = await admin.rpc("run_daily_bill_jobs", { p_today: "2028-03-10" });
    expect(first.error).toBeNull();
    const again = await admin.rpc("run_daily_bill_jobs", { p_today: "2028-03-10" });
    expect(again.data).toMatchObject({ skipped: true });
    const bills = unwrap(await listBills(owner.ctx, household, { accountId: fixedAccount, limit: 500 }));
    expect(bills.find((b) => b.periodKey === "2028-02")?.dueOn).toBe("2028-02-29");
    expect(bills.find((b) => b.periodKey === "2028-04")).toBeDefined(); // one month ahead
    expect(bills.filter((b) => b.periodKey === "2027-06")).toHaveLength(1);
  });

  it("variable bills wait for the statement amount", async () => {
    const bill = await billFor(owner, household, variableAccount, thisMonth);
    expect(bill.status).toBe("awaiting_amount");
    const early = await pay(owner, bill.id, "100");
    expect(early.ok || early.error.reason).toBe("amount_required");
    unwrap(await setBillAmount(owner.ctx, { billId: bill.id, amountCentavos: "2,450.75" }));
    expect(unwrap(await getBill(owner.ctx, bill.id))).toMatchObject({ amountDueCentavos: 245_075, status: "unpaid" });
  });

  it("refuses duplicate one-off bills for the same account and month", async () => {
    const dup = await createBill(owner.ctx, {
      accountId: fixedAccount,
      dueOn: `${thisMonth}-20`,
      amountCentavos: "10",
    });
    expect(dup.ok || dup.error.reason).toBe("duplicate_bill");
  });
});

describe("recording payments", () => {
  let billId: string;

  beforeAll(async () => {
    billId = (await billFor(owner, household, variableAccount, thisMonth)).id;
  });

  it("supports partial payments and exact completion", async () => {
    unwrap(await pay(owner, billId, "1,000"));
    expect(unwrap(await getBill(owner.ctx, billId))).toMatchObject({
      status: "partially_paid",
      amountPaidCentavos: 100_000,
      remainingCentavos: 145_075,
    });
  });

  it("rejects overpayment with the remaining balance", async () => {
    const over = await pay(owner, billId, "1,450.76");
    expect(over.ok || over.error.reason).toBe("overpayment");
    if (!over.ok) expect(over.error.message).toContain("₱1,450.75");
  });

  it("treats duplicate submissions with the same key as one payment", async () => {
    const key = randomUUID();
    const a = unwrap(await pay(owner, billId, "50", key));
    const b = unwrap(await pay(owner, billId, "50", key));
    expect(b.paymentId).toBe(a.paymentId);
    const different = await pay(owner, billId, "60", key);
    expect(different.ok || different.error.code).toBe("IDEMPOTENCY_MISMATCH");
    expect(unwrap(await listBillPayments(owner.ctx, billId)).filter((p) => !p.voidedAt)).toHaveLength(2);
  });

  it("serialises concurrent payments so the total never exceeds the bill", async () => {
    const remaining = unwrap(await getBill(owner.ctx, billId)).remainingCentavos!;
    const amount = (remaining / 100).toFixed(2);
    const results = await Promise.all([pay(owner, billId, amount), pay(owner, billId, amount)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && ["already_paid", "overpayment"]).toContain(
      failed && !failed.ok ? failed.error.reason : "",
    );
    expect(unwrap(await getBill(owner.ctx, billId))).toMatchObject({ status: "paid", remainingCentavos: 0 });
  });

  it("members can view but not record; outsiders and limited members see nothing", async () => {
    expect(unwrap(await listBills(member.ctx, household, { limit: 5 })).length).toBeGreaterThan(0);
    const memberPay = await pay(member, billId, "1");
    expect(memberPay.ok || memberPay.error.code).toBe("FORBIDDEN");
    expect(unwrap(await listBills(limited.ctx, household))).toEqual([]);
    expect(unwrap(await listBills(outsider.ctx, household))).toEqual([]);
    const outsiderPay = await pay(outsider, billId, "1");
    expect(outsiderPay.ok || outsiderPay.error.code).toBe("NOT_FOUND");
    const direct = await owner.client.from("bill_payments").insert({
      household_id: household,
      bill_id: billId,
      amount_centavos: 1,
      paid_on: today,
      method: "cash",
      idempotency_key: randomUUID(),
      request_hash: "x",
    });
    expect(direct.error).not.toBeNull(); // payments only through record_bill_payment
  });

  it("rejects future payment dates", async () => {
    const fixedBill = await billFor(owner, household, fixedAccount, thisMonth);
    const future = await pay(owner, fixedBill.id, "1", randomUUID(), { paidOn: "2099-01-01" });
    expect(future.ok || future.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("reminders", () => {
  it("are scheduled from the account's offsets and suppressed once fully paid", async () => {
    // 2028-04 is beyond the simulated 2028-03-10 job run above, so its reminders are still scheduled.
    const bill = await billFor(owner, household, fixedAccount, "2028-04");
    const reminders = unwrap(await listBillReminders(owner.ctx, bill.id));
    expect(reminders.map((r) => r.offsetDays).sort((a, b) => a - b)).toEqual([-3, 0, 1, 3, 7]);
    expect(reminders.find((r) => r.offsetDays === -3)?.remindOn).toBe("2028-05-03"); // due Apr 30 + 3 days
    // Record the full amount → every scheduled reminder is cancelled.
    unwrap(await pay(owner, bill.id, "1,500"));
    const after = unwrap(await listBillReminders(owner.ctx, bill.id));
    expect(after.every((r) => r.status === "cancelled" && r.cancelReason === "paid")).toBe(true);
  });

  it("voiding a payment reinstates future reminders, but not ones the user cancelled", async () => {
    const oneOff = unwrap(
      await createBill(owner.ctx, { accountId: fixedAccount, dueOn: "2028-05-31", amountCentavos: "1,500" }),
    );
    const bill = unwrap(await getBill(owner.ctx, oneOff.billId));
    const userCancelled = unwrap(await listBillReminders(owner.ctx, bill.id)).find((r) => r.offsetDays === 7)!;
    unwrap(await cancelBillReminder(owner.ctx, { reminderId: userCancelled.id }));
    const payment = unwrap(await pay(owner, bill.id, "1,500"));
    unwrap(await voidBillPayment(owner.ctx, { paymentId: payment.paymentId, reason: "Entered twice" }));
    const reminders = unwrap(await listBillReminders(owner.ctx, bill.id));
    expect(reminders.find((r) => r.offsetDays === 7)).toMatchObject({ status: "cancelled", cancelReason: "user" });
    expect(reminders.filter((r) => r.offsetDays !== 7).every((r) => r.status === "scheduled")).toBe(true);
    expect(unwrap(await getBill(owner.ctx, bill.id)).status).toBe("unpaid");
  });

  it("are delivered exactly once to members who can see bills, skipping paid bills", async () => {
    const admin = adminClient();
    // A fresh household with one open and one paid bill, both with reminders due.
    const solo = await createTestUser("bill-solo");
    const hh = unwrap(await createHousehold(solo.ctx, { name: "Reminder home" })).householdId;
    const acc = unwrap(
      await createBillAccount(solo.ctx, {
        householdId: hh,
        billType: "water",
        providerName: "Maynilad",
        amountType: "fixed",
        fixedAmountCentavos: "300",
        dueDay: "5",
        startsOn: "2026-01-01",
        reminderOffsets: [0],
      }),
    ).accountId;
    const open = await billFor(solo, hh, acc, "2026-01");
    const paid = await billFor(solo, hh, acc, "2026-02");
    unwrap(await pay(solo, paid.id, "300"));
    const processed = await admin.rpc("run_daily_bill_jobs", { p_today: "2026-03-01" });
    expect(processed.error).toBeNull();
    await admin.rpc("run_daily_bill_jobs", { p_today: "2026-03-02" });
    const { data: notes } = await solo.client.from("notifications").select("link, dedupe_key");
    const links = (notes ?? []).map((n) => n.link);
    expect(links.filter((l) => l?.endsWith(open.id))).toHaveLength(1);
    expect(links.some((l) => l?.endsWith(paid.id))).toBe(false);
    expect((await outsider.client.from("notifications").select("id").eq("household_id", hh)).data).toEqual([]);
  });
});

describe("budgets and expenses (no double counting)", () => {
  it("creates exactly one expense per recorded payment and removes it when voided", async () => {
    const bill = await billFor(owner, household, fixedAccount, "2026-03");
    const payment = unwrap(await pay(owner, bill.id, "1,500"));
    const { data: linked } = await adminClient()
      .from("expenses")
      .select("id, amount_centavos, voided_at")
      .eq("source_id", payment.paymentId);
    expect(linked).toHaveLength(1);
    expect(linked![0]!.amount_centavos).toBe(150_000);
    // The database refuses a second expense for the same payment, even from the service role.
    const duplicate = await adminClient()
      .from("expenses")
      .insert({
        household_id: household,
        category_id: (await listCategories(owner.ctx, household).then(unwrap))[0]!.id,
        amount_centavos: 150_000,
        spent_on: today,
        source_type: "bill_payment",
        source_id: payment.paymentId,
      });
    expect(duplicate.error?.code).toBe("23505");
    // Users cannot fake a bill-payment expense or void one directly.
    const fake = await owner.client.from("expenses").insert({
      household_id: household,
      category_id: linked![0]!.id,
      amount_centavos: 1,
      spent_on: today,
      source_type: "bill_payment",
      source_id: payment.paymentId,
    } as never);
    expect(fake.error).not.toBeNull();
    expect((await voidExpense(owner.ctx, { expenseId: linked![0]!.id })).ok).toBe(false);
    unwrap(await voidBillPayment(owner.ctx, { paymentId: payment.paymentId, reason: "Wrong bill" }));
    const { data: after } = await adminClient()
      .from("expenses")
      .select("voided_at")
      .eq("source_id", payment.paymentId)
      .single();
    expect(after?.voided_at).not.toBeNull();
  });

  it("budget vs actual counts each payment once and supports manual expenses", async () => {
    const categories = unwrap(await listCategories(owner.ctx, household));
    const utilities = categories.find((c) => c.name === "Utilities")!;
    const groceries = categories.find((c) => c.name === "Groceries & market")!;
    unwrap(
      await saveBudget(owner.ctx, {
        householdId: household,
        month: thisMonth,
        lines: [
          { categoryId: utilities.id, limitCentavos: "3,000" },
          { categoryId: groceries.id, limitCentavos: "10,000" },
        ],
      }),
    );
    unwrap(
      await createExpense(owner.ctx, {
        householdId: household,
        categoryId: groceries.id,
        amountCentavos: "8,500.25",
        spentOn: today,
        description: "Palengke",
        paymentMethod: "cash",
      }),
    );
    const rows = unwrap(await budgetVsActual(owner.ctx, household, thisMonth));
    const util = rows.find((r) => r.categoryId === utilities.id)!;
    // Meralco bill this month: ₱2,450.75 fully paid across several payments → counted once in total.
    expect(util.spentCentavos).toBe(245_075);
    expect(util.state).toBe("warning"); // 81% of ₱3,000
    expect(rows.find((r) => r.categoryId === groceries.id)).toMatchObject({
      spentCentavos: 850_025,
      state: "warning",
      basisPoints: 8500,
    });
    expect(unwrap(await listExpenses(member.ctx, household, { monthKey: thisMonth })).length).toBeGreaterThan(0);
    expect(
      (
        await createExpense(member.ctx, {
          householdId: household,
          categoryId: groceries.id,
          amountCentavos: "1",
          spentOn: today,
        })
      ).ok,
    ).toBe(false);
    expect(unwrap(await budgetVsActual(outsider.ctx, household, thisMonth))).toEqual([]);
    expect(unwrap(await listExpenses(limited.ctx, household))).toEqual([]);
  });
});

describe("statements and receipts", () => {
  const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\n");

  it("are private to members who can see bills", async () => {
    const bill = await billFor(owner, household, variableAccount, thisMonth);
    const prepared = unwrap(
      await prepareUpload(owner.ctx, {
        householdId: household,
        entityType: "bill",
        entityId: bill.id,
        purpose: "statement",
        fileName: "meralco.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
      }),
    );
    expect(
      (
        await owner.client.storage
          .from("household-files")
          .upload(prepared.objectPath, PDF, { contentType: "application/pdf" })
      ).error,
    ).toBeNull();
    unwrap(
      await registerFile(owner.ctx, {
        householdId: household,
        entityType: "bill",
        entityId: bill.id,
        purpose: "statement",
        fileName: "meralco.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
        objectPath: prepared.objectPath,
      }),
    );
    expect(unwrap(await listFiles(member.ctx, "bill", bill.id))).toHaveLength(1);
    expect(unwrap(await listFiles(limited.ctx, "bill", bill.id))).toEqual([]);
    expect(unwrap(await listFiles(outsider.ctx, "bill", bill.id))).toEqual([]);
    expect((await limited.client.storage.from("household-files").download(prepared.objectPath)).error).not.toBeNull();
    expect(
      (await outsider.client.storage.from("household-files").createSignedUrl(prepared.objectPath, 60)).error,
    ).not.toBeNull();
    const memberUpload = await prepareUpload(member.ctx, {
      householdId: household,
      entityType: "bill",
      entityId: bill.id,
      purpose: "receipt",
      fileName: "r.pdf",
      contentType: "application/pdf",
      sizeBytes: PDF.length,
    });
    expect(memberUpload.ok).toBe(false);
  });
});

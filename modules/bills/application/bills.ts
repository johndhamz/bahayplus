import {
  BillAccountIdInput,
  CreateBillAccountInput,
  CreateBillInput,
  DEFAULT_CATEGORY_KEY,
  RecordBillPaymentInput,
  ReminderIdInput,
  SetBillAmountInput,
  UpdateBillAccountInput,
  VoidBillPaymentInput,
  type BillType,
  type PaymentMethod,
} from "@bahayplus/validation/finance/bills";
import { manilaDateOf } from "@bahayplus/types/dates";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import { billBalance, billDisplayStatus, type BillDisplayStatus, type StoredBillStatus } from "../domain/status";

export type BillAccountView = {
  id: string;
  householdId: string;
  propertyId: string | null;
  propertyName: string | null;
  billType: BillType;
  providerName: string;
  nickname: string;
  accountNumberLast4: string;
  categoryId: string;
  amountType: "fixed" | "variable";
  fixedAmountCentavos: number | null;
  isRecurring: boolean;
  dueDay: number | null;
  startsOn: string;
  endsOn: string | null;
  reminderOffsets: number[];
  archivedAt: string | null;
};

export type BillView = {
  id: string;
  householdId: string;
  accountId: string;
  accountLabel: string;
  billType: BillType;
  propertyId: string | null;
  periodKey: string;
  dueOn: string;
  amountDueCentavos: number | null;
  amountPaidCentavos: number;
  remainingCentavos: number | null;
  creditCentavos: number;
  status: StoredBillStatus;
  displayStatus: BillDisplayStatus;
  notes: string;
};

export type BillPaymentView = {
  id: string;
  amountCentavos: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type BillReminderView = {
  id: string;
  offsetDays: number;
  remindOn: string;
  status: "scheduled" | "sent" | "cancelled";
  cancelReason: string | null;
};

const ACCOUNT_COLUMNS =
  "id, household_id, property_id, bill_type, provider_name, nickname, account_number_last4, category_id, amount_type, fixed_amount_centavos, is_recurring, due_day, starts_on, ends_on, reminder_offsets, archived_at, properties(name)";

type AccountRow = {
  id: string;
  household_id: string;
  property_id: string | null;
  bill_type: string;
  provider_name: string;
  nickname: string;
  account_number_last4: string;
  category_id: string;
  amount_type: string;
  fixed_amount_centavos: number | null;
  is_recurring: boolean;
  due_day: number | null;
  starts_on: string;
  ends_on: string | null;
  reminder_offsets: number[];
  archived_at: string | null;
  properties: { name: string } | null;
};

const toAccount = (r: AccountRow): BillAccountView => ({
  id: r.id,
  householdId: r.household_id,
  propertyId: r.property_id,
  propertyName: r.properties?.name ?? null,
  billType: r.bill_type as BillType,
  providerName: r.provider_name,
  nickname: r.nickname,
  accountNumberLast4: r.account_number_last4,
  categoryId: r.category_id,
  amountType: r.amount_type as "fixed" | "variable",
  fixedAmountCentavos: r.fixed_amount_centavos,
  isRecurring: r.is_recurring,
  dueDay: r.due_day,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  reminderOffsets: r.reminder_offsets ?? [],
  archivedAt: r.archived_at,
});

const BILL_COLUMNS =
  "id, household_id, bill_account_id, period_key, due_on, amount_due_centavos, amount_paid_centavos, status, notes, bill_accounts!inner(provider_name, nickname, bill_type, property_id)";

type BillRow = {
  id: string;
  household_id: string;
  bill_account_id: string;
  period_key: string;
  due_on: string;
  amount_due_centavos: number | null;
  amount_paid_centavos: number;
  status: string;
  notes: string;
  bill_accounts: { provider_name: string; nickname: string; bill_type: string; property_id: string | null };
};

function toBill(r: BillRow, today: string): BillView {
  const status = r.status as StoredBillStatus;
  const balance = billBalance({ amountDueCentavos: r.amount_due_centavos, amountPaidCentavos: r.amount_paid_centavos });
  return {
    id: r.id,
    householdId: r.household_id,
    accountId: r.bill_account_id,
    accountLabel: r.bill_accounts.nickname || r.bill_accounts.provider_name,
    billType: r.bill_accounts.bill_type as BillType,
    propertyId: r.bill_accounts.property_id,
    periodKey: r.period_key,
    dueOn: r.due_on,
    amountDueCentavos: r.amount_due_centavos,
    amountPaidCentavos: r.amount_paid_centavos,
    remainingCentavos: balance.remainingCentavos,
    creditCentavos: balance.creditCentavos,
    status,
    displayStatus: billDisplayStatus({ status, dueOn: r.due_on }, today),
    notes: r.notes,
  };
}

async function resolveCategory(
  ctx: ServiceContext,
  billType: BillType,
  categoryId: string | null,
): Promise<Result<string>> {
  if (categoryId) return ok(categoryId);
  const { data, error } = await ctx.db
    .from("expense_categories")
    .select("id")
    .eq("key", DEFAULT_CATEGORY_KEY[billType])
    .is("household_id", null)
    .single();
  if (error) return err(mapDbError(error));
  return ok(data.id);
}

export async function createBillAccount(ctx: ServiceContext, input: unknown): Promise<Result<{ accountId: string }>> {
  const parsed = parseInput(CreateBillAccountInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const category = await resolveCategory(ctx, v.billType, v.categoryId);
  if (!category.ok) return category;
  const { data, error } = await ctx.db.rpc("create_bill_account", {
    p_payload: {
      household_id: v.householdId,
      property_id: v.propertyId,
      bill_type: v.billType,
      provider_name: v.providerName,
      nickname: v.nickname,
      account_number_last4: v.accountNumberLast4,
      category_id: category.value,
      amount_type: v.amountType,
      fixed_amount_centavos: v.amountType === "fixed" ? v.fixedAmountCentavos : null,
      is_recurring: v.isRecurring,
      due_day: v.dueDay,
      starts_on: v.startsOn,
      ends_on: v.endsOn,
      reminder_offsets: v.reminderOffsets,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ accountId: data });
}

export async function updateBillAccount(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateBillAccountInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const category = await resolveCategory(ctx, v.billType, v.categoryId);
  if (!category.ok) return category;
  const { data, error } = await ctx.db
    .from("bill_accounts")
    .update({
      property_id: v.propertyId,
      provider_name: v.providerName,
      nickname: v.nickname,
      account_number_last4: v.accountNumberLast4,
      category_id: category.value,
      amount_type: v.amountType,
      fixed_amount_centavos: v.amountType === "fixed" ? v.fixedAmountCentavos : null,
      is_recurring: v.isRecurring,
      due_day: v.dueDay,
      ends_on: v.endsOn,
      reminder_offsets: v.reminderOffsets,
    })
    .eq("id", v.accountId)
    .is("archived_at", null)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't edit this account."));
  return ok(true);
}

export async function archiveBillAccount(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(BillAccountIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("bill_accounts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.value.accountId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't change this account."));
  return ok(true);
}

export async function listBillAccounts(ctx: ServiceContext, householdId: string): Promise<Result<BillAccountView[]>> {
  const { data, error } = await ctx.db
    .from("bill_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("household_id", householdId)
    .is("archived_at", null)
    .order("provider_name");
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toAccount(r as unknown as AccountRow)));
}

export async function getBillAccount(ctx: ServiceContext, accountId: string): Promise<Result<BillAccountView>> {
  const { data, error } = await ctx.db.from("bill_accounts").select(ACCOUNT_COLUMNS).eq("id", accountId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Account not found."));
  return ok(toAccount(data as unknown as AccountRow));
}

export type BillFilter = {
  status?: BillDisplayStatus | "open";
  accountId?: string;
  propertyId?: string;
  fromDue?: string;
  toDue?: string;
  limit?: number;
  today?: string;
};

export async function listBills(
  ctx: ServiceContext,
  householdId: string,
  filter: BillFilter = {},
): Promise<Result<BillView[]>> {
  const today = filter.today ?? manilaDateOf(new Date());
  let query = ctx.db.from("bills").select(BILL_COLUMNS).eq("household_id", householdId);
  if (filter.accountId) query = query.eq("bill_account_id", filter.accountId);
  if (filter.propertyId) query = query.eq("bill_accounts.property_id", filter.propertyId);
  if (filter.fromDue) query = query.gte("due_on", filter.fromDue);
  if (filter.toDue) query = query.lte("due_on", filter.toDue);
  if (filter.status === "paid") query = query.eq("status", "paid");
  if (filter.status === "open" || filter.status === "overdue") query = query.neq("status", "paid");
  if (filter.status === "overdue") query = query.lt("due_on", today);
  if (filter.status && ["unpaid", "partially_paid", "awaiting_amount"].includes(filter.status))
    query = query.eq("status", filter.status).gte("due_on", today);
  const { data, error } = await query
    .order("due_on", { ascending: filter.status !== "paid" })
    .limit(Math.min(filter.limit ?? 100, 500));
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toBill(r as unknown as BillRow, today)));
}

export async function getBill(ctx: ServiceContext, billId: string): Promise<Result<BillView>> {
  const { data, error } = await ctx.db.from("bills").select(BILL_COLUMNS).eq("id", billId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Bill not found."));
  return ok(toBill(data as unknown as BillRow, manilaDateOf(new Date())));
}

export async function createBill(ctx: ServiceContext, input: unknown): Promise<Result<{ billId: string }>> {
  const parsed = parseInput(CreateBillInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("create_bill", {
    p_account: v.accountId,
    p_due_on: v.dueOn,
    p_amount_centavos: v.amountCentavos as number,
    p_notes: v.notes,
  });
  if (error) return err(mapDbError(error));
  return ok({ billId: data });
}

export async function setBillAmount(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetBillAmountInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("bills")
    .update({ amount_due_centavos: parsed.value.amountCentavos, notes: parsed.value.notes })
    .eq("id", parsed.value.billId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't edit this bill."));
  return ok(true);
}

/** Records a payment made outside Bahay+. Idempotent per key; never processes money. */
export async function recordBillPayment(ctx: ServiceContext, input: unknown): Promise<Result<{ paymentId: string }>> {
  const parsed = parseInput(RecordBillPaymentInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("record_bill_payment", {
    p_bill: v.billId,
    p_amount_centavos: v.amountCentavos,
    p_paid_on: v.paidOn,
    p_method: v.method,
    p_reference: v.reference,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return err(mapDbError(error));
  return ok({ paymentId: data });
}

export async function voidBillPayment(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(VoidBillPaymentInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("void_bill_payment", {
    p_payment: parsed.value.paymentId,
    p_reason: parsed.value.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function listBillPayments(ctx: ServiceContext, billId: string): Promise<Result<BillPaymentView[]>> {
  const { data, error } = await ctx.db
    .from("bill_payments")
    .select("id, amount_centavos, paid_on, method, reference, voided_at, void_reason")
    .eq("bill_id", billId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((p) => ({
      id: p.id,
      amountCentavos: p.amount_centavos,
      paidOn: p.paid_on,
      method: p.method as PaymentMethod,
      reference: p.reference,
      voidedAt: p.voided_at,
      voidReason: p.void_reason,
    })),
  );
}

export async function listBillReminders(ctx: ServiceContext, billId: string): Promise<Result<BillReminderView[]>> {
  const { data, error } = await ctx.db
    .from("bill_reminders")
    .select("id, offset_days, remind_on, status, cancel_reason")
    .eq("bill_id", billId)
    .order("remind_on");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      offsetDays: r.offset_days,
      remindOn: r.remind_on,
      status: r.status as BillReminderView["status"],
      cancelReason: r.cancel_reason,
    })),
  );
}

export async function cancelBillReminder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ReminderIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("bill_reminders")
    .update({ status: "cancelled" })
    .eq("id", parsed.value.reminderId)
    .eq("status", "scheduled")
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.notFound("Reminder not found or already processed."));
  return ok(true);
}

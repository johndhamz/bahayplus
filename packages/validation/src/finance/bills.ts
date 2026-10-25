import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalInt, OptionalIsoDate, OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";
import { parsePesoInput } from "@bahayplus/types/money";

export const BILL_TYPES = [
  "electricity",
  "water",
  "internet",
  "telecom",
  "association_dues",
  "rent",
  "insurance",
  "custom",
] as const;
export const BillType = z.enum(BILL_TYPES, { message: "Choose a bill type." });
export type BillType = z.infer<typeof BillType>;

/** Default expense category key for each bill type (system categories seeded by migration). */
export const DEFAULT_CATEGORY_KEY: Record<BillType, string> = {
  electricity: "utilities",
  water: "utilities",
  internet: "utilities",
  telecom: "utilities",
  association_dues: "rent_dues",
  rent: "rent_dues",
  insurance: "insurance",
  custom: "other",
};

export const PAYMENT_METHODS = [
  "gcash",
  "maya",
  "bank_transfer",
  "over_the_counter",
  "credit_card",
  "debit_card",
  "cash",
  "auto_debit",
  "other",
] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS, { message: "Choose how it was paid." });
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const DEFAULT_REMINDER_OFFSETS = [7, 3, 1, 0, -3] as const;

/** Keeps only the last 4 letters/digits of an account number (privacy by design). */
export const AccountNumberLast4 = z
  .string()
  .default("")
  .transform((v) => v.replace(/[^A-Za-z0-9]/g, "").slice(-4));

const OptionalUuid = z
  .union([Uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const ReminderOffsets = z
  .array(z.coerce.number().int().min(-30).max(60))
  .max(8, "Choose up to 8 reminders.")
  .default([...DEFAULT_REMINDER_OFFSETS])
  .transform((v) => [...new Set(v)].sort((a, b) => b - a));

const BillAccountFields = z.object({
  propertyId: OptionalUuid,
  billType: BillType,
  providerName: z.string().trim().min(1, "Enter the biller, e.g. Meralco or Maynilad.").max(80),
  nickname: text(80),
  accountNumberLast4: AccountNumberLast4,
  categoryId: OptionalUuid,
  amountType: z.enum(["fixed", "variable"]),
  fixedAmountCentavos: OptionalPesoAmount,
  isRecurring: z.boolean().default(true),
  dueDay: OptionalInt(1, 31, "Due day"),
  endsOn: OptionalIsoDate,
  reminderOffsets: ReminderOffsets,
});

const accountRules = (v: z.infer<typeof BillAccountFields>, ctx: z.RefinementCtx) => {
  if (v.amountType === "fixed" && v.fixedAmountCentavos === null) {
    ctx.addIssue({ code: "custom", path: ["fixedAmountCentavos"], message: "Enter the fixed monthly amount." });
  }
  if (v.isRecurring && v.dueDay === null) {
    ctx.addIssue({ code: "custom", path: ["dueDay"], message: "Enter the day of the month it's due (1–31)." });
  }
};

export const CreateBillAccountInput = BillAccountFields.extend({
  householdId: Uuid,
  startsOn: OptionalIsoDate,
}).superRefine(accountRules);
export type CreateBillAccountInput = z.input<typeof CreateBillAccountInput>;
export const UpdateBillAccountInput = BillAccountFields.extend({ accountId: Uuid }).superRefine(accountRules);
export type UpdateBillAccountInput = z.input<typeof UpdateBillAccountInput>;
export const BillAccountIdInput = z.object({ accountId: Uuid });

export const CreateBillInput = z.object({
  accountId: Uuid,
  dueOn: RequiredIsoDate,
  amountCentavos: OptionalPesoAmount,
  notes: text(1000),
});
export type CreateBillInput = z.input<typeof CreateBillInput>;

export const SetBillAmountInput = z.object({
  billId: Uuid,
  amountCentavos: OptionalPesoAmount.refine((v) => v !== null, "Enter the amount on your statement."),
  notes: text(1000),
});
export type SetBillAmountInput = z.input<typeof SetBillAmountInput>;

/** Required peso amount > 0 as centavos. */
const PositivePeso = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const centavos = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero, e.g. 2,450.75" });
    return z.NEVER;
  }
  return centavos;
});

export const RecordBillPaymentInput = z.object({
  billId: Uuid,
  amountCentavos: PositivePeso,
  paidOn: RequiredIsoDate,
  method: PaymentMethod,
  reference: text(80),
  /** Generated once per form session; resubmitting the same form is safe. */
  idempotencyKey: z.string().min(8).max(100),
});
export type RecordBillPaymentInput = z.input<typeof RecordBillPaymentInput>;

export const VoidBillPaymentInput = z.object({
  paymentId: Uuid,
  reason: z.string().trim().min(3, "Give a short reason.").max(200),
});
export const ReminderIdInput = z.object({ reminderId: Uuid });

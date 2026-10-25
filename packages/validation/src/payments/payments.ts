import { z } from "zod";
import { parsePesoInput } from "@bahayplus/types/money";
import { Uuid } from "../common/primitives";

export const PAYMENT_STATUSES = [
  "requires_payment",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const Key = z.string().min(8).max(120);
const Peso = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const c = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
  if (!Number.isSafeInteger(c) || c <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter an amount in pesos." });
    return z.NEVER;
  }
  return c;
});

export const StartPaymentInput = z.object({ bookingId: Uuid, idempotencyKey: Key });
export const CancelPaymentInput = z.object({ paymentIntentId: Uuid });
export const RequestRefundInput = z.object({
  paymentIntentId: Uuid,
  amountCentavos: Peso,
  reason: z.string().trim().min(3, "Give a reason.").max(500),
  idempotencyKey: Key,
});
export type RequestRefundInput = z.input<typeof RequestRefundInput>;
export const CreateSettlementInput = z.object({
  organizationId: Uuid,
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
});
export const UpdateSettlementInput = z.object({
  settlementId: Uuid,
  status: z.enum(["approved", "paid_out"]),
  payoutReference: z.string().trim().max(120).default(""),
});
export const ReconciliationRow = z.object({
  external_reference: z.string().min(1).max(200),
  amount_centavos: z.number().int().nonnegative(),
  status: z.enum(["succeeded", "failed", "refunded", "partially_refunded"]),
});
export const RunReconciliationInput = z.object({
  provider: z.string().regex(/^[a-z_]{3,30}$/),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  report: z.array(ReconciliationRow).max(10000),
});
export const SetCommissionInput = z.object({
  /** Empty = platform default. */
  organizationId: z.union([Uuid, z.literal(""), z.null()]).transform((v) => v || null),
  rateBps: z.coerce.number().int().min(0).max(5000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).default(""),
});

/** Normalised, provider-independent event produced only after signature verification. */
export const ProviderEvent = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["payment.succeeded", "payment.failed", "refund.succeeded", "refund.failed"]),
  externalReference: z.string().min(1).max(200),
  amountCentavos: z.number().int().nonnegative(),
  currency: z.literal("PHP"),
  signedAt: z.date(),
  raw: z.record(z.string(), z.unknown()),
});
export type ProviderEvent = z.infer<typeof ProviderEvent>;

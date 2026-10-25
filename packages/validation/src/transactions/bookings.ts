import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalIsoDate, text } from "../common/fields";
import { parsePesoInput } from "@bahayplus/types/money";

const OptionalUuid = z
  .union([Uuid, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);

/** "YYYY-MM-DDTHH:MM" from <input type="datetime-local">, interpreted as Asia/Manila wall time → ISO UTC. */
export const ManilaDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Choose a date and time.")
  .transform((v) => new Date(`${v.length === 16 ? `${v}:00` : v}+08:00`).toISOString());

export const RequestBookingInput = z.object({
  householdId: Uuid,
  serviceId: Uuid,
  propertyId: Uuid,
  start: ManilaDateTime,
  notes: text(2000),
  idempotencyKey: z.string().min(8).max(100),
  assetId: OptionalUuid,
  petId: OptionalUuid,
  vehicleId: OptionalUuid,
});
export type RequestBookingInput = z.input<typeof RequestBookingInput>;

export const BOOKING_ACTIONS = ["confirm", "decline", "start", "complete", "cancel"] as const;
export const TransitionBookingInput = z.object({
  bookingId: Uuid,
  action: z.enum(BOOKING_ACTIONS),
  reason: text(500),
});
export const RescheduleBookingInput = z.object({ bookingId: Uuid, start: ManilaDateTime, reason: text(500) });
export type RescheduleBookingInput = z.input<typeof RescheduleBookingInput>;
export const ConfirmCompletionInput = z.object({
  bookingId: Uuid,
  outcome: z.enum(["confirmed", "disputed"]),
  note: text(1000),
});

export const CreateServiceRequestInput = z.object({
  householdId: Uuid,
  organizationId: Uuid,
  propertyId: Uuid,
  serviceId: OptionalUuid,
  title: z.string().trim().min(3, "Describe what you need in a few words.").max(120),
  description: text(3000),
  preferredDate: OptionalIsoDate,
  idempotencyKey: z.string().min(8).max(100),
  assetId: OptionalUuid,
  petId: OptionalUuid,
  vehicleId: OptionalUuid,
});
export type CreateServiceRequestInput = z.input<typeof CreateServiceRequestInput>;

const Quantity = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : Number(String(v).replaceAll(",", ""));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000 || Math.round(n * 1000) !== n * 1000) {
    ctx.addIssue({ code: "custom", message: "Enter a quantity greater than 0 (up to 3 decimals)." });
    return z.NEVER;
  }
  return n;
});
const UnitPrice = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const c = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
  if (!Number.isSafeInteger(c) || c < 0) {
    ctx.addIssue({ code: "custom", message: "Enter a unit price in pesos." });
    return z.NEVER;
  }
  return c;
});

export const QuotationLineInput = z.object({
  description: z.string().trim().min(1, "Describe the item.").max(200),
  quantity: Quantity,
  unitLabel: text(20),
  unitPriceCentavos: UnitPrice,
});
export const SaveQuotationDraftInput = z.object({
  quotationId: Uuid,
  notes: text(2000),
  lines: z.array(QuotationLineInput).min(1, "Add at least one line.").max(50),
});
export type SaveQuotationDraftInput = z.input<typeof SaveQuotationDraftInput>;
export const SendQuotationInput = z.object({
  quotationId: Uuid,
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
});
export const QuotationIdInput = z.object({ quotationId: Uuid });
export const RequestIdInput = z.object({ requestId: Uuid });
export const DecideQuotationInput = z.object({
  quotationId: Uuid,
  decision: z.enum(["accepted", "rejected"]),
  start: z
    .union([ManilaDateTime, z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
});

/** Mirrors the generated column: round(quantity × unit price) half away from zero. */
export function lineTotalCentavos(quantity: number, unitPriceCentavos: number): number {
  const thousandths = BigInt(Math.round(quantity * 1000)) * BigInt(unitPriceCentavos);
  const q = thousandths / 1000n;
  const r = thousandths % 1000n;
  return Number(r * 2n >= 1000n ? q + 1n : q);
}

export const CreateWorkOrderInput = z
  .object({
    bookingId: OptionalUuid,
    projectId: OptionalUuid,
    title: text(120),
    instructions: text(2000),
    start: z
      .union([ManilaDateTime, z.literal(""), z.null()])
      .optional()
      .transform((v) => v || null),
    end: z
      .union([ManilaDateTime, z.literal(""), z.null()])
      .optional()
      .transform((v) => v || null),
    checklist: z.array(z.string().trim().min(2).max(200)).max(30).default([]),
  })
  .refine((v) => (v.bookingId ? 1 : 0) + (v.projectId ? 1 : 0) === 1, { message: "Choose a booking or a project." });
export type CreateWorkOrderInput = z.input<typeof CreateWorkOrderInput>;
export const AssignWorkOrderInput = z.object({ workOrderId: Uuid, workerId: Uuid });
export const WORK_ORDER_STATUSES = [
  "scheduled",
  "assigned",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export const UpdateWorkOrderStatusInput = z.object({
  workOrderId: Uuid,
  status: z.enum(WORK_ORDER_STATUSES),
  notes: text(2000),
});
export const ToggleChecklistInput = z.object({ itemId: Uuid, done: z.boolean() });

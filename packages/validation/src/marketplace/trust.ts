import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalIsoDate, RequiredIsoDate, text } from "../common/fields";

export const VERIFICATION_ITEM_TYPES = [
  "business_registration",
  "mayors_permit",
  "bir_registration",
  "government_id",
  "professional_license",
  "nbi_clearance",
  "insurance",
] as const;
export type VerificationItemType = (typeof VERIFICATION_ITEM_TYPES)[number];

export const SubmitVerificationInput = z.object({
  organizationId: Uuid,
  items: z
    .array(
      z.object({
        itemType: z.enum(VERIFICATION_ITEM_TYPES),
        referenceNumber: text(80),
        validUntil: OptionalIsoDate,
      }),
    )
    .min(1, "Add at least one document.")
    .max(VERIFICATION_ITEM_TYPES.length)
    .refine(
      (items) => new Set(items.map((i) => i.itemType)).size === items.length,
      "Each document type can be added once.",
    ),
});
export type SubmitVerificationInput = z.input<typeof SubmitVerificationInput>;

export const VerificationRequestIdInput = z.object({ requestId: Uuid });

export const DecideVerificationInput = z.object({
  requestId: Uuid,
  decision: z.enum(["approved", "rejected"]),
  items: z.array(z.object({ itemId: Uuid, status: z.enum(["verified", "rejected"]), note: text(500) })).max(20),
  decisionNotes: text(2000),
  internalNotes: text(4000),
  expiresOn: OptionalIsoDate,
});
export type DecideVerificationInput = z.input<typeof DecideVerificationInput>;

export const RevokeVerificationInput = z.object({
  requestId: Uuid,
  reason: z.string().trim().min(5, "Give a reason.").max(500),
});

export const SubmitReviewInput = z.object({
  bookingId: Uuid,
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  comment: text(2000),
});
export type SubmitReviewInput = z.input<typeof SubmitReviewInput>;
export const EditReviewInput = z.object({
  reviewId: Uuid,
  rating: z.coerce.number().int().min(1).max(5),
  comment: text(2000),
});
export const ReplyToReviewInput = z.object({
  reviewId: Uuid,
  reply: z.string().trim().min(2, "Write a reply.").max(1000),
});
export type ReplyToReviewInput = z.input<typeof ReplyToReviewInput>;

export { RequiredIsoDate };

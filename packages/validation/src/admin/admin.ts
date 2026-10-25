import { z } from "zod";
import { Uuid } from "../common/primitives";

const Reason = z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500);

export const SetOrganizationStatusInput = z.object({
  organizationId: Uuid,
  status: z.enum(["active", "suspended"]),
  reason: Reason,
});
export const SetUserSuspensionInput = z.object({ userId: Uuid, suspend: z.boolean(), reason: Reason });

export const SaveCategoryInput = z.object({
  id: z.union([Uuid, z.literal("")]).default(""),
  division: z.enum(["home", "pet", "vehicle", "renovation"]),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,60}$/, "Use lowercase letters, numbers and dashes."),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  urgentEligible: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
});
export type SaveCategoryInput = z.input<typeof SaveCategoryInput>;

export const UpdateDisputeInput = z.object({
  disputeId: Uuid,
  action: z.enum(["take", "resolved", "dismissed"]),
  resolution: z.string().trim().max(2000).default(""),
});

export const PLATFORM_SETTING_KEYS = ["maintenance_banner", "urgent_stale_hours", "support_email"] as const;
export const UpdateSettingInput = z.discriminatedUnion("key", [
  z.object({ key: z.literal("maintenance_banner"), value: z.string().trim().max(300) }),
  z.object({
    key: z.literal("urgent_stale_hours"),
    value: z.coerce.number().int().min(1, "1 to 168 hours.").max(168, "1 to 168 hours."),
  }),
  z.object({ key: z.literal("support_email"), value: z.email({ message: "Enter a valid email." }) }),
]);
export type UpdateSettingInput = z.input<typeof UpdateSettingInput>;

export const AuditQuery = z.object({
  action: z.string().trim().max(60).optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

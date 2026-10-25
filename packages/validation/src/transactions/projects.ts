import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalIsoDate, text } from "../common/fields";
import { parsePesoInput } from "@bahayplus/types/money";
import { ManilaDateTime } from "./bookings";

export const PROJECT_KINDS = [
  "renovation",
  "custom_furniture",
  "carpentry",
  "cabinetry",
  "painting",
  "roofing",
  "other",
] as const;
export const ProjectKind = z.enum(PROJECT_KINDS);

export const CreateProjectRequestInput = z.object({
  householdId: Uuid,
  organizationId: Uuid,
  propertyId: Uuid,
  kind: ProjectKind,
  title: z.string().trim().min(3, "Name your project.").max(120),
  description: text(4000),
  targetEndDate: OptionalIsoDate,
});
export type CreateProjectRequestInput = z.input<typeof CreateProjectRequestInput>;

export const UpdateProjectInput = z.object({
  projectId: Uuid,
  status: z.enum(["site_visit_scheduled", "quoted", "active", "on_hold", "completed"]).optional(),
  siteVisitAt: z
    .union([ManilaDateTime, z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  startDate: OptionalIsoDate,
  targetEndDate: OptionalIsoDate,
  warrantyUntil: OptionalIsoDate,
  warrantyTerms: z.string().trim().max(2000).optional(),
});
export type UpdateProjectInput = z.input<typeof UpdateProjectInput>;

/** Signed peso amount ("-1,500" reduces the price) → centavos. */
const SignedPeso = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const c = typeof v === "number" ? v : (parsePesoInput(v)?.amountCentavos ?? Number.NaN);
  if (!Number.isSafeInteger(c)) {
    ctx.addIssue({ code: "custom", message: "Enter an amount, e.g. 12,500 or -3,000." });
    return z.NEVER;
  }
  return c;
});

export const ProposeChangeOrderInput = z.object({
  projectId: Uuid,
  title: z.string().trim().min(3, "Summarise the change.").max(120),
  description: text(2000),
  amountDeltaCentavos: SignedPeso,
  scheduleDeltaDays: z.coerce.number().int().min(-365).max(365).default(0),
});
export type ProposeChangeOrderInput = z.input<typeof ProposeChangeOrderInput>;
export const DecideChangeOrderInput = z.object({
  changeOrderId: Uuid,
  decision: z.enum(["approved", "rejected"]),
  note: text(500),
});
export const PostProjectUpdateInput = z.object({
  projectId: Uuid,
  body: z.string().trim().min(2, "Write an update.").max(2000),
  percentComplete: z
    .union([z.coerce.number().int().min(0).max(100), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});
export type PostProjectUpdateInput = z.input<typeof PostProjectUpdateInput>;
export const AddMilestoneInput = z.object({
  projectId: Uuid,
  title: z.string().trim().min(2, "Name the milestone.").max(120),
  dueOn: OptionalIsoDate,
  amountCentavos: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const m = parsePesoInput(v);
      if (!m || m.amountCentavos < 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount in pesos." });
        return z.NEVER;
      }
      return m.amountCentavos;
    }),
});
export const SetMilestoneStatusInput = z.object({
  milestoneId: Uuid,
  status: z.enum(["pending", "in_progress", "done"]),
});
export const AcceptProjectQuotationInput = z.object({ projectId: Uuid, quotationId: Uuid });
export const ProjectIdInput = z.object({ projectId: Uuid });

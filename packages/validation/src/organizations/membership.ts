import { z } from "zod";
import { Email, OrganizationRoleKey, MembershipStatus, Uuid } from "../common/primitives";

export const OrganizationKind = z.enum(["service_provider", "supplier"]);
export type OrganizationKind = z.infer<typeof OrganizationKind>;

export const OrganizationSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Use 3–60 lowercase letters, numbers and dashes.");

export const CreateOrganizationInput = z.object({
  kind: OrganizationKind,
  name: z.string().trim().min(2, "Enter your business name.").max(120),
  slug: OrganizationSlug,
});
export type CreateOrganizationInput = z.input<typeof CreateOrganizationInput>;

export const InviteOrganizationMemberInput = z.object({
  organizationId: Uuid,
  email: Email,
  role: OrganizationRoleKey,
});
export type InviteOrganizationMemberInput = z.input<typeof InviteOrganizationMemberInput>;

export const ChangeOrganizationMemberRoleInput = z.object({ memberId: Uuid, role: OrganizationRoleKey });
export const SetOrganizationMemberStatusInput = z.object({ memberId: Uuid, status: MembershipStatus });

/** Suggest a slug from a business name ("Juan's Plumbing Co." → "juans-plumbing-co"). */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

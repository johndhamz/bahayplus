import { z } from "zod";
import { Email, HouseholdRoleKey, InvitationToken, MembershipStatus, Uuid } from "../common/primitives";

export const HouseholdName = z.string().trim().min(1, "Enter a household name.").max(80, "Use 80 characters or fewer.");

export const CreateHouseholdInput = z.object({ name: HouseholdName });
export type CreateHouseholdInput = z.input<typeof CreateHouseholdInput>;

export const UpdateHouseholdInput = z.object({ householdId: Uuid, name: HouseholdName });
export type UpdateHouseholdInput = z.input<typeof UpdateHouseholdInput>;

export const InviteHouseholdMemberInput = z.object({
  householdId: Uuid,
  email: Email,
  role: HouseholdRoleKey,
});
export type InviteHouseholdMemberInput = z.input<typeof InviteHouseholdMemberInput>;

export const ChangeHouseholdMemberRoleInput = z.object({ memberId: Uuid, role: HouseholdRoleKey });
export type ChangeHouseholdMemberRoleInput = z.input<typeof ChangeHouseholdMemberRoleInput>;

export const SetHouseholdMemberStatusInput = z.object({ memberId: Uuid, status: MembershipStatus });
export type SetHouseholdMemberStatusInput = z.input<typeof SetHouseholdMemberStatusInput>;

export const MemberIdInput = z.object({ memberId: Uuid });
export const InvitationIdInput = z.object({ invitationId: Uuid });
export const AcceptInvitationInput = z.object({ token: InvitationToken });
export type AcceptInvitationInput = z.input<typeof AcceptInvitationInput>;

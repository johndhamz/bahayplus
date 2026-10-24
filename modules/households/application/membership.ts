import {
  AcceptInvitationInput,
  ChangeHouseholdMemberRoleInput,
  CreateHouseholdInput,
  InvitationIdInput,
  InviteHouseholdMemberInput,
  MemberIdInput,
  SetHouseholdMemberStatusInput,
  UpdateHouseholdInput,
} from "@bahayplus/validation/households/membership";
import type { HouseholdRoleKey } from "@bahayplus/validation/common/primitives";
import { appError, err, ok, type AppError, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput as parse, type ServiceContext } from "@bahayplus/modules/authorization";

export type CreatedInvitation = { invitationId: string; token: string; expiresAt: string };

export async function createHousehold(ctx: ServiceContext, input: unknown): Promise<Result<{ householdId: string }>> {
  const parsed = parse(CreateHouseholdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("create_household", { p_name: parsed.value.name });
  if (error) return err(mapDbError(error));
  return ok({ householdId: data });
}

export async function updateHousehold(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(UpdateHouseholdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("households")
    .update({ name: parsed.value.name })
    .eq("id", parsed.value.householdId)
    .select("id");
  if (error) return err(mapDbError(error));
  // RLS turns an unauthorized update into "0 rows" rather than an error.
  if (!data || data.length === 0) return err(appError.forbidden("You can't edit this household."));
  return ok(true);
}

export async function inviteHouseholdMember(ctx: ServiceContext, input: unknown): Promise<Result<CreatedInvitation>> {
  const parsed = parse(InviteHouseholdMemberInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("invite_household_member", {
    p_household: parsed.value.householdId,
    p_email: parsed.value.email,
    p_role: parsed.value.role,
  });
  if (error) return err(mapDbError(error));
  const row = data?.[0];
  if (!row) return err(appError.internal());
  return ok({ invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at });
}

export async function revokeHouseholdInvitation(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(InvitationIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("revoke_household_invitation", { p_invitation: parsed.value.invitationId });
  return error ? err(mapDbError(error)) : ok(true);
}

export type InvitationPreview = {
  householdName: string;
  role: HouseholdRoleKey;
  invitedEmail: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
};

export async function getHouseholdInvitation(ctx: ServiceContext, input: unknown): Promise<Result<InvitationPreview>> {
  const parsed = parse(AcceptInvitationInput, input);
  if (!parsed.ok) return err(appError.notFound("This invitation link is not valid.", "invitation_invalid"));
  const { data, error } = await ctx.db.rpc("get_household_invitation", { p_token: parsed.value.token });
  if (error) return err(mapDbError(error));
  const row = data?.[0];
  if (!row) return err(appError.notFound("This invitation link is not valid.", "invitation_invalid"));
  return ok({
    householdName: row.household_name,
    role: row.role_key as HouseholdRoleKey,
    invitedEmail: row.invited_email,
    status: row.status as InvitationPreview["status"],
    expiresAt: row.expires_at,
  });
}

export async function acceptHouseholdInvitation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ householdId: string }>> {
  const parsed = parse(AcceptInvitationInput, input);
  if (!parsed.ok) return err(appError.conflict("This invitation link is not valid.", "invitation_invalid"));
  const { data, error } = await ctx.db.rpc("accept_household_invitation", { p_token: parsed.value.token });
  if (error) return err(mapDbError(error));
  return ok({ householdId: data });
}

export async function changeHouseholdMemberRole(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(ChangeHouseholdMemberRoleInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("change_household_member_role", {
    p_member: parsed.value.memberId,
    p_role: parsed.value.role,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function setHouseholdMemberStatus(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(SetHouseholdMemberStatusInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("set_household_member_status", {
    p_member: parsed.value.memberId,
    p_status: parsed.value.status,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function removeHouseholdMember(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(MemberIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("remove_household_member", { p_member: parsed.value.memberId });
  return error ? err(mapDbError(error)) : ok(true);
}

export type HouseholdMemberView = {
  id: string;
  userId: string;
  fullName: string;
  role: HouseholdRoleKey;
  rank: number;
  status: "active" | "suspended";
  joinedAt: string;
};

export async function listHouseholdMembers(
  ctx: ServiceContext,
  householdId: string,
): Promise<Result<HouseholdMemberView[]>> {
  const { data, error } = await ctx.db
    .from("household_members")
    .select("id, user_id, status, joined_at, roles!inner(key, rank)")
    .eq("household_id", householdId)
    .order("joined_at");
  if (error) return err(mapDbError(error));
  const userIds = (data ?? []).map((m) => m.user_id);
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const profiles = await ctx.db.from("profiles").select("id, full_name").in("id", userIds);
    if (profiles.error) return err(mapDbError(profiles.error));
    for (const p of profiles.data ?? []) names.set(p.id, p.full_name);
  }
  return ok(
    (data ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      fullName: names.get(m.user_id) || "Member",
      role: m.roles.key as HouseholdRoleKey,
      rank: m.roles.rank,
      status: m.status as HouseholdMemberView["status"],
      joinedAt: m.joined_at,
    })),
  );
}

export type HouseholdInvitationView = {
  id: string;
  email: string;
  role: HouseholdRoleKey;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
};

export async function listHouseholdInvitations(
  ctx: ServiceContext,
  householdId: string,
): Promise<Result<HouseholdInvitationView[]>> {
  const { data, error } = await ctx.db
    .from("household_invitations")
    .select("id, email, status, expires_at, created_at, roles!inner(key)")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return err(mapDbError(error));
  const now = Date.now();
  return ok(
    (data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.roles.key as HouseholdRoleKey,
      status: (i.status === "pending" && Date.parse(i.expires_at) <= now
        ? "expired"
        : i.status) as HouseholdInvitationView["status"],
      expiresAt: i.expires_at,
      createdAt: i.created_at,
    })),
  );
}

export type { AppError };

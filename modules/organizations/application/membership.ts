import {
  ChangeOrganizationMemberRoleInput,
  CreateOrganizationInput,
  InviteOrganizationMemberInput,
  SetOrganizationMemberStatusInput,
} from "@bahayplus/validation/organizations/membership";
import { AcceptInvitationInput, InvitationIdInput, MemberIdInput } from "@bahayplus/validation/households/membership";
import type { OrganizationRoleKey } from "@bahayplus/validation/common/primitives";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput as parse, type ServiceContext } from "@bahayplus/modules/authorization";

export async function createOrganization(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ organizationId: string }>> {
  const parsed = parse(CreateOrganizationInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("create_organization", {
    p_kind: parsed.value.kind,
    p_name: parsed.value.name,
    p_slug: parsed.value.slug,
  });
  if (error) return err(mapDbError(error));
  return ok({ organizationId: data });
}

export async function inviteOrganizationMember(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ invitationId: string; token: string; expiresAt: string }>> {
  const parsed = parse(InviteOrganizationMemberInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("invite_organization_member", {
    p_org: parsed.value.organizationId,
    p_email: parsed.value.email,
    p_role: parsed.value.role,
  });
  if (error) return err(mapDbError(error));
  const row = data?.[0];
  if (!row) return err(appError.internal());
  return ok({ invitationId: row.invitation_id, token: row.token, expiresAt: row.expires_at });
}

export async function revokeOrganizationInvitation(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(InvitationIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("revoke_organization_invitation", { p_invitation: parsed.value.invitationId });
  return error ? err(mapDbError(error)) : ok(true);
}

export type OrganizationInvitationPreview = {
  organizationName: string;
  organizationKind: "service_provider" | "supplier";
  role: OrganizationRoleKey;
  invitedEmail: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
};

export async function getOrganizationInvitation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<OrganizationInvitationPreview>> {
  const parsed = parse(AcceptInvitationInput, input);
  if (!parsed.ok) return err(appError.notFound("This invitation link is not valid.", "invitation_invalid"));
  const { data, error } = await ctx.db.rpc("get_organization_invitation", { p_token: parsed.value.token });
  if (error) return err(mapDbError(error));
  const row = data?.[0];
  if (!row) return err(appError.notFound("This invitation link is not valid.", "invitation_invalid"));
  return ok({
    organizationName: row.organization_name,
    organizationKind: row.organization_kind as OrganizationInvitationPreview["organizationKind"],
    role: row.role_key as OrganizationRoleKey,
    invitedEmail: row.invited_email,
    status: row.status as OrganizationInvitationPreview["status"],
    expiresAt: row.expires_at,
  });
}

export async function acceptOrganizationInvitation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ organizationId: string }>> {
  const parsed = parse(AcceptInvitationInput, input);
  if (!parsed.ok) return err(appError.conflict("This invitation link is not valid.", "invitation_invalid"));
  const { data, error } = await ctx.db.rpc("accept_organization_invitation", { p_token: parsed.value.token });
  if (error) return err(mapDbError(error));
  return ok({ organizationId: data });
}

export async function changeOrganizationMemberRole(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(ChangeOrganizationMemberRoleInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("change_organization_member_role", {
    p_member: parsed.value.memberId,
    p_role: parsed.value.role,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function setOrganizationMemberStatus(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(SetOrganizationMemberStatusInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("set_organization_member_status", {
    p_member: parsed.value.memberId,
    p_status: parsed.value.status,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function removeOrganizationMember(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parse(MemberIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("remove_organization_member", { p_member: parsed.value.memberId });
  return error ? err(mapDbError(error)) : ok(true);
}

export type OrganizationMemberView = {
  id: string;
  userId: string;
  fullName: string;
  role: OrganizationRoleKey;
  rank: number;
  status: "active" | "suspended";
  joinedAt: string;
};

export async function listOrganizationMembers(
  ctx: ServiceContext,
  organizationId: string,
): Promise<Result<OrganizationMemberView[]>> {
  const { data, error } = await ctx.db
    .from("organization_members")
    .select("id, user_id, status, joined_at, roles!inner(key, rank)")
    .eq("organization_id", organizationId)
    .order("joined_at");
  if (error) return err(mapDbError(error));
  const ids = (data ?? []).map((m) => m.user_id);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const profiles = await ctx.db.from("profiles").select("id, full_name").in("id", ids);
    if (profiles.error) return err(mapDbError(profiles.error));
    for (const p of profiles.data ?? []) names.set(p.id, p.full_name);
  }
  return ok(
    (data ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      fullName: names.get(m.user_id) || "Team member",
      role: m.roles.key as OrganizationRoleKey,
      rank: m.roles.rank,
      status: m.status as OrganizationMemberView["status"],
      joinedAt: m.joined_at,
    })),
  );
}

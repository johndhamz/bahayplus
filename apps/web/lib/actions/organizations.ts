"use server";

import { revalidatePath } from "next/cache";
import {
  acceptOrganizationInvitation,
  changeOrganizationMemberRole,
  createOrganization,
  inviteOrganizationMember,
  removeOrganizationMember,
  revokeOrganizationInvitation,
  setOrganizationMemberStatus,
} from "@bahayplus/modules/organizations";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import { publicEnv } from "@/lib/env/public";
import { getServiceContext } from "@/lib/auth/context";

const UNAUTHENTICATED: ActionResult<never> = {
  ok: false,
  error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." },
};

export async function createOrganizationAction(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await createOrganization(ctx, input);
  if (result.ok) {
    revalidatePath("/provider", "layout");
    revalidatePath("/supplier", "layout");
  }
  return fromResult(result, "Business registered.");
}

export async function inviteOrganizationMemberAction(
  input: unknown,
): Promise<ActionResult<{ inviteUrl: string; expiresAt: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await inviteOrganizationMember(ctx, input);
  if (!result.ok) return fromResult(result);
  const inviteUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/invite/organization?token=${encodeURIComponent(result.value.token)}`;
  return { ok: true, data: { inviteUrl, expiresAt: result.value.expiresAt }, message: "Invitation created." };
}

export async function revokeOrganizationInvitationAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  return fromResult(await revokeOrganizationInvitation(ctx, input), "Invitation revoked.");
}

export async function acceptOrganizationInvitationAction(
  input: unknown,
): Promise<ActionResult<{ organizationId: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  return fromResult(await acceptOrganizationInvitation(ctx, input), "You've joined the team!");
}

export async function changeOrganizationMemberRoleAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  return fromResult(await changeOrganizationMemberRole(ctx, input), "Role updated.");
}

export async function setOrganizationMemberStatusAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  return fromResult(await setOrganizationMemberStatus(ctx, input), "Membership updated.");
}

export async function removeOrganizationMemberAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  return fromResult(await removeOrganizationMember(ctx, input), "Team member removed.");
}

"use server";

import { revalidatePath } from "next/cache";
import {
  acceptHouseholdInvitation,
  changeHouseholdMemberRole,
  createHousehold,
  inviteHouseholdMember,
  removeHouseholdMember,
  revokeHouseholdInvitation,
  setHouseholdMemberStatus,
  updateHousehold,
} from "@bahayplus/modules/households";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import { publicEnv } from "@/lib/env/public";
import { getServiceContext } from "@/lib/auth/context";

const UNAUTHENTICATED: ActionResult<never> = {
  ok: false,
  error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." },
};

export async function createHouseholdAction(input: unknown): Promise<ActionResult<{ householdId: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await createHousehold(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Household created.");
}

export async function updateHouseholdAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await updateHousehold(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Household updated.");
}

export async function inviteHouseholdMemberAction(
  input: unknown,
): Promise<ActionResult<{ inviteUrl: string; expiresAt: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await inviteHouseholdMember(ctx, input);
  if (!result.ok) return fromResult(result);
  revalidatePath("/app", "layout");
  const inviteUrl = `${publicEnv().NEXT_PUBLIC_SITE_URL}/invite/household?token=${encodeURIComponent(result.value.token)}`;
  return { ok: true, data: { inviteUrl, expiresAt: result.value.expiresAt }, message: "Invitation created." };
}

export async function revokeHouseholdInvitationAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await revokeHouseholdInvitation(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Invitation revoked.");
}

export async function acceptHouseholdInvitationAction(input: unknown): Promise<ActionResult<{ householdId: string }>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await acceptHouseholdInvitation(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Welcome to the household!");
}

export async function changeHouseholdMemberRoleAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await changeHouseholdMemberRole(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Role updated.");
}

export async function setHouseholdMemberStatusAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await setHouseholdMemberStatus(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Membership updated.");
}

export async function removeHouseholdMemberAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return UNAUTHENTICATED;
  const result = await removeHouseholdMember(ctx, input);
  if (result.ok) revalidatePath("/app", "layout");
  return fromResult(result, "Member removed.");
}

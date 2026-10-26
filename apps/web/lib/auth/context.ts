import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  listMyContexts,
  loadHouseholdAccess,
  loadOrganizationAccess,
  loadPlatformAccess,
  type HouseholdAccess,
  type MyContext,
  type OrganizationAccess,
  type PlatformAccess,
  type ServiceContext,
} from "@bahayplus/modules/authorization";
import { AUTH_ROUTES, loginRedirectPath } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Builds the per-request service context (user-scoped DB client → RLS applies). */
export const getServiceContext = cache(async (): Promise<ServiceContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await createSupabaseServerClient();
  const requestId = (await headers()).get("x-request-id") ?? crypto.randomUUID();
  return { db, userId: user.id, requestId };
});

export async function requireServiceContext(returnTo = "/app"): Promise<ServiceContext> {
  const ctx = await getServiceContext();
  if (!ctx) redirect(loginRedirectPath(returnTo));
  return ctx;
}

export const getMyContexts = cache(async (): Promise<MyContext[]> => {
  const ctx = await getServiceContext();
  if (!ctx) return [];
  const result = await listMyContexts(ctx);
  return result.ok ? result.value : [];
});

/**
 * Resolves the household named in the URL. Any failure (malformed id, not a member, suspended,
 * archived) renders 404 so other households' existence is never revealed.
 */
export const requireHouseholdAccess = cache(async (householdId: string): Promise<HouseholdAccess> => {
  if (!UUID.test(householdId)) notFound();
  const ctx = await requireServiceContext(`/app/h/${householdId}`);
  const access = await loadHouseholdAccess(ctx, householdId);
  if (!access.ok) notFound();
  return access.value;
});

export const requireOrganizationAccess = cache(
  async (organizationId: string, kind: OrganizationAccess["organizationKind"]): Promise<OrganizationAccess> => {
    if (!UUID.test(organizationId)) notFound();
    const portal = kind === "service_provider" ? "provider" : "supplier";
    const ctx = await requireServiceContext(`/${portal}/o/${organizationId}`);
    const access = await loadOrganizationAccess(ctx, organizationId);
    if (!access.ok || access.value.organizationKind !== kind) notFound();
    return access.value;
  },
);

/**
 * Platform admin gate. Non-admins get 404, not 403, so the admin surface isn't advertised.
 * Admins must also have verified a second factor this session (aal2); the database enforces the
 * same rule, so this redirect is for the user's benefit, not the security boundary.
 */
export const requirePlatformAccess = cache(async (): Promise<PlatformAccess> => {
  const ctx = await requireServiceContext("/admin");
  const access = await loadPlatformAccess(ctx);
  if (!access.ok || !access.value.permissions.has("platform.access")) notFound();
  const { data: aal } = await ctx.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect(`${AUTH_ROUTES.mfa}?next=${encodeURIComponent("/admin")}`);
  return access.value;
});

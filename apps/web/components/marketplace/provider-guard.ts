import "server-only";
import { notFound } from "next/navigation";
import { requireOrganizationAccess, requireServiceContext } from "@/lib/auth/context";

/** Resolves the provider org and whether the caller may manage marketplace data (owners/managers). */
export async function providerContext(orgId: string) {
  const access = await requireOrganizationAccess(orgId, "service_provider");
  const ctx = await requireServiceContext();
  return { access, ctx, canManage: access.permissions.has("organization.update"), base: `/provider/o/${orgId}` };
}

export function requireManage(canManage: boolean) {
  if (!canManage) notFound();
}

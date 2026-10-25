import "server-only";
import { notFound } from "next/navigation";
import type { OrganizationPermission } from "@bahayplus/modules/authorization";
import { requireOrganizationAccess, requireServiceContext } from "@/lib/auth/context";

/** Resolves the supplier org for a page; 404s when the caller lacks `permission`. */
export async function supplierContext(orgId: string, permission?: OrganizationPermission) {
  const access = await requireOrganizationAccess(orgId, "supplier");
  if (permission && !access.permissions.has(permission)) notFound();
  const ctx = await requireServiceContext();
  return { access, ctx, base: `/supplier/o/${orgId}`, can: (p: OrganizationPermission) => access.permissions.has(p) };
}

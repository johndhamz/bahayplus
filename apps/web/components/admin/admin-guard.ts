import "server-only";
import { notFound } from "next/navigation";
import type { PlatformPermission } from "@bahayplus/modules/authorization";
import { requirePlatformAccess, requireServiceContext } from "@/lib/auth/context";

/** Platform page gate: 404 for non-admins and for admins without the page's permission. */
export async function adminContext(permission: PlatformPermission) {
  const access = await requirePlatformAccess();
  if (!access.permissions.has(permission)) notFound();
  const ctx = await requireServiceContext("/admin");
  return { access, ctx, can: (p: PlatformPermission) => access.permissions.has(p) };
}

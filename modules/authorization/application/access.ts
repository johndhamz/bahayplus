import type { HouseholdRoleKey, OrganizationRoleKey, PlatformRoleKey } from "@bahayplus/validation/common/primitives";
import { err, ok, appError, type Result } from "@bahayplus/types/result";
import type { HouseholdPermission, OrganizationPermission, PlatformPermission } from "../domain/roles";
import type { ServiceContext } from "./context";
import { mapDbError } from "./db-errors";

export type HouseholdAccess = {
  kind: "household";
  householdId: string;
  householdName: string;
  memberId: string;
  role: HouseholdRoleKey;
  rank: number;
  permissions: ReadonlySet<HouseholdPermission>;
};

export type OrganizationAccess = {
  kind: "organization";
  organizationId: string;
  organizationName: string;
  organizationKind: "service_provider" | "supplier";
  memberId: string;
  role: OrganizationRoleKey;
  rank: number;
  permissions: ReadonlySet<OrganizationPermission>;
};

export type PlatformAccess = {
  kind: "platform";
  role: PlatformRoleKey;
  permissions: ReadonlySet<PlatformPermission>;
};

export type MyContext = {
  kind: "household" | "organization" | "platform";
  id: string | null;
  name: string;
  roleKey: string;
  orgKind: "service_provider" | "supplier" | null;
};

type RoleRow = { key: string; rank: number; role_permissions: { permissions: { key: string } | null }[] };

function permissionsOf(role: RoleRow | null): Set<string> {
  return new Set(
    (role?.role_permissions ?? []).map((rp) => rp.permissions?.key).filter((k): k is string => Boolean(k)),
  );
}

/**
 * Resolves the caller's active membership in a household. Returns NOT_FOUND (never FORBIDDEN) for
 * households the caller doesn't belong to, so existence isn't leaked.
 */
export async function loadHouseholdAccess(ctx: ServiceContext, householdId: string): Promise<Result<HouseholdAccess>> {
  const { data, error } = await ctx.db
    .from("household_members")
    .select(
      "id, status, households!inner(id, name, archived_at), roles!inner(key, rank, role_permissions(permissions(key)))",
    )
    .eq("household_id", householdId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data || data.status !== "active" || data.households.archived_at)
    return err(appError.notFound("Household not found."));
  const role = data.roles as unknown as RoleRow;
  return ok({
    kind: "household",
    householdId,
    householdName: data.households.name,
    memberId: data.id,
    role: role.key as HouseholdRoleKey,
    rank: role.rank,
    permissions: permissionsOf(role) as Set<HouseholdPermission>,
  });
}

export async function loadOrganizationAccess(
  ctx: ServiceContext,
  organizationId: string,
): Promise<Result<OrganizationAccess>> {
  const { data, error } = await ctx.db
    .from("organization_members")
    .select(
      "id, status, organizations!inner(id, name, kind, status), roles!inner(key, rank, role_permissions(permissions(key)))",
    )
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data || data.status !== "active" || data.organizations.status !== "active") {
    return err(appError.notFound("Organization not found."));
  }
  const role = data.roles as unknown as RoleRow;
  return ok({
    kind: "organization",
    organizationId,
    organizationName: data.organizations.name,
    organizationKind: data.organizations.kind as OrganizationAccess["organizationKind"],
    memberId: data.id,
    role: role.key as OrganizationRoleKey,
    rank: role.rank,
    permissions: permissionsOf(role) as Set<OrganizationPermission>,
  });
}

export async function loadPlatformAccess(ctx: ServiceContext): Promise<Result<PlatformAccess>> {
  const { data, error } = await ctx.db
    .from("platform_admins")
    .select("roles!inner(key, rank, role_permissions(permissions(key)))")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound());
  const role = data.roles as unknown as RoleRow;
  return ok({
    kind: "platform",
    role: role.key as PlatformRoleKey,
    permissions: permissionsOf(role) as Set<PlatformPermission>,
  });
}

export async function listMyContexts(ctx: ServiceContext): Promise<Result<MyContext[]>> {
  const { data, error } = await ctx.db.rpc("my_contexts");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((row) => ({
      kind: row.kind as MyContext["kind"],
      id: row.id,
      name: row.name,
      roleKey: row.role_key,
      orgKind: (row.org_kind as MyContext["orgKind"]) ?? null,
    })),
  );
}

export function requirePermission<P extends string>(
  access: { permissions: ReadonlySet<P> },
  permission: P,
): Result<true> {
  return access.permissions.has(permission) ? ok(true) : err(appError.forbidden());
}

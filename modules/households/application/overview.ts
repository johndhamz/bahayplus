import { err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, type HouseholdAccess, type ServiceContext } from "@bahayplus/modules/authorization";
import { describeActivity } from "../domain/activity";

export type HouseholdOverview = {
  activeProperties: number | null;
  archivedProperties: number | null;
  activeMembers: number | null;
  pendingInvitations: number | null;
  defaultPropertyId: string | null;
};

/**
 * Counts for the dashboard. Each count is null when the caller's role may not see that data,
 * so the UI can hide the section rather than show a misleading zero.
 */
export async function getHouseholdOverview(
  ctx: ServiceContext,
  access: HouseholdAccess,
): Promise<Result<HouseholdOverview>> {
  const id = access.householdId;
  const can = (p: Parameters<typeof access.permissions.has>[0]) => access.permissions.has(p);
  const [household, active, archived, members, invitations] = await Promise.all([
    ctx.db.from("households").select("default_property_id").eq("id", id).maybeSingle(),
    can("property.view")
      ? ctx.db
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("household_id", id)
          .is("archived_at", null)
      : null,
    can("property.view")
      ? ctx.db
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("household_id", id)
          .not("archived_at", "is", null)
      : null,
    can("household.members.view")
      ? ctx.db
          .from("household_members")
          .select("id", { count: "exact", head: true })
          .eq("household_id", id)
          .eq("status", "active")
      : null,
    can("household.invitations.manage")
      ? ctx.db
          .from("household_invitations")
          .select("id", { count: "exact", head: true })
          .eq("household_id", id)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
      : null,
  ]);
  for (const r of [household, active, archived, members, invitations]) if (r?.error) return err(mapDbError(r.error));
  return ok({
    activeProperties: active ? (active.count ?? 0) : null,
    archivedProperties: archived ? (archived.count ?? 0) : null,
    activeMembers: members ? (members.count ?? 0) : null,
    pendingInvitations: invitations ? (invitations.count ?? 0) : null,
    defaultPropertyId: household.data?.default_property_id ?? null,
  });
}

export type ActivityItem = { id: string; kind: string; text: string; occurredAt: string; propertyId: string | null };

/** Recent activity the caller is allowed to see (RLS filters rows by required permission). */
export async function listHouseholdActivity(
  ctx: ServiceContext,
  householdId: string,
  options: { limit?: number; propertyId?: string } = {},
): Promise<Result<ActivityItem[]>> {
  let query = ctx.db
    .from("household_activity")
    .select("id, kind, metadata, occurred_at, property_id")
    .eq("household_id", householdId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(options.limit ?? 10, 50));
  if (options.propertyId) query = query.eq("property_id", options.propertyId);
  const { data, error } = await query;
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      text: describeActivity(row.kind, (row.metadata ?? {}) as Record<string, unknown>),
      occurredAt: row.occurred_at,
      propertyId: row.property_id,
    })),
  );
}

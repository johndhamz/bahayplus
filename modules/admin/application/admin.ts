import {
  SaveCategoryInput,
  SetOrganizationStatusInput,
  SetUserSuspensionInput,
  UpdateDisputeInput,
  UpdateSettingInput,
} from "@bahayplus/validation/admin/admin";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

/** Every command here is a SECURITY DEFINER function that checks the platform permission and writes the audit log. */

export type AdminOverview = {
  pendingVerifications: number;
  openDisputes: number;
  organizations: number;
  suspendedOrganizations: number;
  users: number;
  failedDeliveries7d: number;
};

export async function getAdminOverview(ctx: ServiceContext): Promise<Result<AdminOverview>> {
  const { data, error } = await ctx.db.rpc("admin_overview");
  if (error) return err(mapDbError(error));
  const d = data as Record<string, number>;
  return ok({
    pendingVerifications: d.pending_verifications ?? 0,
    openDisputes: d.open_disputes ?? 0,
    organizations: d.organizations ?? 0,
    suspendedOrganizations: d.suspended_organizations ?? 0,
    users: d.users ?? 0,
    failedDeliveries7d: d.failed_deliveries_7d ?? 0,
  });
}

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  kind: "service_provider" | "supplier";
  status: "active" | "suspended";
  createdAt: string;
  memberCount: number;
  verificationStatus: string | null;
  verifiedUntil: string | null;
  listed: boolean;
};

export async function listOrganizationsForAdmin(
  ctx: ServiceContext,
  filter: { search?: string; kind?: string; status?: string; page?: number } = {},
): Promise<Result<AdminOrganization[]>> {
  const page = filter.page ?? 1;
  const { data, error } = await ctx.db.rpc("admin_list_organizations", {
    p_search: (filter.search ?? null) as string,
    p_kind: (filter.kind ?? null) as string,
    p_status: (filter.status ?? null) as string,
    p_limit: 50,
    p_offset: (page - 1) * 50,
  });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      kind: o.kind as AdminOrganization["kind"],
      status: o.status as AdminOrganization["status"],
      createdAt: o.created_at,
      memberCount: o.member_count,
      verificationStatus: o.verification_status,
      verifiedUntil: o.verified_until,
      listed: o.listed,
    })),
  );
}

export async function setOrganizationStatus(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetOrganizationStatusInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("admin_set_organization_status", {
    p_org: v.organizationId,
    p_status: v.status,
    p_reason: v.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type AdminUser = {
  id: string;
  fullName: string;
  /** Masked for staff without platform.users.manage. */
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  suspended: boolean;
  householdCount: number;
  organizationCount: number;
  platformRole: string | null;
};

export async function listUsersForAdmin(
  ctx: ServiceContext,
  filter: { search?: string; page?: number } = {},
): Promise<Result<AdminUser[]>> {
  const page = filter.page ?? 1;
  const { data, error } = await ctx.db.rpc("admin_list_users", {
    p_search: (filter.search ?? null) as string,
    p_limit: 50,
    p_offset: (page - 1) * 50,
  });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      suspended: u.suspended,
      householdCount: u.household_count,
      organizationCount: u.organization_count,
      platformRole: u.platform_role,
    })),
  );
}

export async function setUserSuspension(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetUserSuspensionInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("admin_set_user_suspension", {
    p_user: v.userId,
    p_suspend: v.suspend,
    p_reason: v.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type AdminCategory = {
  id: string;
  division: string;
  slug: string;
  name: string;
  description: string;
  urgentEligible: boolean;
  sortOrder: number;
  isActive: boolean;
};

export async function listCategoriesForAdmin(ctx: ServiceContext): Promise<Result<AdminCategory[]>> {
  const { data, error } = await ctx.db
    .from("service_categories")
    .select("*")
    .order("division")
    .order("sort_order")
    .order("name");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((c) => ({
      id: c.id,
      division: c.division,
      slug: c.slug,
      name: c.name,
      description: c.description,
      urgentEligible: c.urgent_eligible,
      sortOrder: c.sort_order,
      isActive: c.is_active,
    })),
  );
}

export async function saveCategory(ctx: ServiceContext, input: unknown): Promise<Result<{ categoryId: string }>> {
  const parsed = parseInput(SaveCategoryInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("admin_save_service_category", {
    p_payload: {
      id: v.id,
      division: v.division,
      slug: v.slug,
      name: v.name,
      description: v.description,
      urgent_eligible: v.urgentEligible,
      sort_order: v.sortOrder,
      is_active: v.isActive,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ categoryId: data });
}

export type DisputeView = {
  id: string;
  bookingId: string;
  householdId: string;
  organizationId: string;
  providerName: string;
  bookingTitle: string;
  reason: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  assignedTo: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function listDisputes(
  ctx: ServiceContext,
  filter: { open?: boolean } = {},
): Promise<Result<DisputeView[]>> {
  let q = ctx.db
    .from("disputes")
    .select(
      "id, booking_id, household_id, organization_id, reason, status, assigned_to, resolution, resolved_at, created_at, bookings!inner(title, organizations!inner(name))",
    );
  if (filter.open) q = q.in("status", ["open", "under_review"]);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((d) => ({
      id: d.id,
      bookingId: d.booking_id,
      householdId: d.household_id,
      organizationId: d.organization_id,
      providerName: d.bookings.organizations.name,
      bookingTitle: d.bookings.title,
      reason: d.reason,
      status: d.status as DisputeView["status"],
      assignedTo: d.assigned_to,
      resolution: d.resolution,
      resolvedAt: d.resolved_at,
      createdAt: d.created_at,
    })),
  );
}

export async function getDispute(ctx: ServiceContext, disputeId: string): Promise<Result<DisputeView>> {
  const all = await listDisputes(ctx);
  if (!all.ok) return all;
  const d = all.value.find((x) => x.id === disputeId);
  return d ? ok(d) : err(appError.notFound("Dispute not found."));
}

export async function updateDispute(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateDisputeInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("admin_update_dispute", {
    p_dispute: v.disputeId,
    p_action: v.action,
    p_resolution: v.resolution,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type AuditEntry = {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string | null;
  householdId: string | null;
  organizationId: string | null;
  metadata: Record<string, unknown>;
};

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLog(
  ctx: ServiceContext,
  filter: { action?: string; from?: string; to?: string; page?: number } = {},
): Promise<Result<AuditEntry[]>> {
  const { data, error } = await ctx.db.rpc("admin_audit_log", {
    p_action: (filter.action ?? null) as string,
    p_from: (filter.from ?? null) as string,
    p_to: (filter.to ?? null) as string,
    p_limit: AUDIT_PAGE_SIZE + 1,
    p_offset: ((filter.page ?? 1) - 1) * AUDIT_PAGE_SIZE,
  });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((a) => ({
      id: a.id,
      occurredAt: a.occurred_at,
      actorId: a.actor_id,
      actorName: a.actor_name,
      actorType: a.actor_type,
      action: a.action,
      targetType: a.target_type,
      targetId: a.target_id,
      householdId: a.household_id,
      organizationId: a.organization_id,
      metadata: (a.metadata ?? {}) as Record<string, unknown>,
    })),
  );
}

export type PlatformSettings = { maintenanceBanner: string; urgentStaleHours: number; supportEmail: string };

export async function getPlatformSettings(ctx: ServiceContext): Promise<Result<PlatformSettings>> {
  const { data, error } = await ctx.db.from("platform_settings").select("key, value");
  if (error) return err(mapDbError(error));
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return ok({
    maintenanceBanner:
      typeof map.get("maintenance_banner") === "string" ? (map.get("maintenance_banner") as string) : "",
    urgentStaleHours:
      typeof map.get("urgent_stale_hours") === "number" ? (map.get("urgent_stale_hours") as number) : 24,
    supportEmail: typeof map.get("support_email") === "string" ? (map.get("support_email") as string) : "",
  });
}

export async function updatePlatformSetting(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateSettingInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("admin_update_setting", { p_key: parsed.value.key, p_value: parsed.value.value });
  return error ? err(mapDbError(error)) : ok(true);
}

import {
  AssignWorkOrderInput,
  CreateWorkOrderInput,
  ToggleChecklistInput,
  UpdateWorkOrderStatusInput,
} from "@bahayplus/validation/transactions/bookings";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import type { WorkOrderStatus } from "../domain/lifecycle";

export type WorkOrderView = {
  id: string;
  organizationId: string;
  householdId: string;
  bookingId: string | null;
  projectId: string | null;
  title: string;
  instructions: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: WorkOrderStatus;
  completionNotes: string;
  completedAt: string | null;
  assignedWorkerId: string | null;
  assignedWorkerName: string | null;
  checklist: { id: string; label: string; isDone: boolean; doneAt: string | null }[];
};

const COLUMNS =
  "id, organization_id, household_id, booking_id, project_id, title, instructions, scheduled_start, scheduled_end, status, completion_notes, completed_at, work_order_assignments(worker_id, active), work_order_checklist_items(id, position, label, is_done, done_at)";

type Row = {
  id: string;
  organization_id: string;
  household_id: string;
  booking_id: string | null;
  project_id: string | null;
  title: string;
  instructions: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  completion_notes: string;
  completed_at: string | null;
  work_order_assignments: { worker_id: string; active: boolean }[];
  work_order_checklist_items: {
    id: string;
    position: number;
    label: string;
    is_done: boolean;
    done_at: string | null;
  }[];
};

async function toViews(ctx: ServiceContext, rows: Row[]): Promise<WorkOrderView[]> {
  const workerIds = [
    ...new Set(rows.flatMap((r) => r.work_order_assignments.filter((a) => a.active).map((a) => a.worker_id))),
  ];
  const names = new Map<string, string>();
  if (workerIds.length) {
    const { data } = await ctx.db.from("profiles").select("id, full_name").in("id", workerIds);
    for (const p of data ?? []) names.set(p.id, p.full_name);
  }
  return rows.map((r) => {
    const worker = r.work_order_assignments.find((a) => a.active)?.worker_id ?? null;
    return {
      id: r.id,
      organizationId: r.organization_id,
      householdId: r.household_id,
      bookingId: r.booking_id,
      projectId: r.project_id,
      title: r.title,
      instructions: r.instructions,
      scheduledStart: r.scheduled_start,
      scheduledEnd: r.scheduled_end,
      status: r.status as WorkOrderStatus,
      completionNotes: r.completion_notes,
      completedAt: r.completed_at,
      assignedWorkerId: worker,
      assignedWorkerName: worker ? names.get(worker) || "Team member" : null,
      checklist: [...r.work_order_checklist_items]
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ id: c.id, label: c.label, isDone: c.is_done, doneAt: c.done_at })),
    };
  });
}

export async function listWorkOrders(
  ctx: ServiceContext,
  scope: { organizationId?: string; bookingId?: string; projectId?: string; assignedToMe?: boolean },
  filter: { statuses?: WorkOrderStatus[]; from?: string; to?: string; limit?: number } = {},
): Promise<Result<WorkOrderView[]>> {
  let query = ctx.db.from("work_orders").select(COLUMNS);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  if (scope.bookingId) query = query.eq("booking_id", scope.bookingId);
  if (scope.projectId) query = query.eq("project_id", scope.projectId);
  if (filter.statuses?.length) query = query.in("status", filter.statuses);
  if (filter.from) query = query.gte("scheduled_start", filter.from);
  if (filter.to) query = query.lt("scheduled_start", filter.to);
  const { data, error } = await query.order("scheduled_start").limit(filter.limit ?? 100);
  if (error) return err(mapDbError(error));
  let rows = (data ?? []) as unknown as Row[];
  if (scope.assignedToMe)
    rows = rows.filter((r) => r.work_order_assignments.some((a) => a.active && a.worker_id === ctx.userId));
  return ok(await toViews(ctx, rows));
}

export async function getWorkOrder(ctx: ServiceContext, workOrderId: string): Promise<Result<WorkOrderView>> {
  const { data, error } = await ctx.db.from("work_orders").select(COLUMNS).eq("id", workOrderId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Work order not found."));
  return ok((await toViews(ctx, [data as unknown as Row]))[0]!);
}

export async function createWorkOrder(ctx: ServiceContext, input: unknown): Promise<Result<{ workOrderId: string }>> {
  const parsed = parseInput(CreateWorkOrderInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("create_work_order", {
    p_payload: {
      booking_id: v.bookingId,
      project_id: v.projectId,
      title: v.title,
      instructions: v.instructions,
      scheduled_start: v.start,
      scheduled_end: v.end,
      checklist: v.checklist,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ workOrderId: data });
}

export async function assignWorkOrder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(AssignWorkOrderInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("assign_work_order", {
    p_work_order: parsed.value.workOrderId,
    p_worker: parsed.value.workerId,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function updateWorkOrderStatus(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateWorkOrderStatusInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("update_work_order_status", {
    p_work_order: parsed.value.workOrderId,
    p_status: parsed.value.status,
    p_notes: parsed.value.notes,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function toggleChecklistItem(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ToggleChecklistInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("toggle_checklist_item", {
    p_item: parsed.value.itemId,
    p_done: parsed.value.done,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type FieldWorker = { userId: string; name: string; role: string };

/** Team members who can be assigned field work. */
export async function listFieldWorkers(ctx: ServiceContext, organizationId: string): Promise<Result<FieldWorker[]>> {
  const { data, error } = await ctx.db
    .from("organization_members")
    .select("user_id, status, roles!inner(key, role_permissions!inner(permissions!inner(key)))")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("roles.role_permissions.permissions.key", "work_orders.perform");
  if (error) return err(mapDbError(error));
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await ctx.db.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  return ok(
    (data ?? []).map((m) => ({
      userId: m.user_id,
      name: profiles?.find((p) => p.id === m.user_id)?.full_name || "Team member",
      role: (m.roles as { key: string }).key,
    })),
  );
}

export type WorkOrderLocation = { propertyName: string; address: string; notes: string } | null;

/** Job address for the assigned worker or a dispatcher; null for anyone else. */
export async function getWorkOrderLocation(
  ctx: ServiceContext,
  workOrderId: string,
): Promise<Result<WorkOrderLocation>> {
  const { data, error } = await ctx.db.rpc("work_order_location", { p_work_order: workOrderId });
  if (error) return err(mapDbError(error));
  const row = data?.[0];
  if (!row) return ok(null);
  const address = [
    row.address_line,
    row.barangay && `Brgy. ${row.barangay}`,
    row.city_municipality,
    [row.province, row.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  return ok({ propertyName: row.property_name, address, notes: row.notes });
}

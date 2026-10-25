import {
  AcceptProjectQuotationInput,
  AddMilestoneInput,
  CreateProjectRequestInput,
  DecideChangeOrderInput,
  PostProjectUpdateInput,
  ProjectIdInput,
  ProposeChangeOrderInput,
  SetMilestoneStatusInput,
  UpdateProjectInput,
} from "@bahayplus/validation/transactions/projects";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type ProjectStatus =
  "requested" | "site_visit_scheduled" | "quoted" | "active" | "on_hold" | "completed" | "cancelled";
export type ProjectView = {
  id: string;
  householdId: string;
  organizationId: string;
  providerName: string;
  kind: string;
  title: string;
  description: string;
  status: ProjectStatus;
  siteVisitAt: string | null;
  serviceRequestId: string | null;
  contractQuotationId: string | null;
  contractAmountCentavos: number | null;
  approvedChangesCentavos: number;
  /** Contract plus approved change orders; null until a quotation is accepted. */
  currentAmountCentavos: number | null;
  startDate: string | null;
  targetEndDate: string | null;
  completedAt: string | null;
  warrantyUntil: string | null;
  warrantyTerms: string;
  createdAt: string;
};
export type MilestoneView = {
  id: string;
  title: string;
  dueOn: string | null;
  amountCentavos: number | null;
  status: "pending" | "in_progress" | "done";
};
export type ProjectUpdateView = {
  id: string;
  authorSide: "customer" | "provider";
  body: string;
  percentComplete: number | null;
  createdAt: string;
};
export type ChangeOrderView = {
  id: string;
  number: number;
  title: string;
  description: string;
  amountDeltaCentavos: number;
  scheduleDeltaDays: number;
  status: "proposed" | "approved" | "rejected" | "withdrawn";
  decidedAt: string | null;
  decisionNote: string | null;
};

const COLUMNS =
  "id, household_id, organization_id, kind, title, description, status, site_visit_at, service_request_id, contract_quotation_id, contract_amount_centavos, approved_changes_centavos, start_date, target_end_date, completed_at, warranty_until, warranty_terms, created_at, organizations!inner(name)";

type Row = {
  id: string;
  household_id: string;
  organization_id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  site_visit_at: string | null;
  service_request_id: string | null;
  contract_quotation_id: string | null;
  contract_amount_centavos: number | null;
  approved_changes_centavos: number;
  start_date: string | null;
  target_end_date: string | null;
  completed_at: string | null;
  warranty_until: string | null;
  warranty_terms: string;
  created_at: string;
  organizations: { name: string };
};
const toView = (r: Row): ProjectView => ({
  id: r.id,
  householdId: r.household_id,
  organizationId: r.organization_id,
  providerName: r.organizations.name,
  kind: r.kind,
  title: r.title,
  description: r.description,
  status: r.status as ProjectStatus,
  siteVisitAt: r.site_visit_at,
  serviceRequestId: r.service_request_id,
  contractQuotationId: r.contract_quotation_id,
  contractAmountCentavos: r.contract_amount_centavos,
  approvedChangesCentavos: r.approved_changes_centavos,
  currentAmountCentavos:
    r.contract_amount_centavos === null ? null : r.contract_amount_centavos + r.approved_changes_centavos,
  startDate: r.start_date,
  targetEndDate: r.target_end_date,
  completedAt: r.completed_at,
  warrantyUntil: r.warranty_until,
  warrantyTerms: r.warranty_terms,
  createdAt: r.created_at,
});

export async function listProjects(
  ctx: ServiceContext,
  scope: { householdId: string } | { organizationId: string },
): Promise<Result<ProjectView[]>> {
  let query = ctx.db.from("projects").select(COLUMNS);
  query =
    "householdId" in scope
      ? query.eq("household_id", scope.householdId)
      : query.eq("organization_id", scope.organizationId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as unknown as Row)));
}

export async function getProject(ctx: ServiceContext, projectId: string): Promise<Result<ProjectView>> {
  const { data, error } = await ctx.db.from("projects").select(COLUMNS).eq("id", projectId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Project not found."));
  return ok(toView(data as unknown as Row));
}

export async function createProjectRequest(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ projectId: string }>> {
  const parsed = parseInput(CreateProjectRequestInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("create_project_request", {
    p_payload: {
      household_id: v.householdId,
      organization_id: v.organizationId,
      property_id: v.propertyId,
      kind: v.kind,
      title: v.title,
      description: v.description,
      target_end_date: v.targetEndDate,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ projectId: data });
}

export async function updateProject(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateProjectInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("update_project", {
    p_project: v.projectId,
    p_payload: {
      status: v.status ?? null,
      site_visit_at: v.siteVisitAt,
      start_date: v.startDate,
      target_end_date: v.targetEndDate,
      warranty_until: v.warrantyUntil,
      warranty_terms: v.warrantyTerms ?? null,
    },
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function startProjectQuotation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ quotationId: string }>> {
  const parsed = parseInput(ProjectIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("start_project_quotation", { p_project: parsed.value.projectId });
  if (error) return err(mapDbError(error));
  return ok({ quotationId: data });
}

export async function acceptProjectQuotation(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(AcceptProjectQuotationInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("accept_project_quotation", {
    p_project: parsed.value.projectId,
    p_quotation: parsed.value.quotationId,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function listMilestones(ctx: ServiceContext, projectId: string): Promise<Result<MilestoneView[]>> {
  const { data, error } = await ctx.db
    .from("project_milestones")
    .select("id, title, due_on, amount_centavos, status")
    .eq("project_id", projectId)
    .order("position");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      dueOn: m.due_on,
      amountCentavos: m.amount_centavos,
      status: m.status as MilestoneView["status"],
    })),
  );
}

export async function addMilestone(ctx: ServiceContext, input: unknown): Promise<Result<{ milestoneId: string }>> {
  const parsed = parseInput(AddMilestoneInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { count } = await ctx.db
    .from("project_milestones")
    .select("id", { count: "exact", head: true })
    .eq("project_id", v.projectId);
  const { data, error } = await ctx.db
    .from("project_milestones")
    .insert({
      project_id: v.projectId,
      position: (count ?? 0) + 1,
      title: v.title,
      due_on: v.dueOn,
      amount_centavos: v.amountCentavos,
    })
    .select("id")
    .single();
  if (error)
    return err(
      error.code === "42501" ? appError.forbidden("Only the contractor manages milestones.") : mapDbError(error),
    );
  return ok({ milestoneId: data.id });
}

export async function setMilestoneStatus(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetMilestoneStatusInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("project_milestones")
    .update({
      status: parsed.value.status,
      completed_at: parsed.value.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.value.milestoneId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("Only the contractor manages milestones."));
  return ok(true);
}

export async function listProjectUpdates(ctx: ServiceContext, projectId: string): Promise<Result<ProjectUpdateView[]>> {
  const { data, error } = await ctx.db
    .from("project_updates")
    .select("id, author_side, body, percent_complete, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((u) => ({
      id: u.id,
      authorSide: u.author_side as ProjectUpdateView["authorSide"],
      body: u.body,
      percentComplete: u.percent_complete,
      createdAt: u.created_at,
    })),
  );
}

export async function postProjectUpdate(ctx: ServiceContext, input: unknown): Promise<Result<{ updateId: string }>> {
  const parsed = parseInput(PostProjectUpdateInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("post_project_update", {
    p_project: parsed.value.projectId,
    p_body: parsed.value.body,
    p_percent: parsed.value.percentComplete as number,
  });
  if (error) return err(mapDbError(error));
  return ok({ updateId: data });
}

export async function listChangeOrders(ctx: ServiceContext, projectId: string): Promise<Result<ChangeOrderView[]>> {
  const { data, error } = await ctx.db
    .from("change_orders")
    .select(
      "id, number, title, description, amount_delta_centavos, schedule_delta_days, status, decided_at, decision_note",
    )
    .eq("project_id", projectId)
    .order("number", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      description: c.description,
      amountDeltaCentavos: c.amount_delta_centavos,
      scheduleDeltaDays: c.schedule_delta_days,
      status: c.status as ChangeOrderView["status"],
      decidedAt: c.decided_at,
      decisionNote: c.decision_note,
    })),
  );
}

export async function proposeChangeOrder(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ changeOrderId: string }>> {
  const parsed = parseInput(ProposeChangeOrderInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("propose_change_order", {
    p_project: v.projectId,
    p_title: v.title,
    p_description: v.description,
    p_amount_delta: v.amountDeltaCentavos,
    p_schedule_delta: v.scheduleDeltaDays,
  });
  if (error) return err(mapDbError(error));
  return ok({ changeOrderId: data });
}

export async function decideChangeOrder(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(DecideChangeOrderInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("decide_change_order", {
    p_change_order: parsed.value.changeOrderId,
    p_decision: parsed.value.decision,
    p_note: parsed.value.note,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

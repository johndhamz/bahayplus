import {
  CreateServiceRequestInput,
  DecideQuotationInput,
  QuotationIdInput,
  RequestIdInput,
  SaveQuotationDraftInput,
  SendQuotationInput,
} from "@bahayplus/validation/transactions/bookings";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import type { QuotationStatus } from "../domain/lifecycle";

export type ServiceRequestView = {
  id: string;
  householdId: string;
  organizationId: string;
  providerName: string;
  title: string;
  description: string;
  preferredDate: string | null;
  status: "open" | "quoted" | "accepted" | "declined" | "cancelled";
  createdAt: string;
};
export type QuotationLineView = {
  id: string;
  description: string;
  quantity: number;
  unitLabel: string;
  unitPriceCentavos: number;
  lineTotalCentavos: number;
};
export type QuotationView = {
  id: string;
  serviceRequestId: string;
  version: number;
  status: QuotationStatus;
  validUntil: string | null;
  notes: string;
  totalCentavos: number;
  sentAt: string | null;
  decidedAt: string | null;
  lines: QuotationLineView[];
};

const REQUEST_COLUMNS =
  "id, household_id, organization_id, title, description, preferred_date, status, created_at, organizations!inner(name)";

type RequestRow = {
  id: string;
  household_id: string;
  organization_id: string;
  title: string;
  description: string;
  preferred_date: string | null;
  status: string;
  created_at: string;
  organizations: { name: string };
};
const toRequest = (r: RequestRow): ServiceRequestView => ({
  id: r.id,
  householdId: r.household_id,
  organizationId: r.organization_id,
  providerName: r.organizations.name,
  title: r.title,
  description: r.description,
  preferredDate: r.preferred_date,
  status: r.status as ServiceRequestView["status"],
  createdAt: r.created_at,
});

export async function createServiceRequest(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ requestId: string }>> {
  const parsed = parseInput(CreateServiceRequestInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("create_service_request", {
    p_payload: {
      household_id: v.householdId,
      organization_id: v.organizationId,
      property_id: v.propertyId,
      provider_service_id: v.serviceId,
      title: v.title,
      description: v.description,
      preferred_date: v.preferredDate,
      idempotency_key: v.idempotencyKey,
      asset_id: v.assetId,
      pet_id: v.petId,
      vehicle_id: v.vehicleId,
    },
  });
  if (error) return err(mapDbError(error));
  return ok({ requestId: data });
}

export async function listServiceRequests(
  ctx: ServiceContext,
  scope: { householdId: string } | { organizationId: string },
  limit = 50,
): Promise<Result<ServiceRequestView[]>> {
  let query = ctx.db.from("service_requests").select(REQUEST_COLUMNS);
  query =
    "householdId" in scope
      ? query.eq("household_id", scope.householdId)
      : query.eq("organization_id", scope.organizationId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toRequest(r as unknown as RequestRow)));
}

export async function getServiceRequest(ctx: ServiceContext, requestId: string): Promise<Result<ServiceRequestView>> {
  const { data, error } = await ctx.db
    .from("service_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Request not found."));
  return ok(toRequest(data as unknown as RequestRow));
}

/** Quotations for a request. RLS hides drafts from customers. */
export async function listQuotations(ctx: ServiceContext, requestId: string): Promise<Result<QuotationView[]>> {
  const { data, error } = await ctx.db
    .from("quotations")
    .select(
      "id, service_request_id, version, status, valid_until, notes, total_centavos, sent_at, decided_at, quotation_lines(id, position, description, quantity, unit_label, unit_price_centavos, line_total_centavos)",
    )
    .eq("service_request_id", requestId)
    .order("version", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((q) => ({
      id: q.id,
      serviceRequestId: q.service_request_id,
      version: q.version,
      status: q.status as QuotationStatus,
      validUntil: q.valid_until,
      notes: q.notes,
      totalCentavos: q.total_centavos,
      sentAt: q.sent_at,
      decidedAt: q.decided_at,
      lines: [...(q.quotation_lines ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          id: l.id,
          description: l.description,
          quantity: Number(l.quantity),
          unitLabel: l.unit_label,
          unitPriceCentavos: l.unit_price_centavos,
          lineTotalCentavos: l.line_total_centavos ?? 0,
        })),
    })),
  );
}

export async function createQuotationDraft(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ quotationId: string }>> {
  const parsed = parseInput(RequestIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("create_quotation_draft", { p_request: parsed.value.requestId });
  if (error) return err(mapDbError(error));
  return ok({ quotationId: data });
}

/** Replaces a draft's lines (allowed only while draft; the database rejects edits otherwise). */
export async function saveQuotationDraft(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SaveQuotationDraftInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const updated = await ctx.db
    .from("quotations")
    .update({ notes: v.notes })
    .eq("id", v.quotationId)
    .eq("status", "draft")
    .select("id");
  if (updated.error) return err(mapDbError(updated.error));
  if (!updated.data?.length) return err(appError.conflict("Only draft quotations can be edited.", "quotation_locked"));
  const removed = await ctx.db.from("quotation_lines").delete().eq("quotation_id", v.quotationId);
  if (removed.error) return err(mapDbError(removed.error));
  const inserted = await ctx.db.from("quotation_lines").insert(
    v.lines.map((l, i) => ({
      quotation_id: v.quotationId,
      position: i + 1,
      description: l.description,
      quantity: l.quantity,
      unit_label: l.unitLabel,
      unit_price_centavos: l.unitPriceCentavos,
    })),
  );
  if (inserted.error) return err(mapDbError(inserted.error));
  return ok(true);
}

export async function sendQuotation(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SendQuotationInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("send_quotation", {
    p_quotation: parsed.value.quotationId,
    p_valid_until: parsed.value.validUntil,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function withdrawQuotation(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(QuotationIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("withdraw_quotation", { p_quotation: parsed.value.quotationId });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function decideQuotation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ bookingId: string | null }>> {
  const parsed = parseInput(DecideQuotationInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("decide_quotation", {
    p_quotation: parsed.value.quotationId,
    p_decision: parsed.value.decision,
    p_start: parsed.value.start as string,
  });
  if (error) return err(mapDbError(error));
  return ok({ bookingId: data ?? null });
}

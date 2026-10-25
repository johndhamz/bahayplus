import {
  ConfirmCompletionInput,
  RequestBookingInput,
  RescheduleBookingInput,
  TransitionBookingInput,
} from "@bahayplus/validation/transactions/bookings";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import type { BookingStatus } from "../domain/lifecycle";

export type BookingView = {
  id: string;
  householdId: string;
  organizationId: string;
  providerName: string;
  providerSlug: string;
  title: string;
  status: BookingStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  agreedAmountCentavos: number | null;
  pricingNote: string;
  customerNotes: string;
  quotationId: string | null;
  serviceRequestId: string | null;
  cancellationReason: string | null;
  cancelledBy: "customer" | "provider" | null;
  customerConfirmation: "confirmed" | "disputed" | null;
  completedAt: string | null;
  createdAt: string;
};

export type BookingEventView = {
  id: string;
  kind: string;
  actorSide: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
export type BookingLocation = { propertyName: string; address: string; notes: string } | null;

const COLUMNS =
  "id, household_id, organization_id, title, status, scheduled_start, scheduled_end, agreed_amount_centavos, pricing_note, customer_notes, quotation_id, service_request_id, cancellation_reason, cancelled_by, customer_confirmation, completed_at, created_at, organizations!inner(name, slug)";

type Row = {
  id: string;
  household_id: string;
  organization_id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  agreed_amount_centavos: number | null;
  pricing_note: string;
  customer_notes: string;
  quotation_id: string | null;
  service_request_id: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  customer_confirmation: string | null;
  completed_at: string | null;
  created_at: string;
  organizations: { name: string; slug: string };
};

const toView = (r: Row): BookingView => ({
  id: r.id,
  householdId: r.household_id,
  organizationId: r.organization_id,
  providerName: r.organizations.name,
  providerSlug: r.organizations.slug,
  title: r.title,
  status: r.status as BookingStatus,
  scheduledStart: r.scheduled_start,
  scheduledEnd: r.scheduled_end,
  agreedAmountCentavos: r.agreed_amount_centavos,
  pricingNote: r.pricing_note,
  customerNotes: r.customer_notes,
  quotationId: r.quotation_id,
  serviceRequestId: r.service_request_id,
  cancellationReason: r.cancellation_reason,
  cancelledBy: r.cancelled_by as BookingView["cancelledBy"],
  customerConfirmation: r.customer_confirmation as BookingView["customerConfirmation"],
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

export async function listBookings(
  ctx: ServiceContext,
  scope: { householdId: string } | { organizationId: string },
  filter: { statuses?: BookingStatus[]; limit?: number } = {},
): Promise<Result<BookingView[]>> {
  let query = ctx.db.from("bookings").select(COLUMNS);
  query =
    "householdId" in scope
      ? query.eq("household_id", scope.householdId)
      : query.eq("organization_id", scope.organizationId);
  if (filter.statuses?.length) query = query.in("status", filter.statuses);
  const { data, error } = await query
    .order("scheduled_start", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as unknown as Row)));
}

export async function getBooking(ctx: ServiceContext, bookingId: string): Promise<Result<BookingView>> {
  const { data, error } = await ctx.db.from("bookings").select(COLUMNS).eq("id", bookingId).maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Booking not found."));
  return ok(toView(data as unknown as Row));
}

export async function listBookingEvents(ctx: ServiceContext, bookingId: string): Promise<Result<BookingEventView[]>> {
  const { data, error } = await ctx.db
    .from("booking_events")
    .select("id, kind, actor_side, from_status, to_status, payload, created_at")
    .eq("booking_id", bookingId)
    .order("created_at");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      actorSide: e.actor_side,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      payload: (e.payload ?? {}) as Record<string, unknown>,
      createdAt: e.created_at,
    })),
  );
}

/** The job address; null for providers until the booking is confirmed (privacy). */
export async function getBookingLocation(ctx: ServiceContext, bookingId: string): Promise<Result<BookingLocation>> {
  const { data, error } = await ctx.db.rpc("booking_location", { p_booking: bookingId });
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

export async function requestBooking(ctx: ServiceContext, input: unknown): Promise<Result<{ bookingId: string }>> {
  const parsed = parseInput(RequestBookingInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("request_booking", {
    p_household: v.householdId,
    p_service: v.serviceId,
    p_property: v.propertyId,
    p_start: v.start,
    p_notes: v.notes,
    p_idempotency_key: v.idempotencyKey,
    p_asset: v.assetId as string,
    p_pet: v.petId as string,
    p_vehicle: v.vehicleId as string,
  });
  if (error) return err(mapDbError(error));
  return ok({ bookingId: data });
}

export async function transitionBooking(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(TransitionBookingInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("transition_booking", {
    p_booking: parsed.value.bookingId,
    p_action: parsed.value.action,
    p_reason: parsed.value.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function rescheduleBooking(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(RescheduleBookingInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("reschedule_booking", {
    p_booking: parsed.value.bookingId,
    p_start: parsed.value.start,
    p_reason: parsed.value.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function confirmBookingCompletion(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ConfirmCompletionInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("confirm_booking_completion", {
    p_booking: parsed.value.bookingId,
    p_outcome: parsed.value.outcome,
    p_note: parsed.value.note,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

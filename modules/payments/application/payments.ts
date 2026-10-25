import {
  CancelPaymentInput,
  CreateSettlementInput,
  RequestRefundInput,
  RunReconciliationInput,
  SetCommissionInput,
  StartPaymentInput,
  UpdateSettlementInput,
  type PaymentStatus,
  type ProviderEvent,
} from "@bahayplus/validation/payments/payments";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type Db, type ServiceContext } from "@bahayplus/modules/authorization";
import type { PaymentProvider } from "../domain/provider";

export type PaymentIntentView = {
  id: string;
  householdId: string;
  organizationId: string;
  bookingId: string | null;
  description: string;
  amountCentavos: number;
  amountRefundedCentavos: number;
  status: PaymentStatus;
  provider: string;
  externalReference: string | null;
  checkoutUrl: string | null;
  commissionCentavos: number | null;
  failureMessage: string | null;
  succeededAt: string | null;
  createdAt: string;
};
export type RefundView = {
  id: string;
  paymentIntentId: string;
  amountCentavos: number;
  reason: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
};
export type PaymentEventView = {
  id: number;
  eventType: string;
  amountCentavos: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  source: string;
  createdAt: string;
};

const COLUMNS =
  "id, household_id, organization_id, booking_id, description, amount_centavos, amount_refunded_centavos, status, provider, external_reference, checkout_url, commission_centavos, failure_message, succeeded_at, created_at";
type Row = {
  id: string;
  household_id: string;
  organization_id: string;
  booking_id: string | null;
  description: string;
  amount_centavos: number;
  amount_refunded_centavos: number;
  status: string;
  provider: string;
  external_reference: string | null;
  checkout_url: string | null;
  commission_centavos: number | null;
  failure_message: string | null;
  succeeded_at: string | null;
  created_at: string;
};
const toView = (r: Row): PaymentIntentView => ({
  id: r.id,
  householdId: r.household_id,
  organizationId: r.organization_id,
  bookingId: r.booking_id,
  description: r.description,
  amountCentavos: r.amount_centavos,
  amountRefundedCentavos: r.amount_refunded_centavos,
  status: r.status as PaymentStatus,
  provider: r.provider,
  externalReference: r.external_reference,
  checkoutUrl: r.checkout_url,
  commissionCentavos: r.commission_centavos,
  failureMessage: r.failure_message,
  succeededAt: r.succeeded_at,
  createdAt: r.created_at,
});

export async function listPayments(
  ctx: ServiceContext,
  scope: { organizationId: string } | { householdId: string } | { bookingId: string } | { all: true },
  limit = 100,
): Promise<Result<PaymentIntentView[]>> {
  let q = ctx.db.from("payment_intents").select(COLUMNS);
  if ("organizationId" in scope) q = q.eq("organization_id", scope.organizationId);
  else if ("householdId" in scope) q = q.eq("household_id", scope.householdId);
  else if ("bookingId" in scope) q = q.eq("booking_id", scope.bookingId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) return err(mapDbError(error));
  return ok((data ?? []).map((r) => toView(r as Row)));
}

export async function getPayment(ctx: ServiceContext, id: string): Promise<Result<PaymentIntentView>> {
  const { data, error } = await ctx.db.from("payment_intents").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return err(mapDbError(error));
  return data ? ok(toView(data as Row)) : err(appError.notFound("Payment not found."));
}

export async function listRefunds(ctx: ServiceContext, paymentIntentId: string): Promise<Result<RefundView[]>> {
  const { data, error } = await ctx.db
    .from("refunds")
    .select("id, payment_intent_id, amount_centavos, reason, status, created_at")
    .eq("payment_intent_id", paymentIntentId)
    .order("created_at");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      paymentIntentId: r.payment_intent_id,
      amountCentavos: r.amount_centavos,
      reason: r.reason,
      status: r.status as RefundView["status"],
      createdAt: r.created_at,
    })),
  );
}

export async function listPaymentEvents(
  ctx: ServiceContext,
  paymentIntentId: string,
): Promise<Result<PaymentEventView[]>> {
  const { data, error } = await ctx.db
    .from("payment_events")
    .select("id, event_type, amount_centavos, from_status, to_status, source, created_at")
    .eq("payment_intent_id", paymentIntentId)
    .order("id");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      amountCentavos: e.amount_centavos,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      source: e.source,
      createdAt: e.created_at,
    })),
  );
}

/**
 * Customer starts paying a booking: the intent (amount from the agreed price) is created as the user,
 * then the provider checkout is attached with the service-role client. Returns where to send the user.
 */
export async function startPayment(
  ctx: ServiceContext,
  admin: Db,
  provider: PaymentProvider,
  input: unknown,
  returnUrl: string,
): Promise<Result<{ paymentIntentId: string; checkoutUrl: string }>> {
  const parsed = parseInput(StartPaymentInput, input);
  if (!parsed.ok) return parsed;
  const { data: id, error } = await ctx.db.rpc("create_payment_intent", {
    p_booking: parsed.value.bookingId,
    p_provider: provider.id,
    p_idempotency_key: parsed.value.idempotencyKey,
  });
  if (error) return err(mapDbError(error));
  const intent = await getPayment(ctx, id);
  if (!intent.ok) return intent;
  if (intent.value.checkoutUrl) return ok({ paymentIntentId: id, checkoutUrl: intent.value.checkoutUrl });
  const session = await provider.createCheckout({
    paymentIntentId: id,
    amountCentavos: intent.value.amountCentavos,
    description: intent.value.description,
    returnUrl,
  });
  const attach = await admin.rpc("attach_payment_reference", {
    p_intent: id,
    p_external_reference: session.externalReference,
    p_checkout_url: session.checkoutUrl,
  });
  if (attach.error) return err(mapDbError(attach.error));
  return ok({ paymentIntentId: id, checkoutUrl: session.checkoutUrl });
}

export async function cancelPayment(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(CancelPaymentInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("cancel_payment_intent", { p_intent: parsed.value.paymentIntentId });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function requestRefund(
  ctx: ServiceContext,
  admin: Db,
  provider: PaymentProvider,
  input: unknown,
): Promise<Result<{ refundId: string }>> {
  const parsed = parseInput(RequestRefundInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data: refundId, error } = await ctx.db.rpc("request_refund", {
    p_intent: v.paymentIntentId,
    p_amount: v.amountCentavos,
    p_reason: v.reason,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error) return err(mapDbError(error));
  const intent = await getPayment(ctx, v.paymentIntentId);
  if (!intent.ok) return intent;
  const sent = await provider.requestRefund({
    refundId,
    paymentExternalReference: intent.value.externalReference ?? "",
    amountCentavos: v.amountCentavos,
    reason: v.reason,
  });
  const attach = await admin.rpc("attach_refund_reference", {
    p_refund: refundId,
    p_external_reference: sent.externalReference,
  });
  if (attach.error) return err(mapDbError(attach.error));
  return ok({ refundId });
}

/** Applies a provider event that has ALREADY been verified by `provider.parseWebhook` (service role only). */
export async function applyVerifiedEvent(admin: Db, providerId: string, event: ProviderEvent): Promise<Result<string>> {
  const { data, error } = await admin.rpc("apply_payment_event", {
    p_provider: providerId,
    p_event_id: event.id,
    p_event_type: event.type,
    p_external_reference: event.externalReference,
    p_amount_centavos: event.amountCentavos,
    p_currency: event.currency,
    p_signed_at: event.signedAt.toISOString(),
    p_payload: event.raw as never,
  });
  return error ? err(mapDbError(error)) : ok(data as string);
}

export type SettlementView = {
  id: string;
  organizationId: string;
  periodEnd: string;
  grossCentavos: number;
  refundsCentavos: number;
  commissionCentavos: number;
  netCentavos: number;
  itemCount: number;
  status: "draft" | "approved" | "paid_out";
  payoutReference: string | null;
  createdAt: string;
};

export async function listSettlements(
  ctx: ServiceContext,
  scope: { organizationId: string } | { all: true },
): Promise<Result<SettlementView[]>> {
  let q = ctx.db.from("settlements").select("*");
  if ("organizationId" in scope) q = q.eq("organization_id", scope.organizationId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((s) => ({
      id: s.id,
      organizationId: s.organization_id,
      periodEnd: s.period_end,
      grossCentavos: s.gross_centavos,
      refundsCentavos: s.refunds_centavos,
      commissionCentavos: s.commission_centavos,
      netCentavos: s.net_centavos,
      itemCount: s.item_count,
      status: s.status as SettlementView["status"],
      payoutReference: s.payout_reference,
      createdAt: s.created_at,
    })),
  );
}

export async function createSettlement(ctx: ServiceContext, input: unknown): Promise<Result<{ settlementId: string }>> {
  const parsed = parseInput(CreateSettlementInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("create_settlement", {
    p_org: parsed.value.organizationId,
    p_period_end: parsed.value.periodEnd,
  });
  return error ? err(mapDbError(error)) : ok({ settlementId: data });
}

export async function updateSettlement(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateSettlementInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("update_settlement_status", {
    p_settlement: v.settlementId,
    p_status: v.status,
    p_payout_reference: v.payoutReference,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type ReconciliationItemView = {
  externalReference: string;
  providerAmountCentavos: number | null;
  providerStatus: string | null;
  ledgerAmountCentavos: number | null;
  ledgerStatus: string | null;
  result: string;
};

export async function runReconciliation(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ runId: string; matched: number; mismatched: number; items: ReconciliationItemView[] }>> {
  const parsed = parseInput(RunReconciliationInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data: runId, error } = await ctx.db.rpc("run_reconciliation", {
    p_provider: v.provider,
    p_from: v.from,
    p_to: v.to,
    p_report: v.report,
  });
  if (error) return err(mapDbError(error));
  const [run, items] = await Promise.all([
    ctx.db.from("reconciliation_runs").select("matched, mismatched").eq("id", runId).single(),
    ctx.db
      .from("reconciliation_items")
      .select(
        "external_reference, provider_amount_centavos, provider_status, ledger_amount_centavos, ledger_status, result",
      )
      .eq("run_id", runId)
      .order("result"),
  ]);
  if (run.error) return err(mapDbError(run.error));
  return ok({
    runId,
    matched: run.data.matched,
    mismatched: run.data.mismatched,
    items: (items.data ?? []).map((i) => ({
      externalReference: i.external_reference,
      providerAmountCentavos: i.provider_amount_centavos,
      providerStatus: i.provider_status,
      ledgerAmountCentavos: i.ledger_amount_centavos,
      ledgerStatus: i.ledger_status,
      result: i.result,
    })),
  });
}

export async function setCommissionRate(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetCommissionInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("set_commission_rate", {
    p_org: v.organizationId as string,
    p_rate_bps: v.rateBps,
    p_effective_from: v.effectiveFrom,
    p_note: v.note,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

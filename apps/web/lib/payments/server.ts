import "server-only";
import { randomUUID } from "node:crypto";
import * as payments from "@bahayplus/modules/payments";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { paymentProvider, sandboxProvider } from "./provider";

/**
 * Payment operations that need the service role (provider references, verified provider events).
 * Each one first performs the user-scoped step through `ctx`, so RLS and permission checks still apply.
 */
const disabled = () => err(appError.validation([], "Online payments aren't available yet. Pay the provider directly."));

export async function startPaymentForUser(ctx: ServiceContext, input: unknown, returnPath: string) {
  const provider = paymentProvider();
  if (!provider) return disabled();
  return payments.startPayment(ctx, createSupabaseAdminClient(), provider, input, returnPath);
}

export async function requestRefundForUser(ctx: ServiceContext, input: unknown) {
  const provider = paymentProvider();
  if (!provider) return disabled();
  const admin = createSupabaseAdminClient();
  const res = await payments.requestRefund(ctx, admin, provider, input);
  // The sandbox confirms refunds immediately through the same signed-webhook path a real provider uses.
  const sandbox = sandboxProvider();
  if (res.ok && sandbox) {
    const { data } = await admin
      .from("refunds")
      .select("external_reference, amount_centavos")
      .eq("id", res.value.refundId)
      .single();
    if (data?.external_reference)
      await deliverSandboxEvent({
        type: "refund.succeeded",
        externalReference: data.external_reference,
        amountCentavos: data.amount_centavos,
      });
  }
  return res;
}

/** LOCAL SANDBOX ONLY: sign an event as the sandbox provider, verify it, and apply it. */
export async function deliverSandboxEvent(e: {
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded" | "refund.failed";
  externalReference: string;
  amountCentavos: number;
  failureCode?: string;
}): Promise<Result<string>> {
  const sandbox = sandboxProvider();
  if (!sandbox) return err(appError.forbidden("The payment sandbox is disabled."));
  const { body, signature } = sandbox.buildWebhook({ id: `sbx_evt_${randomUUID()}`, ...e });
  const event = sandbox.parseWebhook(body, new Headers({ [payments.SANDBOX_SIGNATURE_HEADER]: signature }));
  if ("error" in event) return err(appError.internal());
  return payments.applyVerifiedEvent(createSupabaseAdminClient(), sandbox.id, event);
}

export async function simulateSandboxPayment(
  ctx: ServiceContext,
  paymentIntentId: string,
  outcome: "succeeded" | "failed",
) {
  if (!sandboxProvider()) return err(appError.forbidden("The payment sandbox is disabled."));
  const intent = await payments.getPayment(ctx, paymentIntentId);
  if (!intent.ok) return intent;
  if (!intent.value.externalReference || intent.value.provider !== "sandbox")
    return err(appError.validation([], "This payment has no sandbox checkout."));
  const applied = await deliverSandboxEvent({
    type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
    externalReference: intent.value.externalReference,
    amountCentavos: intent.value.amountCentavos,
    failureCode: outcome === "failed" ? "card_declined" : undefined,
  });
  return applied.ok ? ok({ outcome: applied.value }) : applied;
}

export async function applyWebhook(providerId: string, rawBody: string, headers: Headers) {
  const provider = paymentProvider();
  if (!provider || provider.id !== providerId) return { status: 404 as const };
  const event = provider.parseWebhook(rawBody, headers);
  if ("error" in event) return { status: 400 as const, reason: event.error };
  const result = await payments.applyVerifiedEvent(createSupabaseAdminClient(), provider.id, event);
  return result.ok ? { status: 200 as const, outcome: result.value } : { status: 500 as const };
}

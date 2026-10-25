"use server";

import { revalidatePath } from "next/cache";
import * as payments from "@bahayplus/modules/payments";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { fromResult, type ActionResult } from "@bahayplus/types/action-result";
import type { Result } from "@bahayplus/types/result";
import { getServiceContext } from "@/lib/auth/context";
import { requestRefundForUser, simulateSandboxPayment, startPaymentForUser } from "@/lib/payments/server";

async function run<T>(fn: (ctx: ServiceContext) => Promise<Result<T>>, message: string): Promise<ActionResult<T>> {
  const ctx = await getServiceContext();
  if (!ctx)
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/", "layout");
  return fromResult(result, message);
}

const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/app");

export const startPaymentAction = async (i: unknown) =>
  run(
    (c) => startPaymentForUser(c, i, safePath((i as { returnPath?: unknown })?.returnPath)),
    "Redirecting to checkout…",
  );
export const cancelPaymentAction = async (i: unknown) => run((c) => payments.cancelPayment(c, i), "Payment cancelled.");
export const requestRefundAction = async (i: unknown) => run((c) => requestRefundForUser(c, i), "Refund requested.");
/** LOCAL SANDBOX ONLY. */
export const simulateSandboxPaymentAction = async (i: unknown) => {
  const { paymentIntentId, outcome } = (i ?? {}) as { paymentIntentId?: string; outcome?: string };
  return run(
    (c) => simulateSandboxPayment(c, String(paymentIntentId), outcome === "succeeded" ? "succeeded" : "failed"),
    "Sandbox event delivered.",
  );
};
export const createSettlementAction = async (i: unknown) =>
  run((c) => payments.createSettlement(c, i), "Settlement created.");
export const updateSettlementAction = async (i: unknown) =>
  run((c) => payments.updateSettlement(c, i), "Settlement updated.");
export const runReconciliationAction = async (i: unknown) =>
  run((c) => payments.runReconciliation(c, i), "Reconciliation complete.");
export const setCommissionRateAction = async (i: unknown) =>
  run((c) => payments.setCommissionRate(c, i), "Commission rate saved.");

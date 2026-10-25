import type { ProviderEvent } from "@bahayplus/validation/payments/payments";

export type CheckoutRequest = {
  paymentIntentId: string;
  amountCentavos: number;
  description: string;
  returnUrl: string;
};
export type CheckoutSession = { externalReference: string; checkoutUrl: string };
export type RefundRequest = {
  refundId: string;
  paymentExternalReference: string;
  amountCentavos: number;
  reason: string;
};

/**
 * A licensed payment provider (PSP/e-money partner). Bahay+ never holds funds: the provider collects
 * from the customer and settles to the business. Implementations must be idempotent on our ids.
 */
export interface PaymentProvider {
  readonly id: string;
  /** Shown to users; the sandbox must say it moves no real money. */
  readonly label: string;
  readonly isSandbox: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  requestRefund(request: RefundRequest): Promise<{ externalReference: string }>;
  /** Verifies the signature and maps the provider's payload to a normalised event; null if not verifiable. */
  parseWebhook(
    rawBody: string,
    headers: Headers,
  ): ProviderEvent | { error: "missing" | "malformed" | "expired" | "mismatch" | "invalid_payload" };
}

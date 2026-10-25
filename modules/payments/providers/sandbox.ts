import { ProviderEvent } from "@bahayplus/validation/payments/payments";
import type { CheckoutRequest, PaymentProvider, RefundRequest } from "../domain/provider";
import { signPayload, verifySignature } from "../domain/webhooks";

export const SANDBOX_SIGNATURE_HEADER = "x-bahayplus-sandbox-signature";

/**
 * LOCAL SANDBOX — NOT A PAYMENT PROVIDER. Moves no money. Its "checkout" is a Bahay+ page where a developer
 * chooses an outcome; the outcome is then delivered as a signed webhook through the same verified path a
 * real provider would use, so success never comes from the browser. Enabled only for local/test.
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = "sandbox";
  readonly label = "Local sandbox (no real money)";
  readonly isSandbox = true;
  constructor(private readonly opts: { webhookSecret: string; siteUrl: string }) {}

  async createCheckout(request: CheckoutRequest) {
    const externalReference = `sbx_pi_${request.paymentIntentId.replaceAll("-", "")}`;
    const checkoutUrl = new URL(`/payments/sandbox/${request.paymentIntentId}`, this.opts.siteUrl);
    checkoutUrl.searchParams.set("return", request.returnUrl);
    return { externalReference, checkoutUrl: checkoutUrl.pathname + checkoutUrl.search };
  }

  async requestRefund(request: RefundRequest) {
    return { externalReference: `sbx_re_${request.refundId.replaceAll("-", "")}` };
  }

  /** Builds a signed sandbox webhook (used by the sandbox checkout page and tests). */
  buildWebhook(
    event: {
      id: string;
      type: ProviderEvent["type"];
      externalReference: string;
      amountCentavos: number;
      failureCode?: string;
    },
    nowSeconds = Math.floor(Date.now() / 1000),
  ) {
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      data: {
        reference: event.externalReference,
        amount: event.amountCentavos,
        currency: "PHP",
        failure_code: event.failureCode,
      },
    });
    return { body, signature: signPayload(this.opts.webhookSecret, body, nowSeconds) };
  }

  parseWebhook(rawBody: string, headers: Headers) {
    const check = verifySignature(this.opts.webhookSecret, rawBody, headers.get(SANDBOX_SIGNATURE_HEADER));
    if (!check.ok) return { error: check.reason };
    let json: {
      id?: string;
      type?: string;
      data?: { reference?: string; amount?: number; currency?: string; failure_code?: string };
    };
    try {
      json = JSON.parse(rawBody);
    } catch {
      return { error: "invalid_payload" as const };
    }
    const parsed = ProviderEvent.safeParse({
      id: json.id,
      type: json.type,
      externalReference: json.data?.reference,
      amountCentavos: json.data?.amount,
      currency: json.data?.currency,
      signedAt: check.signedAt,
      raw: { failure_code: json.data?.failure_code ?? null },
    });
    return parsed.success ? parsed.data : { error: "invalid_payload" as const };
  }
}

export type ExternalChannel = "email" | "sms" | "push";

/** A delivery claimed from the queue, ready for an adapter. */
export type OutboundMessage = {
  deliveryId: string;
  attempt: number;
  to: string;
  title: string;
  body: string;
  /** App-relative link, e.g. "/app/h/…/bills/…". */
  link: string | null;
  kind: string;
};

/** Thrown by adapters. Retryable errors (timeouts, 429, 5xx) are retried with backoff; others fail the delivery. */
export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

/**
 * A delivery provider for one channel. Email ships with Resend (production) and Mailpit (local);
 * SMS and push have no implementation yet — their deliveries are recorded as `channel_not_configured`.
 */
export interface ChannelAdapter {
  readonly channel: ExternalChannel;
  readonly provider: string;
  send(message: OutboundMessage): Promise<{ providerMessageId?: string }>;
}

/** Mirrors public.fail_notification_delivery: 30s, 60s, 120s … capped at one hour. */
export function retryDelaySeconds(attempt: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(attempt - 1, 0));
}

/** HTTP status → whether a retry could succeed. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

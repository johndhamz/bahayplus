import type { PaymentIntentView } from "@bahayplus/modules/payments";
import { StatusBadge, type StatusTone } from "@bahayplus/ui/components/feedback/status-badge";
import type { PaymentStatus } from "@bahayplus/validation/payments/payments";

const LABEL: Record<PaymentStatus, string> = {
  requires_payment: "Awaiting payment",
  processing: "Confirming payment…",
  succeeded: "Paid",
  failed: "Payment failed",
  cancelled: "Cancelled",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};
const TONE: Record<PaymentStatus, StatusTone> = {
  requires_payment: "warning",
  processing: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
  partially_refunded: "info",
  refunded: "neutral",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge status={status} tone={TONE[status]} label={LABEL[status]} />;
}

export const isPaid = (p: Pick<PaymentIntentView, "status">) =>
  ["succeeded", "partially_refunded", "refunded"].includes(p.status);

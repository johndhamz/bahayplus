import "server-only";
import { listPayments } from "@bahayplus/modules/payments";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import type { BookingView } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { paymentProvider } from "@/lib/payments/provider";
import { CancelPaymentButton, PayButton } from "./payment-forms";
import { isPaid, PaymentStatusBadge } from "./payment-status";

/** Customer-side payment panel for a booking. Status always comes from the server (verified provider events). */
export async function BookingPaymentPanel({
  ctx,
  booking,
  canPay,
  returnPath,
}: {
  ctx: ServiceContext;
  booking: BookingView;
  canPay: boolean;
  returnPath: string;
}) {
  const provider = paymentProvider();
  const payments = await listPayments(ctx, { bookingId: booking.id });
  const list = payments.ok ? payments.value : [];
  const live = list.find((p) => ["requires_payment", "processing"].includes(p.status) || isPaid(p));
  const payable =
    !!provider &&
    canPay &&
    !live &&
    ["confirmed", "in_progress", "completed"].includes(booking.status) &&
    (booking.agreedAmountCentavos ?? 0) > 0;
  if (!list.length && !payable) return null;
  return (
    <SectionCard title="Payment" id="payment">
      {list.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1 tabular-nums">
                {formatPeso(p.amountCentavos)}
                {p.amountRefundedCentavos > 0 && ` · ${formatPeso(p.amountRefundedCentavos)} refunded`}
                <span className="block text-xs text-muted-foreground">
                  {p.succeededAt
                    ? `Paid ${formatManilaDateTime(p.succeededAt)}`
                    : `Started ${formatManilaDateTime(p.createdAt)}`}
                  {p.provider === "sandbox" ? " · sandbox (no real money)" : ""}
                  {p.failureMessage ? ` · ${p.failureMessage}` : ""}
                </span>
              </span>
              <PaymentStatusBadge status={p.status} />
              {canPay && p.status === "requires_payment" && <CancelPaymentButton paymentIntentId={p.id} />}
            </li>
          ))}
        </ul>
      )}
      {list.some((p) => p.status === "processing") && (
        <p className="text-xs text-muted-foreground">
          We mark a payment as paid only after the payment provider confirms it to our server. Refresh in a moment.
        </p>
      )}
      {payable && provider && (
        <PayButton
          bookingId={booking.id}
          amountCentavos={booking.agreedAmountCentavos!}
          returnPath={returnPath}
          providerLabel={provider.label}
        />
      )}
    </SectionCard>
  );
}

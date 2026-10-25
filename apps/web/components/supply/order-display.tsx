import Link from "next/link";
import {
  formatPoNumber,
  PO_STATUS_LABELS,
  type PurchaseOrderDetail,
  type PurchaseOrderView,
} from "@bahayplus/modules/suppliers";
import { StatusBadge, type StatusTone } from "@bahayplus/ui/components/feedback/status-badge";
import type { PurchaseOrderStatus } from "@bahayplus/validation/supply/supply";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";

const TONE: Record<PurchaseOrderStatus, StatusTone> = {
  submitted: "warning",
  accepted: "info",
  rejected: "danger",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
};

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <StatusBadge status={status} tone={TONE[status]} label={PO_STATUS_LABELS[status]} />;
}

export function OrderList({
  orders,
  hrefBase,
  counterparty,
}: {
  orders: PurchaseOrderView[];
  hrefBase: string;
  counterparty: "buyer" | "supplier";
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {orders.map((o) => (
        <li key={o.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`${hrefBase}/${o.id}`} className="font-medium hover:underline">
              {formatPoNumber(o.number)} · {counterparty === "buyer" ? o.buyerName : o.supplierName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatManilaDateTime(o.submittedAt)} · {formatPeso(o.totalCentavos)}
            </p>
          </div>
          <OrderStatusBadge status={o.status} />
        </li>
      ))}
    </ul>
  );
}

export function OrderLines({ order }: { order: PurchaseOrderDetail }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Scrollable table">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">Order lines</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground uppercase">
            <th scope="col" className="pb-2 font-semibold">
              Product
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Unit price
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {order.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2">
                {l.productName} <span className="text-xs text-muted-foreground">({l.sku})</span>
              </td>
              <td className="py-2 text-right tabular-nums">
                {l.quantity} {l.unit}
              </td>
              <td className="py-2 text-right tabular-nums">{formatPeso(l.unitPriceCentavos)}</td>
              <td className="py-2 text-right tabular-nums">{formatPeso(l.lineTotalCentavos)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3} className="pt-2 text-right">
              Total
            </th>
            <td className="pt-2 text-right font-semibold tabular-nums">{formatPeso(order.totalCentavos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const DELIVERY_LABEL = {
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
} as const;

export function OrderFacts({ order }: { order: PurchaseOrderDetail }) {
  const d = order.delivery;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Deliver to</dt>
        <dd className="whitespace-pre-line">{order.deliveryAddress}</dd>
        {order.deliveryContact && <dd className="text-xs text-muted-foreground">{order.deliveryContact}</dd>}
      </div>
      <div>
        <dt className="text-muted-foreground">Requested delivery</dt>
        <dd>{order.requestedDeliveryOn ? formatManilaDate(order.requestedDeliveryOn) : "No preference"}</dd>
      </div>
      {order.buyerNotes && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Buyer notes</dt>
          <dd className="whitespace-pre-line">{order.buyerNotes}</dd>
        </div>
      )}
      {order.decisionReason && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">
            {order.status === "rejected" ? "Rejection reason" : `Cancelled by ${order.cancelledBy ?? ""}`}
          </dt>
          <dd>{order.decisionReason}</dd>
        </div>
      )}
      {d && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="font-medium">
            {DELIVERY_LABEL[d.status]}
            {d.attempts > 1 ? ` (attempt ${d.attempts})` : ""}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {[
              d.courier && `Courier: ${d.courier}`,
              d.trackingRef && `Tracking: ${d.trackingRef}`,
              d.scheduledFor && `Scheduled ${formatManilaDate(d.scheduledFor)}`,
            ]
              .filter(Boolean)
              .join(" · ") || "No courier details"}
          </dd>
          {d.failureReason && <dd className="text-xs text-destructive">Failed: {d.failureReason}</dd>}
          {d.deliveredAt && (
            <dd className="text-xs text-muted-foreground">
              Delivered {formatManilaDateTime(d.deliveredAt)}
              {d.receivedBy ? `, received by ${d.receivedBy}` : ""}
            </dd>
          )}
        </div>
      )}
    </dl>
  );
}

import type { PurchaseOrderStatus } from "@bahayplus/validation/supply/supply";

export type OrderSide = "buyer" | "supplier";
export type PurchaseOrderAction =
  "accept" | "reject" | "ship" | "deliver" | "fail_delivery" | "reattempt" | "confirm_receipt" | "cancel";

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  submitted: "New",
  accepted: "Accepted",
  rejected: "Rejected",
  shipped: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Mirrors the purchase-order SQL commands so each side is only offered valid actions. */
export function allowedOrderActions(
  status: PurchaseOrderStatus,
  side: OrderSide,
  delivery: "out_for_delivery" | "delivered" | "failed" | null,
): PurchaseOrderAction[] {
  const actions: PurchaseOrderAction[] = [];
  if (side === "supplier") {
    if (status === "submitted") actions.push("accept", "reject");
    if (status === "accepted") actions.push("ship");
    if (status === "shipped" && delivery === "out_for_delivery") actions.push("deliver", "fail_delivery");
    if (status === "shipped" && delivery === "failed") actions.push("reattempt");
  } else if (status === "shipped") {
    actions.push("confirm_receipt");
  }
  if (status === "submitted" || status === "accepted") actions.push("cancel");
  return actions;
}

export const formatPoNumber = (n: number) => `PO-${String(n).padStart(6, "0")}`;

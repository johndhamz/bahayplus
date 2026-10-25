"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { allowedOrderActions, type OrderSide } from "@bahayplus/modules/suppliers";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import type { PurchaseOrderStatus } from "@bahayplus/validation/supply/supply";
import {
  cancelPurchaseOrderAction,
  decidePurchaseOrderAction,
  shipPurchaseOrderAction,
  updateDeliveryAction,
} from "@/lib/actions/operations";

export function OrderActions({
  orderId,
  status,
  side,
  delivery,
}: {
  orderId: string;
  status: PurchaseOrderStatus;
  side: OrderSide;
  delivery: "out_for_delivery" | "delivered" | "failed" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [date, setDate] = useState("");
  const actions = allowedOrderActions(status, side, delivery);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error?.message ?? "Something went wrong.");
          return resolve(false);
        }
        toast.success(msg);
        setText("");
        router.refresh();
        resolve(true);
      }),
    );
  if (!actions.length) return <p className="text-sm text-muted-foreground">No actions available.</p>;
  const reasonField = (label: string) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      {label}
      <Input value={text} onChange={(e) => setText(e.target.value)} />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      {actions.includes("ship") && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Courier
            <Input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. Own truck, Lalamove"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Tracking / plate no.
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Delivery date
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.includes("accept") && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => decidePurchaseOrderAction({ purchaseOrderId: orderId, decision: "accepted", note: "" }),
                "Order accepted.",
              )
            }
          >
            Accept order
          </Button>
        )}
        {actions.includes("ship") && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  shipPurchaseOrderAction({
                    purchaseOrderId: orderId,
                    courier,
                    trackingRef: tracking,
                    scheduledFor: date,
                  }),
                "Marked as shipped.",
              )
            }
          >
            Mark as shipped
          </Button>
        )}
        {actions.includes("deliver") && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => updateDeliveryAction({ purchaseOrderId: orderId, status: "delivered", detail: text }),
                "Marked delivered.",
              )
            }
          >
            Mark delivered
          </Button>
        )}
        {actions.includes("confirm_receipt") && (
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => updateDeliveryAction({ purchaseOrderId: orderId, status: "delivered", detail: text }),
                "Receipt confirmed.",
              )
            }
          >
            Confirm we received it
          </Button>
        )}
        {actions.includes("reattempt") && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () => updateDeliveryAction({ purchaseOrderId: orderId, status: "out_for_delivery", detail: "" }),
                "Delivery re-attempt recorded.",
              )
            }
          >
            Re-attempt delivery
          </Button>
        )}
        {actions.includes("fail_delivery") && (
          <ConfirmationDialog
            title="Record a failed delivery?"
            description={reasonField("What happened?")}
            confirmLabel="Record failure"
            tone="destructive"
            onConfirm={() =>
              run(
                () => updateDeliveryAction({ purchaseOrderId: orderId, status: "failed", detail: text }),
                "Failure recorded.",
              )
            }
            trigger={
              <Button variant="outline" disabled={pending}>
                Delivery failed
              </Button>
            }
          />
        )}
        {actions.includes("reject") && (
          <ConfirmationDialog
            title="Reject this order?"
            description={reasonField("Reason for the buyer")}
            confirmLabel="Reject order"
            tone="destructive"
            onConfirm={() =>
              run(
                () => decidePurchaseOrderAction({ purchaseOrderId: orderId, decision: "rejected", note: text }),
                "Order rejected.",
              )
            }
            trigger={
              <Button variant="outline" className="text-destructive" disabled={pending}>
                Reject
              </Button>
            }
          />
        )}
        {actions.includes("cancel") && (
          <ConfirmationDialog
            title="Cancel this order?"
            description={reasonField("Reason")}
            confirmLabel="Cancel order"
            tone="destructive"
            onConfirm={() =>
              run(() => cancelPurchaseOrderAction({ purchaseOrderId: orderId, reason: text }), "Order cancelled.")
            }
            trigger={
              <Button variant="ghost" className="text-destructive" disabled={pending}>
                Cancel order
              </Button>
            }
          />
        )}
      </div>
      {(actions.includes("deliver") || actions.includes("confirm_receipt")) && (
        <label className="flex flex-col gap-1 text-sm font-medium sm:w-72">
          Received by (optional)
          <Input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
    </div>
  );
}

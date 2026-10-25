"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { formatPeso } from "@bahayplus/types/money";
import {
  cancelPaymentAction,
  requestRefundAction,
  simulateSandboxPaymentAction,
  startPaymentAction,
} from "@/lib/actions/payments";

export function PayButton({
  bookingId,
  amountCentavos,
  returnPath,
  providerLabel,
}: {
  bookingId: string;
  amountCentavos: number;
  returnPath: string;
  providerLabel: string;
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        disabled={pending}
        className="w-fit"
        onClick={() =>
          start(async () => {
            const r = await startPaymentAction({ bookingId, idempotencyKey: key, returnPath });
            if (!r.ok) return void toast.error(r.error.message);
            router.push(r.data.checkoutUrl);
          })
        }
      >
        Pay {formatPeso(amountCentavos)} online
      </Button>
      <span className="text-xs text-muted-foreground">via {providerLabel}</span>
    </div>
  );
}

export function CancelPaymentButton({ paymentIntentId }: { paymentIntentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelPaymentAction({ paymentIntentId });
          if (!r.ok) return void toast.error(r.error.message);
          router.refresh();
        })
      }
    >
      Cancel payment
    </Button>
  );
}

export function SandboxCheckout({ paymentIntentId, returnPath }: { paymentIntentId: string; returnPath: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const simulate = (outcome: "succeeded" | "failed") =>
    start(async () => {
      const r = await simulateSandboxPaymentAction({ paymentIntentId, outcome });
      if (!r.ok) return void toast.error(r.error.message);
      router.push(returnPath);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => simulate("succeeded")}>
        Simulate successful payment
      </Button>
      <Button disabled={pending} variant="outline" onClick={() => simulate("failed")}>
        Simulate declined payment
      </Button>
    </div>
  );
}

export function RefundForm({
  paymentIntentId,
  refundableCentavos,
}: {
  paymentIntentId: string;
  refundableCentavos: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(formatPeso(refundableCentavos).replace("₱", ""));
  const [reason, setReason] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await requestRefundAction({ paymentIntentId, amountCentavos: amount, reason, idempotencyKey: key });
          if (!r.ok) return setError(r.error.message);
          toast.success("Refund requested.");
          setReason("");
          setKey(crypto.randomUUID());
          router.refresh();
        });
      }}
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Amount (₱)
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reason
          <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <Button type="submit" variant="outline" disabled={pending}>
          Refund
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Up to {formatPeso(refundableCentavos)} can still be refunded.</p>
    </form>
  );
}

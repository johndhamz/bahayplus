"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { VERIFICATION_ITEM_LABELS, type VerificationItemView } from "@bahayplus/modules/providers";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";
import {
  decideVerificationAction,
  revokeVerificationAction,
  startVerificationReviewAction,
} from "@/lib/actions/marketplace";

export function StartReviewButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await startVerificationReviewAction({ requestId });
          if (!r.ok) toast.error(r.error.message);
          else router.refresh();
        })
      }
    >
      Start review
    </Button>
  );
}

export function DecideForm({
  requestId,
  items,
  defaultExpiry,
}: {
  requestId: string;
  items: VerificationItemView[];
  defaultExpiry: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "verified" | "rejected">>(() =>
    Object.fromEntries(items.map((i) => [i.id, "rejected"])),
  );
  const [notes, setNotes] = useState("");
  const [internal, setInternal] = useState("");
  const [expiresOn, setExpiresOn] = useState(defaultExpiry);
  const submit = (decision: "approved" | "rejected") =>
    start(async () => {
      setError(null);
      const r = await decideVerificationAction({
        requestId,
        decision,
        items: items.map((i) => ({ itemId: i.id, status: decisions[i.id]!, note: "" })),
        decisionNotes: notes,
        internalNotes: internal,
        expiresOn: decision === "approved" ? expiresOn : "",
      });
      if (!r.ok) return setError(r.error.message);
      toast.success(decision === "approved" ? "Approved." : "Rejected.");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-4">
      <FormAlert message={error} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Mark each document</legend>
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2">
            <span className="min-w-48 flex-1 text-sm">{VERIFICATION_ITEM_LABELS[i.itemType].label}</span>
            {(["verified", "rejected"] as const).map((s) => (
              <label key={s} className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`d-${i.id}`}
                  checked={decisions[i.id] === s}
                  onChange={() => setDecisions((d) => ({ ...d, [i.id]: s }))}
                  className="size-4 accent-[var(--brand)]"
                />
                {s === "verified" ? "Verified" : "Not verified"}
              </label>
            ))}
          </div>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Message to the provider
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Internal notes (admins only)
        <Textarea value={internal} onChange={(e) => setInternal(e.target.value)} rows={2} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:w-56">
        Verification valid until
        <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => submit("approved")}>
          Approve
        </Button>
        <Button disabled={pending} variant="outline" className="text-destructive" onClick={() => submit("rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function RevokeButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmationDialog
      title="Revoke this verification?"
      description={
        <span className="flex flex-col gap-2">
          <span>The provider is removed from the marketplace immediately.</span>
          <label className="flex flex-col gap-1 text-foreground">
            <span className="text-sm font-medium">Reason (shown to the provider)</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        </span>
      }
      confirmLabel="Revoke"
      tone="destructive"
      onConfirm={async () => {
        const r = await revokeVerificationAction({ requestId, reason });
        if (!r.ok) {
          toast.error(r.error.message);
          return false;
        }
        router.refresh();
      }}
      trigger={
        <Button variant="outline" className="text-destructive">
          Revoke verification
        </Button>
      }
    />
  );
}

"use client";

import { Ban, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PAYMENT_METHOD_LABELS } from "@bahayplus/modules/bills";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { CreateBillInput, RecordBillPaymentInput, SetBillAmountInput } from "@bahayplus/validation/finance/bills";
import { asAnyControl, DateField, MoneyField, SelectField, TextField, toOptions } from "@/components/forms/fields";
import {
  cancelBillReminderAction,
  createBillAction,
  recordBillPaymentAction,
  setBillAmountAction,
  voidBillPaymentAction,
} from "@/lib/actions/finance";

export function SetBillAmountForm({ billId, current }: { billId: string; current: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SetBillAmountInput,
    defaultValues: { billId, amountCentavos: current, notes: "" },
    action: setBillAmountAction,
    onSuccess: () => {
      toast.success("Amount saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <MoneyField
        control={asAnyControl(form.control)}
        name="amountCentavos"
        label="Amount on statement"
        required
        className="flex-1"
      />
      <SubmitButton pending={pending} className="sm:mt-7">
        Save amount
      </SubmitButton>
      <FormAlert message={formError} />
    </form>
  );
}

/**
 * Records a payment made outside Bahay+. The idempotency key is created once per form session,
 * so double-taps and network retries record a single payment.
 */
export function RecordPaymentForm({ billId, remaining, today }: { billId: string; remaining: string; today: string }) {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const blank = {
    billId,
    amountCentavos: remaining,
    paidOn: today,
    method: "gcash" as const,
    reference: "",
    idempotencyKey,
  };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: RecordBillPaymentInput,
    defaultValues: blank,
    action: recordBillPaymentAction,
    onSuccess: () => {
      toast.success("Payment recorded.");
      const next = crypto.randomUUID();
      setIdempotencyKey(next);
      form.reset({ ...blank, idempotencyKey: next });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField control={control} name="amountCentavos" label="Amount paid" required />
        <DateField control={control} name="paidOn" label="Date paid" required />
        <SelectField
          control={control}
          name="method"
          label="Paid via"
          required
          options={toOptions(PAYMENT_METHOD_LABELS)}
        />
        <TextField
          control={control}
          name="reference"
          label="Reference no."
          description="From your GCash/bank receipt."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Bahay+ records payments you made elsewhere. No money moves through Bahay+.
      </p>
      <SubmitButton pending={pending} pendingLabel="Recording…" className="w-full sm:w-fit">
        Record payment
      </SubmitButton>
    </form>
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmationDialog
      title="Void this payment?"
      description={
        <span className="flex flex-col gap-2">
          <span>
            The payment and its budget expense are kept in history but no longer count. Use this to fix mistakes.
          </span>
          <label className="flex flex-col gap-1 text-foreground">
            <span className="text-sm font-medium">Reason</span>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Recorded twice" />
          </label>
        </span>
      }
      confirmLabel="Void payment"
      tone="destructive"
      onConfirm={async () => {
        const r = await voidBillPaymentAction({ paymentId, reason });
        if (!r.ok) {
          toast.error(r.error.message);
          return false;
        }
        toast.success("Payment voided.");
        router.refresh();
      }}
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive">
          <Ban aria-hidden="true" /> Void
        </Button>
      }
    />
  );
}

export function CancelReminderButton({ reminderId }: { reminderId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const r = await cancelBillReminderAction({ reminderId });
        if (!r.ok) return toast.error(r.error.message);
        toast.success("Reminder cancelled.");
        router.refresh();
      }}
    >
      <BellOff aria-hidden="true" /> Cancel
    </Button>
  );
}

export function CreateOneOffBillForm({
  accountId,
  householdId,
  today,
}: {
  accountId: string;
  householdId: string;
  today: string;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateBillInput,
    defaultValues: { accountId, dueOn: today, amountCentavos: "", notes: "" },
    action: createBillAction,
    onSuccess: (d) => {
      toast.success("Bill created.");
      router.push(`/app/h/${householdId}/bills/${d.billId}`);
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField control={control} name="dueOn" label="Due date" required />
        <MoneyField
          control={control}
          name="amountCentavos"
          label="Amount"
          description="Leave empty if you don't know it yet."
        />
      </div>
      <SubmitButton pending={pending} className="w-fit">
        Add bill
      </SubmitButton>
    </form>
  );
}

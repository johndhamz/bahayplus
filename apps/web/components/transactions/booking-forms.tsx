"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  allowedBookingActions,
  canReschedule,
  type BookingAction,
  type BookingStatus,
  type Side,
} from "@bahayplus/modules/bookings";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import {
  CreateServiceRequestInput,
  RequestBookingInput,
  RescheduleBookingInput,
} from "@bahayplus/validation/transactions/bookings";
import { asAnyControl, DateField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import {
  confirmCompletionAction,
  createServiceRequestAction,
  requestBookingAction,
  rescheduleBookingAction,
  transitionBookingAction,
} from "@/lib/actions/transactions";

type Option = { id: string; name: string };

function DateTimeField({
  control,
  name,
  label,
  min,
}: {
  control: ReturnType<typeof asAnyControl>;
  name: string;
  label: string;
  min: string;
}) {
  return (
    <FormField control={control} name={name} label={label} required description="Philippine time (PHT)">
      {(field, a11y) => <Input {...field} {...a11y} value={field.value ?? ""} type="datetime-local" min={min} />}
    </FormField>
  );
}

export function NewBookingForm({
  householdId,
  serviceId,
  serviceTitle,
  providerName,
  properties,
  defaultPropertyId,
  minStart,
}: {
  householdId: string;
  serviceId: string;
  serviceTitle: string;
  providerName: string;
  properties: Option[];
  defaultPropertyId: string | null;
  minStart: string;
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: RequestBookingInput,
    defaultValues: {
      householdId,
      serviceId,
      propertyId: defaultPropertyId ?? properties[0]?.id ?? "",
      start: "",
      notes: "",
      idempotencyKey: key,
      assetId: "",
      petId: "",
      vehicleId: "",
    },
    action: requestBookingAction,
    onSuccess: (d) => {
      toast.success("Booking sent.");
      router.push(`/app/h/${householdId}/bookings/${d.bookingId}`);
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-semibold">{serviceTitle}</span> with {providerName}
      </p>
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="propertyId"
          label="Where"
          required
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
        <DateTimeField control={control} name="start" label="When" min={minStart} />
      </div>
      <TextAreaField control={control} name="notes" label="Notes for the provider" rows={3} />
      <p className="text-xs text-muted-foreground">
        Your exact address is shared only after the booking is confirmed. Payment is arranged directly with the
        provider.
      </p>
      <SubmitButton pending={pending} pendingLabel="Booking…" className="w-full sm:w-fit">
        Book
      </SubmitButton>
    </form>
  );
}

export function NewQuoteRequestForm({
  householdId,
  organizationId,
  serviceId,
  providerName,
  properties,
  defaultPropertyId,
  defaultTitle,
}: {
  householdId: string;
  organizationId: string;
  serviceId: string | null;
  providerName: string;
  properties: Option[];
  defaultPropertyId: string | null;
  defaultTitle: string;
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateServiceRequestInput,
    defaultValues: {
      householdId,
      organizationId,
      serviceId: serviceId ?? "",
      propertyId: defaultPropertyId ?? properties[0]?.id ?? "",
      title: defaultTitle,
      description: "",
      preferredDate: "",
      idempotencyKey: key,
      assetId: "",
      petId: "",
      vehicleId: "",
    },
    action: createServiceRequestAction,
    onSuccess: (d) => {
      toast.success("Quote request sent.");
      router.push(`/app/h/${householdId}/bookings/requests/${d.requestId}`);
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">Request a quotation from {providerName}</p>
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="title" label="What do you need?" required />
        <SelectField
          control={control}
          name="propertyId"
          label="Where"
          required
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
        <DateField control={control} name="preferredDate" label="Preferred date" />
      </div>
      <TextAreaField
        control={control}
        name="description"
        label="Details"
        rows={4}
        description="Sizes, brands, photos to follow — anything that helps the provider quote accurately."
      />
      <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full sm:w-fit">
        Request quote
      </SubmitButton>
    </form>
  );
}

const ACTION_LABELS: Record<BookingAction, string> = {
  confirm: "Confirm booking",
  decline: "Decline",
  start: "Start job",
  complete: "Mark completed",
  cancel: "Cancel booking",
};

export function BookingActions({
  bookingId,
  status,
  side,
  minStart,
}: {
  bookingId: string;
  status: BookingStatus;
  side: Side;
  minStart: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const act = (action: BookingAction, r = "") =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await transitionBookingAction({ bookingId, action, reason: r });
        if (!res.ok) {
          toast.error(res.error.message);
          return resolve(false);
        }
        toast.success("Booking updated.");
        router.refresh();
        resolve(true);
      }),
    );
  const actions = allowedBookingActions(status, side);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => a !== "cancel" && a !== "decline")
          .map((a) => (
            <Button key={a} disabled={pending} onClick={() => act(a)}>
              {ACTION_LABELS[a]}
            </Button>
          ))}
        {canReschedule(status) && (
          <Button variant="outline" onClick={() => setShowReschedule((s) => !s)} aria-expanded={showReschedule}>
            Reschedule
          </Button>
        )}
        {(["decline", "cancel"] as const)
          .filter((a) => actions.includes(a))
          .map((a) => (
            <ConfirmationDialog
              key={a}
              title={`${ACTION_LABELS[a]}?`}
              description={
                <span className="flex flex-col gap-2">
                  <span>The other side is notified and the time slot is released.</span>
                  <label className="flex flex-col gap-1 text-foreground">
                    <span className="text-sm font-medium">Reason</span>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                </span>
              }
              confirmLabel={ACTION_LABELS[a]}
              tone="destructive"
              onConfirm={() => act(a, reason)}
              trigger={
                <Button variant="outline" className="text-destructive">
                  {ACTION_LABELS[a]}
                </Button>
              }
            />
          ))}
      </div>
      {showReschedule && (
        <RescheduleForm bookingId={bookingId} minStart={minStart} onDone={() => setShowReschedule(false)} />
      )}
    </div>
  );
}

function RescheduleForm({ bookingId, minStart, onDone }: { bookingId: string; minStart: string; onDone: () => void }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: RescheduleBookingInput,
    defaultValues: { bookingId, start: "", reason: "" },
    action: rescheduleBookingAction,
    onSuccess: () => {
      toast.success("Booking rescheduled.");
      onDone();
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <FormAlert message={formError} />
      <DateTimeField control={control} name="start" label="New time" min={minStart} />
      <TextField control={control} name="reason" label="Reason" />
      <SubmitButton pending={pending} size="sm" className="w-fit">
        Save new time
      </SubmitButton>
    </form>
  );
}

export function ConfirmCompletion({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const respond = (outcome: "confirmed" | "disputed") =>
    start(async () => {
      const r = await confirmCompletionAction({ bookingId, outcome, note: "" });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(outcome === "confirmed" ? "Thanks for confirming." : "We've recorded your dispute.");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => respond("confirmed")}>
        Yes, the job is done
      </Button>
      <Button disabled={pending} variant="outline" onClick={() => respond("disputed")}>
        Report a problem
      </Button>
    </div>
  );
}

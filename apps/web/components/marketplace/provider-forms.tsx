"use client";

import { Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  VERIFICATION_ITEM_LABELS,
  type ProviderProfileView,
  type ProviderServiceView,
} from "@bahayplus/modules/providers";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import {
  AddServiceAreaInput,
  CreatePortfolioItemInput,
  CreateProviderServiceInput,
  UpdateProviderProfileInput,
  UpdateProviderServiceInput,
  WEEKDAYS,
} from "@bahayplus/validation/marketplace/provider";
import {
  ReplyToReviewInput,
  SubmitVerificationInput,
  VERIFICATION_ITEM_TYPES,
} from "@bahayplus/validation/marketplace/trust";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, type OrgFileEntityType } from "@bahayplus/validation/registry/files";
import { formatPeso } from "@bahayplus/types/money";
import type { ActionResult } from "@bahayplus/types/action-result";
import {
  asAnyControl,
  DateField,
  MoneyField,
  SelectField,
  TextAreaField,
  TextField,
  type AnyControl,
} from "@/components/forms/fields";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  addServiceAreaAction,
  createPortfolioItemAction,
  createProviderServiceAction,
  prepareOrgUploadAction,
  registerOrgFileAction,
  replyToReviewAction,
  setAvailabilityAction,
  submitVerificationAction,
  updateProviderProfileAction,
  updateProviderServiceAction,
} from "@/lib/actions/marketplace";
import { AVAILABILITY_LABELS } from "./labels";

const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" } as const;

function useRefreshOnSuccess(message: string) {
  const router = useRouter();
  return () => {
    toast.success(message);
    router.refresh();
  };
}

export function ProviderProfileForm({ profile }: { profile: ProviderProfileView }) {
  const done = useRefreshOnSuccess("Profile saved.");
  const [hours, setHours] = useState(
    () =>
      Object.fromEntries(WEEKDAYS.map((d) => [d, profile.businessHours[d]?.[0] ?? null])) as Record<
        (typeof WEEKDAYS)[number],
        [string, string] | null
      >,
  );
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateProviderProfileInput,
    defaultValues: {
      organizationId: profile.organizationId,
      tagline: profile.tagline,
      description: profile.description,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      messengerUrl: profile.messengerUrl,
      yearEstablished: profile.yearEstablished?.toString() ?? "",
      teamSize: profile.teamSize?.toString() ?? "",
      businessHours: profile.businessHours,
      acceptsBookNow: profile.acceptsBookNow,
      acceptsQuoteRequests: profile.acceptsQuoteRequests,
      acceptsContact: profile.acceptsContact,
      acceptsUrgent: profile.acceptsUrgent,
      isPublished: profile.isPublished,
    },
    action: (values) =>
      updateProviderProfileAction({
        ...values,
        businessHours: Object.fromEntries(
          Object.entries(hours)
            .filter(([, v]) => v)
            .map(([d, v]) => [d, [v]]),
        ),
      }),
    onSuccess: done,
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="tagline"
          label="Tagline"
          description="One line customers see in search results."
          className="sm:col-span-2"
        />
        <TextAreaField control={control} name="description" label="About the business" rows={4} />
        <div className="grid gap-4">
          <TextField control={control} name="phone" label="Phone" inputProps={{ type: "tel", inputMode: "tel" }} />
          <TextField control={control} name="email" label="Email" inputProps={{ type: "email" }} />
        </div>
        <TextField control={control} name="website" label="Website" inputProps={{ placeholder: "https://" }} />
        <TextField
          control={control}
          name="messengerUrl"
          label="Messenger / Facebook page"
          inputProps={{ placeholder: "https://m.me/yourpage" }}
        />
        <TextField
          control={control}
          name="yearEstablished"
          label="Year established"
          inputProps={{ inputMode: "numeric" }}
        />
        <TextField control={control} name="teamSize" label="Team size" inputProps={{ inputMode: "numeric" }} />
      </div>
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Business hours</legend>
        {WEEKDAYS.map((d) => (
          <div key={d} className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-10 w-28 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-[var(--brand)]"
                checked={!!hours[d]}
                onChange={(e) => setHours((h) => ({ ...h, [d]: e.target.checked ? ["08:00", "17:00"] : null }))}
              />
              {DAY_LABELS[d]}
            </label>
            {hours[d] ? (
              <>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[d]} opening time`}
                  value={hours[d]![0]}
                  onChange={(e) => setHours((h) => ({ ...h, [d]: [e.target.value, h[d]![1]] }))}
                  className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABELS[d]} closing time`}
                  value={hours[d]![1]}
                  onChange={(e) => setHours((h) => ({ ...h, [d]: [h[d]![0], e.target.value] }))}
                  className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                />
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">How customers can reach you</legend>
        {[
          ["acceptsBookNow", "Book Now (fixed-price services)"],
          ["acceptsQuoteRequests", "Request a quote"],
          ["acceptsContact", "Show my contact details"],
          ["acceptsUrgent", "List me for urgent requests (plumbing, electrical, locksmith, roadside…)"],
          ["isPublished", "Publish my profile (listed once verification is approved)"],
        ].map(([name, label]) => (
          <label key={name} className="flex min-h-10 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--brand)]" {...form.register(name as "isPublished")} />
            {label}
          </label>
        ))}
      </fieldset>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function AvailabilityToggle({
  organizationId,
  status,
}: {
  organizationId: string;
  status: keyof typeof AVAILABILITY_LABELS;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <fieldset className="flex flex-wrap gap-2" disabled={pending}>
      <legend className="sr-only">Availability</legend>
      {(Object.keys(AVAILABILITY_LABELS) as (keyof typeof AVAILABILITY_LABELS)[]).map((s) => (
        <label
          key={s}
          className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${s === status ? "border-brand bg-sage font-semibold" : "border-border"}`}
        >
          <input
            type="radio"
            name="availability"
            className="sr-only"
            checked={s === status}
            onChange={() =>
              startTransition(async () => {
                const r = await setAvailabilityAction({ organizationId, status: s });
                if (!r.ok) toast.error(r.error.message);
                else router.refresh();
              })
            }
          />
          {AVAILABILITY_LABELS[s]}
        </label>
      ))}
    </fieldset>
  );
}

type Category = { id: string; name: string; division: string };

function ServiceFields({
  control,
  register,
  categories,
}: {
  control: AnyControl;
  register: (n: string) => object;
  categories: Category[];
}) {
  const pricing = useWatch({ control, name: "pricingModel" });
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="title" label="Service name" required />
        <SelectField
          control={control}
          name="categoryId"
          label="Category"
          required
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          control={control}
          name="pricingModel"
          label="Pricing"
          required
          options={[
            { value: "fixed", label: "Fixed price" },
            { value: "starting_at", label: "Starting at" },
            { value: "hourly", label: "Per hour" },
            { value: "per_unit", label: "Per unit" },
            { value: "quote_only", label: "Quote only" },
          ]}
        />
        {pricing !== "quote_only" && <MoneyField control={control} name="priceCentavos" label="Price" required />}
        {pricing === "per_unit" && (
          <TextField control={control} name="unitLabel" label="Unit" description='e.g. "per aircon unit"' />
        )}
        <TextField
          control={control}
          name="durationMinutes"
          label="Typical duration (minutes)"
          inputProps={{ inputMode: "numeric" }}
        />
      </div>
      <TextAreaField control={control} name="description" label="Details" rows={2} />
      <div className="flex flex-wrap gap-4">
        {[
          ["allowsBookNow", "Allow Book Now"],
          ["allowsQuote", "Allow quote requests"],
          ["isActive", "Active"],
        ].map(([n, l]) => (
          <label key={n} className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-[var(--brand)]" {...register(n!)} />
            {l}
          </label>
        ))}
      </div>
    </>
  );
}

export function CreateServiceForm({ organizationId, categories }: { organizationId: string; categories: Category[] }) {
  const done = useRefreshOnSuccess("Service added.");
  const blank = {
    organizationId,
    categoryId: categories[0]?.id ?? "",
    title: "",
    description: "",
    pricingModel: "fixed" as const,
    priceCentavos: "",
    unitLabel: "",
    durationMinutes: "",
    allowsBookNow: false,
    allowsQuote: true,
    isActive: true,
  };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateProviderServiceInput,
    defaultValues: blank,
    action: createProviderServiceAction,
    onSuccess: () => {
      form.reset(blank);
      done();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <ServiceFields
        control={asAnyControl(form.control)}
        register={form.register as unknown as (n: string) => object}
        categories={categories}
      />
      <SubmitButton pending={pending} className="w-fit">
        Add service
      </SubmitButton>
    </form>
  );
}

export function EditServiceForm({ service, categories }: { service: ProviderServiceView; categories: Category[] }) {
  const done = useRefreshOnSuccess("Service saved.");
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateProviderServiceInput,
    defaultValues: {
      serviceId: service.id,
      categoryId: service.categoryId,
      title: service.title,
      description: service.description,
      pricingModel: service.pricingModel,
      priceCentavos: service.priceCentavos === null ? "" : formatPeso(service.priceCentavos).replace("₱", ""),
      unitLabel: service.unitLabel,
      durationMinutes: service.durationMinutes?.toString() ?? "",
      allowsBookNow: service.allowsBookNow,
      allowsQuote: service.allowsQuote,
      isActive: service.isActive,
    },
    action: updateProviderServiceAction,
    onSuccess: done,
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <ServiceFields
        control={asAnyControl(form.control)}
        register={form.register as unknown as (n: string) => object}
        categories={categories}
      />
      <SubmitButton pending={pending} className="w-fit">
        Save service
      </SubmitButton>
    </form>
  );
}

export function AddAreaForm({ organizationId }: { organizationId: string }) {
  const done = useRefreshOnSuccess("Area added.");
  const blank = { organizationId, province: "", cityMunicipality: "", barangay: "" };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: AddServiceAreaInput,
    defaultValues: blank,
    action: addServiceAreaAction,
    onSuccess: () => {
      form.reset({ ...blank, province: form.getValues("province") });
      done();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4">
        <TextField
          control={control}
          name="province"
          label="Province"
          required
          description='Use "Metro Manila" for NCR.'
        />
        <TextField
          control={control}
          name="cityMunicipality"
          label="City / municipality"
          description="Empty = whole province"
        />
        <TextField control={control} name="barangay" label="Barangay" description="Empty = whole city" />
      </div>
      <SubmitButton pending={pending} className="w-fit">
        Add area
      </SubmitButton>
    </form>
  );
}

export function PortfolioItemForm({ organizationId, today }: { organizationId: string; today: string }) {
  const done = useRefreshOnSuccess("Project added.");
  const blank = { organizationId, title: "", description: "", categoryId: "", completedOn: today };
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreatePortfolioItemInput,
    defaultValues: blank,
    action: createPortfolioItemAction,
    onSuccess: () => {
      form.reset(blank);
      done();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="title" label="Project" required />
        <DateField control={control} name="completedOn" label="Completed" />
      </div>
      <TextAreaField control={control} name="description" label="Description" rows={2} />
      <SubmitButton pending={pending} className="w-fit">
        Add project
      </SubmitButton>
    </form>
  );
}

export function SubmitVerificationForm({ organizationId }: { organizationId: string }) {
  const done = useRefreshOnSuccess("Submitted for verification.");
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SubmitVerificationInput,
    defaultValues: {
      organizationId,
      items: [
        { itemType: "business_registration", referenceNumber: "", validUntil: "" },
        { itemType: "mayors_permit", referenceNumber: "", validUntil: "" },
      ],
    },
    action: submitVerificationAction,
    onSuccess: done,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const control = asAnyControl(form.control);
  const used = useWatch({ control: form.control, name: "items" }).map((i) => i.itemType);
  const next = VERIFICATION_ITEM_TYPES.find((t) => !used.includes(t));
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <ul className="flex flex-col gap-3">
        {fields.map((f, i) => (
          <li
            key={f.id}
            className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end"
          >
            <SelectField
              control={control}
              name={`items.${i}.itemType`}
              label="Document"
              options={VERIFICATION_ITEM_TYPES.map((t) => ({ value: t, label: VERIFICATION_ITEM_LABELS[t].label }))}
            />
            <TextField control={control} name={`items.${i}.referenceNumber`} label="Reference no." />
            <DateField control={control} name={`items.${i}.validUntil`} label="Valid until" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove document"
              onClick={() => remove(i)}
              disabled={fields.length === 1}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {next && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => append({ itemType: next, referenceNumber: "", validUntil: "" })}
        >
          Add another document
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        After submitting, upload a scan or photo of each document. Bahay+ staff review them; documents are never shown
        to customers.
      </p>
      <SubmitButton pending={pending} className="w-fit">
        Submit for verification
      </SubmitButton>
    </form>
  );
}

export function OrgFileUpload({
  organizationId,
  entityType,
  entityId,
  label,
  imagesOnly,
}: {
  organizationId: string;
  entityType: OrgFileEntityType;
  entityId: string;
  label: string;
  imagesOnly?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const types = Object.keys(ALLOWED_FILE_TYPES).filter((t) =>
    imagesOnly ? ["image/jpeg", "image/png", "image/webp"].includes(t) : true,
  );
  const run = async <T,>(p: Promise<ActionResult<T>>) => {
    const r = await p;
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={types.join(",")}
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);
          if (!types.includes(file.type))
            return setError(
              imagesOnly ? "Choose a JPG, PNG or WEBP image." : "Choose a JPG, PNG, WEBP, HEIC image or a PDF.",
            );
          if (file.size > MAX_FILE_BYTES) return setError("Files must be 10 MB or smaller.");
          startTransition(async () => {
            try {
              const meta = {
                organizationId,
                entityType,
                entityId,
                fileName: file.name,
                contentType: file.type,
                sizeBytes: file.size,
              };
              const prepared = await run(prepareOrgUploadAction(meta));
              const { error: upErr } = await getSupabaseBrowserClient()
                .storage.from(prepared.bucket)
                .upload(prepared.objectPath, file, { contentType: file.type });
              if (upErr) throw new Error("Upload failed. Try again.");
              await run(registerOrgFileAction({ ...meta, objectPath: prepared.objectPath }));
              toast.success("Uploaded.");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              if (input.current) input.current.value = "";
            }
          });
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden="true" /> {pending ? "Uploading…" : label}
      </Button>
      <FormAlert message={error} />
    </div>
  );
}

export function ReplyForm({ reviewId, existing }: { reviewId: string; existing: string | null }) {
  const done = useRefreshOnSuccess("Reply posted.");
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ReplyToReviewInput,
    defaultValues: { reviewId, reply: existing ?? "" },
    action: replyToReviewAction,
    onSuccess: done,
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <FormAlert message={formError} />
      <TextAreaField control={asAnyControl(form.control)} name="reply" label="Your reply" rows={2} />
      <SubmitButton pending={pending} size="sm" className="w-fit">
        {existing ? "Update reply" : "Reply"}
      </SubmitButton>
    </form>
  );
}

export function DeleteButton({ label, action }: { label: string; action: () => Promise<ActionResult<true>> }) {
  const router = useRouter();
  return (
    <ConfirmationDialog
      title={`Remove ${label}?`}
      description="This can't be undone."
      confirmLabel="Remove"
      tone="destructive"
      onConfirm={async () => {
        const r = await action();
        if (!r.ok) {
          toast.error(r.error.message);
          return false;
        }
        router.refresh();
      }}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`}>
          <Trash2 aria-hidden="true" />
        </Button>
      }
    />
  );
}

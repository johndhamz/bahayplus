"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ASSET_CATEGORY_LABELS, SUGGESTED_MAINTENANCE_MONTHS, type AssetView } from "@bahayplus/modules/assets";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { AddAssetServiceRecordInput, CreateAssetInput, UpdateAssetInput } from "@bahayplus/validation/registry/assets";
import { formatPeso } from "@bahayplus/types/money";
import {
  asAnyControl,
  DateField,
  MoneyField,
  SelectField,
  TextAreaField,
  TextField,
  toOptions,
  type AnyControl,
} from "@/components/forms/fields";
import { addAssetServiceRecordAction, createAssetAction, updateAssetAction } from "@/lib/actions/registry";

export type PropertyOption = { id: string; name: string };

const centavosToInput = (c: number | null) => (c === null ? "" : formatPeso(c).replace("₱", ""));

function initial(a?: AssetView) {
  return {
    name: a?.name ?? "",
    category: a?.category ?? "aircon",
    propertyId: a?.propertyId ?? "",
    brand: a?.brand ?? "",
    model: a?.model ?? "",
    serialNumber: a?.serialNumber ?? "",
    purchaseDate: a?.purchaseDate ?? "",
    purchasePriceCentavos: centavosToInput(a?.purchasePriceCentavos ?? null),
    warrantyExpiresOn: a?.warrantyExpiresOn ?? "",
    maintenanceIntervalMonths: a?.maintenanceIntervalMonths?.toString() ?? "",
    notes: a?.notes ?? "",
  };
}

function AssetFields({ control, properties }: { control: AnyControl; properties: PropertyOption[] }) {
  const categoryOptions = toOptions(ASSET_CATEGORY_LABELS);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="name"
          label="Name"
          required
          description='e.g. "Sala aircon" or "Kitchen ref".'
        />
        <SelectField control={control} name="category" label="Category" required options={categoryOptions} />
        <SelectField
          control={control}
          name="propertyId"
          label="Property"
          options={[{ value: "", label: "Not assigned" }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <TextField control={control} name="brand" label="Brand" />
        <TextField control={control} name="model" label="Model" />
        <TextField control={control} name="serialNumber" label="Serial number" />
      </div>
      <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Purchase & warranty</legend>
        <DateField control={control} name="purchaseDate" label="Purchase date" />
        <MoneyField control={control} name="purchasePriceCentavos" label="Purchase price" />
        <DateField control={control} name="warrantyExpiresOn" label="Warranty ends" />
        <TextField
          control={control}
          name="maintenanceIntervalMonths"
          label="Maintenance every (months)"
          description={`Aircons are typically cleaned every ${SUGGESTED_MAINTENANCE_MONTHS.aircon} months.`}
          inputProps={{ inputMode: "numeric" }}
        />
      </fieldset>
      <TextAreaField control={control} name="notes" label="Notes" />
    </>
  );
}

export function CreateAssetForm({
  householdId,
  properties,
  defaultPropertyId,
}: {
  householdId: string;
  properties: PropertyOption[];
  defaultPropertyId?: string | null;
}) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateAssetInput,
    defaultValues: { ...initial(), propertyId: defaultPropertyId ?? "", householdId },
    action: createAssetAction,
    onSuccess: (d) => {
      toast.success("Item added.");
      router.push(`/app/h/${householdId}/assets/${d.assetId}`);
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <AssetFields control={asAnyControl(form.control)} properties={properties} />
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Add item
      </SubmitButton>
    </form>
  );
}

export function EditAssetForm({ asset, properties }: { asset: AssetView; properties: PropertyOption[] }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateAssetInput,
    defaultValues: { ...initial(asset), assetId: asset.id },
    action: updateAssetAction,
    onSuccess: () => {
      toast.success("Item saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <AssetFields control={asAnyControl(form.control)} properties={properties} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}

export const ASSET_SERVICE_KIND_LABELS = {
  maintenance: "Maintenance",
  cleaning: "Cleaning",
  repair: "Repair",
  inspection: "Inspection",
  installation: "Installation",
  other: "Other",
} as const;

export function AssetServiceRecordForm({ assetId, today }: { assetId: string; today: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: AddAssetServiceRecordInput,
    defaultValues: {
      assetId,
      servicedOn: today,
      kind: "cleaning",
      description: "",
      providerName: "",
      costCentavos: "",
    },
    action: addAssetServiceRecordAction,
    onSuccess: () => {
      toast.success("Record added.");
      form.reset({ assetId, servicedOn: today, kind: "cleaning", description: "", providerName: "", costCentavos: "" });
      router.refresh();
    },
  });
  const control = asAnyControl(form.control);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField control={control} name="servicedOn" label="Date" required />
        <SelectField
          control={control}
          name="kind"
          label="Type"
          required
          options={toOptions(ASSET_SERVICE_KIND_LABELS)}
        />
        <TextField control={control} name="providerName" label="Done by" />
        <MoneyField control={control} name="costCentavos" label="Cost" />
      </div>
      <TextAreaField control={control} name="description" label="What was done" rows={2} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-fit">
        Add record
      </SubmitButton>
    </form>
  );
}

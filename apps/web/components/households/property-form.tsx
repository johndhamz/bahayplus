"use client";

import { useRouter } from "next/navigation";
import type { Control, FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { Textarea } from "@bahayplus/ui/components/ui/textarea";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { CreatePropertyInput, PROPERTY_TYPES, UpdatePropertyInput } from "@bahayplus/validation/properties/property";
import { PROPERTY_TYPE_LABELS, type PropertyView } from "@bahayplus/modules/properties";
import { createPropertyAction, updatePropertyAction } from "@/lib/actions/properties";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

function initialFields(p?: PropertyView) {
  return {
    name: p?.name ?? "",
    propertyType: p?.propertyType ?? "house",
    addressLine: p?.addressLine ?? "",
    barangay: p?.barangay ?? "",
    cityMunicipality: p?.cityMunicipality ?? "",
    province: p?.province ?? "",
    postalCode: p?.postalCode ?? "",
    latitude: p?.latitude?.toString() ?? "",
    longitude: p?.longitude?.toString() ?? "",
    notes: p?.notes ?? "",
  } as const;
}

/**
 * Shared field layout for create and edit. Both schemas have identical property fields, so the
 * control is typed loosely here; each form keeps its own fully typed useActionForm.
 */
function PropertyFields({ control }: { control: Control<FieldValues> }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="name"
          label="Property name"
          required
          description='e.g. "Family home" or "BGC condo".'
        >
          {(field, a11y) => <Input {...field} {...a11y} />}
        </FormField>
        <FormField control={control} name="propertyType" label="Type" required>
          {(field, a11y) => (
            <select {...field} {...a11y} className={selectClass}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Address</legend>
        <FormField control={control} name="addressLine" label="House/unit no., street, building, subdivision">
          {(field, a11y) => <Input {...field} {...a11y} autoComplete="address-line1" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={control} name="barangay" label="Barangay">
            {(field, a11y) => <Input {...field} {...a11y} />}
          </FormField>
          <FormField control={control} name="cityMunicipality" label="City or municipality" required>
            {(field, a11y) => <Input {...field} {...a11y} autoComplete="address-level2" />}
          </FormField>
          <FormField
            control={control}
            name="province"
            label="Province"
            required
            description='Use "Metro Manila" for NCR cities.'
          >
            {(field, a11y) => <Input {...field} {...a11y} autoComplete="address-level1" />}
          </FormField>
          <FormField control={control} name="postalCode" label="Postal code">
            {(field, a11y) => (
              <Input
                {...field}
                {...a11y}
                value={field.value ?? ""}
                inputMode="numeric"
                maxLength={4}
                autoComplete="postal-code"
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Map coordinates (optional)</legend>
        <p className="-mt-2 text-xs text-muted-foreground">
          Helps providers find you later. Enter both values or neither. No map service is connected yet.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={control} name="latitude" label="Latitude">
            {(field, a11y) => (
              <Input {...field} {...a11y} value={field.value ?? ""} inputMode="decimal" placeholder="14.5547" />
            )}
          </FormField>
          <FormField control={control} name="longitude" label="Longitude">
            {(field, a11y) => (
              <Input {...field} {...a11y} value={field.value ?? ""} inputMode="decimal" placeholder="121.0244" />
            )}
          </FormField>
        </div>
      </fieldset>

      <FormField
        control={control}
        name="notes"
        label="Notes"
        description="Gate codes, parking, landmarks — visible to household members who can see properties."
      >
        {(field, a11y) => <Textarea {...field} {...a11y} rows={3} />}
      </FormField>
    </>
  );
}

export function CreatePropertyForm({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreatePropertyInput,
    defaultValues: { ...initialFields(), householdId },
    action: createPropertyAction,
    onSuccess: (data) => {
      toast.success("Property added.");
      router.push(`/app/h/${householdId}/properties/${data.propertyId}`);
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <PropertyFields control={form.control as unknown as Control<FieldValues>} />
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Add property
      </SubmitButton>
    </form>
  );
}

export function EditPropertyForm({ property }: { property: PropertyView }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdatePropertyInput,
    defaultValues: { ...initialFields(property), propertyId: property.id, isActive: property.isActive },
    action: updatePropertyAction,
    onSuccess: () => {
      toast.success("Property saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <PropertyFields control={form.control as unknown as Control<FieldValues>} />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-[var(--brand)]" {...form.register("isActive")} />
        Active — uncheck if you no longer use this property but want to keep it listed
      </label>
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}

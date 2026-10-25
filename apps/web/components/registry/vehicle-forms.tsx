"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VEHICLE_TYPE_LABELS, type VehicleView } from "@bahayplus/modules/vehicles";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import {
  AddVehicleServiceRecordInput,
  CreateVehicleInput,
  UpdateVehicleInput,
} from "@bahayplus/validation/registry/vehicles";
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
import { addVehicleServiceRecordAction, createVehicleAction, updateVehicleAction } from "@/lib/actions/registry";

function initial(v?: VehicleView) {
  return {
    vehicleType: v?.vehicleType ?? "car",
    make: v?.make ?? "",
    model: v?.model ?? "",
    year: v?.year?.toString() ?? "",
    plateNumber: v?.plateNumber ?? "",
    color: v?.color ?? "",
    mileageKm: v?.mileageKm?.toString() ?? "",
    registrationExpiresOn: v?.registrationExpiresOn ?? "",
    insuranceProvider: v?.insuranceProvider ?? "",
    insuranceExpiresOn: v?.insuranceExpiresOn ?? "",
    maintenanceIntervalMonths: v?.maintenanceIntervalMonths?.toString() ?? "",
    maintenanceIntervalKm: v?.maintenanceIntervalKm?.toString() ?? "",
    notes: v?.notes ?? "",
  };
}

function VehicleFields({ control }: { control: AnyControl }) {
  const numeric = { inputMode: "numeric" as const };
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="vehicleType"
          label="Type"
          required
          options={toOptions(VEHICLE_TYPE_LABELS)}
        />
        <TextField
          control={control}
          name="plateNumber"
          label="Plate number"
          description="e.g. ABC 1234 or 123 ABC"
          inputProps={{ autoCapitalize: "characters" }}
        />
        <TextField control={control} name="make" label="Make" required />
        <TextField control={control} name="model" label="Model" required />
        <TextField control={control} name="year" label="Year" inputProps={numeric} />
        <TextField control={control} name="color" label="Colour" />
        <TextField control={control} name="mileageKm" label="Current mileage (km)" inputProps={numeric} />
      </div>
      <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Registration & insurance</legend>
        <DateField control={control} name="registrationExpiresOn" label="LTO registration expires" />
        <TextField control={control} name="insuranceProvider" label="Insurance provider" />
        <DateField control={control} name="insuranceExpiresOn" label="Insurance expires" />
      </fieldset>
      <fieldset className="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Maintenance schedule</legend>
        <TextField control={control} name="maintenanceIntervalMonths" label="Every (months)" inputProps={numeric} />
        <TextField control={control} name="maintenanceIntervalKm" label="Every (km)" inputProps={numeric} />
      </fieldset>
      <TextAreaField control={control} name="notes" label="Notes" />
    </>
  );
}

export function CreateVehicleForm({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateVehicleInput,
    defaultValues: { ...initial(), householdId },
    action: createVehicleAction,
    onSuccess: (d) => {
      toast.success("Vehicle added.");
      router.push(`/app/h/${householdId}/vehicles/${d.vehicleId}`);
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <VehicleFields control={asAnyControl(form.control)} />
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Add vehicle
      </SubmitButton>
    </form>
  );
}

export function EditVehicleForm({ vehicle }: { vehicle: VehicleView }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateVehicleInput,
    defaultValues: { ...initial(vehicle), vehicleId: vehicle.id },
    action: updateVehicleAction,
    onSuccess: () => {
      toast.success("Vehicle saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <VehicleFields control={asAnyControl(form.control)} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}

export const VEHICLE_SERVICE_KIND_LABELS = {
  preventive_maintenance: "Preventive maintenance (PMS)",
  oil_change: "Oil change",
  repair: "Repair",
  tires: "Tires",
  battery: "Battery",
  inspection: "Inspection",
  registration_renewal: "LTO registration renewal",
  insurance_renewal: "Insurance renewal",
  car_wash: "Car wash / detailing",
  other: "Other",
} as const;

export function VehicleServiceRecordForm({ vehicleId, today }: { vehicleId: string; today: string }) {
  const router = useRouter();
  const blank = {
    vehicleId,
    servicedOn: today,
    odometerKm: "",
    kind: "preventive_maintenance",
    description: "",
    providerName: "",
    costCentavos: "",
  } as const;
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: AddVehicleServiceRecordInput,
    defaultValues: blank,
    action: addVehicleServiceRecordAction,
    onSuccess: () => {
      toast.success("Record added.");
      form.reset(blank);
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
          options={toOptions(VEHICLE_SERVICE_KIND_LABELS)}
        />
        <TextField control={control} name="odometerKm" label="Odometer (km)" inputProps={{ inputMode: "numeric" }} />
        <TextField control={control} name="providerName" label="Shop / provider" />
        <MoneyField control={control} name="costCentavos" label="Cost" />
      </div>
      <TextAreaField control={control} name="description" label="Details" rows={2} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-fit">
        Add record
      </SubmitButton>
    </form>
  );
}

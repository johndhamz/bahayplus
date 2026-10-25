"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PET_HEALTH_KIND_LABELS, PET_SPECIES_LABELS, type PetView } from "@bahayplus/modules/pets";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { AddPetHealthRecordInput, CreatePetInput, UpdatePetInput } from "@bahayplus/validation/registry/pets";
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
import { addPetHealthRecordAction, createPetAction, updatePetAction } from "@/lib/actions/registry";

function initial(p?: PetView) {
  return {
    name: p?.name ?? "",
    species: p?.species ?? "dog",
    breed: p?.breed ?? "",
    sex: p?.sex ?? "unknown",
    birthDate: p?.birthDate ?? "",
    colorMarkings: p?.colorMarkings ?? "",
    microchipNumber: p?.microchipNumber ?? "",
    carePreferences: p?.carePreferences ?? "",
    notes: p?.notes ?? "",
  };
}

function PetFields({ control }: { control: AnyControl }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="name" label="Name" required />
        <SelectField
          control={control}
          name="species"
          label="Species"
          required
          options={toOptions(PET_SPECIES_LABELS)}
        />
        <TextField control={control} name="breed" label="Breed" description='e.g. "Aspin", "Puspin", "Shih Tzu".' />
        <SelectField
          control={control}
          name="sex"
          label="Sex"
          options={[
            { value: "unknown", label: "Unknown" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <DateField control={control} name="birthDate" label="Birthday" />
        <TextField control={control} name="colorMarkings" label="Colour / markings" />
        <TextField control={control} name="microchipNumber" label="Microchip number" />
      </div>
      <TextAreaField
        control={control}
        name="carePreferences"
        label="Care preferences"
        description="Food, allergies, temperament, routines — useful for pet sitters."
      />
      <TextAreaField control={control} name="notes" label="Notes" />
    </>
  );
}

export function CreatePetForm({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreatePetInput,
    defaultValues: { ...initial(), householdId },
    action: createPetAction,
    onSuccess: (d) => {
      toast.success("Pet added.");
      router.push(`/app/h/${householdId}/pets/${d.petId}`);
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <PetFields control={asAnyControl(form.control)} />
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg" className="w-full sm:w-fit">
        Add pet
      </SubmitButton>
    </form>
  );
}

export function EditPetForm({ pet }: { pet: PetView }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdatePetInput,
    defaultValues: { ...initial(pet), petId: pet.id },
    action: updatePetAction,
    onSuccess: () => {
      toast.success("Pet saved.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormAlert message={formError} />
      <PetFields control={asAnyControl(form.control)} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-fit">
        Save changes
      </SubmitButton>
    </form>
  );
}

export function PetHealthRecordForm({
  petId,
  today,
  allowSensitive,
}: {
  petId: string;
  today: string;
  allowSensitive: boolean;
}) {
  const router = useRouter();
  const kinds = Object.entries(PET_HEALTH_KIND_LABELS)
    .filter(([k]) => allowSensitive || k === "grooming")
    .map(([value, label]) => ({ value, label }));
  const blank = {
    petId,
    kind: allowSensitive ? "vaccination" : "grooming",
    title: "",
    occurredOn: today,
    nextDueOn: "",
    clinicOrProvider: "",
    notes: "",
    costCentavos: "",
  } as const;
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: AddPetHealthRecordInput,
    defaultValues: blank,
    action: addPetHealthRecordAction,
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
        <SelectField control={control} name="kind" label="Type" required options={kinds} />
        <TextField
          control={control}
          name="title"
          label="What"
          required
          description="e.g. Anti-rabies, 5-in-1, Annual check-up, Bath & trim"
        />
        <DateField control={control} name="occurredOn" label="Date" required />
        <DateField control={control} name="nextDueOn" label="Next due" description="Creates a reminder date." />
        <TextField control={control} name="clinicOrProvider" label="Clinic or groomer" />
        <MoneyField control={control} name="costCentavos" label="Cost" />
      </div>
      <TextAreaField control={control} name="notes" label="Notes" rows={2} />
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-fit">
        Add record
      </SubmitButton>
    </form>
  );
}

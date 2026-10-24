"use client";

import { useRouter } from "next/navigation";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { CreateHouseholdInput } from "@bahayplus/validation/households/membership";
import { createHouseholdAction } from "@/lib/actions/households";

export function CreateHouseholdForm() {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateHouseholdInput,
    defaultValues: { name: "" },
    action: createHouseholdAction,
    onSuccess: (data) => router.push(`/app/h/${data.householdId}`),
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField
        control={form.control}
        name="name"
        label="Household name"
        required
        description='For example "Dela Cruz Family" or "Lola’s house".'
      >
        {(field, a11y) => <Input {...field} {...a11y} autoComplete="off" />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Creating…" size="lg">
        Create household
      </SubmitButton>
    </form>
  );
}

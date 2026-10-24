"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { UpdateHouseholdInput } from "@bahayplus/validation/households/membership";
import { updateHouseholdAction } from "@/lib/actions/households";

export function HouseholdSettingsForm({ householdId, name }: { householdId: string; name: string }) {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateHouseholdInput,
    defaultValues: { householdId, name },
    action: updateHouseholdAction,
    onSuccess: () => {
      toast.success("Household updated.");
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="name" label="Household name" required>
        {(field, a11y) => <Input {...field} {...a11y} />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-fit">
        Save
      </SubmitButton>
    </form>
  );
}

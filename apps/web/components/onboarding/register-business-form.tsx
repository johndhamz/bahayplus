"use client";

import { useRouter } from "next/navigation";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import {
  CreateOrganizationInput,
  slugify,
  type OrganizationKind,
} from "@bahayplus/validation/organizations/membership";
import { createOrganizationAction } from "@/lib/actions/organizations";

export function RegisterBusinessForm({ kind }: { kind: OrganizationKind }) {
  const router = useRouter();
  const portal = kind === "service_provider" ? "provider" : "supplier";
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: CreateOrganizationInput,
    defaultValues: { kind, name: "", slug: "" },
    action: createOrganizationAction,
    onSuccess: (data) => router.push(`/${portal}/o/${data.organizationId}`),
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="name" label="Business name" required>
        {(field, a11y) => (
          <Input
            {...field}
            {...a11y}
            autoComplete="organization"
            onChange={(e) => {
              field.onChange(e);
              if (!form.getFieldState("slug").isDirty) form.setValue("slug", slugify(e.target.value));
            }}
          />
        )}
      </FormField>
      <FormField
        control={form.control}
        name="slug"
        label="Handle"
        required
        description="Used in your public profile link. Lowercase letters, numbers and dashes."
      >
        {(field, a11y) => <Input {...field} {...a11y} autoCapitalize="none" spellCheck={false} />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Registering…" size="lg">
        Register business
      </SubmitButton>
    </form>
  );
}

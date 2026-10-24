"use client";

import { useState } from "react";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { ForgotPasswordInput } from "@bahayplus/validation/identity/auth";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ForgotPasswordInput,
    defaultValues: { email: "" },
    action: requestPasswordResetAction,
    onSuccess: (_data, message) => setSent(message ?? "Check your email for a reset link."),
  });
  if (sent) return <FormAlert tone="success" message={sent} />;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="email" label="Email" required>
        {(field, a11y) => <Input {...field} {...a11y} type="email" autoComplete="email" inputMode="email" />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Sending…" size="lg">
        Send reset link
      </SubmitButton>
    </form>
  );
}

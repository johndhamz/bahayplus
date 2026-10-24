"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { ResetPasswordInput } from "@bahayplus/validation/identity/auth";
import { resetPasswordAction } from "@/lib/actions/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ResetPasswordInput,
    defaultValues: { password: "", confirmPassword: "" },
    action: resetPasswordAction,
    onSuccess: (_data, message) => {
      toast.success(message ?? "Password updated.");
      router.push("/app");
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField
        control={form.control}
        name="password"
        label="New password"
        required
        description="At least 10 characters."
      >
        {(field, a11y) => <Input {...field} {...a11y} type="password" autoComplete="new-password" />}
      </FormField>
      <FormField control={form.control} name="confirmPassword" label="Confirm new password" required>
        {(field, a11y) => <Input {...field} {...a11y} type="password" autoComplete="new-password" />}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Saving…" size="lg">
        Update password
      </SubmitButton>
    </form>
  );
}

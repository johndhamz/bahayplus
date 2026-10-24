"use client";

import { toast } from "sonner";
import type { Profile } from "@bahayplus/modules/identity";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { ChangePasswordInput, UpdateProfileInput } from "@bahayplus/validation/identity/auth";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/account";

export function ProfileForm({ profile }: { profile: Profile }) {
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: UpdateProfileInput,
    defaultValues: { fullName: profile.fullName, phone: profile.phone ?? "", locale: profile.locale },
    action: updateProfileAction,
    onSuccess: (_d, message) => toast.success(message ?? "Saved."),
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="fullName" label="Full name" required>
        {(field, a11y) => <Input {...field} {...a11y} autoComplete="name" />}
      </FormField>
      <FormField
        control={form.control}
        name="phone"
        label="Mobile number"
        description="Philippine mobile, e.g. +63 917 123 4567."
      >
        {(field, a11y) => (
          <Input {...field} {...a11y} value={field.value ?? ""} type="tel" autoComplete="tel" inputMode="tel" />
        )}
      </FormField>
      <FormField control={form.control} name="locale" label="Language" required>
        {(field, a11y) => (
          <select
            {...field}
            {...a11y}
            className="h-11 rounded-lg border border-input bg-surface px-3 text-base md:text-sm"
          >
            <option value="en-PH">English</option>
            <option value="fil-PH">Filipino (coming soon)</option>
          </select>
        )}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-fit">
        Save profile
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ChangePasswordInput,
    defaultValues: { password: "", confirmPassword: "" },
    action: changePasswordAction,
    onSuccess: (_d, message) => {
      toast.success(message ?? "Password updated.");
      form.reset();
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
      <SubmitButton pending={pending} pendingLabel="Updating…" className="w-fit">
        Update password
      </SubmitButton>
    </form>
  );
}

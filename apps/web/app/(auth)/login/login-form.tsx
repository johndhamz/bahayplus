"use client";

import Link from "next/link";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { Input } from "@bahayplus/ui/components/ui/input";
import { LoginInput } from "@bahayplus/validation/identity/auth";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: LoginInput,
    defaultValues: { email: "", password: "", next },
    action: loginAction,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="email" label="Email" required>
        {(field, a11y) => <Input {...field} {...a11y} type="email" autoComplete="email" inputMode="email" />}
      </FormField>
      <FormField control={form.control} name="password" label="Password" required>
        {(field, a11y) => <Input {...field} {...a11y} type="password" autoComplete="current-password" />}
      </FormField>
      <div className="-mt-2 text-right text-sm">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-10 items-center font-medium text-brand hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending} pendingLabel="Signing in…" size="lg">
        Log in
      </SubmitButton>
    </form>
  );
}

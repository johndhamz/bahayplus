"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { Checkbox } from "@bahayplus/ui/components/ui/checkbox";
import { Input } from "@bahayplus/ui/components/ui/input";
import { SignupInput } from "@bahayplus/validation/identity/auth";
import { signupAction } from "@/lib/actions/auth";

export function SignupForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: SignupInput,
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
    action: signupAction,
    onSuccess: (data) => setSentTo(data.email),
  });

  if (sentTo) {
    return (
      <EmptyState
        icon={MailCheck}
        title="Check your email"
        description={
          <>
            We sent a verification link to <strong>{sentTo}</strong>. Open it on this device to activate your account.
          </>
        }
        action={
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Back to log in
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="fullName" label="Full name" required>
        {(field, a11y) => <Input {...field} {...a11y} autoComplete="name" />}
      </FormField>
      <FormField control={form.control} name="email" label="Email" required>
        {(field, a11y) => <Input {...field} {...a11y} type="email" autoComplete="email" inputMode="email" />}
      </FormField>
      <FormField control={form.control} name="password" label="Password" required description="At least 10 characters.">
        {(field, a11y) => <Input {...field} {...a11y} type="password" autoComplete="new-password" />}
      </FormField>
      <FormField control={form.control} name="confirmPassword" label="Confirm password" required>
        {(field, a11y) => <Input {...field} {...a11y} type="password" autoComplete="new-password" />}
      </FormField>
      <FormField control={form.control} name="acceptTerms" label="Terms and privacy" required>
        {(field, a11y) => (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
            <Checkbox
              id={a11y.id}
              checked={field.value === true}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={a11y["aria-invalid"]}
              aria-describedby={a11y["aria-describedby"]}
              className="mt-0.5 size-5"
            />
            <span className="text-sm text-muted-foreground">
              I agree to the Bahay+ Terms of Service and Privacy Notice, including processing of my personal data under
              the Data Privacy Act of 2012.
            </span>
          </div>
        )}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Creating account…" size="lg">
        Create account
      </SubmitButton>
    </form>
  );
}

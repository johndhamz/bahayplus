"use client";

import { useState, useTransition } from "react";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { VerifyMfaInput } from "@bahayplus/validation/identity/auth";
import { startTotpEnrollmentAction, verifyTotpAction, type TotpEnrollment } from "@/lib/actions/mfa";

export function MfaVerifyForm({ factorId, next }: { factorId: string; next: string }) {
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: VerifyMfaInput,
    defaultValues: { factorId, code: "", next },
    action: verifyTotpAction,
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <FormField control={form.control} name="code" label="Authentication code" required>
        {(field, a11y) => (
          <Input
            {...field}
            {...a11y}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            className="font-mono tracking-widest"
          />
        )}
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Verifying…" size="lg">
        Verify
      </SubmitButton>
    </form>
  );
}

export function MfaEnrollment({ next }: { next: string }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert message={error} />
        <Button
          size="lg"
          disabled={pending}
          aria-busy={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await startTotpEnrollmentAction();
              if (result.ok) setEnrollment(result.data);
              else setError(result.error.message);
            })
          }
        >
          {pending ? "Preparing…" : "Set up authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
        <li>
          <p>Scan this QR code with your authenticator app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI from Supabase Auth */}
          <img
            src={enrollment.qrCode}
            alt="QR code for adding Bahay+ to your authenticator app"
            width={176}
            height={176}
            className="mt-3 rounded-md border border-border bg-white p-2"
          />
          <p className="mt-3 text-muted-foreground">
            Can&apos;t scan it? Enter this setup key instead:{" "}
            <code data-testid="mfa-secret" className="font-mono text-sm break-all text-foreground select-all">
              {enrollment.secret}
            </code>
          </p>
        </li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <MfaVerifyForm factorId={enrollment.factorId} next={next} />
    </div>
  );
}

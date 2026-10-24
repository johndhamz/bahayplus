"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import type { ActionResult } from "@bahayplus/types/action-result";

type Props = {
  token: string;
  accept: (input: { token: string }) => Promise<ActionResult<{ householdId: string } | { organizationId: string }>>;
  redirectTo: (data: { householdId: string } | { organizationId: string }) => string;
};

export function AcceptInvitationButton({ token, accept, redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await accept({ token });
          if (result.ok) router.push(redirectTo(result.data));
          else setError(result.error.message);
        });
      }}
      className="flex flex-col gap-3"
    >
      <FormAlert message={error} />
      <SubmitButton pending={pending} pendingLabel="Joining…" size="lg">
        Accept invitation
      </SubmitButton>
    </form>
  );
}

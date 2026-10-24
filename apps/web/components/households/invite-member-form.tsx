"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignableRanks, HOUSEHOLD_ROLES } from "@bahayplus/modules/authorization";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";
import { InviteHouseholdMemberInput } from "@bahayplus/validation/households/membership";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { inviteHouseholdMemberAction } from "@/lib/actions/households";

export function InviteMemberForm({
  householdId,
  actorRank,
  canManageOwners,
}: {
  householdId: string;
  actorRank: number;
  canManageOwners: boolean;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<{ inviteUrl: string; expiresAt: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const allowed = assignableRanks(
    actorRank,
    canManageOwners,
    HOUSEHOLD_ROLES.map((r) => r.rank),
  );
  const roles = HOUSEHOLD_ROLES.filter((r) => allowed.includes(r.rank));
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: InviteHouseholdMemberInput,
    defaultValues: {
      householdId,
      email: "",
      role: roles.some((r) => r.key === "member") ? "member" : (roles.at(-1)?.key ?? "guest"),
    },
    action: inviteHouseholdMemberAction,
    onSuccess: (data) => {
      setCreated({ ...data, email: form.getValues("email") });
      setCopied(false);
      form.reset({ householdId, email: "", role: form.getValues("role") });
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <FormField control={form.control} name="email" label="Email address" required className="flex-1">
          {(field, a11y) => <Input {...field} {...a11y} type="email" inputMode="email" autoComplete="off" />}
        </FormField>
        <FormField control={form.control} name="role" label="Role" required className="sm:w-44">
          {(field, a11y) => (
            <select
              {...field}
              {...a11y}
              className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base md:text-sm"
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Inviting…" className="sm:mt-7">
          Create invite
        </SubmitButton>
      </form>
      <FormAlert message={formError} />
      {created && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-success/30 bg-success-soft p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-success">
            <Link2 aria-hidden="true" className="size-4" />
            Invitation link for {created.email}
          </p>
          <p className="text-muted-foreground">
            Email delivery isn&apos;t connected yet — copy this link and send it yourself. It works once, only for{" "}
            {created.email}, until {formatManilaDateTime(created.expiresAt)}. It won&apos;t be shown again.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={created.inviteUrl}
              aria-label="Invitation link"
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(created.inviteUrl);
                setCopied(true);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

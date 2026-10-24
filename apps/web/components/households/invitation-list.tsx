"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HOUSEHOLD_ROLES } from "@bahayplus/modules/authorization";
import type { HouseholdInvitationView } from "@bahayplus/modules/households";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { revokeHouseholdInvitationAction } from "@/lib/actions/households";

export function InvitationList({ invitations }: { invitations: HouseholdInvitationView[] }) {
  const router = useRouter();
  if (invitations.length === 0) return <p className="text-sm text-muted-foreground">No invitations yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
      {invitations.map((inv) => (
        <li key={inv.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{inv.email}</p>
            <p className="text-xs text-muted-foreground">
              {HOUSEHOLD_ROLES.find((r) => r.key === inv.role)?.name} ·{" "}
              {inv.status === "pending"
                ? `expires ${formatManilaDateTime(inv.expiresAt)}`
                : `sent ${formatManilaDateTime(inv.createdAt)}`}
            </p>
          </div>
          <StatusBadge status={inv.status} />
          {inv.status === "pending" && (
            <ConfirmationDialog
              title={`Cancel the invitation for ${inv.email}?`}
              description="The link will stop working immediately."
              confirmLabel="Cancel invitation"
              cancelLabel="Keep"
              tone="destructive"
              onConfirm={async () => {
                const result = await revokeHouseholdInvitationAction({ invitationId: inv.id });
                if (!result.ok) {
                  toast.error(result.error.message);
                  return false;
                }
                toast.success("Invitation cancelled.");
                router.refresh();
              }}
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  Revoke
                </Button>
              }
            />
          )}
        </li>
      ))}
    </ul>
  );
}

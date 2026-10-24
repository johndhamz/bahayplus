"use client";

import { LogOut, UserMinus, UserX, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { assignableRanks, evaluateMembershipChange, HOUSEHOLD_ROLES } from "@bahayplus/modules/authorization";
import type { HouseholdMemberView } from "@bahayplus/modules/households";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate } from "@bahayplus/types/dates";
import {
  changeHouseholdMemberRoleAction,
  removeHouseholdMemberAction,
  setHouseholdMemberStatusAction,
} from "@/lib/actions/households";

export type MemberActor = {
  userId: string;
  rank: number;
  canManageMembers: boolean;
  canManageOwners: boolean;
};

type ActionResultLike = { ok: boolean; message?: string; error?: { message: string } };

/**
 * Member management. Buttons are shown only for changes the policy allows; the database
 * re-checks every change (rank rules, last owner), so a hidden button is UX, not security.
 */
export function MemberList({ members, actor }: { members: HouseholdMemberView[]; actor: MemberActor }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeOwners = members.filter((m) => m.role === "owner" && m.status === "active").length;
  const allRanks = HOUSEHOLD_ROLES.map((r) => r.rank);

  const run = async (fn: () => Promise<ActionResultLike>, after?: () => void) => {
    const result = await fn();
    if (result.ok) {
      toast.success(result.message ?? "Done.");
      if (after) after();
      else router.refresh();
      return true;
    }
    toast.error(result.error?.message ?? "That didn't work.");
    return false;
  };

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-card">
      {members.map((member) => {
        const isSelf = member.userId === actor.userId;
        const base = {
          ...actor,
          actorCanManageMembers: actor.canManageMembers,
          actorCanManageOwners: actor.canManageOwners,
          actorRank: actor.rank,
          isSelf,
          targetRank: member.rank,
        };
        const canManage = !isSelf && evaluateMembershipChange(base).allowed;
        const roleOptions = HOUSEHOLD_ROLES.filter(
          (r) =>
            r.key === member.role ||
            (assignableRanks(actor.rank, actor.canManageOwners, allRanks).includes(r.rank) &&
              evaluateMembershipChange({ ...base, newRank: r.rank }).allowed),
        );
        const isLastOwner = member.role === "owner" && member.status === "active" && activeOwners <= 1;
        return (
          <li key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-semibold text-gold"
              >
                {member.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {member.fullName}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="text-xs text-muted-foreground">Joined {formatManilaDate(new Date(member.joinedAt))}</p>
              </div>
              {member.status === "suspended" && <StatusBadge status="suspended" tone="warning" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && roleOptions.length > 1 ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Role for {member.fullName}</span>
                  <select
                    className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                    value={member.role}
                    disabled={pending}
                    onChange={(e) =>
                      startTransition(
                        () =>
                          void run(() =>
                            changeHouseholdMemberRoleAction({ memberId: member.id, role: e.target.value }),
                          ),
                      )
                    }
                  >
                    {roleOptions.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-sage-foreground">
                  {HOUSEHOLD_ROLES.find((r) => r.key === member.role)?.name}
                </span>
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(
                      () =>
                        void run(() =>
                          setHouseholdMemberStatusAction({
                            memberId: member.id,
                            status: member.status === "active" ? "suspended" : "active",
                          }),
                        ),
                    )
                  }
                >
                  {member.status === "active" ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                  {member.status === "active" ? "Suspend" : "Reactivate"}
                </Button>
              )}
              {canManage && !isLastOwner && (
                <ConfirmationDialog
                  title={`Remove ${member.fullName}?`}
                  description="They will immediately lose access to this household. You can invite them again later."
                  confirmLabel="Remove"
                  tone="destructive"
                  onConfirm={() => run(() => removeHouseholdMemberAction({ memberId: member.id }))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      aria-label={`Remove ${member.fullName}`}
                    >
                      <UserMinus aria-hidden="true" />
                      Remove
                    </Button>
                  }
                />
              )}
              {isSelf && !isLastOwner && (
                <ConfirmationDialog
                  title="Leave this household?"
                  description="You will lose access immediately. Someone will need to invite you to rejoin."
                  confirmLabel="Leave"
                  tone="destructive"
                  onConfirm={() =>
                    run(
                      () => removeHouseholdMemberAction({ memberId: member.id }),
                      () => router.push("/app"),
                    )
                  }
                  trigger={
                    <Button variant="ghost" size="sm">
                      <LogOut aria-hidden="true" />
                      Leave
                    </Button>
                  }
                />
              )}
              {isSelf && isLastOwner && (
                <span className="text-xs text-muted-foreground">You&apos;re the only owner</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

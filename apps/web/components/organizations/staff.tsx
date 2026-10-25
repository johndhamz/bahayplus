"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignableRanks, ORGANIZATION_ROLES } from "@bahayplus/modules/authorization";
import type { OrganizationInvitationView, OrganizationMemberView } from "@bahayplus/modules/organizations";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { formatManilaDate } from "@bahayplus/types/dates";
import { selectClassName } from "@/components/forms/fields";
import {
  changeOrganizationMemberRoleAction,
  inviteOrganizationMemberAction,
  removeOrganizationMemberAction,
  revokeOrganizationInvitationAction,
} from "@/lib/actions/organizations";

const roleName = (key: string) => ORGANIZATION_ROLES.find((r) => r.key === key)?.name ?? key;

export function StaffList({
  members,
  canManage,
  actorRank,
  canManageOwners,
  currentUserId,
}: {
  members: OrganizationMemberView[];
  canManage: boolean;
  actorRank: number;
  canManageOwners: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const allowed = assignableRanks(
    actorRank,
    canManageOwners,
    ORGANIZATION_ROLES.map((r) => r.rank),
  );
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error?.message ?? "Something went wrong.");
          return resolve(false);
        }
        toast.success(msg);
        router.refresh();
        resolve(true);
      }),
    );
  return (
    <ul className="flex flex-col divide-y divide-border">
      {members.map((m) => {
        const editable = canManage && m.userId !== currentUserId && (m.rank < actorRank || canManageOwners);
        return (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.fullName}
                {m.userId === currentUserId && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
              </p>
              <p className="text-xs text-muted-foreground">Joined {formatManilaDate(new Date(m.joinedAt))}</p>
            </div>
            {m.status !== "active" && <StatusBadge status={m.status} />}
            {editable ? (
              <select
                aria-label={`Role for ${m.fullName}`}
                className="h-10 rounded-lg border border-input bg-surface px-2 text-sm"
                value={m.role}
                disabled={pending}
                onChange={(e) =>
                  run(
                    () => changeOrganizationMemberRoleAction({ memberId: m.id, role: e.target.value }),
                    "Role updated.",
                  )
                }
              >
                {ORGANIZATION_ROLES.filter((r) => allowed.includes(r.rank) || r.key === m.role).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-muted-foreground">{roleName(m.role)}</span>
            )}
            {editable && (
              <ConfirmationDialog
                title={`Remove ${m.fullName}?`}
                description="They lose access to this business immediately. Their past work stays on record."
                confirmLabel="Remove"
                tone="destructive"
                onConfirm={() => run(() => removeOrganizationMemberAction({ memberId: m.id }), "Member removed.")}
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Remove
                  </Button>
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function InviteStaffForm({
  organizationId,
  actorRank,
  canManageOwners,
}: {
  organizationId: string;
  actorRank: number;
  canManageOwners: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const allowed = assignableRanks(
    actorRank,
    canManageOwners,
    ORGANIZATION_ROLES.map((r) => r.rank),
  );
  const roles = ORGANIZATION_ROLES.filter((r) => allowed.includes(r.rank));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles.find((r) => r.key === "staff")?.key ?? roles.at(-1)?.key ?? "worker");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await inviteOrganizationMemberAction({ organizationId, email, role });
          if (!r.ok) return setError(r.error.message);
          setLink(r.data.inviteUrl);
          setEmail("");
          router.refresh();
        });
      }}
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Role
        <select className={selectClassName} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name} — {r.description}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending} className="w-fit">
        Create invite link
      </Button>
      {link && (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-sage/60 p-3 text-sm">
          <p className="font-medium">Share this link with them. It is shown only once.</p>
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

export function PendingInvitations({ invitations }: { invitations: OrganizationInvitationView[] }) {
  const router = useRouter();
  if (!invitations.length) return <p className="text-sm text-muted-foreground">No pending invitations.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {invitations.map((i) => (
        <li key={i.id} className="flex items-center gap-2 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{i.email}</p>
            <p className="text-xs text-muted-foreground">
              {roleName(i.role)} · expires {formatManilaDate(new Date(i.expiresAt))}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const r = await revokeOrganizationInvitationAction({ invitationId: i.id });
              if (!r.ok) return void toast.error(r.error.message);
              toast.success("Invitation revoked.");
              router.refresh();
            }}
          >
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}

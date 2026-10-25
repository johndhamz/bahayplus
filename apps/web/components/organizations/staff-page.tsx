import "server-only";
import { listOrganizationInvitations, listOrganizationMembers } from "@bahayplus/modules/organizations";
import type { OrganizationAccess, ServiceContext } from "@bahayplus/modules/authorization";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { InviteStaffForm, PendingInvitations, StaffList } from "./staff";

/** Staff management shared by the provider and supplier portals (same organizations and memberships). */
export async function StaffSection({ ctx, access }: { ctx: ServiceContext; access: OrganizationAccess }) {
  const canManage = access.permissions.has("organization.members.manage");
  const canInvite = access.permissions.has("organization.invitations.manage");
  const canManageOwners = access.permissions.has("organization.owners.manage");
  const [members, invitations] = await Promise.all([
    listOrganizationMembers(ctx, access.organizationId),
    canInvite ? listOrganizationInvitations(ctx, access.organizationId) : null,
  ]);
  if (!members.ok) return <ErrorState description="We couldn't load your team." />;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <SectionCard
        title={`Team (${members.value.filter((m) => m.status === "active").length})`}
        id="team"
        className="xl:col-span-2"
      >
        <StaffList
          members={members.value}
          canManage={canManage}
          actorRank={access.rank}
          canManageOwners={canManageOwners}
          currentUserId={ctx.userId}
        />
      </SectionCard>
      {canInvite && (
        <div className="flex flex-col gap-4">
          <SectionCard title="Invite a team member" id="invite">
            <InviteStaffForm
              organizationId={access.organizationId}
              actorRank={access.rank}
              canManageOwners={canManageOwners}
            />
          </SectionCard>
          <SectionCard title="Pending invitations" id="pending">
            <PendingInvitations invitations={invitations?.ok ? invitations.value : []} />
          </SectionCard>
        </div>
      )}
    </div>
  );
}

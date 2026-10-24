import { notFound } from "next/navigation";
import { listHouseholdInvitations, listHouseholdMembers } from "@bahayplus/modules/households";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { InvitationList } from "@/components/households/invitation-list";
import { InviteMemberForm } from "@/components/households/invite-member-form";
import { MemberList } from "@/components/households/member-list";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/app/h/[householdId]/members">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("household.members.view")) notFound();
  const ctx = await requireServiceContext();
  const canInvite = access.permissions.has("household.invitations.manage");
  const [members, invitations] = await Promise.all([
    listHouseholdMembers(ctx, householdId),
    canInvite ? listHouseholdInvitations(ctx, householdId) : null,
  ]);
  const base = `/app/h/${householdId}`;

  return (
    <>
      <PageHeader
        title="Members"
        description="People with access to this household and what they can do."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Members" }]}
      />
      <div className="flex flex-col gap-4">
        {canInvite && (
          <SectionCard title="Invite someone" id="invite">
            <InviteMemberForm
              householdId={householdId}
              actorRank={access.rank}
              canManageOwners={access.permissions.has("household.owners.manage")}
            />
          </SectionCard>
        )}
        <section aria-labelledby="members-heading" className="flex flex-col gap-3">
          <h2 id="members-heading" className="font-heading text-lg font-semibold">
            Members
          </h2>
          {members.ok ? (
            <MemberList
              members={members.value}
              actor={{
                userId: ctx.userId,
                rank: access.rank,
                canManageMembers: access.permissions.has("household.members.manage"),
                canManageOwners: access.permissions.has("household.owners.manage"),
              }}
            />
          ) : (
            <ErrorState description="We couldn't load members." />
          )}
        </section>
        {invitations && (
          <SectionCard title="Invitations" id="invitations">
            {invitations.ok ? (
              <InvitationList invitations={invitations.value} />
            ) : (
              <ErrorState description="We couldn't load invitations." />
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}

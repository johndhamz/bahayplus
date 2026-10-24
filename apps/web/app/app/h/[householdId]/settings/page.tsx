import { listHouseholdMembers } from "@bahayplus/modules/households";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { HouseholdSettingsForm } from "@/components/households/household-settings-form";
import { MemberList } from "@/components/households/member-list";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";
import { roleLabel } from "@/lib/config/roles";

export const metadata = { title: "Household settings" };

export default async function HouseholdSettingsPage({ params }: PageProps<"/app/h/[householdId]/settings">) {
  const { householdId } = await params;
  const access = await requireHouseholdAccess(householdId);
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const members = await listHouseholdMembers(ctx, householdId);
  const self = members.ok ? members.value.filter((m) => m.userId === ctx.userId) : [];

  return (
    <>
      <PageHeader title="Household settings" breadcrumbs={[{ label: "Home", href: base }, { label: "Settings" }]} />
      <div className="flex max-w-2xl flex-col gap-4">
        <SectionCard title="Details" id="details">
          {access.permissions.has("household.update") ? (
            <HouseholdSettingsForm householdId={householdId} name={access.householdName} />
          ) : (
            <p className="text-sm">
              <span className="font-medium">{access.householdName}</span>
              <span className="block text-muted-foreground">Only owners and managers can rename the household.</span>
            </p>
          )}
        </SectionCard>
        <SectionCard title="Your membership" id="membership">
          <p className="text-sm text-muted-foreground">
            You are a {roleLabel("household", access.role)} of this household.
          </p>
          <MemberList
            members={self}
            actor={{ userId: ctx.userId, rank: access.rank, canManageMembers: false, canManageOwners: false }}
          />
        </SectionCard>
      </div>
    </>
  );
}

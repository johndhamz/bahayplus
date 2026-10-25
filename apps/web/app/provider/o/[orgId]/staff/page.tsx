import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { StaffSection } from "@/components/organizations/staff-page";

export const metadata = { title: "Staff" };

export default async function ProviderStaffPage({ params }: PageProps<"/provider/o/[orgId]/staff">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  return (
    <>
      <PageHeader
        title="Staff"
        description="Owners, managers, office staff and field workers."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Staff" }]}
      />
      <StaffSection ctx={ctx} access={access} />
    </>
  );
}

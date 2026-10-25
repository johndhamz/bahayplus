import { PageHeader } from "@/components/layout/page-header";
import { StaffSection } from "@/components/organizations/staff-page";
import { supplierContext } from "@/components/organizations/supplier-guard";

export const metadata = { title: "Staff" };

export default async function SupplierStaffPage({ params }: PageProps<"/supplier/o/[orgId]/staff">) {
  const { orgId } = await params;
  const { access, ctx, base } = await supplierContext(orgId);
  return (
    <>
      <PageHeader title="Staff" breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Staff" }]} />
      <StaffSection ctx={ctx} access={access} />
    </>
  );
}

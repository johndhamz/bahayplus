import { OrganizationPortalShell } from "@/components/layout/organization-portal";

export default async function Layout({ children, params }: LayoutProps<"/supplier/o/[orgId]">) {
  const { orgId } = await params;
  return (
    <OrganizationPortalShell portal="supplier" organizationId={orgId}>
      {children}
    </OrganizationPortalShell>
  );
}

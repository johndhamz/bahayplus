import { OrganizationPortalShell } from "@/components/layout/organization-portal";

export default async function Layout({ children, params }: LayoutProps<"/provider/o/[orgId]">) {
  const { orgId } = await params;
  return (
    <OrganizationPortalShell portal="provider" organizationId={orgId}>
      {children}
    </OrganizationPortalShell>
  );
}

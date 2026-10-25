import { getSupplierProfile } from "@bahayplus/modules/suppliers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { supplierContext } from "@/components/organizations/supplier-guard";
import { SupplierProfileForm } from "@/components/supply/supplier-forms";

export const metadata = { title: "Supplier profile" };

export default async function SupplierProfilePage({ params }: PageProps<"/supplier/o/[orgId]/profile">) {
  const { orgId } = await params;
  const { ctx, base } = await supplierContext(orgId, "catalog.manage");
  const profile = await getSupplierProfile(ctx, orgId);
  return (
    <>
      <PageHeader
        title="Supplier profile"
        description="What service providers see before ordering."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Profile" }]}
      />
      <SectionCard title="Profile" id="profile" className="max-w-3xl">
        {profile.ok ? (
          <SupplierProfileForm profile={profile.value} />
        ) : (
          <ErrorState description="We couldn't load your profile." />
        )}
      </SectionCard>
    </>
  );
}

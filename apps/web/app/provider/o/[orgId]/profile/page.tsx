import { getProviderProfile } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { ProviderProfileForm } from "@/components/marketplace/provider-forms";
import { providerContext, requireManage } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Business profile" };

export default async function ProviderProfilePage({ params }: PageProps<"/provider/o/[orgId]/profile">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  requireManage(canManage);
  const profile = await getProviderProfile(ctx, orgId);
  return (
    <>
      <PageHeader
        title="Business profile"
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Business profile" }]}
      />
      <SectionCard title="Public profile" id="profile" className="max-w-4xl">
        {profile.ok ? (
          <ProviderProfileForm profile={profile.value} />
        ) : (
          <ErrorState description="We couldn't load your profile." />
        )}
      </SectionCard>
    </>
  );
}

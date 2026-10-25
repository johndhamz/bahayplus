import { notFound } from "next/navigation";
import { listProviderServices } from "@bahayplus/modules/providers";
import { listServiceCategories } from "@bahayplus/modules/marketplace";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EditServiceForm } from "@/components/marketplace/provider-forms";
import { providerContext, requireManage } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/provider/o/[orgId]/services/[serviceId]">) {
  const { orgId, serviceId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  requireManage(canManage);
  const [services, categories] = await Promise.all([listProviderServices(ctx, orgId), listServiceCategories(ctx)]);
  const service = services.ok ? services.value.find((s) => s.id === serviceId) : undefined;
  if (!service || !categories.ok) notFound();
  return (
    <>
      <PageHeader
        title={service.title}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Services", href: `${base}/services` },
          { label: service.title },
        ]}
      />
      <SectionCard title="Service details" id="details" className="max-w-3xl">
        <EditServiceForm service={service} categories={categories.value} />
      </SectionCard>
    </>
  );
}

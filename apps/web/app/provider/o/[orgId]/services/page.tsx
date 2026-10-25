import Link from "next/link";
import { listProviderServices } from "@bahayplus/modules/providers";
import { listServiceCategories } from "@bahayplus/modules/marketplace";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { CreateServiceForm, DeleteButton } from "@/components/marketplace/provider-forms";
import { priceLabel } from "@/components/marketplace/labels";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";
import { deleteProviderServiceAction } from "@/lib/actions/marketplace";

export const metadata = { title: "Services & pricing" };

export default async function ProviderServicesPage({ params }: PageProps<"/provider/o/[orgId]/services">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  const [services, categories] = await Promise.all([listProviderServices(ctx, orgId), listServiceCategories(ctx)]);
  return (
    <>
      <PageHeader
        title="Services & pricing"
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Services" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Your services" id="services" className="xl:col-span-2">
          {services.ok && services.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {services.value.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`${base}/services/${s.id}`}
                      className="inline-flex min-h-6 items-center font-medium hover:underline"
                    >
                      {s.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.categoryName} · {priceLabel(s)}
                      {s.allowsBookNow ? " · Book Now" : ""}
                      {s.allowsQuote ? " · Quotes" : ""}
                    </p>
                  </div>
                  {!s.isActive && <StatusBadge status="inactive" />}
                  {canManage && (
                    <DeleteButton
                      label={s.title}
                      action={deleteProviderServiceAction.bind(null, { serviceId: s.id })}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No services yet.</p>
          )}
        </SectionCard>
        {canManage && categories.ok && (
          <SectionCard title="Add a service" id="add-service">
            <CreateServiceForm organizationId={orgId} categories={categories.value} />
          </SectionCard>
        )}
      </div>
    </>
  );
}

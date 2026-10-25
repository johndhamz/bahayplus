import { MapPin } from "lucide-react";
import { listServiceAreas } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { AddAreaForm, DeleteButton } from "@/components/marketplace/provider-forms";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";
import { removeServiceAreaAction } from "@/lib/actions/marketplace";

export const metadata = { title: "Coverage areas" };

export default async function CoveragePage({ params }: PageProps<"/provider/o/[orgId]/coverage">) {
  const { orgId } = await params;
  const { ctx, canManage, base } = await providerContext(orgId);
  const areas = await listServiceAreas(ctx, orgId);
  const label = (a: { province: string; cityMunicipality: string | null; barangay: string | null }) =>
    a.barangay ? `Brgy. ${a.barangay}, ${a.cityMunicipality}, ${a.province}` : a.cityMunicipality ? `${a.cityMunicipality}, ${a.province}` : `All of ${a.province}`;
  return (
    <>
      <PageHeader title="Coverage areas" description="Customers in these areas can find you. Matching uses province, city and barangay names." breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Coverage" }]} />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Areas you serve" id="areas" className="xl:col-span-2">
          {areas.ok && areas.value.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {areas.value.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <MapPin aria-hidden="true" className="size-4 text-brand" />
                  <span className="flex-1 text-sm">{label(a)}</span>
                  {canManage && <DeleteButton label={label(a)} action={removeServiceAreaAction.bind(null, { areaId: a.id })} />}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState size="compact" icon={MapPin} title="No coverage areas" description="Add the provinces, cities or barangays you serve." />
          )}
        </SectionCard>
        {canManage && (
          <SectionCard title="Add an area" id="add-area">
            <AddAreaForm organizationId={orgId} />
          </SectionCard>
        )}
      </div>
    </>
  );
}

import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { listHouseholdActivity } from "@bahayplus/modules/households";
import { formatPhilippineAddress, getProperty, PROPERTY_TYPE_LABELS } from "@bahayplus/modules/properties";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { ActivityList } from "@/components/households/activity-list";
import { PropertyActions } from "@/components/households/property-actions";
import { EditPropertyForm } from "@/components/households/property-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Property" };

export default async function PropertyPage({ params }: PageProps<"/app/h/[householdId]/properties/[propertyId]">) {
  const { householdId, propertyId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("property.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getProperty(ctx, propertyId);
  // A property from another household is indistinguishable from a missing one.
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const property = result.value;
  const canManage = access.permissions.has("property.manage");
  const activity = await listHouseholdActivity(ctx, householdId, { propertyId, limit: 10 });
  const base = `/app/h/${householdId}`;
  const address = formatPhilippineAddress(property, { multiline: true });

  return (
    <>
      <PageHeader
        title={property.name}
        eyebrow={PROPERTY_TYPE_LABELS[property.propertyType]}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Properties", href: `${base}/properties` },
          { label: property.name },
        ]}
        actions={canManage ? <PropertyActions property={property} /> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {property.isDefault && <StatusBadge status="default" tone="brand" label="Default property" />}
        {property.archivedAt ? (
          <StatusBadge status="archived" />
        ) : (
          <StatusBadge status={property.isActive ? "active" : "inactive"} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {canManage && !property.archivedAt ? (
            <SectionCard title="Details" id="details">
              <EditPropertyForm property={property} />
            </SectionCard>
          ) : (
            <SectionCard title="Details" id="details">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="font-medium text-muted-foreground">Address</dt>
                  <dd className="mt-1 flex gap-1 whitespace-pre-line">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {address || "Not provided"}
                  </dd>
                </div>
                {property.latitude !== null && (
                  <div>
                    <dt className="font-medium text-muted-foreground">Coordinates</dt>
                    <dd className="mt-1 font-mono">
                      {property.latitude}, {property.longitude}
                    </dd>
                  </div>
                )}
                {property.notes && (
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-muted-foreground">Notes</dt>
                    <dd className="mt-1 whitespace-pre-line">{property.notes}</dd>
                  </div>
                )}
              </dl>
              {property.archivedAt && (
                <p className="text-sm text-muted-foreground">
                  Archived properties are read-only. Restore it to make changes.
                </p>
              )}
            </SectionCard>
          )}
        </div>
        <SectionCard title="Activity" id="property-activity">
          {activity.ok ? <ActivityList items={activity.value} /> : null}
        </SectionCard>
      </div>
    </>
  );
}

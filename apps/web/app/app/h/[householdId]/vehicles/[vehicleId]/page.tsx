import { notFound } from "next/navigation";
import { listFiles } from "@bahayplus/modules/files";
import { listDueItems } from "@bahayplus/modules/scheduling";
import {
  getVehicle,
  listVehicleServiceRecords,
  ltoRenewalMonth,
  VEHICLE_TYPE_LABELS,
  vehicleLabel,
} from "@bahayplus/modules/vehicles";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { ArchiveToggle } from "@/components/registry/archive-toggle";
import { AttachmentList } from "@/components/registry/attachment-list";
import { DueList } from "@/components/registry/due-list";
import { FileUpload } from "@/components/registry/file-upload";
import { RecordTimeline } from "@/components/registry/record-timeline";
import {
  EditVehicleForm,
  VEHICLE_SERVICE_KIND_LABELS,
  VehicleServiceRecordForm,
} from "@/components/registry/vehicle-forms";
import { archiveVehicleAction, deleteVehicleServiceRecordAction, restoreVehicleAction } from "@/lib/actions/registry";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Vehicle" };

export default async function VehiclePage({ params }: PageProps<"/app/h/[householdId]/vehicles/[vehicleId]">) {
  const { householdId, vehicleId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getVehicle(ctx, vehicleId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const vehicle = result.value;
  const today = manilaDateOf(new Date());
  const [records, files, due] = await Promise.all([
    listVehicleServiceRecords(ctx, vehicleId),
    listFiles(ctx, "vehicle", vehicleId),
    listDueItems(ctx, householdId, { horizonDays: 3650, subject: { type: "vehicle", id: vehicleId } }),
  ]);
  const canManage = access.permissions.has("registry.manage") && !vehicle.archivedAt;
  const base = `/app/h/${householdId}`;
  const renewal = vehicle.plateNumber ? ltoRenewalMonth(vehicle.plateNumber) : null;

  return (
    <>
      <PageHeader
        title={vehicleLabel(vehicle)}
        eyebrow={VEHICLE_TYPE_LABELS[vehicle.vehicleType]}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Vehicles", href: `${base}/vehicles` },
          { label: vehicle.plateNumber || vehicle.model },
        ]}
        actions={
          access.permissions.has("registry.manage") ? (
            <ArchiveToggle
              archived={!!vehicle.archivedAt}
              label={vehicleLabel(vehicle)}
              description="Use this when you sell or stop using the vehicle. History and documents are kept."
              archive={archiveVehicleAction.bind(null, { vehicleId })}
              restore={restoreVehicleAction.bind(null, { vehicleId })}
            />
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {vehicle.archivedAt && <StatusBadge status="archived" />}
        {vehicle.mileageKm !== null && (
          <StatusBadge status="info" tone="neutral" label={`${vehicle.mileageKm.toLocaleString("en-PH")} km`} />
        )}
        {renewal && <StatusBadge status="info" tone="info" label={`LTO renewal month: ${renewal.name}`} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Service history" id="history">
            {canManage && <VehicleServiceRecordForm vehicleId={vehicleId} today={today} />}
            <RecordTimeline
              empty="No service records yet."
              deleteAction={canManage ? deleteVehicleServiceRecordAction : undefined}
              items={
                records.ok
                  ? records.value.map((r) => ({
                      id: r.id,
                      date:
                        formatManilaDate(r.servicedOn) +
                        (r.odometerKm !== null ? ` · ${r.odometerKm.toLocaleString("en-PH")} km` : ""),
                      title: VEHICLE_SERVICE_KIND_LABELS[r.kind as keyof typeof VEHICLE_SERVICE_KIND_LABELS] ?? r.kind,
                      detail: [r.description, r.providerName].filter(Boolean).join(" — ") || undefined,
                      meta: r.costCentavos !== null ? formatPeso(r.costCentavos) : undefined,
                    }))
                  : []
              }
            />
          </SectionCard>
          <SectionCard title="Details" id="details">
            {canManage ? (
              <EditVehicleForm vehicle={vehicle} />
            ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Registration expires</dt>
                  <dd>{vehicle.registrationExpiresOn ? formatManilaDate(vehicle.registrationExpiresOn) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Insurance</dt>
                  <dd>
                    {vehicle.insuranceProvider || "—"}
                    {vehicle.insuranceExpiresOn ? ` until ${formatManilaDate(vehicle.insuranceExpiresOn)}` : ""}
                  </dd>
                </div>
              </dl>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Reminders" id="reminders">
            <DueList
              items={due.ok ? due.value : []}
              basePath={base}
              emptyText="Add registration, insurance or maintenance details to get reminders."
            />
          </SectionCard>
          <SectionCard title="Documents" id="documents">
            {canManage && (
              <FileUpload
                householdId={householdId}
                entityType="vehicle"
                entityId={vehicleId}
                purpose="document"
                label="Upload OR/CR or policy"
              />
            )}
            <AttachmentList files={files.ok ? files.value : []} canManage={canManage} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}

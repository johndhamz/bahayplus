import { notFound } from "next/navigation";
import { ASSET_CATEGORY_LABELS, getAsset, listAssetServiceRecords, warrantyStatus } from "@bahayplus/modules/assets";
import { listFiles } from "@bahayplus/modules/files";
import { listProperties } from "@bahayplus/modules/properties";
import { listDueItems } from "@bahayplus/modules/scheduling";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDate, manilaDateOf } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { ArchiveToggle } from "@/components/registry/archive-toggle";
import { ASSET_SERVICE_KIND_LABELS, AssetServiceRecordForm, EditAssetForm } from "@/components/registry/asset-forms";
import { AttachmentList } from "@/components/registry/attachment-list";
import { DueList } from "@/components/registry/due-list";
import { FileUpload } from "@/components/registry/file-upload";
import { RecordTimeline } from "@/components/registry/record-timeline";
import { archiveAssetAction, deleteAssetServiceRecordAction, restoreAssetAction } from "@/lib/actions/registry";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Item" };

export default async function AssetPage({ params }: PageProps<"/app/h/[householdId]/assets/[assetId]">) {
  const { householdId, assetId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("registry.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getAsset(ctx, assetId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const asset = result.value;
  const today = manilaDateOf(new Date());
  const [records, files, properties, due] = await Promise.all([
    listAssetServiceRecords(ctx, assetId),
    listFiles(ctx, "asset", assetId),
    listProperties(ctx, householdId),
    listDueItems(ctx, householdId, { horizonDays: 3650, subject: { type: "asset", id: assetId } }),
  ]);
  const canManage = access.permissions.has("registry.manage") && !asset.archivedAt;
  const base = `/app/h/${householdId}`;
  const w = warrantyStatus(asset.warrantyExpiresOn, today);

  return (
    <>
      <PageHeader
        title={asset.name}
        eyebrow={ASSET_CATEGORY_LABELS[asset.category]}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Assets", href: `${base}/assets` },
          { label: asset.name },
        ]}
        actions={
          access.permissions.has("registry.manage") ? (
            <ArchiveToggle
              archived={!!asset.archivedAt}
              label={asset.name}
              description="Archived items leave your lists and reminders but keep their history and files."
              archive={archiveAssetAction.bind(null, { assetId })}
              restore={restoreAssetAction.bind(null, { assetId })}
            />
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {asset.archivedAt && <StatusBadge status="archived" />}
        {w.state === "active" && (
          <StatusBadge status="active" label={`Warranty until ${formatManilaDate(asset.warrantyExpiresOn!)}`} />
        )}
        {w.state === "expiring_soon" && (
          <StatusBadge status="pending" label={`Warranty ends in ${w.daysRemaining} days`} />
        )}
        {w.state === "expired" && <StatusBadge status="expired" label="Warranty expired" />}
        {asset.purchasePriceCentavos !== null && (
          <StatusBadge status="info" tone="neutral" label={`Bought for ${formatPeso(asset.purchasePriceCentavos)}`} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Maintenance history" id="history">
            {canManage && <AssetServiceRecordForm assetId={assetId} today={today} />}
            <RecordTimeline
              empty="No service records yet."
              deleteAction={canManage ? deleteAssetServiceRecordAction : undefined}
              items={
                records.ok
                  ? records.value.map((r) => ({
                      id: r.id,
                      date: formatManilaDate(r.servicedOn),
                      title: ASSET_SERVICE_KIND_LABELS[r.kind as keyof typeof ASSET_SERVICE_KIND_LABELS] ?? r.kind,
                      detail:
                        [r.description, r.providerName && `by ${r.providerName}`].filter(Boolean).join(" — ") ||
                        undefined,
                      meta: r.costCentavos !== null ? formatPeso(r.costCentavos) : undefined,
                    }))
                  : []
              }
            />
          </SectionCard>
          <SectionCard title="Details" id="details">
            {canManage ? (
              <EditAssetForm
                asset={asset}
                properties={properties.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : []}
              />
            ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {[
                  ["Brand", asset.brand],
                  ["Model", asset.model],
                  ["Serial number", asset.serialNumber],
                  ["Property", asset.propertyName ?? ""],
                  ["Purchased", asset.purchaseDate ? formatManilaDate(asset.purchaseDate) : ""],
                  ["Notes", asset.notes],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="Reminders" id="reminders">
            <DueList
              items={due.ok ? due.value : []}
              basePath={base}
              emptyText="Add a warranty date or maintenance interval to get reminders."
            />
          </SectionCard>
          <SectionCard title="Photos & receipts" id="files">
            {canManage && (
              <FileUpload
                householdId={householdId}
                entityType="asset"
                entityId={assetId}
                purpose="receipt"
                label="Upload photo or receipt"
              />
            )}
            <AttachmentList files={files.ok ? files.value : []} canManage={canManage} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}

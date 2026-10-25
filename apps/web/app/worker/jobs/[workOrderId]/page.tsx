import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getWorkOrder, getWorkOrderLocation } from "@bahayplus/modules/bookings";
import { listFiles } from "@bahayplus/modules/files";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { AttachmentList } from "@/components/registry/attachment-list";
import { FileUpload } from "@/components/registry/file-upload";
import {
  Checklist,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStatusActions,
} from "@/components/transactions/work-order-forms";
import { requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Job" };

export default async function WorkerJobPage({ params }: PageProps<"/worker/jobs/[workOrderId]">) {
  const { workOrderId } = await params;
  const ctx = await requireServiceContext("/worker");
  const result = await getWorkOrder(ctx, workOrderId);
  // Only the assigned worker sees this page (dispatchers use the provider portal).
  if (!result.ok || result.value.assignedWorkerId !== ctx.userId) notFound();
  const w = result.value;
  const [location, files] = await Promise.all([
    getWorkOrderLocation(ctx, workOrderId),
    listFiles(ctx, "work_order", workOrderId),
  ]);
  const open = !["completed", "cancelled"].includes(w.status);
  const photos = files.ok ? files.value : [];
  const before = photos.filter((f) => f.purpose === "before_photo");
  const after = photos.filter((f) => f.purpose === "after_photo" || f.purpose === "evidence");
  const loc = location.ok ? location.value : null;
  return (
    <>
      <PageHeader title={w.title} breadcrumbs={[{ label: "Jobs", href: "/worker/jobs" }, { label: w.title }]} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={w.status} label={WORK_ORDER_STATUS_LABELS[w.status]} />
        <span className="text-sm text-muted-foreground">
          {formatManilaDateTime(w.scheduledStart)} – {formatManilaDateTime(w.scheduledEnd)}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Where" id="where">
          {loc ? (
            <>
              <p className="font-medium">{loc.propertyName}</p>
              <p className="text-sm">{loc.address}</p>
              {loc.notes && <p className="text-sm text-muted-foreground">{loc.notes}</p>}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-brand hover:underline"
              >
                <MapPin aria-hidden="true" className="size-4" /> Open in maps
              </a>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Address not available.</p>
          )}
        </SectionCard>
        <SectionCard title="Instructions" id="instructions">
          <p className="text-sm whitespace-pre-line">{w.instructions || "No special instructions."}</p>
        </SectionCard>
        <SectionCard title="Checklist" id="checklist">
          <Checklist items={w.checklist} canToggle={open} />
        </SectionCard>
        {open && (
          <SectionCard title="Update status" id="status">
            <WorkOrderStatusActions workOrder={w} canCancel={false} />
            <p className="text-xs text-muted-foreground">
              To complete the job, finish the checklist and add completion notes or an &quot;after&quot; photo.
            </p>
          </SectionCard>
        )}
        <SectionCard title="Before photos" id="before">
          {open && (
            <FileUpload
              householdId={w.householdId}
              entityType="work_order"
              entityId={w.id}
              purpose="before_photo"
              label="Add before photo"
              imagesOnly
            />
          )}
          <AttachmentList files={before} canManage={false} />
        </SectionCard>
        <SectionCard title="After photos & evidence" id="after">
          {open && (
            <FileUpload
              householdId={w.householdId}
              entityType="work_order"
              entityId={w.id}
              purpose="after_photo"
              label="Add after photo"
              imagesOnly
            />
          )}
          <AttachmentList files={after} canManage={false} />
        </SectionCard>
        {w.status === "completed" && (
          <SectionCard title="Completion" id="completion">
            <p className="text-sm">{w.completionNotes || "No notes."}</p>
            {w.completedAt && (
              <p className="text-xs text-muted-foreground">Completed {formatManilaDateTime(w.completedAt)}</p>
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}

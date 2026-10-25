import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkOrder, listFieldWorkers } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import {
  AssignWorkerForm,
  Checklist,
  WORK_ORDER_STATUS_LABELS,
  WorkOrderStatusActions,
} from "@/components/transactions/work-order-forms";

export const metadata = { title: "Work order" };

export default async function WorkOrderPage({ params }: PageProps<"/provider/o/[orgId]/work-orders/[workOrderId]">) {
  const { orgId, workOrderId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("work_orders.manage")) notFound();
  const result = await getWorkOrder(ctx, workOrderId);
  if (!result.ok || result.value.organizationId !== orgId) notFound();
  const w = result.value;
  const workers = await listFieldWorkers(ctx, orgId);
  const open = !["completed", "cancelled"].includes(w.status);

  return (
    <>
      <PageHeader
        title={w.title}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Work orders", href: `${base}/work-orders` },
          { label: w.title },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={w.status} label={WORK_ORDER_STATUS_LABELS[w.status]} />
        <span className="text-sm text-muted-foreground">
          {formatManilaDateTime(w.scheduledStart)} – {formatManilaDateTime(w.scheduledEnd)}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Instructions" id="instructions">
            <p className="text-sm whitespace-pre-line">{w.instructions || "No instructions."}</p>
            {w.bookingId && (
              <Link href={`${base}/bookings/${w.bookingId}`} className="text-sm font-medium text-brand hover:underline">
                View booking
              </Link>
            )}
            {w.projectId && (
              <Link href={`${base}/projects/${w.projectId}`} className="text-sm font-medium text-brand hover:underline">
                View project
              </Link>
            )}
          </SectionCard>
          <SectionCard title="Checklist" id="checklist">
            <Checklist items={w.checklist} canToggle={open} />
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
        <div className="flex flex-col gap-4">
          <SectionCard title="Assigned worker" id="worker">
            <p className="text-sm font-medium">{w.assignedWorkerName ?? "Unassigned"}</p>
            {open && (
              <AssignWorkerForm
                workOrderId={w.id}
                workers={workers.ok ? workers.value : []}
                current={w.assignedWorkerId}
              />
            )}
          </SectionCard>
          {open && (
            <SectionCard title="Status" id="status">
              <WorkOrderStatusActions workOrder={w} />
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

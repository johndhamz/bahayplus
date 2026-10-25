import { HardHat } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBookings, listWorkOrders } from "@bahayplus/modules/bookings";
import { listProjects } from "@bahayplus/modules/projects";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { CreateWorkOrderForm, WORK_ORDER_STATUS_LABELS } from "@/components/transactions/work-order-forms";

export const metadata = { title: "Work orders" };

export default async function WorkOrdersPage({ params, searchParams }: PageProps<"/provider/o/[orgId]/work-orders">) {
  const { orgId } = await params;
  const sp = await searchParams;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("work_orders.manage")) notFound();
  const [workOrders, bookings, projects] = await Promise.all([
    listWorkOrders(ctx, { organizationId: orgId }),
    listBookings(ctx, { organizationId: orgId }, { statuses: ["confirmed", "in_progress"] }),
    listProjects(ctx, { organizationId: orgId }),
  ]);
  if (!workOrders.ok) return <ErrorState description="We couldn't load work orders." />;
  const sources = [
    ...(bookings.ok ? bookings.value : []).map((b) => ({
      value: b.id,
      label: `Booking: ${b.title || "Service"}${b.scheduledStart ? ` (${formatManilaDateTime(b.scheduledStart)})` : ""}`,
      kind: "booking" as const,
    })),
    ...(projects.ok ? projects.value.filter((p) => p.status === "active") : []).map((p) => ({
      value: p.id,
      label: `Project: ${p.title}`,
      kind: "project" as const,
    })),
  ];
  const source = typeof sp.source === "string" && sources.some((s) => s.value === sp.source) ? sp.source : undefined;
  const open = workOrders.value.filter((w) => !["completed", "cancelled"].includes(w.status));
  const done = workOrders.value.filter((w) => !open.includes(w));
  const list = (items: typeof open) => (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((w) => (
        <li key={w.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`${base}/work-orders/${w.id}`} className="font-medium hover:underline">
              {w.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatManilaDateTime(w.scheduledStart)} · {w.assignedWorkerName ?? "Unassigned"}
            </p>
          </div>
          <StatusBadge
            status={w.status}
            tone={w.status === "scheduled" ? "warning" : undefined}
            label={WORK_ORDER_STATUS_LABELS[w.status]}
          />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader
        title="Work orders"
        description="Dispatch field workers to confirmed jobs."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Work orders" }]}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {workOrders.value.length ? (
            <>
              <SectionCard title={`Open (${open.length})`} id="open">
                {open.length ? list(open) : <p className="text-sm text-muted-foreground">No open work orders.</p>}
              </SectionCard>
              {done.length > 0 && (
                <SectionCard title="Done" id="done">
                  {list(done)}
                </SectionCard>
              )}
            </>
          ) : (
            <EmptyState
              icon={HardHat}
              titleAs="h2"
              title="No work orders yet"
              description="Create one for a confirmed booking or an active project."
            />
          )}
        </div>
        <SectionCard title="New work order" id="new">
          <CreateWorkOrderForm sources={sources} defaultSource={source} hrefBase={`${base}/work-orders`} />
        </SectionCard>
      </div>
    </>
  );
}

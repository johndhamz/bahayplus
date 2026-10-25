import { History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBookings, listWorkOrders } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { BookingList } from "@/components/transactions/display";

export const metadata = { title: "Job history" };

export default async function JobHistoryPage({ params }: PageProps<"/provider/o/[orgId]/history">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const [bookings, workOrders] = await Promise.all([
    listBookings(ctx, { organizationId: orgId }, { statuses: ["completed", "cancelled", "declined"], limit: 200 }),
    access.permissions.has("work_orders.manage")
      ? listWorkOrders(ctx, { organizationId: orgId }, { statuses: ["completed"], limit: 200 })
      : null,
  ]);
  if (!bookings.ok) return <ErrorState description="We couldn't load your job history." />;
  const sorted = [...bookings.value].sort((a, b) =>
    (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
  );
  return (
    <>
      <PageHeader
        title="Job history"
        description="Completed, cancelled and declined jobs."
        breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Job history" }]}
      />
      {sorted.length === 0 ? (
        <EmptyState
          icon={History}
          titleAs="h2"
          title="No past jobs yet"
          description="Completed and cancelled bookings will be listed here."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title={`Bookings (${sorted.length})`} id="bookings" className="xl:col-span-2">
            <BookingList bookings={sorted} hrefBase={`${base}/bookings`} showProvider={false} />
          </SectionCard>
          {workOrders?.ok && (
            <SectionCard title={`Completed work orders (${workOrders.value.length})`} id="work-orders">
              {workOrders.value.length ? (
                <ul className="flex flex-col divide-y divide-border text-sm">
                  {workOrders.value.map((w) => (
                    <li key={w.id} className="py-2.5">
                      <Link href={`${base}/work-orders/${w.id}`} className="font-medium hover:underline">
                        {w.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {w.assignedWorkerName ?? "Unassigned"} ·{" "}
                        {w.completedAt ? formatManilaDateTime(w.completedAt) : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None yet.</p>
              )}
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}

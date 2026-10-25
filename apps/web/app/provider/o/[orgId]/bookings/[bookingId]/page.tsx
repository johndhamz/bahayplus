import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, getBookingLocation, listBookingEvents, listWorkOrders } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { BookingActions } from "@/components/transactions/booking-forms";
import { BookingStatusBadge, BookingTimeline, manilaNowLocal } from "@/components/transactions/display";
import { WORK_ORDER_STATUS_LABELS } from "@/components/transactions/work-order-forms";

export const metadata = { title: "Booking" };

export default async function ProviderBookingPage({ params }: PageProps<"/provider/o/[orgId]/bookings/[bookingId]">) {
  const { orgId, bookingId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const result = await getBooking(ctx, bookingId);
  if (!result.ok || result.value.organizationId !== orgId) notFound();
  const b = result.value;
  const [events, location, workOrders] = await Promise.all([
    listBookingEvents(ctx, bookingId),
    getBookingLocation(ctx, bookingId),
    listWorkOrders(ctx, { organizationId: orgId, bookingId }),
  ]);
  const canManage = access.permissions.has("bookings.manage");
  const canDispatch = access.permissions.has("work_orders.manage");

  return (
    <>
      <PageHeader
        title={b.title || "Service booking"}
        breadcrumbs={[
          { label: "Dashboard", href: base },
          { label: "Bookings", href: `${base}/bookings` },
          { label: b.title || "Booking" },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={b.status} />
        {b.customerConfirmation && (
          <span className="text-xs text-muted-foreground">
            {b.customerConfirmation === "confirmed" ? "Customer confirmed completion" : "Customer reported a problem"}
          </span>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Details" id="details">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">When</dt>
                <dd className="font-medium">
                  {b.scheduledStart ? formatManilaDateTime(b.scheduledStart) : "To be agreed"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-medium">
                  {b.agreedAmountCentavos !== null ? formatPeso(b.agreedAmountCentavos) : b.pricingNote || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Location</dt>
                {location.ok && location.value ? (
                  <>
                    <dd className="font-medium">{location.value.propertyName}</dd>
                    <dd>{location.value.address}</dd>
                    {location.value.notes && <dd className="text-xs text-muted-foreground">{location.value.notes}</dd>}
                  </>
                ) : (
                  <dd className="text-muted-foreground">Shared once you confirm the booking.</dd>
                )}
              </div>
              {b.customerNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Customer notes</dt>
                  <dd className="whitespace-pre-line">{b.customerNotes}</dd>
                </div>
              )}
              {b.cancellationReason !== null && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {b.status === "declined" ? "Declined" : "Cancelled"} by {b.cancelledBy ?? "provider"}
                  </dt>
                  <dd>{b.cancellationReason || "No reason given"}</dd>
                </div>
              )}
            </dl>
          </SectionCard>
          {canManage && ["requested", "confirmed", "in_progress"].includes(b.status) && (
            <SectionCard title="Manage" id="manage">
              <BookingActions bookingId={b.id} status={b.status} side="provider" minStart={manilaNowLocal()} />
            </SectionCard>
          )}
          <SectionCard title="Work orders" id="work-orders">
            {workOrders.ok && workOrders.value.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {workOrders.value.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 py-2.5 text-sm">
                    <Link href={`${base}/work-orders/${w.id}`} className="flex-1 font-medium hover:underline">
                      {w.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {w.assignedWorkerName ?? "Unassigned"} · {WORK_ORDER_STATUS_LABELS[w.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No work orders yet.</p>
            )}
            {canDispatch && ["confirmed", "in_progress"].includes(b.status) && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href={`${base}/work-orders?source=${b.id}`}>Create work order</Link>
              </Button>
            )}
          </SectionCard>
        </div>
        <SectionCard title="Timeline" id="timeline">
          <BookingTimeline events={events.ok ? events.value : []} />
        </SectionCard>
      </div>
    </>
  );
}

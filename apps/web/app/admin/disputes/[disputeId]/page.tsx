import { notFound } from "next/navigation";
import { getDispute } from "@bahayplus/modules/admin";
import { getBooking, listBookingEvents } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { DisputeActions } from "@/components/admin/admin-forms";
import { adminContext } from "@/components/admin/admin-guard";
import { PageHeader } from "@/components/layout/page-header";
import { BookingTimeline } from "@/components/transactions/display";

export const metadata = { title: "Dispute" };

export default async function AdminDisputePage({ params }: PageProps<"/admin/disputes/[disputeId]">) {
  const { disputeId } = await params;
  const { ctx, can } = await adminContext("platform.access");
  const dispute = await getDispute(ctx, disputeId);
  if (!dispute.ok) notFound();
  const d = dispute.value;
  // Admins see the booking summary and its event history only — not the household's other records.
  const [booking, events] = await Promise.all([getBooking(ctx, d.bookingId), listBookingEvents(ctx, d.bookingId)]);
  const open = d.status === "open" || d.status === "under_review";
  return (
    <>
      <PageHeader
        title={d.bookingTitle || "Dispute"}
        eyebrow={d.providerName}
        breadcrumbs={[{ label: "Disputes", href: "/admin/disputes" }, { label: "Dispute" }]}
      />
      <div className="mb-4">
        <StatusBadge status={d.status} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Customer's report" id="report">
            <p className="text-sm whitespace-pre-line">{d.reason || "No details given."}</p>
            <p className="text-xs text-muted-foreground">Opened {formatManilaDateTime(d.createdAt)}</p>
          </SectionCard>
          {booking.ok && (
            <SectionCard title="Booking" id="booking">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Scheduled</dt>
                  <dd>{booking.value.scheduledStart ? formatManilaDateTime(booking.value.scheduledStart) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Agreed price</dt>
                  <dd>
                    {booking.value.agreedAmountCentavos !== null ? formatPeso(booking.value.agreedAmountCentavos) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{booking.value.completedAt ? formatManilaDateTime(booking.value.completedAt) : "—"}</dd>
                </div>
              </dl>
            </SectionCard>
          )}
          {open && can("platform.disputes.manage") && (
            <SectionCard title="Decision" id="decision">
              <DisputeActions disputeId={d.id} status={d.status} />
            </SectionCard>
          )}
          {!open && (
            <SectionCard title="Outcome" id="outcome">
              <p className="text-sm whitespace-pre-line">{d.resolution}</p>
              {d.resolvedAt && <p className="text-xs text-muted-foreground">{formatManilaDateTime(d.resolvedAt)}</p>}
            </SectionCard>
          )}
        </div>
        <SectionCard title="Booking timeline" id="timeline">
          <BookingTimeline events={events.ok ? events.value : []} />
        </SectionCard>
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking, getBookingLocation, listBookingEvents } from "@bahayplus/modules/bookings";
import { listReviewableBookings } from "@bahayplus/modules/marketplace";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { formatPeso } from "@bahayplus/types/money";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewForm } from "@/components/marketplace/review-form";
import { BookingPaymentPanel } from "@/components/payments/booking-payment";
import { BookingActions, ConfirmCompletion } from "@/components/transactions/booking-forms";
import { BookingStatusBadge, BookingTimeline, manilaNowLocal } from "@/components/transactions/display";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Booking" };

export default async function BookingPage({ params }: PageProps<"/app/h/[householdId]/bookings/[bookingId]">) {
  const { householdId, bookingId } = await params;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const result = await getBooking(ctx, bookingId);
  if (!result.ok || result.value.householdId !== householdId) notFound();
  const b = result.value;
  const canAct = access.permissions.has("services.book");
  const [events, location, reviewable] = await Promise.all([
    listBookingEvents(ctx, bookingId),
    getBookingLocation(ctx, bookingId),
    b.status === "completed" && canAct ? listReviewableBookings(ctx, householdId) : null,
  ]);
  const review = reviewable?.ok ? reviewable.value.find((r) => r.bookingId === bookingId) : undefined;
  const base = `/app/h/${householdId}`;

  return (
    <>
      <PageHeader
        title={b.title || "Service booking"}
        eyebrow={b.providerName}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Bookings", href: `${base}/bookings` },
          { label: b.title || "Booking" },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BookingStatusBadge status={b.status} />
        {b.customerConfirmation && (
          <span className="text-xs text-muted-foreground">
            {b.customerConfirmation === "confirmed" ? "You confirmed completion" : "You reported a problem"}
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
                  {b.agreedAmountCentavos !== null
                    ? formatPeso(b.agreedAmountCentavos)
                    : b.pricingNote || "Per provider's quote"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">
                  <Link href={`${base}/services/providers/${b.providerSlug}`} className="hover:underline">
                    {b.providerName}
                  </Link>
                </dd>
              </div>
              {location.ok && location.value && (
                <div>
                  <dt className="text-muted-foreground">Where</dt>
                  <dd className="font-medium">{location.value.propertyName}</dd>
                  <dd className="text-xs text-muted-foreground">{location.value.address}</dd>
                </div>
              )}
              {b.customerNotes && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Your notes</dt>
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
              {b.serviceRequestId && (
                <div className="sm:col-span-2">
                  <Link
                    href={`${base}/bookings/requests/${b.serviceRequestId}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    View the accepted quotation
                  </Link>
                </div>
              )}
            </dl>
          </SectionCard>
          {canAct && ["requested", "confirmed"].includes(b.status) && (
            <SectionCard title="Manage" id="manage">
              <BookingActions bookingId={b.id} status={b.status} side="customer" minStart={manilaNowLocal()} />
            </SectionCard>
          )}
          <BookingPaymentPanel ctx={ctx} booking={b} canPay={canAct} returnPath={`${base}/bookings/${b.id}`} />
          {canAct && b.status === "completed" && !b.customerConfirmation && (
            <SectionCard title="Was the job completed?" id="confirm">
              <p className="mb-3 text-sm text-muted-foreground">
                {b.providerName} marked this job as done. Let them know.
              </p>
              <ConfirmCompletion bookingId={b.id} />
            </SectionCard>
          )}
          {review && !review.reviewed && (
            <SectionCard title="Leave a review" id="review">
              <ReviewForm bookingId={b.id} providerName={b.providerName} />
            </SectionCard>
          )}
        </div>
        <SectionCard title="Timeline" id="timeline">
          <BookingTimeline events={events.ok ? events.value : []} />
        </SectionCard>
      </div>
    </>
  );
}

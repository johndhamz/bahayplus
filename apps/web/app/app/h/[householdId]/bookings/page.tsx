import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBookings, listServiceRequests } from "@bahayplus/modules/bookings";
import { getProviderBySlug } from "@bahayplus/modules/marketplace";
import { listProperties } from "@bahayplus/modules/properties";
import { getProviderProfile, listProviderServices } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate } from "@bahayplus/types/dates";
import { PageHeader } from "@/components/layout/page-header";
import { NewBookingForm, NewQuoteRequestForm } from "@/components/transactions/booking-forms";
import { BookingList, manilaNowLocal } from "@/components/transactions/display";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ params, searchParams }: PageProps<"/app/h/[householdId]/bookings">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const mode = sp.mode === "book" || sp.mode === "quote" ? sp.mode : null;
  const slug = typeof sp.provider === "string" ? sp.provider : null;
  const serviceId = typeof sp.service === "string" ? sp.service : null;

  if (mode && slug && access.permissions.has("services.book")) {
    const provider = await getProviderBySlug(ctx, slug);
    if (!provider.ok) notFound();
    const [services, profile, properties] = await Promise.all([
      listProviderServices(ctx, provider.value.organizationId, { activeOnly: true }),
      getProviderProfile(ctx, provider.value.organizationId),
      listProperties(ctx, householdId),
    ]);
    const service = services.ok ? services.value.find((s) => s.id === serviceId) : undefined;
    const props = properties.ok ? properties.value.map((p) => ({ id: p.id, name: p.name })) : [];
    const canBook = mode === "book" && service?.allowsBookNow && profile.ok && profile.value.acceptsBookNow;
    const canQuote =
      mode === "quote" && profile.ok && profile.value.acceptsQuoteRequests && (!service || service.allowsQuote);
    return (
      <>
        <PageHeader
          title={mode === "book" ? "Book a service" : "Request a quote"}
          breadcrumbs={[
            { label: "Home", href: base },
            { label: "Services", href: `${base}/services` },
            { label: provider.value.name, href: `${base}/services/providers/${slug}` },
            { label: mode === "book" ? "Book" : "Quote" },
          ]}
        />
        <SectionCard title={provider.value.name} id="new" className="max-w-2xl">
          {!props.length ? (
            <EmptyState
              size="compact"
              title="Add a property first"
              description="Providers need to know where the job is."
              action={
                <Button asChild size="sm">
                  <Link href={`${base}/properties`}>Add property</Link>
                </Button>
              }
            />
          ) : canBook && service ? (
            <NewBookingForm
              householdId={householdId}
              serviceId={service.id}
              serviceTitle={service.title}
              providerName={provider.value.name}
              properties={props}
              defaultPropertyId={null}
              minStart={manilaNowLocal()}
            />
          ) : canQuote ? (
            <NewQuoteRequestForm
              householdId={householdId}
              organizationId={provider.value.organizationId}
              serviceId={service?.id ?? null}
              providerName={provider.value.name}
              properties={props}
              defaultPropertyId={null}
              defaultTitle={service?.title ?? ""}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This provider isn&apos;t accepting {mode === "book" ? "instant bookings" : "quote requests"} for this
              service right now.
            </p>
          )}
        </SectionCard>
      </>
    );
  }

  const [bookings, requests] = await Promise.all([
    listBookings(ctx, { householdId }),
    listServiceRequests(ctx, { householdId }),
  ]);
  if (!bookings.ok) return <ErrorState description="We couldn't load your bookings." />;
  const active = bookings.value.filter((b) => ["requested", "confirmed", "in_progress"].includes(b.status));
  const past = bookings.value.filter((b) => !active.includes(b));
  const openRequests = requests.ok ? requests.value.filter((r) => r.status === "open" || r.status === "quoted") : [];

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Service bookings and quote requests for this household."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Bookings" }]}
        actions={
          <Button asChild>
            <Link href={`${base}/services`}>Find a provider</Link>
          </Button>
        }
      />
      {!bookings.value.length && !openRequests.length ? (
        <EmptyState
          icon={ClipboardList}
          titleAs="h2"
          title="No bookings yet"
          description="Book a verified provider or request a quote from Services."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <SectionCard title="Upcoming & active" id="active">
              {active.length ? (
                <BookingList bookings={active} hrefBase={`${base}/bookings`} showProvider />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              )}
            </SectionCard>
            {past.length > 0 && (
              <SectionCard title="Past" id="past">
                <BookingList bookings={past} hrefBase={`${base}/bookings`} showProvider />
              </SectionCard>
            )}
          </div>
          <SectionCard title="Quote requests" id="requests">
            {openRequests.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {openRequests.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`${base}/bookings/requests/${r.id}`} className="text-sm font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {r.providerName} · {formatManilaDate(new Date(r.createdAt))}
                      </p>
                    </div>
                    <StatusBadge
                      status={r.status}
                      tone={r.status === "quoted" ? "info" : "warning"}
                      label={r.status === "quoted" ? "Quote ready" : "Waiting"}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open quote requests.</p>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}

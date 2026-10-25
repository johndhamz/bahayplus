import { ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { listBookings } from "@bahayplus/modules/bookings";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { providerContext } from "@/components/marketplace/provider-guard";
import { BookingList } from "@/components/transactions/display";

export const metadata = { title: "Bookings" };

export default async function ProviderBookingsPage({ params }: PageProps<"/provider/o/[orgId]/bookings">) {
  const { orgId } = await params;
  const { access, ctx, base } = await providerContext(orgId);
  if (!access.permissions.has("bookings.view")) notFound();
  const bookings = await listBookings(ctx, { organizationId: orgId });
  if (!bookings.ok) return <ErrorState description="We couldn't load bookings." />;
  const groups = [
    { id: "requests", title: "New requests", items: bookings.value.filter((b) => b.status === "requested") },
    {
      id: "upcoming",
      title: "Confirmed & in progress",
      items: bookings.value.filter((b) => b.status === "confirmed" || b.status === "in_progress"),
    },
    {
      id: "history",
      title: "History",
      items: bookings.value.filter((b) => ["completed", "cancelled", "declined"].includes(b.status)),
    },
  ];
  return (
    <>
      <PageHeader title="Bookings" breadcrumbs={[{ label: "Dashboard", href: base }, { label: "Bookings" }]} />
      {bookings.value.length ? (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <SectionCard key={g.id} title={`${g.title} (${g.items.length})`} id={g.id}>
              {g.items.length ? (
                <BookingList bookings={g.items} hrefBase={`${base}/bookings`} showProvider={false} />
              ) : (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          titleAs="h2"
          title="No bookings yet"
          description="Bookings appear here when customers book your services or accept your quotations."
        />
      )}
    </>
  );
}

import {
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  FileText,
  HardHat,
  MapPin,
  Star,
  Store,
  Tags,
} from "lucide-react";
import { listBookings, listServiceRequests, listWorkOrders } from "@bahayplus/modules/bookings";
import Link from "next/link";
import {
  averageRatingTenths,
  getProviderProfile,
  listProviderServices,
  listServiceAreas,
  listVerificationRequests,
} from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { StatCard } from "@bahayplus/ui/components/data/stat-card";
import { formatRating } from "@bahayplus/ui/components/domain/provider-card";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { manilaDateOf } from "@bahayplus/types/dates";
import { AvailabilityToggle } from "@/components/marketplace/provider-forms";
import { providerContext } from "@/components/marketplace/provider-guard";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Provider dashboard" };

export default async function ProviderDashboardPage({ params }: PageProps<"/provider/o/[orgId]">) {
  const { orgId } = await params;
  const { access, ctx, canManage, base } = await providerContext(orgId);
  const [profile, services, areas, requests] = await Promise.all([
    getProviderProfile(ctx, orgId),
    listProviderServices(ctx, orgId, { activeOnly: true }),
    listServiceAreas(ctx, orgId),
    canManage ? listVerificationRequests(ctx, { organizationId: orgId, limit: 1 }) : null,
  ]);
  if (!profile.ok) return <ErrorState description="We couldn't load your business." />;
  const canSeeBookings = access.permissions.has("bookings.view");
  const [openBookings, requestsOpen, workOrders] = await Promise.all([
    canSeeBookings
      ? listBookings(ctx, { organizationId: orgId }, { statuses: ["requested", "confirmed", "in_progress"] })
      : null,
    canSeeBookings ? listServiceRequests(ctx, { organizationId: orgId }) : null,
    access.permissions.has("work_orders.manage")
      ? listWorkOrders(
          ctx,
          { organizationId: orgId },
          { statuses: ["scheduled", "assigned", "en_route", "in_progress"] },
        )
      : null,
  ]);
  const todayKey = manilaDateOf(new Date());
  const ops = {
    newRequests: openBookings?.ok ? openBookings.value.filter((b) => b.status === "requested").length : null,
    today: openBookings?.ok
      ? openBookings.value.filter((b) => b.scheduledStart && manilaDateOf(new Date(b.scheduledStart)) === todayKey)
          .length
      : null,
    openQuotes: requestsOpen?.ok ? requestsOpen.value.filter((r) => r.status === "open").length : null,
    unassigned: workOrders?.ok ? workOrders.value.filter((w) => w.status === "scheduled").length : null,
  };
  const p = profile.value;
  const latest = requests?.ok ? requests.value[0] : undefined;
  const today = manilaDateOf(new Date());
  const verified = latest?.status === "approved" && !!latest.expiresOn && latest.expiresOn >= today;
  const checklist = [
    {
      done: p.tagline.length > 0 && p.phone.length > 0,
      label: "Complete your business profile",
      href: `${base}/profile`,
      icon: Store,
    },
    {
      done: services.ok && services.value.length > 0,
      label: "Add at least one service",
      href: `${base}/services`,
      icon: Tags,
    },
    {
      done: areas.ok && areas.value.length > 0,
      label: "Set your coverage areas",
      href: `${base}/coverage`,
      icon: MapPin,
    },
    { done: verified, label: "Get verified by Bahay+", href: `${base}/verification`, icon: BadgeCheck },
    { done: p.isPublished, label: "Publish your profile", href: `${base}/profile`, icon: Store },
  ];
  const listed = checklist.every((c) => c.done);
  const rating = averageRatingTenths(p.ratingSum, p.ratingCount);

  return (
    <>
      <PageHeader title={access.organizationName} description="Your marketplace presence and day-to-day operations." />
      {canSeeBookings && (
        <section aria-label="Operations" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="New booking requests"
            value={ops.newRequests ?? "—"}
            icon={ClipboardList}
            href={`${base}/bookings`}
            tone={ops.newRequests ? "terracotta" : "default"}
          />
          <StatCard label="Jobs today" value={ops.today ?? "—"} icon={CalendarClock} href={`${base}/bookings`} />
          <StatCard
            label="Quotes to prepare"
            value={ops.openQuotes ?? "—"}
            icon={FileText}
            href={`${base}/quotations`}
          />
          <StatCard
            label="Unassigned work orders"
            value={ops.unassigned ?? "—"}
            icon={HardHat}
            href={`${base}/work-orders`}
          />
        </section>
      )}
      <section aria-label="Marketplace summary" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Marketplace"
          value={listed ? "Listed" : "Not listed"}
          icon={Store}
          tone={listed ? "brand" : "terracotta"}
        />
        <StatCard
          label="Active services"
          value={services.ok ? services.value.length : "—"}
          icon={Tags}
          href={`${base}/services`}
        />
        <StatCard
          label="Rating"
          value={rating === null ? "—" : formatRating(rating)}
          icon={Star}
          hint={`${p.ratingCount} review${p.ratingCount === 1 ? "" : "s"}`}
          href={`${base}/reviews`}
        />
        <StatCard
          label="Verification"
          value={verified ? "Verified" : latest ? latest.status.replace("_", " ") : "Not started"}
          icon={BadgeCheck}
          href={`${base}/verification`}
        />
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Get listed in the marketplace" id="checklist" className="xl:col-span-2">
          <ul className="flex flex-col gap-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-muted/60">
                  {c.done ? (
                    <CircleCheck aria-hidden="true" className="size-5 text-success" />
                  ) : (
                    <CircleDashed aria-hidden="true" className="size-5 text-muted-foreground" />
                  )}
                  <span className={c.done ? "text-muted-foreground line-through" : "font-medium"}>{c.label}</span>
                  <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Availability" id="availability">
          <p className="text-sm text-muted-foreground">Customers see this, with when you last updated it.</p>
          {canManage ? (
            <AvailabilityToggle organizationId={orgId} status={p.availabilityStatus} />
          ) : (
            <StatusBadge status={p.availabilityStatus} />
          )}
        </SectionCard>
      </div>
    </>
  );
}

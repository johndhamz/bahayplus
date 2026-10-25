import { BadgeCheck, Clock, MapPin, MessageCircle, Phone, SearchX, Siren } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlatformSettings } from "@bahayplus/modules/admin";
import { searchUrgentProviders, type UrgentProviderView } from "@bahayplus/modules/marketplace";
import { listProperties } from "@bahayplus/modules/properties";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { URGENT_CATEGORIES, type UrgentCategory } from "@bahayplus/validation/marketplace/urgent";
import { formatManilaDateTime } from "@bahayplus/types/dates";
import { selectClassName } from "@/components/forms/fields";
import { AVAILABILITY_LABELS, verifiedItemLabel } from "@/components/marketplace/labels";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";
import { SITE } from "@/lib/config/site";

export const metadata = { title: "Urgent help" };

const URGENT_LABELS: Record<UrgentCategory, string> = {
  plumbing: "Urgent plumbing (leaks, burst pipes, clogs)",
  electrical: "Electrical problem (no power, sparks, tripping breaker)",
  locksmith: "Locked out / broken lock",
  "roadside-assistance": "Roadside assistance (towing, flat tire, battery)",
  handyman: "Other urgent home repair",
  roofing: "Roof leak",
};

function EmergencyNotice() {
  return (
    <div
      role="note"
      aria-label="Emergency notice"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-danger-soft p-4 text-sm"
    >
      <Siren aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          Life-threatening emergency, fire, gas leak, electrocution or crime? Call{" "}
          <a href={`tel:${SITE.emergencyHotline}`} className="underline">
            {SITE.emergencyHotline}
          </a>{" "}
          now.
        </p>
        <p>
          Bahay+ helps you find nearby providers who say they take urgent calls. We don&apos;t dispatch anyone and
          can&apos;t guarantee that a provider will answer or how fast they will arrive. Contact them directly and agree
          on the details yourself.
        </p>
      </div>
    </div>
  );
}

function ProviderResult({ p, base }: { p: UrgentProviderView; base: string }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`${base}/services/providers/${p.slug}`} className="font-heading font-semibold hover:underline">
            {p.name}
          </Link>
          {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
        </div>
        <StatusBadge
          status={p.availabilityStatus}
          tone={
            p.availabilityStatus === "available"
              ? "success"
              : p.availabilityStatus === "limited"
                ? "warning"
                : "neutral"
          }
          label={AVAILABILITY_LABELS[p.availabilityStatus]}
        />
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        <li className="flex items-start gap-2">
          <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {p.availabilityUpdatedAt ? (
            <span>
              Availability updated {formatManilaDateTime(p.availabilityUpdatedAt)}
              {p.isStale && <strong className="ml-1 text-warning">— may be out of date</strong>}
            </span>
          ) : (
            <strong className="text-warning">Availability never updated — confirm before relying on it</strong>
          )}
        </li>
        <li className="flex items-start gap-2">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>Serves {p.areaLabel ?? "your area"}</span>
        </li>
        <li className="flex items-start gap-2">
          <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            {p.verifiedItems.length
              ? `Verified: ${p.verifiedItems.map(verifiedItemLabel).join(", ")}`
              : "Verified business"}
          </span>
        </li>
        {p.serviceTitles.length > 0 && (
          <li className="text-xs text-muted-foreground">Services: {p.serviceTitles.join(", ")}</li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        {p.phone ? (
          <Button asChild>
            <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>
              <Phone aria-hidden="true" /> Call {p.phone}
            </a>
          </Button>
        ) : null}
        {p.messengerUrl ? (
          <Button asChild variant="outline">
            <a href={p.messengerUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> Messenger
            </a>
          </Button>
        ) : null}
        {!p.phone && !p.messengerUrl && (
          <p className="text-sm text-muted-foreground">
            No direct contact listed — open the profile to request a booking.
          </p>
        )}
      </div>
    </li>
  );
}

export default async function UrgentPage({ params, searchParams }: PageProps<"/app/h/[householdId]/services/urgent">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  if (!access.permissions.has("services.view")) notFound();
  const ctx = await requireServiceContext();
  const base = `/app/h/${householdId}`;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const properties = access.permissions.has("property.view") ? await listProperties(ctx, householdId) : null;
  const home = properties?.ok ? properties.value[0] : undefined;
  const category = URGENT_CATEGORIES.includes(sp.category as UrgentCategory) ? (sp.category as UrgentCategory) : null;
  const province = str(sp.province) || home?.province || "";
  const city = str(sp.city) || (str(sp.province) ? "" : home?.cityMunicipality || "");
  const settings = await getPlatformSettings(ctx);
  const staleHours = settings.ok ? settings.value.urgentStaleHours : 24;
  const results =
    category && province
      ? await searchUrgentProviders(ctx, { category, province, city, barangay: str(sp.barangay) }, { staleHours })
      : null;

  return (
    <>
      <PageHeader
        title="Urgent help"
        description="Providers near you who take urgent calls, with how recently they updated their availability."
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Services", href: `${base}/services` },
          { label: "Urgent help" },
        ]}
      />
      <EmergencyNotice />
      <form
        method="get"
        aria-label="Find urgent help"
        className="mb-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2 lg:col-span-1">
          What do you need?
          <select name="category" defaultValue={category ?? ""} required className={selectClassName}>
            <option value="" disabled>
              Choose a problem
            </option>
            {URGENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {URGENT_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Province
          <input
            name="province"
            defaultValue={province}
            required
            className={selectClassName}
            autoComplete="address-level1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          City / municipality
          <input name="city" defaultValue={city} className={selectClassName} autoComplete="address-level2" />
        </label>
        <Button type="submit">Find providers</Button>
      </form>

      {!results ? (
        <p className="text-sm text-muted-foreground">Choose a problem and your location to see providers.</p>
      ) : !results.ok ? (
        <ErrorState description="We couldn't search providers right now. If this is an emergency, call 911." />
      ) : results.value.available.length === 0 ? (
        <EmptyState
          icon={SearchX}
          titleAs="h2"
          title="No available urgent providers found"
          description={
            results.value.unavailable.length
              ? `${results.value.unavailable.length} provider(s) in your area take urgent calls but are not taking jobs right now. Try a nearby city, or search regular services.`
              : "No verified provider in this area takes urgent calls yet. Try a nearby city or search regular services."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/services?category=${category}`}>
                Search all {category?.replace("-", " ")} providers
              </Link>
            </Button>
          }
        />
      ) : (
        <SectionCard title={`${results.value.available.length} provider(s) available`} id="results">
          <ul className="flex flex-col gap-3">
            {results.value.available.map((p) => (
              <ProviderResult key={p.organizationId} p={p} base={base} />
            ))}
          </ul>
          {results.value.unavailable.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {results.value.unavailable.length} more provider(s) in your area take urgent calls but are not taking jobs
              right now.
            </p>
          )}
        </SectionCard>
      )}
    </>
  );
}

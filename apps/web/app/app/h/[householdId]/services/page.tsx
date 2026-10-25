import { Search, Siren } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listProperties } from "@bahayplus/modules/properties";
import { listReviewableBookings, listServiceCategories, searchProviders } from "@bahayplus/modules/marketplace";
import { availabilityFreshness } from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { ProviderCard } from "@bahayplus/ui/components/domain/provider-card";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { Button } from "@bahayplus/ui/components/ui/button";
import { cn } from "@bahayplus/ui/lib/utils";
import { DIVISIONS, type Division } from "@bahayplus/validation/marketplace/provider";
import { formatPeso } from "@bahayplus/types/money";
import { selectClassName } from "@/components/forms/fields";
import { AVAILABILITY_LABELS, DIVISION_LABELS, verifiedItemLabel } from "@/components/marketplace/labels";
import { ReviewForm } from "@/components/marketplace/review-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";
import { SITE } from "@/lib/config/site";

export const metadata = { title: "Services" };

export default async function ServicesPage({ params, searchParams }: PageProps<"/app/h/[householdId]/services">) {
  const { householdId } = await params;
  const sp = await searchParams;
  const access = await requireHouseholdAccess(householdId);
  const ctx = await requireServiceContext();
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const division = DIVISIONS.includes(sp.division as Division) ? (sp.division as Division) : undefined;
  const category = str(sp.category);
  const query = str(sp.q);
  const page = Number(str(sp.page) ?? "1") || 1;
  const base = `/app/h/${householdId}`;
  const [categories, properties, reviewable] = await Promise.all([
    listServiceCategories(ctx),
    access.permissions.has("property.view") ? listProperties(ctx, householdId) : null,
    access.permissions.has("services.book") ? listReviewableBookings(ctx, householdId) : null,
  ]);
  if (!categories.ok) return <ErrorState description="We couldn't load services." />;
  // Location: an explicit choice, else the household's default property, else everywhere.
  const props = properties?.ok ? properties.value : [];
  const locationKey = str(sp.location) ?? props.find((p) => p.isDefault)?.id ?? "any";
  const property = props.find((p) => p.id === locationKey);
  const results = await searchProviders(ctx, {
    query,
    category,
    division,
    province: property?.province || undefined,
    city: property?.cityMunicipality || undefined,
    barangay: property?.barangay || undefined,
    page,
  });
  const shownCategories = categories.value.filter((c) => !division || c.division === division);
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { division, category, q: query, location: locationKey, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `${base}/services?${next.toString()}`;
  };
  const toReview = reviewable?.ok ? reviewable.value.filter((b) => !b.reviewed) : [];
  if (!access.permissions.has("household.view")) notFound();

  return (
    <>
      <PageHeader
        title="Find a service"
        description="Verified home, pet, vehicle and renovation providers near you."
        breadcrumbs={[{ label: "Home", href: base }, { label: "Services" }]}
      />

      {sp.urgent === "1" && (
        <div
          role="note"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-danger-soft p-4 text-sm"
        >
          <Siren aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>
            <strong>Life-threatening emergency, fire or crime? Call {SITE.emergencyHotline} now.</strong> Urgent
            provider matching arrives in a later release; meanwhile, filter below and check each provider&apos;s
            availability. Bahay+ doesn&apos;t guarantee response times.
          </p>
        </div>
      )}

      <form
        method="get"
        role="search"
        className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-end"
      >
        {division && <input type="hidden" name="division" value={division} />}
        {category && <input type="hidden" name="category" value={category} />}
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Search
          <span className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="e.g. aircon cleaning, leak"
              className="h-11 w-full rounded-xl border border-input bg-surface pr-3 pl-9 text-base md:text-sm"
            />
          </span>
        </label>
        {props.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium sm:w-56">
            Location
            <select name="location" defaultValue={locationKey} className={selectClassName}>
              <option value="any">Anywhere</option>
              {props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.cityMunicipality})
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit">Search</Button>
      </form>

      <nav aria-label="Service divisions" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[undefined, ...DIVISIONS].map((d) => (
          <Link
            key={d ?? "all"}
            href={qs({ division: d, category: undefined, page: undefined })}
            aria-current={division === d ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium",
              division === d
                ? "bg-brand text-brand-foreground"
                : "bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {d ? DIVISION_LABELS[d] : "All"}
          </Link>
        ))}
      </nav>
      <nav aria-label="Categories" className="mb-4 flex flex-wrap gap-2">
        {shownCategories.map((c) => (
          <Link
            key={c.slug}
            href={qs({ category: category === c.slug ? undefined : c.slug, page: undefined })}
            aria-current={category === c.slug ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium",
              category === c.slug ? "border-brand bg-sage text-brand" : "border-border bg-surface",
            )}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {toReview.length > 0 && (
        <SectionCard title="Rate your recent services" id="reviews" className="mb-4">
          <ul className="flex flex-col gap-4">
            {toReview.map((b) => (
              <li key={b.bookingId}>
                <ReviewForm bookingId={b.bookingId} providerName={b.providerName} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <section aria-label="Providers" aria-live="polite">
        {!results.ok ? (
          <ErrorState description="Search failed. Please try again." />
        ) : results.value.items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No providers match"
            description={
              property
                ? `No verified providers cover ${property.cityMunicipality} for this search yet. Try "Anywhere" or another category.`
                : "Try a different search or category."
            }
          />
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {results.value.items.map((p) => {
                const fresh = availabilityFreshness(p.availabilityUpdatedAt, new Date());
                return (
                  <li key={p.organizationId}>
                    <ProviderCard
                      className="h-full"
                      name={p.name}
                      href={`${base}/services/providers/${p.slug}`}
                      verification={{ status: "verified", items: p.verifiedItems.map(verifiedItemLabel) }}
                      rating={p.ratingTenths === null ? null : { averageTenths: p.ratingTenths, count: p.ratingCount }}
                      categories={p.categories}
                      availability={
                        <>
                          {AVAILABILITY_LABELS[p.availabilityStatus]}
                          {fresh === "stale" ? " (not updated recently)" : ""}
                          {p.minPriceCentavos !== null ? ` · from ${formatPeso(p.minPriceCentavos)}` : ""}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
            <nav aria-label="Pagination" className="mt-4 flex justify-between">
              {page > 1 ? (
                <Button asChild variant="outline">
                  <Link href={qs({ page: String(page - 1) })}>Previous</Link>
                </Button>
              ) : (
                <span />
              )}
              {results.value.hasMore && (
                <Button asChild variant="outline">
                  <Link href={qs({ page: String(page + 1) })}>Next</Link>
                </Button>
              )}
            </nav>
          </>
        )}
      </section>
    </>
  );
}

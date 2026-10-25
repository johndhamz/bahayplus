import { BadgeCheck, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrgFiles } from "@bahayplus/modules/files";
import { getProviderBySlug, listProviderReviews, listVerifiedItems } from "@bahayplus/modules/marketplace";
import {
  availabilityFreshness,
  averageRatingTenths,
  getProviderProfile,
  listPortfolio,
  listProviderServices,
  listServiceAreas,
  VERIFICATION_ITEM_LABELS,
} from "@bahayplus/modules/providers";
import { SectionCard } from "@bahayplus/ui/components/data/section-card";
import { formatRating } from "@bahayplus/ui/components/domain/provider-card";
import { StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";
import { formatManilaDate, formatManilaDateTime } from "@bahayplus/types/dates";
import { AVAILABILITY_LABELS, priceLabel } from "@/components/marketplace/labels";
import { PageHeader } from "@/components/layout/page-header";
import { requireHouseholdAccess, requireServiceContext } from "@/lib/auth/context";

export const metadata = { title: "Provider" };

const DAYS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
  ["sat", "Sat"],
  ["sun", "Sun"],
] as const;

export default async function ProviderProfilePage({
  params,
}: PageProps<"/app/h/[householdId]/services/providers/[slug]">) {
  const { householdId, slug } = await params;
  const access = await requireHouseholdAccess(householdId);
  const ctx = await requireServiceContext();
  const provider = await getProviderBySlug(ctx, slug);
  if (!provider.ok) notFound();
  const org = provider.value.organizationId;
  const [profile, services, areas, verified, reviews, portfolio] = await Promise.all([
    getProviderProfile(ctx, org),
    listProviderServices(ctx, org, { activeOnly: true }),
    listServiceAreas(ctx, org),
    listVerifiedItems(ctx, org),
    listProviderReviews(ctx, org, 10),
    listPortfolio(ctx, org),
  ]);
  if (!profile.ok) notFound();
  const p = profile.value;
  const photos = portfolio.ok
    ? await listOrgFiles(
        ctx,
        "portfolio",
        portfolio.value.map((i) => i.id),
      )
    : null;
  const rating = averageRatingTenths(p.ratingSum, p.ratingCount);
  const base = `/app/h/${householdId}`;
  const canBook = access.permissions.has("services.book");
  const fresh = availabilityFreshness(p.availabilityUpdatedAt, new Date());
  const verifiedItems = verified.ok ? verified.value : [];

  return (
    <>
      <PageHeader
        title={provider.value.name}
        description={p.tagline}
        breadcrumbs={[
          { label: "Home", href: base },
          { label: "Services", href: `${base}/services` },
          { label: provider.value.name },
        ]}
        actions={
          canBook && p.acceptsQuoteRequests ? (
            <>
              <Button asChild variant="outline">
                <Link href={`${base}/bookings?provider=${slug}&mode=quote`}>Request a quote</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${base}/projects?provider=${slug}`}>Start a project</Link>
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
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
        {p.availabilityUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Updated {formatManilaDateTime(p.availabilityUpdatedAt)}
            {fresh === "stale" ? " — may be out of date" : ""}
          </span>
        )}
        <span className="text-sm font-medium">
          {rating === null ? "No reviews yet" : `★ ${formatRating(rating)} (${p.ratingCount})`}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="Services" id="services">
            <ul className="flex flex-col divide-y divide-border">
              {(services.ok ? services.value : []).map((s) => (
                <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.categoryName} · {priceLabel(s)}
                      {s.durationMinutes ? ` · about ${s.durationMinutes} min` : ""}
                    </p>
                    {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                  {canBook && (
                    <div className="flex gap-2">
                      {s.allowsBookNow && p.acceptsBookNow && (
                        <Button asChild size="sm">
                          <Link href={`${base}/bookings?provider=${slug}&service=${s.id}&mode=book`}>Book now</Link>
                        </Button>
                      )}
                      {s.allowsQuote && p.acceptsQuoteRequests && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${base}/bookings?provider=${slug}&service=${s.id}&mode=quote`}>
                            Request quote
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
          {p.description && (
            <SectionCard title="About" id="about">
              <p className="text-sm whitespace-pre-line">{p.description}</p>
            </SectionCard>
          )}
          <SectionCard title="Reviews" id="reviews">
            {reviews.ok && reviews.value.length ? (
              <ul className="flex flex-col gap-3">
                {reviews.value.map((r) => (
                  <li key={r.id} className="border-l-2 border-gold pl-3">
                    <p className="text-sm font-semibold">
                      <span aria-hidden="true" className="text-gold">
                        {"★".repeat(r.rating)}
                      </span>
                      <span className="sr-only">Rated {r.rating} out of 5</span>
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatManilaDate(new Date(r.createdAt))}
                      </span>
                    </p>
                    {r.comment && <p className="text-sm">{r.comment}</p>}
                    {r.providerReply && (
                      <p className="mt-1 rounded-lg bg-muted p-2 text-xs">
                        Reply from {provider.value.name}: {r.providerReply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No reviews yet. Reviews come only from completed bookings.
              </p>
            )}
          </SectionCard>
          {portfolio.ok && portfolio.value.length > 0 && (
            <SectionCard title="Past work" id="portfolio">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(photos?.ok ? photos.value : []).map((img) => (
                  <li key={img.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- public portfolio bucket */}
                    <img
                      src={img.url ?? ""}
                      alt={portfolio.value.find((i) => i.id === img.entityId)?.title ?? "Past work"}
                      className="aspect-square w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <SectionCard title="What Bahay+ verified" id="verified">
            {verifiedItems.length ? (
              <ul className="flex flex-col gap-2">
                {verifiedItems.map((v) => (
                  <li key={v.itemType} className="flex gap-2 text-sm">
                    <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>
                      <span className="font-medium">{VERIFICATION_ITEM_LABELS[v.itemType].label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {VERIFICATION_ITEM_LABELS[v.itemType].hint}
                      </span>
                    </span>
                  </li>
                ))}
                <li className="text-xs text-muted-foreground">
                  Verification valid until {formatManilaDate(verifiedItems[0]!.verifiedUntil)}. Bahay+ checks documents;
                  it does not guarantee work quality.
                </li>
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No current verification.</p>
            )}
          </SectionCard>
          {p.acceptsContact && (p.phone || p.email || p.messengerUrl) && (
            <SectionCard title="Contact" id="contact">
              <ul className="flex flex-col gap-2 text-sm">
                {p.phone && (
                  <li>
                    <a
                      href={`tel:${p.phone.replace(/\s/g, "")}`}
                      className="flex min-h-10 items-center gap-2 font-medium text-brand hover:underline"
                    >
                      <Phone aria-hidden="true" className="size-4" /> {p.phone}
                    </a>
                  </li>
                )}
                {p.email && (
                  <li>
                    <a
                      href={`mailto:${p.email}`}
                      className="flex min-h-10 items-center gap-2 font-medium text-brand hover:underline"
                    >
                      <Mail aria-hidden="true" className="size-4" /> {p.email}
                    </a>
                  </li>
                )}
                {p.messengerUrl && (
                  <li>
                    <a
                      href={p.messengerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-10 items-center gap-2 font-medium text-brand hover:underline"
                    >
                      <MessageCircle aria-hidden="true" className="size-4" /> Messenger
                    </a>
                  </li>
                )}
              </ul>
            </SectionCard>
          )}
          <SectionCard title="Coverage" id="coverage">
            <ul className="flex flex-col gap-1 text-sm">
              {(areas.ok ? areas.value : []).map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  {a.barangay ? `Brgy. ${a.barangay}, ` : ""}
                  {a.cityMunicipality ? `${a.cityMunicipality}, ` : "All of "}
                  {a.province}
                </li>
              ))}
            </ul>
          </SectionCard>
          {Object.keys(p.businessHours).length > 0 && (
            <SectionCard title="Hours" id="hours">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {DAYS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <Clock aria-hidden="true" className="size-3" /> {label}
                    </dt>
                    <dd>{p.businessHours[key]?.map(([a, b]) => `${a}–${b}`).join(", ") ?? "Closed"}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

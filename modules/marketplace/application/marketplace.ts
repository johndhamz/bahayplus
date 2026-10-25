import { SearchProvidersInput, type Division } from "@bahayplus/validation/marketplace/provider";
import { EditReviewInput, SubmitReviewInput, type VerificationItemType } from "@bahayplus/validation/marketplace/trust";
import { UrgentSearchInput } from "@bahayplus/validation/marketplace/urgent";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import { averageRatingTenths } from "@bahayplus/modules/providers";

export const PAGE_SIZE = 12;

export type CategoryView = {
  id: string;
  division: Division;
  slug: string;
  name: string;
  description: string;
  urgentEligible: boolean;
};
export type ProviderCardView = {
  organizationId: string;
  name: string;
  slug: string;
  tagline: string;
  availabilityStatus: "available" | "limited" | "unavailable";
  availabilityUpdatedAt: string | null;
  ratingTenths: number | null;
  ratingCount: number;
  minPriceCentavos: number | null;
  categories: string[];
  verifiedItems: VerificationItemType[];
  acceptsBookNow: boolean;
  acceptsQuoteRequests: boolean;
};
export type ReviewView = {
  id: string;
  rating: number;
  comment: string;
  providerReply: string | null;
  createdAt: string;
  isMine: boolean;
  editableUntil: string;
};
export type VerifiedItem = { itemType: VerificationItemType; validUntil: string | null; verifiedUntil: string };

export async function listServiceCategories(ctx: ServiceContext): Promise<Result<CategoryView[]>> {
  const { data, error } = await ctx.db
    .from("service_categories")
    .select("id, division, slug, name, description, urgent_eligible")
    .eq("is_active", true)
    .order("division")
    .order("sort_order");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((c) => ({
      id: c.id,
      division: c.division as Division,
      slug: c.slug,
      name: c.name,
      description: c.description,
      urgentEligible: c.urgent_eligible,
    })),
  );
}

export async function searchProviders(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ items: ProviderCardView[]; page: number; hasMore: boolean }>> {
  const parsed = parseInput(SearchProvidersInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("search_providers", {
    p_query: v.query as string,
    p_category: v.category as string,
    p_division: v.division as string,
    p_province: v.province as string,
    p_city: v.city as string,
    p_barangay: v.barangay as string,
    p_limit: PAGE_SIZE + 1,
    p_offset: (v.page - 1) * PAGE_SIZE,
  });
  if (error) return err(mapDbError(error));
  const rows = data ?? [];
  return ok({
    page: v.page,
    hasMore: rows.length > PAGE_SIZE,
    items: rows.slice(0, PAGE_SIZE).map((r) => ({
      organizationId: r.organization_id,
      name: r.name,
      slug: r.slug,
      tagline: r.tagline,
      availabilityStatus: r.availability_status as ProviderCardView["availabilityStatus"],
      availabilityUpdatedAt: r.availability_updated_at,
      ratingTenths: averageRatingTenths(r.rating_sum, r.rating_count),
      ratingCount: r.rating_count,
      minPriceCentavos: r.min_price_centavos,
      categories: r.categories ?? [],
      verifiedItems: (r.verified_items ?? []) as VerificationItemType[],
      acceptsBookNow: r.accepts_book_now,
      acceptsQuoteRequests: r.accepts_quote_requests,
    })),
  });
}

/** Provider looked up by public handle; only listed providers (or your own) are visible. */
export async function getProviderBySlug(
  ctx: ServiceContext,
  slug: string,
): Promise<Result<{ organizationId: string; name: string; slug: string; listed: boolean }>> {
  const { data, error } = await ctx.db
    .from("organizations")
    .select("id, name, slug, kind")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data || data.kind !== "service_provider") return err(appError.notFound("Provider not found."));
  const profile = await ctx.db
    .from("provider_profiles")
    .select("organization_id")
    .eq("organization_id", data.id)
    .maybeSingle();
  if (!profile.data) return err(appError.notFound("Provider not found."));
  return ok({ organizationId: data.id, name: data.name, slug: data.slug, listed: true });
}

export async function listVerifiedItems(ctx: ServiceContext, organizationId: string): Promise<Result<VerifiedItem[]>> {
  const { data, error } = await ctx.db.rpc("provider_verified_items", { p_org: organizationId });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((i) => ({
      itemType: i.item_type as VerificationItemType,
      validUntil: i.valid_until,
      verifiedUntil: i.verified_until,
    })),
  );
}

export async function listProviderReviews(
  ctx: ServiceContext,
  organizationId: string,
  limit = 20,
): Promise<Result<ReviewView[]>> {
  const { data, error } = await ctx.db
    .from("reviews")
    .select("id, rating, comment, provider_reply, created_at, reviewer_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      providerReply: r.provider_reply,
      createdAt: r.created_at,
      isMine: r.reviewer_id === ctx.userId,
      editableUntil: new Date(Date.parse(r.created_at) + 30 * 86_400_000).toISOString(),
    })),
  );
}

export type ReviewableBooking = {
  bookingId: string;
  providerName: string;
  providerSlug: string;
  completedAt: string;
  reviewed: boolean;
};

/** Completed services of a household that can still be reviewed (within 90 days). */
export async function listReviewableBookings(
  ctx: ServiceContext,
  householdId: string,
): Promise<Result<ReviewableBooking[]>> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data, error } = await ctx.db
    .from("bookings")
    .select("id, completed_at, organizations!inner(name, slug), reviews(id)")
    .eq("household_id", householdId)
    .eq("status", "completed")
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((b) => ({
      bookingId: b.id,
      providerName: b.organizations.name,
      providerSlug: b.organizations.slug,
      completedAt: b.completed_at!,
      reviewed: Array.isArray(b.reviews) ? b.reviews.length > 0 : !!b.reviews,
    })),
  );
}

export async function submitReview(ctx: ServiceContext, input: unknown): Promise<Result<{ reviewId: string }>> {
  const parsed = parseInput(SubmitReviewInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("submit_review", {
    p_booking: parsed.value.bookingId,
    p_rating: parsed.value.rating,
    p_comment: parsed.value.comment,
  });
  if (error) return err(mapDbError(error));
  return ok({ reviewId: data });
}

export async function editReview(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(EditReviewInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("edit_review", {
    p_review: parsed.value.reviewId,
    p_rating: parsed.value.rating,
    p_comment: parsed.value.comment,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type UrgentProviderView = {
  organizationId: string;
  name: string;
  slug: string;
  tagline: string;
  availabilityStatus: "available" | "limited" | "unavailable";
  availabilityUpdatedAt: string | null;
  isStale: boolean;
  phone: string;
  messengerUrl: string;
  verifiedItems: VerificationItemType[];
  serviceTitles: string[];
  areaLabel: string | null;
};

/**
 * Urgent discovery: listed providers that opted into urgent calls and serve the area. Unavailable
 * providers are returned separately; stale availability is flagged, never hidden.
 */
export async function searchUrgentProviders(
  ctx: ServiceContext,
  input: unknown,
  options: { staleHours?: number } = {},
): Promise<Result<{ available: UrgentProviderView[]; unavailable: UrgentProviderView[] }>> {
  const parsed = parseInput(UrgentSearchInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db.rpc("search_urgent_providers", {
    p_category: v.category,
    p_province: v.province,
    p_city: v.city,
    p_barangay: v.barangay,
    p_stale_hours: options.staleHours ?? 24,
  });
  if (error) return err(mapDbError(error));
  const rows: UrgentProviderView[] = (data ?? []).map((r) => ({
    organizationId: r.organization_id,
    name: r.name,
    slug: r.slug,
    tagline: r.tagline,
    availabilityStatus: r.availability_status as UrgentProviderView["availabilityStatus"],
    availabilityUpdatedAt: r.availability_updated_at,
    isStale: r.is_stale,
    phone: r.phone,
    messengerUrl: r.messenger_url,
    verifiedItems: (r.verified_items ?? []) as VerificationItemType[],
    serviceTitles: r.service_titles ?? [],
    areaLabel: r.area_label,
  }));
  return ok({
    available: rows.filter((r) => r.availabilityStatus !== "unavailable"),
    unavailable: rows.filter((r) => r.availabilityStatus === "unavailable"),
  });
}

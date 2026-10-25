import {
  AddServiceAreaInput,
  CreatePortfolioItemInput,
  CreateProviderServiceInput,
  PortfolioItemIdInput,
  ServiceAreaIdInput,
  ServiceIdInput,
  SetAvailabilityInput,
  UpdateProviderProfileInput,
  UpdateProviderServiceInput,
  type BusinessHours,
  SetCapacityInput,
} from "@bahayplus/validation/marketplace/provider";
import {
  DecideVerificationInput,
  ReplyToReviewInput,
  RevokeVerificationInput,
  SubmitVerificationInput,
  VerificationRequestIdInput,
  type VerificationItemType,
} from "@bahayplus/validation/marketplace/trust";
import type { Json } from "@bahayplus/types/database";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import type { VerificationStatus } from "../domain/trust";

export type ProviderProfileView = {
  organizationId: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  messengerUrl: string;
  yearEstablished: number | null;
  teamSize: number | null;
  businessHours: BusinessHours;
  acceptsBookNow: boolean;
  acceptsQuoteRequests: boolean;
  acceptsContact: boolean;
  acceptsUrgent: boolean;
  availabilityStatus: "available" | "limited" | "unavailable";
  availabilityUpdatedAt: string | null;
  isPublished: boolean;
  ratingCount: number;
  ratingSum: number;
};

export type ProviderServiceView = {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  division: string;
  title: string;
  description: string;
  pricingModel: "fixed" | "starting_at" | "hourly" | "per_unit" | "quote_only";
  priceCentavos: number | null;
  unitLabel: string;
  durationMinutes: number | null;
  allowsBookNow: boolean;
  allowsQuote: boolean;
  isActive: boolean;
};

export type ServiceAreaView = {
  id: string;
  province: string;
  cityMunicipality: string | null;
  barangay: string | null;
};
export type PortfolioItemView = { id: string; title: string; description: string; completedOn: string | null };
export type VerificationItemView = {
  id: string;
  itemType: VerificationItemType;
  referenceNumber: string;
  validUntil: string | null;
  status: "pending" | "verified" | "rejected";
  reviewerNote: string;
};
export type VerificationRequestView = {
  id: string;
  organizationId: string;
  status: VerificationStatus;
  submittedAt: string;
  decidedAt: string | null;
  decisionNotes: string;
  expiresOn: string | null;
  revokedReason: string | null;
  items: VerificationItemView[];
};

export async function getProviderProfile(
  ctx: ServiceContext,
  organizationId: string,
): Promise<Result<ProviderProfileView>> {
  const { data, error } = await ctx.db
    .from("provider_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Provider not found."));
  return ok({
    organizationId: data.organization_id,
    tagline: data.tagline,
    description: data.description,
    phone: data.phone,
    email: data.email,
    website: data.website,
    messengerUrl: data.messenger_url,
    yearEstablished: data.year_established,
    teamSize: data.team_size,
    businessHours: (data.business_hours ?? {}) as BusinessHours,
    acceptsBookNow: data.accepts_book_now,
    acceptsQuoteRequests: data.accepts_quote_requests,
    acceptsContact: data.accepts_contact,
    acceptsUrgent: data.accepts_urgent,
    availabilityStatus: data.availability_status as ProviderProfileView["availabilityStatus"],
    availabilityUpdatedAt: data.availability_updated_at,
    isPublished: data.is_published,
    ratingCount: data.rating_count,
    ratingSum: data.rating_sum,
  });
}

export async function updateProviderProfile(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateProviderProfileInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("provider_profiles")
    .update({
      tagline: v.tagline,
      description: v.description,
      phone: v.phone,
      email: v.email,
      website: v.website,
      messenger_url: v.messengerUrl,
      year_established: v.yearEstablished,
      team_size: v.teamSize,
      business_hours: v.businessHours as NonNullable<Json>,
      accepts_book_now: v.acceptsBookNow,
      accepts_quote_requests: v.acceptsQuoteRequests,
      accepts_contact: v.acceptsContact,
      accepts_urgent: v.acceptsUrgent,
      is_published: v.isPublished,
    })
    .eq("organization_id", v.organizationId)
    .select("organization_id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("Only owners and managers can edit the business profile."));
  return ok(true);
}

export async function setAvailability(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetAvailabilityInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("provider_profiles")
    .update({ availability_status: parsed.value.status })
    .eq("organization_id", parsed.value.organizationId)
    .select("organization_id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden());
  return ok(true);
}

const SERVICE_COLUMNS =
  "id, category_id, title, description, pricing_model, price_centavos, unit_label, duration_minutes, allows_book_now, allows_quote, is_active, service_categories!inner(name, slug, division)";

export async function listProviderServices(
  ctx: ServiceContext,
  organizationId: string,
  options: { activeOnly?: boolean } = {},
): Promise<Result<ProviderServiceView[]>> {
  let query = ctx.db.from("provider_services").select(SERVICE_COLUMNS).eq("organization_id", organizationId);
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.order("title");
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((s) => ({
      id: s.id,
      categoryId: s.category_id,
      categoryName: s.service_categories.name,
      categorySlug: s.service_categories.slug,
      division: s.service_categories.division,
      title: s.title,
      description: s.description,
      pricingModel: s.pricing_model as ProviderServiceView["pricingModel"],
      priceCentavos: s.price_centavos,
      unitLabel: s.unit_label,
      durationMinutes: s.duration_minutes,
      allowsBookNow: s.allows_book_now,
      allowsQuote: s.allows_quote,
      isActive: s.is_active,
    })),
  );
}

const serviceColumns = (v: Omit<ReturnType<typeof UpdateProviderServiceInput.parse>, "serviceId">) => ({
  category_id: v.categoryId,
  title: v.title,
  description: v.description,
  pricing_model: v.pricingModel,
  price_centavos: v.pricingModel === "quote_only" ? null : v.priceCentavos,
  unit_label: v.unitLabel,
  duration_minutes: v.durationMinutes,
  allows_book_now: v.allowsBookNow,
  allows_quote: v.allowsQuote,
  is_active: v.isActive,
});

export async function createProviderService(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ serviceId: string }>> {
  const parsed = parseInput(CreateProviderServiceInput, input);
  if (!parsed.ok) return parsed;
  const { organizationId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("provider_services")
    .insert({ organization_id: organizationId, ...serviceColumns(rest) })
    .select("id")
    .single();
  if (error)
    return err(
      error.code === "42501" ? appError.forbidden("Only owners and managers can add services.") : mapDbError(error),
    );
  return ok({ serviceId: data.id });
}

export async function updateProviderService(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdateProviderServiceInput, input);
  if (!parsed.ok) return parsed;
  const { serviceId, ...rest } = parsed.value;
  const { data, error } = await ctx.db
    .from("provider_services")
    .update(serviceColumns(rest))
    .eq("id", serviceId)
    .select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't edit this service."));
  return ok(true);
}

export async function deleteProviderService(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ServiceIdInput, input);
  if (!parsed.ok) return parsed;
  // Services referenced by bookings are deactivated instead of deleted.
  const { count } = await ctx.db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("provider_service_id", parsed.value.serviceId);
  const query = count
    ? ctx.db.from("provider_services").update({ is_active: false }).eq("id", parsed.value.serviceId).select("id")
    : ctx.db.from("provider_services").delete().eq("id", parsed.value.serviceId).select("id");
  const { data, error } = await query;
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden("You can't remove this service."));
  return ok(true);
}

export async function listServiceAreas(
  ctx: ServiceContext,
  organizationId: string,
): Promise<Result<ServiceAreaView[]>> {
  const { data, error } = await ctx.db
    .from("service_areas")
    .select("id, province, city_municipality, barangay")
    .eq("organization_id", organizationId)
    .order("province")
    .order("city_municipality", { nullsFirst: true });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((a) => ({
      id: a.id,
      province: a.province,
      cityMunicipality: a.city_municipality,
      barangay: a.barangay,
    })),
  );
}

export async function addServiceArea(ctx: ServiceContext, input: unknown): Promise<Result<{ areaId: string }>> {
  const parsed = parseInput(AddServiceAreaInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("service_areas")
    .insert({
      organization_id: v.organizationId,
      province: v.province,
      city_municipality: v.cityMunicipality,
      barangay: v.barangay,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return err(appError.validation([{ path: ["province"], message: "You already cover this area." }]));
    return err(error.code === "42501" ? appError.forbidden() : mapDbError(error));
  }
  return ok({ areaId: data.id });
}

export async function removeServiceArea(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ServiceAreaIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.from("service_areas").delete().eq("id", parsed.value.areaId).select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden());
  return ok(true);
}

export async function listPortfolio(ctx: ServiceContext, organizationId: string): Promise<Result<PortfolioItemView[]>> {
  const { data, error } = await ctx.db
    .from("portfolio_items")
    .select("id, title, description, completed_on")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((p) => ({ id: p.id, title: p.title, description: p.description, completedOn: p.completed_on })),
  );
}

export async function createPortfolioItem(ctx: ServiceContext, input: unknown): Promise<Result<{ itemId: string }>> {
  const parsed = parseInput(CreatePortfolioItemInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { data, error } = await ctx.db
    .from("portfolio_items")
    .insert({
      organization_id: v.organizationId,
      title: v.title,
      description: v.description,
      category_id: v.categoryId,
      completed_on: v.completedOn,
    })
    .select("id")
    .single();
  if (error) return err(error.code === "42501" ? appError.forbidden() : mapDbError(error));
  return ok({ itemId: data.id });
}

export async function deletePortfolioItem(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(PortfolioItemIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.from("portfolio_items").delete().eq("id", parsed.value.itemId).select("id");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.forbidden());
  return ok(true);
}

// --- Verification -----------------------------------------------------------

export async function listVerificationRequests(
  ctx: ServiceContext,
  filter: { organizationId?: string; statuses?: VerificationStatus[]; limit?: number } = {},
): Promise<Result<VerificationRequestView[]>> {
  let query = ctx.db
    .from("verification_requests")
    .select(
      "id, organization_id, status, submitted_at, decided_at, decision_notes, expires_on, revoked_reason, verification_items(id, item_type, reference_number, valid_until, status, reviewer_note)",
    );
  if (filter.organizationId) query = query.eq("organization_id", filter.organizationId);
  if (filter.statuses?.length) query = query.in("status", filter.statuses);
  const { data, error } = await query.order("submitted_at", { ascending: !!filter.statuses }).limit(filter.limit ?? 50);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      status: r.status as VerificationStatus,
      submittedAt: r.submitted_at,
      decidedAt: r.decided_at,
      decisionNotes: r.decision_notes,
      expiresOn: r.expires_on,
      revokedReason: r.revoked_reason,
      items: (r.verification_items ?? []).map((i) => ({
        id: i.id,
        itemType: i.item_type as VerificationItemType,
        referenceNumber: i.reference_number,
        validUntil: i.valid_until,
        status: i.status as VerificationItemView["status"],
        reviewerNote: i.reviewer_note,
      })),
    })),
  );
}

export async function submitVerification(ctx: ServiceContext, input: unknown): Promise<Result<{ requestId: string }>> {
  const parsed = parseInput(SubmitVerificationInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.rpc("submit_verification_request", {
    p_org: parsed.value.organizationId,
    p_items: parsed.value.items.map((i) => ({
      item_type: i.itemType,
      reference_number: i.referenceNumber,
      valid_until: i.validUntil,
    })),
  });
  if (error) return err(mapDbError(error));
  return ok({ requestId: data });
}

export async function startVerificationReview(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(VerificationRequestIdInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("start_verification_review", { p_request: parsed.value.requestId });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function decideVerification(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(DecideVerificationInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const { error } = await ctx.db.rpc("decide_verification", {
    p_request: v.requestId,
    p_decision: v.decision,
    p_item_decisions: v.items.map((i) => ({ item_id: i.itemId, status: i.status, note: i.note })),
    p_decision_notes: v.decisionNotes,
    p_internal_notes: v.internalNotes,
    p_expires_on: v.expiresOn as string,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function revokeVerification(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(RevokeVerificationInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("revoke_verification", {
    p_request: parsed.value.requestId,
    p_reason: parsed.value.reason,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export async function replyToReview(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(ReplyToReviewInput, input);
  if (!parsed.ok) return parsed;
  const { error } = await ctx.db.rpc("reply_to_review", {
    p_review: parsed.value.reviewId,
    p_reply: parsed.value.reply,
  });
  return error ? err(mapDbError(error)) : ok(true);
}

export type FinanceMonth = {
  month: string;
  completedJobs: number;
  jobValueCentavos: number;
  projectsCompleted: number;
  projectValueCentavos: number;
  purchasesCentavos: number;
};

/** Recorded values only: agreed booking prices, completed project contracts and delivered purchases. Bahay+ processes no payments. */
export async function getFinancialSummary(
  ctx: ServiceContext,
  organizationId: string,
  months = 6,
): Promise<Result<FinanceMonth[]>> {
  const { data, error } = await ctx.db.rpc("provider_financial_summary", { p_org: organizationId, p_months: months });
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((r) => ({
      month: r.month,
      completedJobs: r.completed_jobs,
      jobValueCentavos: r.job_value_centavos,
      projectsCompleted: r.projects_completed,
      projectValueCentavos: r.project_value_centavos,
      purchasesCentavos: r.purchases_centavos,
    })),
  );
}

/** How many confirmed bookings may overlap (Book Now capacity, D-12). */
export async function setCapacity(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(SetCapacityInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("provider_profiles")
    .update({ concurrent_capacity: parsed.value.capacity })
    .eq("organization_id", parsed.value.organizationId)
    .select("organization_id");
  if (error) return err(mapDbError(error));
  return data?.length ? ok(true) : err(appError.forbidden("Only owners and managers can change capacity."));
}

export async function getCapacity(ctx: ServiceContext, organizationId: string): Promise<number> {
  const { data } = await ctx.db
    .from("provider_profiles")
    .select("concurrent_capacity")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.concurrent_capacity ?? 1;
}

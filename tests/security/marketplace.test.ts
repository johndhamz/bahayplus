import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptOrganizationInvitation,
  createOrganization,
  inviteOrganizationMember,
} from "@bahayplus/modules/organizations";
import { createHousehold } from "@bahayplus/modules/households";
import {
  addServiceArea,
  createProviderService,
  decideVerification,
  getProviderProfile,
  listVerificationRequests,
  replyToReview,
  revokeVerification,
  startVerificationReview,
  submitVerification,
  updateProviderProfile,
  updateProviderService,
} from "@bahayplus/modules/providers";
import {
  editReview,
  listProviderReviews,
  listServiceCategories,
  listVerifiedItems,
  searchProviders,
  submitReview,
} from "@bahayplus/modules/marketplace";
import { listOrgFiles, prepareOrgUpload, registerOrgFile } from "@bahayplus/modules/files";
import { adminClient, cleanupTestUsers, createTestUser, type TestUser } from "../support/supabase";

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<<>>endobj\n");
const suffix = Date.now().toString(36);
const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

let owner: TestUser; // provider owner
let staff: TestUser; // provider staff
let rival: TestUser; // owner of another provider
let customer: TestUser;
let otherCustomer: TestUser;
let verifier: TestUser; // platform operations admin
let org: string;
let rivalOrg: string;
let household: string;
let plumbingId: string;
let serviceId: string;

const profileInput = (extra: Record<string, unknown> = {}) => ({
  organizationId: org,
  tagline: `Trusted plumbing ${suffix}`,
  description: "Leak repair and installations",
  phone: "+63 917 123 4567",
  isPublished: true,
  acceptsQuoteRequests: true,
  ...extra,
});

async function approve(requestId: string, itemsToVerify: "all" | number = "all") {
  unwrap(await startVerificationReview(verifier.ctx, { requestId }));
  const request = unwrap(await listVerificationRequests(verifier.ctx, { statuses: ["under_review"] })).find(
    (r) => r.id === requestId,
  )!;
  const items = request.items.map((item, i) => ({
    itemId: item.id,
    status: itemsToVerify === "all" || i < itemsToVerify ? "verified" : "rejected",
    note: "",
  }));
  return decideVerification(verifier.ctx, {
    requestId,
    decision: "approved",
    items,
    decisionNotes: "Looks good",
    internalNotes: "Checked against DTI BNRS",
    expiresOn: future,
  });
}

beforeAll(async () => {
  [owner, staff, rival, customer, otherCustomer, verifier] = await Promise.all([
    createTestUser("mk-owner"),
    createTestUser("mk-staff"),
    createTestUser("mk-rival"),
    createTestUser("mk-customer"),
    createTestUser("mk-customer2"),
    createTestUser("mk-verifier"),
  ]);
  const ops = await adminClient().from("roles").select("id").eq("scope", "platform").eq("key", "operations").single();
  await adminClient().from("platform_admins").insert({ user_id: verifier.id, role_id: ops.data!.id });
  org = unwrap(
    await createOrganization(owner.ctx, {
      kind: "service_provider",
      name: `Aqua Fix ${suffix}`,
      slug: `aqua-fix-${suffix}`,
    }),
  ).organizationId;
  rivalOrg = unwrap(
    await createOrganization(rival.ctx, {
      kind: "service_provider",
      name: `Rival Co ${suffix}`,
      slug: `rival-${suffix}`,
    }),
  ).organizationId;
  const inv = unwrap(
    await inviteOrganizationMember(owner.ctx, { organizationId: org, email: staff.email, role: "staff" }),
  );
  unwrap(await acceptOrganizationInvitation(staff.ctx, { token: inv.token }));
  household = unwrap(await createHousehold(customer.ctx, { name: "Marketplace customer" })).householdId;
  unwrap(await createHousehold(otherCustomer.ctx, { name: "Other customer" }));
  plumbingId = unwrap(await listServiceCategories(customer.ctx)).find((c) => c.slug === "plumbing")!.id;
});
afterAll(cleanupTestUsers);

describe("provider onboarding", () => {
  it("creates an unpublished profile; published-but-unverified providers are not listed", async () => {
    expect(unwrap(await getProviderProfile(owner.ctx, org))).toMatchObject({
      isPublished: false,
      availabilityStatus: "unavailable",
    });
    unwrap(await updateProviderProfile(owner.ctx, profileInput()));
    serviceId = unwrap(
      await createProviderService(owner.ctx, {
        organizationId: org,
        categoryId: plumbingId,
        title: "Leak repair",
        pricingModel: "starting_at",
        priceCentavos: "800",
        allowsBookNow: true,
      }),
    ).serviceId;
    unwrap(
      await addServiceArea(owner.ctx, {
        organizationId: org,
        province: "Metro Manila",
        cityMunicipality: "City of Pasig",
      }),
    );
    const results = unwrap(await searchProviders(customer.ctx, { query: suffix }));
    expect(results.items).toEqual([]);
    expect((await getProviderProfile(customer.ctx, org)).ok).toBe(false);
  });

  it("staff and other organizations cannot edit the provider", async () => {
    expect((await updateProviderProfile(staff.ctx, profileInput({ tagline: "Hacked" }))).ok).toBe(false);
    expect((await updateProviderProfile(rival.ctx, profileInput({ tagline: "Hacked" }))).ok).toBe(false);
    expect((await updateProviderProfile(customer.ctx, profileInput({ tagline: "Hacked" }))).ok).toBe(false);
    expect(
      (
        await updateProviderService(rival.ctx, {
          serviceId,
          categoryId: plumbingId,
          title: "Hijacked",
          pricingModel: "quote_only",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await createProviderService(staff.ctx, {
          organizationId: org,
          categoryId: plumbingId,
          title: "Extra",
          pricingModel: "quote_only",
        })
      ).ok,
    ).toBe(false);
    const rating = await owner.client
      .from("provider_profiles")
      .update({ rating_sum: 500, rating_count: 100 } as never)
      .eq("organization_id", org);
    expect(rating.error?.code).toBe("42501");
    expect(unwrap(await getProviderProfile(owner.ctx, org)).tagline).toBe(`Trusted plumbing ${suffix}`);
  });

  it("providers see no household data", async () => {
    expect((await owner.client.from("households").select("id").eq("id", household)).data).toEqual([]);
    expect((await owner.client.from("properties").select("id")).data).toEqual([]);
  });
});

describe("verification workflow", () => {
  let requestId: string;

  it("accepts credential uploads visible only to the business and verifiers", async () => {
    requestId = unwrap(
      await submitVerification(owner.ctx, {
        organizationId: org,
        items: [
          { itemType: "business_registration", referenceNumber: "DTI-123" },
          { itemType: "mayors_permit", referenceNumber: "MP-2026" },
          { itemType: "nbi_clearance" },
        ],
      }),
    ).requestId;
    const itemId = unwrap(await listVerificationRequests(owner.ctx, { organizationId: org }))[0]!.items[0]!.id;
    const prepared = unwrap(
      await prepareOrgUpload(owner.ctx, {
        organizationId: org,
        entityType: "verification_item",
        entityId: itemId,
        fileName: "dti.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
      }),
    );
    expect(
      (
        await owner.client.storage
          .from("organization-files")
          .upload(prepared.objectPath, PDF, { contentType: "application/pdf" })
      ).error,
    ).toBeNull();
    unwrap(
      await registerOrgFile(owner.ctx, {
        organizationId: org,
        entityType: "verification_item",
        entityId: itemId,
        fileName: "dti.pdf",
        contentType: "application/pdf",
        sizeBytes: PDF.length,
        objectPath: prepared.objectPath,
      }),
    );
    expect(unwrap(await listOrgFiles(verifier.ctx, "verification_item", [itemId]))).toHaveLength(1);
    expect(unwrap(await listOrgFiles(customer.ctx, "verification_item", [itemId]))).toEqual([]);
    expect(unwrap(await listOrgFiles(staff.ctx, "verification_item", [itemId]))).toEqual([]);
    expect(
      (await customer.client.storage.from("organization-files").download(prepared.objectPath)).error,
    ).not.toBeNull();
    expect(
      (await rival.client.storage.from("organization-files").createSignedUrl(prepared.objectPath, 60)).error,
    ).not.toBeNull();
    expect(
      (
        await prepareOrgUpload(staff.ctx, {
          organizationId: org,
          entityType: "verification_item",
          entityId: itemId,
          fileName: "x.pdf",
          contentType: "application/pdf",
          sizeBytes: 10,
        })
      ).ok,
    ).toBe(false);
  });

  it("only allows one open request and only verifiers can move it", async () => {
    const second = await submitVerification(owner.ctx, { organizationId: org, items: [{ itemType: "insurance" }] });
    expect(second.ok || second.error.reason).toBe("verification_open");
    expect((await startVerificationReview(owner.ctx, { requestId })).ok).toBe(false);
    expect((await startVerificationReview(customer.ctx, { requestId })).ok).toBe(false);
    const premature = await decideVerification(verifier.ctx, {
      requestId,
      decision: "approved",
      items: [],
      expiresOn: future,
    });
    expect(premature.ok || premature.error.reason).toBe("invalid_transition");
  });

  it("approval lists the provider and the badge claims only verified items", async () => {
    unwrap(await approve(requestId, 2)); // DTI + Mayor's permit verified; NBI not
    const results = unwrap(await searchProviders(customer.ctx, { query: suffix }));
    expect(results.items).toHaveLength(1);
    expect(results.items[0]!.verifiedItems).toEqual(["business_registration", "mayors_permit"]);
    expect(unwrap(await listVerifiedItems(customer.ctx, org)).map((i) => i.itemType)).toEqual([
      "business_registration",
      "mayors_permit",
    ]);
    // Internal admin notes are never readable by the provider.
    const leak = await owner.client
      .from("verification_requests")
      .select("internal_notes" as "id")
      .eq("id", requestId);
    expect(leak.error?.code).toBe("42501");
    expect(unwrap(await listVerificationRequests(owner.ctx, { organizationId: org }))[0]).toMatchObject({
      status: "approved",
      decisionNotes: "Looks good",
    });
  });

  it("verifiers cannot approve organizations they belong to", async () => {
    const selfOrg = unwrap(
      await createOrganization(verifier.ctx, {
        kind: "service_provider",
        name: `Self ${suffix}`,
        slug: `self-${suffix}`,
      }),
    ).organizationId;
    const req = unwrap(
      await submitVerification(verifier.ctx, { organizationId: selfOrg, items: [{ itemType: "government_id" }] }),
    ).requestId;
    unwrap(await startVerificationReview(verifier.ctx, { requestId: req }));
    const request = unwrap(await listVerificationRequests(verifier.ctx, { statuses: ["under_review"] })).find(
      (r) => r.id === req,
    )!;
    const selfApprove = await decideVerification(verifier.ctx, {
      requestId: req,
      decision: "approved",
      items: [{ itemId: request.items[0]!.id, status: "verified" }],
      expiresOn: future,
    });
    expect(selfApprove.ok || selfApprove.error.code).toBe("FORBIDDEN");
  });

  it("rejection and revocation keep or remove providers from the marketplace", async () => {
    unwrap(
      await updateProviderProfile(rival.ctx, {
        ...profileInput(),
        organizationId: rivalOrg,
        tagline: `Rival ${suffix}`,
      }),
    );
    unwrap(
      await createProviderService(rival.ctx, {
        organizationId: rivalOrg,
        categoryId: plumbingId,
        title: "Pipe work",
        pricingModel: "quote_only",
      }),
    );
    const rejectReq = unwrap(
      await submitVerification(rival.ctx, { organizationId: rivalOrg, items: [{ itemType: "government_id" }] }),
    ).requestId;
    unwrap(await startVerificationReview(verifier.ctx, { requestId: rejectReq }));
    unwrap(
      await decideVerification(verifier.ctx, {
        requestId: rejectReq,
        decision: "rejected",
        items: [],
        decisionNotes: "ID unreadable",
      }),
    );
    expect(unwrap(await searchProviders(customer.ctx, { query: `Rival ${suffix}` })).items).toEqual([]);
    // After rejection a new request is allowed.
    expect(
      (await submitVerification(rival.ctx, { organizationId: rivalOrg, items: [{ itemType: "government_id" }] })).ok,
    ).toBe(true);

    unwrap(await revokeVerification(verifier.ctx, { requestId, reason: "Permit was falsified" }));
    expect(unwrap(await searchProviders(customer.ctx, { query: suffix })).items).toEqual([]);
    expect(unwrap(await listVerifiedItems(customer.ctx, org))).toEqual([]);
  });

  it("expired verifications delist the provider", async () => {
    const req = unwrap(
      await submitVerification(owner.ctx, { organizationId: org, items: [{ itemType: "business_registration" }] }),
    ).requestId;
    unwrap(await approve(req));
    expect(unwrap(await searchProviders(customer.ctx, { query: suffix })).items).toHaveLength(1);
    await adminClient().from("verification_requests").update({ expires_on: "2020-01-01" }).eq("id", req);
    expect(unwrap(await searchProviders(customer.ctx, { query: suffix })).items).toEqual([]);
    await adminClient().from("verification_requests").update({ expires_on: future }).eq("id", req);
  });
});

describe("search filters and service areas", () => {
  it("filters by category, division and normalised locality", async () => {
    const q = { query: suffix };
    expect(unwrap(await searchProviders(customer.ctx, { ...q, category: "plumbing" })).items).toHaveLength(1);
    expect(unwrap(await searchProviders(customer.ctx, { ...q, category: "aircon" })).items).toEqual([]);
    expect(unwrap(await searchProviders(customer.ctx, { ...q, division: "home" })).items).toHaveLength(1);
    expect(unwrap(await searchProviders(customer.ctx, { ...q, division: "pet" })).items).toEqual([]);
    // "City of Pasig" coverage matches "Pasig City" and "pasig"; any barangay in the city matches.
    expect(
      unwrap(
        await searchProviders(customer.ctx, {
          ...q,
          province: "Metro Manila",
          city: "Pasig City",
          barangay: "Kapitolyo",
        }),
      ).items,
    ).toHaveLength(1);
    expect(
      unwrap(await searchProviders(customer.ctx, { ...q, province: "metro manila", city: "pasig" })).items,
    ).toHaveLength(1);
    expect(
      unwrap(await searchProviders(customer.ctx, { ...q, province: "Metro Manila", city: "Makati" })).items,
    ).toEqual([]);
    expect(unwrap(await searchProviders(customer.ctx, { ...q, province: "Cebu" })).items).toEqual([]);
  });

  it("rejects duplicate coverage and coverage edits by staff", async () => {
    const dup = await addServiceArea(owner.ctx, {
      organizationId: org,
      province: "metro manila",
      cityMunicipality: "Pasig City",
    });
    expect(dup.ok || dup.error.code).toBe("VALIDATION_FAILED");
    expect((await addServiceArea(staff.ctx, { organizationId: org, province: "Cebu" })).ok).toBe(false);
  });
});

describe("reviews", () => {
  let requested: string;
  let completed: string;

  beforeAll(async () => {
    const admin = adminClient();
    const r1 = await admin
      .from("bookings")
      .insert({ household_id: household, organization_id: org, status: "requested" })
      .select("id")
      .single();
    const r2 = await admin
      .from("bookings")
      .insert({
        household_id: household,
        organization_id: org,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    requested = r1.data!.id;
    completed = r2.data!.id;
  });

  it("only completed bookings can be reviewed, once, by the household", async () => {
    const early = await submitReview(customer.ctx, { bookingId: requested, rating: 5 });
    expect(early.ok || early.error.reason).toBe("review_not_eligible");
    const stranger = await submitReview(otherCustomer.ctx, { bookingId: completed, rating: 1, comment: "Fake" });
    expect(stranger.ok || stranger.error.code).toBe("NOT_FOUND");
    const providerSelf = await submitReview(owner.ctx, { bookingId: completed, rating: 5 });
    expect(providerSelf.ok).toBe(false);
    const review = unwrap(
      await submitReview(customer.ctx, { bookingId: completed, rating: 4, comment: "Fixed our leak quickly" }),
    );
    const dup = await submitReview(customer.ctx, { bookingId: completed, rating: 5 });
    expect(dup.ok || dup.error.reason).toBe("duplicate_review");
    expect(unwrap(await getProviderProfile(customer.ctx, org))).toMatchObject({ ratingCount: 1, ratingSum: 4 });
    const direct = await customer.client
      .from("reviews")
      .insert({ booking_id: requested, organization_id: org, household_id: household, rating: 5 } as never);
    expect(direct.error).not.toBeNull();

    // Only the author edits; only the provider's managers reply.
    expect((await editReview(otherCustomer.ctx, { reviewId: review.reviewId, rating: 1, comment: "x" })).ok).toBe(
      false,
    );
    expect((await editReview(owner.ctx, { reviewId: review.reviewId, rating: 5, comment: "x" })).ok).toBe(false);
    unwrap(
      await editReview(customer.ctx, {
        reviewId: review.reviewId,
        rating: 5,
        comment: "Fixed our leak quickly — great!",
      }),
    );
    expect((await replyToReview(customer.ctx, { reviewId: review.reviewId, reply: "Thanks!" })).ok).toBe(false);
    expect((await replyToReview(staff.ctx, { reviewId: review.reviewId, reply: "Thanks!" })).ok).toBe(false);
    unwrap(await replyToReview(owner.ctx, { reviewId: review.reviewId, reply: "Salamat po!" }));
    const reviews = unwrap(await listProviderReviews(customer.ctx, org));
    expect(reviews[0]).toMatchObject({ rating: 5, providerReply: "Salamat po!", isMine: true });
  });
});

describe("cross-organization isolation", () => {
  it("one provider cannot see another's unpublished data or verification history", async () => {
    expect(unwrap(await listVerificationRequests(rival.ctx, { organizationId: org }))).toEqual([]);
    expect((await rival.client.from("organization_files").select("id").eq("organization_id", org)).data).toEqual([]);
    const staffView = unwrap(await listVerificationRequests(staff.ctx, { organizationId: org }));
    expect(staffView).toEqual([]); // staff lack organization.update
  });
});

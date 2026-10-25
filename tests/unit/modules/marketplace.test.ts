import { describe, expect, it } from "vitest";
import { availabilityFreshness, averageRatingTenths, canTransition } from "@bahayplus/modules/providers";
import {
  AddServiceAreaInput,
  BusinessHours,
  CreateProviderServiceInput,
  UpdateProviderProfileInput,
} from "@bahayplus/validation/marketplace/provider";
import { SubmitVerificationInput } from "@bahayplus/validation/marketplace/trust";

const ID = "30000000-0000-4000-8000-000000000001";

describe("verification state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("submitted", "under_review")).toBe(true);
    expect(canTransition("submitted", "approved")).toBe(false);
    expect(canTransition("under_review", "approved")).toBe(true);
    expect(canTransition("under_review", "rejected")).toBe(true);
    expect(canTransition("approved", "revoked")).toBe(true);
    expect(canTransition("approved", "expired")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("revoked", "approved")).toBe(false);
  });
});

describe("ratings and availability", () => {
  it("averages ratings in tenths without floats", () => {
    expect(averageRatingTenths(0, 0)).toBeNull();
    expect(averageRatingTenths(14, 3)).toBe(47);
    expect(averageRatingTenths(5, 1)).toBe(50);
  });
  it("flags availability older than 24 hours as stale", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(availabilityFreshness(null, now)).toBe("unknown");
    expect(availabilityFreshness("2026-10-25T00:00:00Z", now)).toBe("fresh");
    expect(availabilityFreshness("2026-10-24T11:59:00Z", now)).toBe("stale");
  });
});

describe("marketplace contracts", () => {
  it("validates business hours", () => {
    expect(
      BusinessHours.safeParse({
        mon: [["08:00", "17:00"]],
        sat: [
          ["09:00", "12:00"],
          ["13:00", "15:00"],
        ],
      }).success,
    ).toBe(true);
    expect(BusinessHours.safeParse({ mon: [["17:00", "08:00"]] }).success).toBe(false);
    expect(BusinessHours.safeParse({ mon: [["8am", "5pm"]] }).success).toBe(false);
  });

  it("enforces pricing and booking-mode rules for services", () => {
    const base = { organizationId: ID, categoryId: ID, title: "Leak repair" };
    expect(
      CreateProviderServiceInput.safeParse({ ...base, pricingModel: "fixed", priceCentavos: "1,500" }).success,
    ).toBe(true);
    expect(CreateProviderServiceInput.safeParse({ ...base, pricingModel: "fixed" }).success).toBe(false);
    expect(
      CreateProviderServiceInput.safeParse({ ...base, pricingModel: "quote_only", priceCentavos: "100" }).success,
    ).toBe(false);
    expect(
      CreateProviderServiceInput.safeParse({ ...base, pricingModel: "quote_only", allowsBookNow: true }).success,
    ).toBe(false);
    expect(
      CreateProviderServiceInput.safeParse({ ...base, pricingModel: "quote_only", allowsQuote: false }).success,
    ).toBe(false);
  });

  it("requires a city for a barangay-level service area", () => {
    expect(
      AddServiceAreaInput.safeParse({ organizationId: ID, province: "Metro Manila", barangay: "Kapitolyo" }).success,
    ).toBe(false);
    expect(AddServiceAreaInput.parse({ organizationId: ID, province: "Cebu", cityMunicipality: "" })).toMatchObject({
      cityMunicipality: null,
      barangay: null,
    });
  });

  it("validates profile links and verification item lists", () => {
    expect(
      UpdateProviderProfileInput.safeParse({ organizationId: ID, website: "http://insecure.example" }).success,
    ).toBe(false);
    expect(
      UpdateProviderProfileInput.safeParse({ organizationId: ID, messengerUrl: "https://m.me/aquafix" }).success,
    ).toBe(true);
    expect(SubmitVerificationInput.safeParse({ organizationId: ID, items: [] }).success).toBe(false);
    expect(
      SubmitVerificationInput.safeParse({
        organizationId: ID,
        items: [{ itemType: "mayors_permit" }, { itemType: "mayors_permit" }],
      }).success,
    ).toBe(false);
  });
});

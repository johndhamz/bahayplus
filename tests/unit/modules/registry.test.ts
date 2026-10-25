import { describe, expect, it } from "vitest";
import { nextMaintenanceDate, warrantyStatus } from "@bahayplus/modules/assets";
import { detectFileType } from "@bahayplus/modules/files";
import { petAge } from "@bahayplus/modules/pets";
import { classifyDue, describeDays } from "@bahayplus/modules/scheduling";
import { ltoRenewalMonth } from "@bahayplus/modules/vehicles";
import { CreateAssetInput } from "@bahayplus/validation/registry/assets";
import { sanitizeFileName } from "@bahayplus/validation/registry/files";
import { AddPetHealthRecordInput } from "@bahayplus/validation/registry/pets";
import { normalizePlate } from "@bahayplus/validation/registry/vehicles";

const HH = "20000000-0000-4000-8000-000000000001";

describe("warranty status", () => {
  it("covers none, active, expiring soon (inclusive 30 days), and expired", () => {
    expect(warrantyStatus(null, "2026-10-25")).toEqual({ state: "none" });
    expect(warrantyStatus("2027-01-01", "2026-10-25")).toEqual({ state: "active", daysRemaining: 68 });
    expect(warrantyStatus("2026-11-24", "2026-10-25")).toEqual({ state: "expiring_soon", daysRemaining: 30 });
    expect(warrantyStatus("2026-10-25", "2026-10-25")).toEqual({ state: "expiring_soon", daysRemaining: 0 });
    expect(warrantyStatus("2026-10-24", "2026-10-25")).toEqual({ state: "expired", daysRemaining: -1 });
  });
});

describe("maintenance schedule", () => {
  it("anchors on the last service, else purchase date, clamping month ends", () => {
    expect(nextMaintenanceDate({ intervalMonths: 6, lastMaintainedOn: "2026-08-31", purchaseDate: "2025-01-01" })).toBe(
      "2027-02-28",
    );
    expect(nextMaintenanceDate({ intervalMonths: 1, lastMaintainedOn: null, purchaseDate: "2028-01-31" })).toBe(
      "2028-02-29",
    );
    expect(
      nextMaintenanceDate({ intervalMonths: null, lastMaintainedOn: "2026-01-01", purchaseDate: null }),
    ).toBeNull();
    expect(nextMaintenanceDate({ intervalMonths: 3, lastMaintainedOn: null, purchaseDate: null })).toBeNull();
  });
});

describe("due classification", () => {
  it("classifies relative to the Manila calendar date", () => {
    expect(classifyDue("2026-10-24", "2026-10-25")).toEqual({ status: "overdue", days: -1 });
    expect(classifyDue("2026-10-25", "2026-10-25").status).toBe("due_today");
    expect(classifyDue("2026-11-24", "2026-10-25").status).toBe("due_soon");
    expect(classifyDue("2026-11-25", "2026-10-25").status).toBe("upcoming");
    expect(describeDays(1)).toBe("tomorrow");
    expect(describeDays(-3)).toBe("3 days ago");
  });
});

describe("LTO renewal month and plates", () => {
  it("maps the plate's last digit to the renewal month", () => {
    expect(ltoRenewalMonth("ABC 1231")).toEqual({ month: 1, name: "January" });
    expect(ltoRenewalMonth("NBC 1239")).toEqual({ month: 9, name: "September" });
    expect(ltoRenewalMonth("123 ABC0")).toEqual({ month: 10, name: "October" });
    expect(ltoRenewalMonth("TEMP")).toBeNull();
  });

  it("normalises plate input", () => {
    expect(normalizePlate(" abc   1234 ")).toBe("ABC 1234");
    expect(normalizePlate("ab-12/34")).toBe("AB-1234");
  });
});

describe("pet age", () => {
  it("formats years/months/weeks and rejects future birthdays", () => {
    expect(petAge("2024-07-25", "2026-10-25")).toBe("2 years, 3 months");
    expect(petAge("2026-05-26", "2026-10-25")).toBe("4 months");
    expect(petAge("2026-10-04", "2026-10-25")).toBe("3 weeks");
    expect(petAge("2026-10-24", "2026-10-25")).toBe("1 day");
    expect(petAge("2027-01-01", "2026-10-25")).toBeNull();
    expect(petAge(null, "2026-10-25")).toBeNull();
  });
});

describe("file signatures", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  const text = (s: string) => new TextEncoder().encode(s);
  it("detects allowed types from leading bytes", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectFileType(text("%PDF-1.7"))).toBe("application/pdf");
    expect(detectFileType(text("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectFileType(text("\0\0\0\x18ftypheic"))).toBe("image/heic");
  });
  it("rejects everything else", () => {
    expect(detectFileType(text("<svg xmlns=..."))).toBeNull();
    expect(detectFileType(text("GIF89a"))).toBeNull();
    expect(detectFileType(bytes(0x4d, 0x5a))).toBeNull(); // Windows executable
    expect(detectFileType(bytes())).toBeNull();
  });
  it("sanitises display names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\receipt.pdf")).toBe("receipt.pdf");
    expect(sanitizeFileName("bad\u0000name.jpg")).toBe("badname.jpg");
  });
});

describe("registry contracts", () => {
  it("parses peso amounts into centavos and empty values into null", () => {
    const parsed = CreateAssetInput.parse({
      householdId: HH,
      name: "TV",
      category: "electronics",
      purchasePriceCentavos: "₱1,299.95",
      purchaseDate: "",
      propertyId: "",
    });
    expect(parsed).toMatchObject({
      purchasePriceCentavos: 129_995,
      purchaseDate: null,
      propertyId: null,
      maintenanceIntervalMonths: null,
    });
  });
  it("rejects invalid dates, negative prices and warranty before purchase", () => {
    expect(
      CreateAssetInput.safeParse({ householdId: HH, name: "TV", category: "electronics", purchaseDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      CreateAssetInput.safeParse({ householdId: HH, name: "TV", category: "electronics", purchasePriceCentavos: "-5" })
        .success,
    ).toBe(false);
    expect(
      CreateAssetInput.safeParse({
        householdId: HH,
        name: "TV",
        category: "electronics",
        purchaseDate: "2026-05-01",
        warrantyExpiresOn: "2026-04-30",
      }).success,
    ).toBe(false);
  });
  it("requires the next due date on or after the visit", () => {
    expect(
      AddPetHealthRecordInput.safeParse({
        petId: HH,
        kind: "vaccination",
        title: "Rabies",
        occurredOn: "2026-10-01",
        nextDueOn: "2026-09-01",
      }).success,
    ).toBe(false);
  });
});

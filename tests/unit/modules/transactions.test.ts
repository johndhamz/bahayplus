import { describe, expect, it } from "vitest";
import { allowedBookingActions, canReschedule, isQuotationOpen, WORK_ORDER_NEXT } from "@bahayplus/modules/bookings";
import {
  lineTotalCentavos,
  ManilaDateTime,
  SaveQuotationDraftInput,
} from "@bahayplus/validation/transactions/bookings";
import { ProposeChangeOrderInput } from "@bahayplus/validation/transactions/projects";

const ID = "30000000-0000-4000-8000-000000000001";

describe("booking lifecycle (mirrors SQL)", () => {
  it("offers provider and customer actions by status", () => {
    expect(allowedBookingActions("requested", "provider")).toEqual(["confirm", "decline", "cancel"]);
    expect(allowedBookingActions("requested", "customer")).toEqual(["cancel"]);
    expect(allowedBookingActions("confirmed", "provider")).toEqual(["start", "complete", "cancel"]);
    expect(allowedBookingActions("in_progress", "provider")).toEqual(["complete"]);
    expect(allowedBookingActions("in_progress", "customer")).toEqual([]);
    expect(allowedBookingActions("completed", "provider")).toEqual([]);
    expect(canReschedule("confirmed")).toBe(true);
    expect(canReschedule("in_progress")).toBe(false);
  });

  it("work order transitions are one-directional", () => {
    expect(WORK_ORDER_NEXT.in_progress).toEqual(["completed"]);
    expect(WORK_ORDER_NEXT.completed).toEqual([]);
  });
});

describe("quotations", () => {
  it("are open only while sent and valid", () => {
    expect(isQuotationOpen({ status: "sent", validUntil: "2026-10-25" }, "2026-10-25")).toBe(true);
    expect(isQuotationOpen({ status: "sent", validUntil: "2026-10-24" }, "2026-10-25")).toBe(false);
    expect(isQuotationOpen({ status: "accepted", validUntil: "2026-12-31" }, "2026-10-25")).toBe(false);
  });

  it("computes line totals exactly like the database (half away from zero)", () => {
    expect(lineTotalCentavos(2.5, 33_333)).toBe(83_333); // 83,332.5 → 83,333
    expect(lineTotalCentavos(3, 2_500_000)).toBe(7_500_000);
    expect(lineTotalCentavos(0.333, 100)).toBe(33);
    expect(lineTotalCentavos(1.005, 1_000)).toBe(1_005);
  });

  it("validates quotation lines", () => {
    expect(SaveQuotationDraftInput.safeParse({ quotationId: ID, lines: [] }).success).toBe(false);
    expect(
      SaveQuotationDraftInput.safeParse({
        quotationId: ID,
        lines: [{ description: "x", quantity: "0", unitPriceCentavos: "1" }],
      }).success,
    ).toBe(false);
    expect(
      SaveQuotationDraftInput.safeParse({
        quotationId: ID,
        lines: [{ description: "x", quantity: "1.2345", unitPriceCentavos: "1" }],
      }).success,
    ).toBe(false);
    expect(
      SaveQuotationDraftInput.parse({
        quotationId: ID,
        lines: [{ description: "Tiles", quantity: "12.5", unitPriceCentavos: "₱450.25" }],
      }).lines[0],
    ).toMatchObject({ quantity: 12.5, unitPriceCentavos: 45_025 });
  });
});

describe("contracts", () => {
  it("interprets datetime-local input as Manila time", () => {
    expect(ManilaDateTime.parse("2026-11-01T09:00")).toBe("2026-11-01T01:00:00.000Z");
    expect(ManilaDateTime.safeParse("2026-11-01").success).toBe(false);
  });

  it("allows negative change orders (scope reductions)", () => {
    expect(
      ProposeChangeOrderInput.parse({ projectId: ID, title: "Remove molding", amountDeltaCentavos: "-2,000" })
        .amountDeltaCentavos,
    ).toBe(-200_000);
  });
});

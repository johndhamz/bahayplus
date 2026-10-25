import { describe, expect, it } from "vitest";
import { allowedOrderActions, formatPoNumber } from "@bahayplus/modules/suppliers";
import { stockState } from "@bahayplus/modules/inventory";
import { SaveCategoryInput, SetUserSuspensionInput, UpdateSettingInput } from "@bahayplus/validation/admin/admin";
import { CreatePurchaseOrderInput, RecordStockInput } from "@bahayplus/validation/supply/supply";

const id = "20000000-0000-4000-8000-000000000001";

describe("purchase order actions", () => {
  it("offers each side only the valid next steps", () => {
    expect(allowedOrderActions("submitted", "supplier", null)).toEqual(["accept", "reject", "cancel"]);
    expect(allowedOrderActions("submitted", "buyer", null)).toEqual(["cancel"]);
    expect(allowedOrderActions("accepted", "supplier", null)).toEqual(["ship", "cancel"]);
    expect(allowedOrderActions("shipped", "supplier", "out_for_delivery")).toEqual(["deliver", "fail_delivery"]);
    expect(allowedOrderActions("shipped", "supplier", "failed")).toEqual(["reattempt"]);
    expect(allowedOrderActions("shipped", "buyer", "failed")).toEqual(["confirm_receipt"]);
    expect(allowedOrderActions("delivered", "buyer", "delivered")).toEqual([]);
    expect(allowedOrderActions("cancelled", "supplier", null)).toEqual([]);
  });
  it("formats PO numbers", () => {
    expect(formatPoNumber(42)).toBe("PO-000042");
  });
});

describe("stock state", () => {
  it("computes availability from on hand minus reserved, with low/out flags", () => {
    expect(stockState(10, 4, 2)).toEqual({ available: 6, low: false, out: false });
    expect(stockState(3, 1, 2)).toEqual({ available: 2, low: true, out: false });
    expect(stockState(2, 2, 0)).toEqual({ available: 0, low: true, out: true });
    expect(stockState(0.3, 0.1, 0).available).toBe(0.2);
  });
});

describe("Phase 9 contracts", () => {
  it("purchase orders need lines, unique products and an address", () => {
    const base = {
      buyerOrgId: id,
      supplierOrgId: id,
      deliveryAddress: "12 Rizal St., Pasig",
      idempotencyKey: "abcdefgh12",
    };
    expect(CreatePurchaseOrderInput.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(
      CreatePurchaseOrderInput.safeParse({
        ...base,
        lines: [
          { productId: id, quantity: "1" },
          { productId: id, quantity: "2" },
        ],
      }).success,
    ).toBe(false);
    expect(CreatePurchaseOrderInput.safeParse({ ...base, lines: [{ productId: id, quantity: "0" }] }).success).toBe(
      false,
    );
    expect(
      CreatePurchaseOrderInput.parse({ ...base, lines: [{ productId: id, quantity: "2.5" }] }).lines[0]!.quantity,
    ).toBe(2.5);
  });
  it("stock movements allow negative adjustments but never zero", () => {
    const base = { productId: id, reason: "adjustment", note: "", idempotencyKey: "abcdefgh12" } as const;
    expect(RecordStockInput.parse({ ...base, quantity: "-2" }).quantity).toBe(-2);
    expect(RecordStockInput.safeParse({ ...base, quantity: "0" }).success).toBe(false);
  });
  it("privileged admin actions require a reason; settings are validated per key", () => {
    expect(SetUserSuspensionInput.safeParse({ userId: id, suspend: true, reason: "" }).success).toBe(false);
    expect(UpdateSettingInput.safeParse({ key: "urgent_stale_hours", value: "500" }).success).toBe(false);
    expect(UpdateSettingInput.parse({ key: "urgent_stale_hours", value: "36" }).value).toBe(36);
    expect(UpdateSettingInput.safeParse({ key: "support_email", value: "nope" }).success).toBe(false);
    expect(SaveCategoryInput.safeParse({ division: "home", slug: "Bad Slug", name: "X" }).success).toBe(false);
  });
});

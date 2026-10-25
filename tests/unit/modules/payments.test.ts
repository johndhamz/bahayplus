import { describe, expect, it } from "vitest";
import {
  commissionOf,
  refundAdjustment,
  refundableCentavos,
  settlementLine,
  signPayload,
  verifySignature,
} from "@bahayplus/modules/payments";
import { RequestRefundInput } from "@bahayplus/validation/payments/payments";

describe("commission (exact integer centavos)", () => {
  it("rounds half up and never uses floating point", () => {
    expect(commissionOf(150_000, 1000)).toBe(15_000);
    expect(commissionOf(150_000, 750)).toBe(11_250);
    expect(commissionOf(5, 1000)).toBe(1); // 0.5 → 1
    expect(commissionOf(4, 1000)).toBe(0); // 0.4 → 0
    expect(commissionOf(99_999_999_999, 1234)).toBe(12_340_000_000); // 12 339 999 999.88 → 12 340 000 000
    expect(commissionOf(1, 0)).toBe(0);
  });
  it("settlement lines charge commission on the kept amount; adjustments return it", () => {
    expect(settlementLine(150_000, 50_000, 1000)).toEqual({
      gross: 150_000,
      refunds: 50_000,
      commission: 10_000,
      net: 90_000,
    });
    expect(refundAdjustment(30_000, 1000)).toEqual({ gross: 0, refunds: 30_000, commission: -3_000, net: -27_000 });
    // Settling then refunding equals refunding then settling.
    const before = settlementLine(150_000, 30_000, 1000).net;
    const after = settlementLine(150_000, 0, 1000).net + refundAdjustment(30_000, 1000).net;
    expect(after).toBe(before);
  });
  it("refundable amount never goes negative", () => {
    expect(refundableCentavos(150_000, 50_000)).toBe(100_000);
    expect(refundableCentavos(150_000, 200_000)).toBe(0);
  });
});

describe("webhook signatures", () => {
  const secret = "unit-test-secret-0123456789abcdef01234567";
  const now = 1_800_000_000;
  it("accepts a valid signature inside the tolerance window", () => {
    const sig = signPayload(secret, '{"a":1}', now);
    expect(verifySignature(secret, '{"a":1}', sig, now + 60)).toEqual({ ok: true, signedAt: new Date(now * 1000) });
  });
  it("rejects tampering, wrong secrets, stale and future timestamps", () => {
    const sig = signPayload(secret, '{"a":1}', now);
    expect(verifySignature(secret, '{"a":2}', sig, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySignature("another-secret-0123456789abcdef0123456", '{"a":1}', sig, now)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(verifySignature(secret, '{"a":1}', sig, now + 301)).toEqual({ ok: false, reason: "expired" });
    expect(verifySignature(secret, '{"a":1}', sig, now - 301)).toEqual({ ok: false, reason: "expired" });
    expect(verifySignature(secret, '{"a":1}', null, now)).toEqual({ ok: false, reason: "missing" });
    expect(verifySignature(secret, '{"a":1}', "t=abc,v1=zz", now)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("refund contract", () => {
  it("requires a positive peso amount and a reason", () => {
    const id = "20000000-0000-4000-8000-000000000001";
    expect(
      RequestRefundInput.safeParse({
        paymentIntentId: id,
        amountCentavos: "0",
        reason: "ok reason",
        idempotencyKey: "abcdefgh",
      }).success,
    ).toBe(false);
    expect(
      RequestRefundInput.parse({
        paymentIntentId: id,
        amountCentavos: "500.50",
        reason: "Missed visit",
        idempotencyKey: "abcdefgh",
      }).amountCentavos,
    ).toBe(50_050);
  });
});

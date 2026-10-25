/** Exact commission: round half up of amount × bps / 10 000 (mirrors private.commission_of). */
export function commissionOf(amountCentavos: number, rateBps: number): number {
  if (!Number.isSafeInteger(amountCentavos) || !Number.isInteger(rateBps))
    throw new Error("integer centavos and bps required");
  const product = BigInt(amountCentavos) * BigInt(rateBps);
  const sign = product < 0n ? -1n : 1n;
  const abs = product < 0n ? -product : product;
  return Number(sign * ((abs + 5000n) / 10000n));
}

/** Settlement line for one payment: commission is charged on what the customer kept paid. */
export function settlementLine(grossCentavos: number, refundedCentavos: number, rateBps: number) {
  const commission = commissionOf(grossCentavos - refundedCentavos, rateBps);
  return {
    gross: grossCentavos,
    refunds: refundedCentavos,
    commission,
    net: grossCentavos - refundedCentavos - commission,
  };
}

/** A refund after settlement: the refunded amount comes back, and so does its share of commission. */
export function refundAdjustment(refundCentavos: number, rateBps: number) {
  const commission = -commissionOf(refundCentavos, rateBps);
  return { gross: 0, refunds: refundCentavos, commission, net: -refundCentavos - commission };
}

export function refundableCentavos(amountCentavos: number, committedRefundsCentavos: number): number {
  return Math.max(0, amountCentavos - committedRefundsCentavos);
}

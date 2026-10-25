/** Available stock = on hand − reserved by accepted orders; low when at or below the reorder level. */
export function stockState(
  onHand: number,
  reserved: number,
  reorderLevel: number,
): { available: number; low: boolean; out: boolean } {
  const available = Math.round((onHand - reserved) * 1000) / 1000;
  return { available, out: available <= 0, low: available <= reorderLevel };
}

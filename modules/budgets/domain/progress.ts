export type BudgetState = "no_limit" | "on_track" | "warning" | "over";

/**
 * Progress of spending against a limit as integer basis points (10000 = 100%), avoiding floats.
 * Warning from 80% of the limit; over when spending exceeds the limit.
 */
export function budgetProgress(
  limitCentavos: number | null,
  spentCentavos: number,
): { state: BudgetState; basisPoints: number | null } {
  if (limitCentavos === null) return { state: "no_limit", basisPoints: null };
  if (limitCentavos === 0)
    return { state: spentCentavos > 0 ? "over" : "on_track", basisPoints: spentCentavos > 0 ? 10_000 : 0 };
  const bp = Number((BigInt(spentCentavos) * 10_000n) / BigInt(limitCentavos));
  return { state: spentCentavos > limitCentavos ? "over" : bp >= 8_000 ? "warning" : "on_track", basisPoints: bp };
}

export const percentLabel = (basisPoints: number) => `${Math.floor(basisPoints / 100)}%`;

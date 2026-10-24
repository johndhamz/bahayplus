/**
 * Pure membership-change policy. Mirrors private.assert_household_role_change /
 * private.assert_organization_role_change in SQL so the UI can show only allowed actions;
 * the database remains the enforcement point.
 */
export const OWNER_RANK = 100;

export type MembershipChange = {
  actorRank: number;
  actorCanManageMembers: boolean;
  actorCanManageOwners: boolean;
  isSelf: boolean;
  targetRank: number;
  /** New role rank when changing a role; undefined for remove/suspend. */
  newRank?: number;
};

export type PolicyDecision = { allowed: true } | { allowed: false; reason: "forbidden" | "role_escalation" };

export function evaluateMembershipChange(change: MembershipChange): PolicyDecision {
  const { actorRank, actorCanManageMembers, actorCanManageOwners, isSelf, targetRank, newRank } = change;
  if (!actorCanManageMembers) return { allowed: false, reason: "forbidden" };
  if ((targetRank === OWNER_RANK || newRank === OWNER_RANK) && !actorCanManageOwners) {
    return { allowed: false, reason: "role_escalation" };
  }
  if (actorRank < OWNER_RANK) {
    if (targetRank >= actorRank && !isSelf) return { allowed: false, reason: "forbidden" };
    if (newRank !== undefined && newRank >= actorRank) return { allowed: false, reason: "role_escalation" };
  }
  if (isSelf && newRank !== undefined && newRank > targetRank) return { allowed: false, reason: "role_escalation" };
  return { allowed: true };
}

/** Roles an actor may assign (or invite with). Owners may assign every role. */
export function assignableRanks(
  actorRank: number,
  actorCanManageOwners: boolean,
  allRanks: readonly number[],
): number[] {
  return allRanks.filter((rank) => {
    if (rank === OWNER_RANK) return actorCanManageOwners;
    return actorRank >= OWNER_RANK || rank < actorRank;
  });
}

/** The last active owner can never be removed, suspended or demoted. */
export function wouldRemoveLastOwner(input: {
  targetIsOwner: boolean;
  activeOwnerCount: number;
  keepsOwnerRole: boolean;
}) {
  return input.targetIsOwner && !input.keepsOwnerRole && input.activeOwnerCount <= 1;
}

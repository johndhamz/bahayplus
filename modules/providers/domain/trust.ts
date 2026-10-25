import type { VerificationItemType } from "@bahayplus/validation/marketplace/trust";

/** What each verified item means, in plain words, for badges and admin review. */
export const VERIFICATION_ITEM_LABELS: Record<VerificationItemType, { label: string; hint: string }> = {
  business_registration: {
    label: "Business registration",
    hint: "DTI (sole proprietors) or SEC (corporations/partnerships)",
  },
  mayors_permit: {
    label: "Mayor's / business permit",
    hint: "Issued by the city or municipality for the current year",
  },
  bir_registration: { label: "BIR registration", hint: "Certificate of Registration (BIR Form 2303)" },
  government_id: { label: "Owner's government ID", hint: "PhilSys, passport, driver's license or UMID" },
  professional_license: { label: "Professional license", hint: "PRC, TESDA NC or PCAB, depending on the service" },
  nbi_clearance: { label: "NBI clearance", hint: "For the owner or field staff" },
  insurance: { label: "Insurance", hint: "Liability or accident insurance" },
};

export type VerificationStatus = "submitted" | "under_review" | "approved" | "rejected" | "expired" | "revoked";

const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  submitted: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["expired", "revoked"],
  rejected: [],
  expired: [],
  revoked: [],
};

/** Mirrors the SQL workflow; used to show only valid admin actions. */
export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Average rating in tenths without float drift (47 = 4.7). Null when there are no reviews. */
export function averageRatingTenths(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((sum * 10) / count);
}

export type Freshness = "fresh" | "stale" | "unknown";
/** Availability set more than 24 hours ago is stale and shown as such. */
export function availabilityFreshness(updatedAt: string | null, now: Date, staleAfterHours = 24): Freshness {
  if (!updatedAt) return "unknown";
  return now.getTime() - Date.parse(updatedAt) > staleAfterHours * 3_600_000 ? "stale" : "fresh";
}

import { VERIFICATION_ITEM_LABELS } from "@bahayplus/modules/providers";
import type { ProviderServiceView } from "@bahayplus/modules/providers";
import type { VerificationItemType } from "@bahayplus/validation/marketplace/trust";
import { formatPeso } from "@bahayplus/types/money";

export const DIVISION_LABELS = {
  home: "Home Services",
  pet: "Pet Care",
  vehicle: "Vehicle Care",
  renovation: "Renovation & Custom Projects",
} as const;

export const verifiedItemLabel = (t: VerificationItemType) => VERIFICATION_ITEM_LABELS[t].label;

export function priceLabel(s: Pick<ProviderServiceView, "pricingModel" | "priceCentavos" | "unitLabel">): string {
  if (s.pricingModel === "quote_only" || s.priceCentavos === null) return "Price on quotation";
  const p = formatPeso(s.priceCentavos);
  switch (s.pricingModel) {
    case "starting_at":
      return `From ${p}`;
    case "hourly":
      return `${p} / hour`;
    case "per_unit":
      return `${p} / ${s.unitLabel || "unit"}`;
    default:
      return s.unitLabel ? `${p} ${s.unitLabel}` : p;
  }
}

export const AVAILABILITY_LABELS = {
  available: "Available",
  limited: "Limited availability",
  unavailable: "Not taking jobs",
} as const;

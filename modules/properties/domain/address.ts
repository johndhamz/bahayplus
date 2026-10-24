import type { PropertyType } from "@bahayplus/validation/properties/property";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: "House",
  condominium: "Condominium",
  apartment: "Apartment",
  townhouse: "Townhouse",
  other: "Other",
};

export type PhilippineAddress = {
  addressLine?: string | null;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** "Brgy." prefix unless the user already wrote Barangay/Brgy./Bgy. */
function barangayLabel(barangay: string): string {
  if (!barangay) return "";
  return /^(barangay|brgy\.?|bgy\.?)\s/i.test(barangay) ? barangay : `Brgy. ${barangay}`;
}

/**
 * Philippine address convention: street / unit, barangay, city or municipality, province + postal code.
 * Metro Manila cities are not followed by a province name twice ("Quezon City, Metro Manila 1101").
 */
export function formatPhilippineAddress(address: PhilippineAddress, options: { multiline?: boolean } = {}): string {
  const line1 = clean(address.addressLine);
  const barangay = barangayLabel(clean(address.barangay));
  const city = clean(address.cityMunicipality);
  const province = clean(address.province);
  const postal = clean(address.postalCode);
  const provincePart = [province && province.toLowerCase() !== city.toLowerCase() ? province : "", postal]
    .filter(Boolean)
    .join(" ");
  const parts = [line1, barangay, city, provincePart].filter(Boolean);
  return parts.join(options.multiline ? "\n" : ", ");
}

/** Short locality label for cards, e.g. "Taguig, Metro Manila". */
export function localityLabel(address: PhilippineAddress): string {
  return [clean(address.cityMunicipality), clean(address.province)].filter(Boolean).join(", ");
}

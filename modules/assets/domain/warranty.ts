import { addMonthsClamped, daysBetween, type IsoDate } from "@bahayplus/types/dates";
import type { AssetCategory } from "@bahayplus/validation/registry/assets";

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  aircon: "Air conditioner",
  refrigerator: "Refrigerator",
  washing_machine: "Washing machine",
  kitchen_appliance: "Kitchen appliance",
  water_heater: "Water heater",
  water_system: "Water pump / filter",
  electronics: "Electronics",
  electrical: "Electrical (genset, panel)",
  furniture: "Furniture",
  tools: "Tools & equipment",
  outdoor: "Outdoor & garden",
  other: "Other",
};

/** Suggested maintenance interval in months, e.g. aircon cleaning every 6 months in PH climate. */
export const SUGGESTED_MAINTENANCE_MONTHS: Partial<Record<AssetCategory, number>> = {
  aircon: 6,
  water_system: 6,
  water_heater: 12,
  refrigerator: 12,
  washing_machine: 12,
  electrical: 12,
};

export type WarrantyStatus =
  { state: "none" } | { state: "active" | "expiring_soon" | "expired"; daysRemaining: number };

export function warrantyStatus(expiresOn: IsoDate | null, today: IsoDate, soonDays = 30): WarrantyStatus {
  if (!expiresOn) return { state: "none" };
  const daysRemaining = daysBetween(today, expiresOn);
  if (daysRemaining < 0) return { state: "expired", daysRemaining };
  if (daysRemaining <= soonDays) return { state: "expiring_soon", daysRemaining };
  return { state: "active", daysRemaining };
}

/**
 * Next maintenance date: from the last routine service (or purchase date) plus the interval,
 * clamped to month end (a Jan 31 service + 1 month → Feb 28/29). Null without an interval or anchor.
 */
export function nextMaintenanceDate(input: {
  intervalMonths: number | null;
  lastMaintainedOn: IsoDate | null;
  purchaseDate: IsoDate | null;
}): IsoDate | null {
  const anchor = input.lastMaintainedOn ?? input.purchaseDate;
  if (!input.intervalMonths || !anchor) return null;
  return addMonthsClamped(anchor, input.intervalMonths);
}

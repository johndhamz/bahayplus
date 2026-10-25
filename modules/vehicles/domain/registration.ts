import type { VehicleType } from "@bahayplus/validation/registry/vehicles";

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: "Car",
  suv: "SUV",
  van: "Van",
  pickup: "Pickup",
  motorcycle: "Motorcycle",
  tricycle: "Tricycle",
  other: "Other",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October"];

/**
 * LTO renewal schedule: the last digit of the plate sets the month (1 = January … 9 = September,
 * 0 = October). Returns null for plates without a trailing digit (e.g. temporary/conduction plates).
 */
export function ltoRenewalMonth(plate: string): { month: number; name: string } | null {
  const match = /(\d)\s*$/.exec(plate.trim());
  if (!match) return null;
  const digit = Number(match[1]);
  const month = digit === 0 ? 10 : digit;
  return { month, name: MONTHS[month - 1]! };
}

export function vehicleLabel(v: { make: string; model: string; year: number | null; plateNumber: string }): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.plateNumber ? ` · ${v.plateNumber}` : "");
}

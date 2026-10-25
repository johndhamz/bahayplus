import { daysBetween, type IsoDate } from "@bahayplus/types/dates";

export const DUE_SOON_DAYS = 30;

export type DueStatus = "overdue" | "due_today" | "due_soon" | "upcoming";

/** Classifies a due date relative to "today" in Asia/Manila (pass today explicitly for testability). */
export function classifyDue(
  dueOn: IsoDate,
  today: IsoDate,
  soonDays = DUE_SOON_DAYS,
): { status: DueStatus; days: number } {
  const days = daysBetween(today, dueOn);
  if (days < 0) return { status: "overdue", days };
  if (days === 0) return { status: "due_today", days };
  if (days <= soonDays) return { status: "due_soon", days };
  return { status: "upcoming", days };
}

export function describeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export const DUE_KIND_LABELS: Record<string, string> = {
  warranty_expiry: "Warranty ends",
  asset_maintenance: "Maintenance due",
  pet_vaccination: "Vaccination due",
  pet_vet_visit: "Vet visit due",
  pet_deworming: "Deworming due",
  pet_medication: "Medication due",
  pet_grooming: "Grooming due",
  pet_other: "Pet care due",
  vehicle_registration: "LTO registration expires",
  vehicle_insurance: "Insurance expires",
  vehicle_maintenance: "Vehicle maintenance due",
};

export const dueKindLabel = (kind: string) => DUE_KIND_LABELS[kind] ?? "Due";

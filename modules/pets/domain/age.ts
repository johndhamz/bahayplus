import { parseIsoDate, type IsoDate } from "@bahayplus/types/dates";
import type { PetSpecies } from "@bahayplus/validation/registry/pets";

export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  fish: "Fish",
  rabbit: "Rabbit",
  hamster: "Hamster",
  reptile: "Reptile",
  other: "Other",
};

/** "2 years, 3 months", "5 months", "3 weeks" — null without a birth date or for future dates. */
export function petAge(birthDate: IsoDate | null, today: IsoDate): string | null {
  const b = birthDate ? parseIsoDate(birthDate) : null;
  const t = parseIsoDate(today);
  if (!b || !t) return null;
  let months = (t.year - b.year) * 12 + (t.month - b.month);
  if (t.day < b.day) months -= 1;
  if (months < 0) return null;
  if (months === 0) {
    const days = Math.round((Date.UTC(t.year, t.month - 1, t.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86_400_000);
    if (days < 0) return null;
    const weeks = Math.floor(days / 7);
    return weeks >= 1 ? `${weeks} ${weeks === 1 ? "week" : "weeks"}` : `${days} ${days === 1 ? "day" : "days"}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "year" : "years"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "month" : "months"}` : "";
  return [y, m].filter(Boolean).join(", ");
}

export const PET_HEALTH_KIND_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vet_visit: "Vet visit",
  deworming: "Deworming",
  medication: "Medication",
  grooming: "Grooming",
  other: "Other",
};

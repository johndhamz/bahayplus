import { z } from "zod";

/** Categories Bahay+ lists for urgent discovery (must be `urgent_eligible` in the catalog). */
export const URGENT_CATEGORIES = [
  "plumbing",
  "electrical",
  "locksmith",
  "roadside-assistance",
  "handyman",
  "roofing",
] as const;
export type UrgentCategory = (typeof URGENT_CATEGORIES)[number];

export const UrgentSearchInput = z.object({
  category: z.enum(URGENT_CATEGORIES, { message: "Choose what kind of help you need." }),
  province: z.string().trim().min(2, "Enter your province.").max(80),
  city: z.string().trim().max(80).optional().default(""),
  barangay: z.string().trim().max(80).optional().default(""),
});
export type UrgentSearchInput = z.input<typeof UrgentSearchInput>;

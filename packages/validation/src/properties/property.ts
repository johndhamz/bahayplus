import { z } from "zod";
import { Uuid } from "../common/primitives";

export const PROPERTY_TYPES = ["house", "condominium", "apartment", "townhouse", "other"] as const;
export const PropertyType = z.enum(PROPERTY_TYPES, { message: "Choose a property type." });
export type PropertyType = z.infer<typeof PropertyType>;

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).default("");

/** Form-friendly coordinate: "" → null, otherwise a decimal within the Philippine bounding box. */
const coordinate = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be between ${min} and ${max} for a Philippine address.`,
        });
        return z.NEVER;
      }
      return Math.round(n * 1_000_000) / 1_000_000;
    });

const PropertyFields = z.object({
  name: z.string().trim().min(1, "Give this property a name.").max(80, "Use 80 characters or fewer."),
  propertyType: PropertyType,
  addressLine: optionalText(200, "Street address"),
  barangay: optionalText(100, "Barangay"),
  cityMunicipality: z.string().trim().min(1, "Enter the city or municipality.").max(100),
  province: z.string().trim().min(1, "Enter the province (or Metro Manila).").max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^$|^[0-9]{4}$/, "Philippine postal codes have 4 digits.")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  latitude: coordinate(4, 22, "Latitude"),
  longitude: coordinate(116, 127, "Longitude"),
  notes: optionalText(2000, "Notes"),
});

const bothOrNeither = <T extends { latitude: number | null; longitude: number | null }>(v: T) =>
  (v.latitude === null) === (v.longitude === null);
const coordinateMessage = { path: ["longitude"], message: "Enter both latitude and longitude, or leave both empty." };

export const CreatePropertyInput = PropertyFields.extend({ householdId: Uuid }).refine(
  bothOrNeither,
  coordinateMessage,
);
export type CreatePropertyInput = z.input<typeof CreatePropertyInput>;

export const UpdatePropertyInput = PropertyFields.extend({
  propertyId: Uuid,
  isActive: z.boolean().default(true),
}).refine(bothOrNeither, coordinateMessage);
export type UpdatePropertyInput = z.input<typeof UpdatePropertyInput>;

export const PropertyIdInput = z.object({ propertyId: Uuid });
export const SetDefaultPropertyInput = z.object({ householdId: Uuid, propertyId: Uuid });

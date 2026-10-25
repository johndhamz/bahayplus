import { z } from "zod";
import { Uuid } from "../common/primitives";
import { OptionalInt, OptionalIsoDate, OptionalPesoAmount, RequiredIsoDate, text } from "../common/fields";

export const DIVISIONS = ["home", "pet", "vehicle", "renovation"] as const;
export const Division = z.enum(DIVISIONS);
export type Division = z.infer<typeof Division>;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");

/** {"mon": [["08:00","17:00"]], ...}; each range must end after it starts. */
export const BusinessHours = z
  .partialRecord(z.enum(WEEKDAYS), z.array(z.tuple([Time, Time])).max(3))
  .refine(
    (h) => Object.values(h).every((ranges) => (ranges ?? []).every(([a, b]) => a < b)),
    "Closing time must be after opening time.",
  )
  .default({});
export type BusinessHours = z.infer<typeof BusinessHours>;

const Url = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || pattern.test(v), message);

export const UpdateProviderProfileInput = z.object({
  organizationId: Uuid,
  tagline: text(120),
  description: text(3000),
  phone: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .default("")
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  website: Url(/^https:\/\/[^\s]+$/, "Use a full https:// address."),
  messengerUrl: Url(
    /^https:\/\/(m\.me|www\.facebook\.com|facebook\.com)\/[^\s]+$/,
    "Use your m.me or facebook.com page link.",
  ),
  yearEstablished: OptionalInt(1900, 2100, "Year established"),
  teamSize: OptionalInt(1, 10000, "Team size"),
  businessHours: BusinessHours,
  acceptsBookNow: z.boolean().default(false),
  acceptsQuoteRequests: z.boolean().default(true),
  acceptsContact: z.boolean().default(true),
  acceptsUrgent: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});
export type UpdateProviderProfileInput = z.input<typeof UpdateProviderProfileInput>;

export const AvailabilityStatus = z.enum(["available", "limited", "unavailable"]);
export const SetAvailabilityInput = z.object({ organizationId: Uuid, status: AvailabilityStatus });

export const PRICING_MODELS = ["fixed", "starting_at", "hourly", "per_unit", "quote_only"] as const;

const ServiceFields = z.object({
  categoryId: Uuid,
  title: z.string().trim().min(2, "Name this service.").max(120),
  description: text(2000),
  pricingModel: z.enum(PRICING_MODELS),
  priceCentavos: OptionalPesoAmount,
  unitLabel: text(40),
  durationMinutes: OptionalInt(15, 10080, "Duration"),
  allowsBookNow: z.boolean().default(false),
  allowsQuote: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
const serviceRules = (v: z.infer<typeof ServiceFields>, ctx: z.RefinementCtx) => {
  if (v.pricingModel === "quote_only" && v.priceCentavos !== null)
    ctx.addIssue({ code: "custom", path: ["priceCentavos"], message: "Quote-only services have no listed price." });
  if (v.pricingModel !== "quote_only" && v.priceCentavos === null)
    ctx.addIssue({ code: "custom", path: ["priceCentavos"], message: "Enter a price." });
  if (v.allowsBookNow && v.pricingModel === "quote_only")
    ctx.addIssue({ code: "custom", path: ["allowsBookNow"], message: "Book Now needs a listed price." });
  if (!v.allowsBookNow && !v.allowsQuote)
    ctx.addIssue({ code: "custom", path: ["allowsQuote"], message: "Allow at least Book Now or quote requests." });
};
export const CreateProviderServiceInput = ServiceFields.extend({ organizationId: Uuid }).superRefine(serviceRules);
export type CreateProviderServiceInput = z.input<typeof CreateProviderServiceInput>;
export const UpdateProviderServiceInput = ServiceFields.extend({ serviceId: Uuid }).superRefine(serviceRules);
export type UpdateProviderServiceInput = z.input<typeof UpdateProviderServiceInput>;
export const ServiceIdInput = z.object({ serviceId: Uuid });

export const AddServiceAreaInput = z
  .object({
    organizationId: Uuid,
    province: z.string().trim().min(2, "Enter the province (or Metro Manila).").max(100),
    cityMunicipality: z
      .string()
      .trim()
      .max(100)
      .default("")
      .transform((v) => v || null),
    barangay: z
      .string()
      .trim()
      .max(100)
      .default("")
      .transform((v) => v || null),
  })
  .refine((v) => !v.barangay || v.cityMunicipality, {
    path: ["cityMunicipality"],
    message: "Enter the city for this barangay.",
  });
export type AddServiceAreaInput = z.input<typeof AddServiceAreaInput>;
export const ServiceAreaIdInput = z.object({ areaId: Uuid });

export const CreatePortfolioItemInput = z.object({
  organizationId: Uuid,
  title: z.string().trim().min(2, "Name this project.").max(120),
  description: text(1000),
  categoryId: z
    .union([Uuid, z.literal(""), z.null()])
    .optional()
    .transform((v) => v || null),
  completedOn: OptionalIsoDate,
});
export type CreatePortfolioItemInput = z.input<typeof CreatePortfolioItemInput>;
export const PortfolioItemIdInput = z.object({ itemId: Uuid });

export const SearchProvidersInput = z.object({
  query: z.string().trim().max(80).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{2,60}$/)
    .optional(),
  division: Division.optional(),
  province: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  barangay: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
export type SearchProvidersInput = z.input<typeof SearchProvidersInput>;

export { RequiredIsoDate };

export const SetCapacityInput = z.object({
  organizationId: z.uuid(),
  capacity: z.coerce.number().int().min(1, "At least 1 job at a time.").max(50, "Up to 50 jobs at a time."),
});

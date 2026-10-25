import { z } from "zod";
import { Uuid } from "../common/primitives";

export const CALENDAR_CATEGORIES = ["bills", "assets", "pets", "vehicles", "bookings", "projects"] as const;
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

/** Calendar filters from the URL. Invalid values are dropped rather than failing the page. */
export const CalendarQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  category: optional(z.enum(CALENDAR_CATEGORIES)).catch(undefined),
  property: optional(Uuid).catch(undefined),
  member: optional(z.union([Uuid, z.literal("unassigned")])).catch(undefined),
  scope: z.enum(["household", "all"]).default("household").catch("household"),
});
export type CalendarQuery = z.output<typeof CalendarQuery>;

export const CALENDAR_ITEM_KEY = /^[a-z_]+:[0-9a-f-]{36}(:[0-9a-z_-]+)?$/;
export const AssignCalendarItemInput = z.object({
  householdId: Uuid,
  itemKey: z.string().regex(CALENDAR_ITEM_KEY, "Invalid calendar item."),
  userId: z.union([Uuid, z.literal(""), z.null()]).transform((v) => v || null),
});

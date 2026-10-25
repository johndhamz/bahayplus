import { z } from "zod";
import { Uuid } from "../common/primitives";

export const NOTIFICATION_CATEGORIES = [
  "bills",
  "assets",
  "pets",
  "vehicles",
  "bookings",
  "projects",
  "account",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
/** Channels a user can switch today. SMS and push have no delivery provider yet. */
export const CONFIGURABLE_CHANNELS = ["in_app", "email"] as const;

export const UpdatePreferencesInput = z.object({
  preferences: z
    .array(
      z.object({
        category: z.enum(NOTIFICATION_CATEGORIES),
        channel: z.enum(CONFIGURABLE_CHANNELS, { message: "SMS and push notifications aren't available yet." }),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(NOTIFICATION_CATEGORIES.length * CONFIGURABLE_CHANNELS.length),
});
export type UpdatePreferencesInput = z.input<typeof UpdatePreferencesInput>;

export const MarkReadInput = z.union([
  z.object({ notificationIds: z.array(Uuid).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
]);

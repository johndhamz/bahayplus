import {
  CONFIGURABLE_CHANNELS,
  MarkReadInput,
  NOTIFICATION_CATEGORIES,
  UpdatePreferencesInput,
  type NotificationCategory,
  type NotificationChannel,
} from "@bahayplus/validation/notifications/notifications";
import { err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "skipped" | "cancelled";
export type NotificationView = {
  id: string;
  kind: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  deliveries: { channel: NotificationChannel; status: DeliveryStatus; skipReason: string | null }[];
};

export async function listNotifications(
  ctx: ServiceContext,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<Result<NotificationView[]>> {
  let query = ctx.db
    .from("notifications")
    .select(
      "id, kind, category, title, body, link, read_at, created_at, notification_deliveries(channel, status, skip_reason)",
    )
    .eq("recipient_id", ctx.userId)
    .eq("show_in_inbox", true);
  if (options.unreadOnly) query = query.is("read_at", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(options.limit ?? 50);
  if (error) return err(mapDbError(error));
  return ok(
    (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      category: n.category as NotificationCategory,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.read_at,
      createdAt: n.created_at,
      deliveries: (n.notification_deliveries ?? []).map((d) => ({
        channel: d.channel as NotificationChannel,
        status: d.status as DeliveryStatus,
        skipReason: d.skip_reason,
      })),
    })),
  );
}

export async function countUnread(ctx: ServiceContext): Promise<number> {
  const { count } = await ctx.db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", ctx.userId)
    .eq("show_in_inbox", true)
    .is("read_at", null);
  return count ?? 0;
}

export async function markRead(ctx: ServiceContext, input: unknown): Promise<Result<{ updated: number }>> {
  const parsed = parseInput(MarkReadInput, input);
  if (!parsed.ok) return parsed;
  let query = ctx.db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);
  if ("notificationIds" in parsed.value) query = query.in("id", parsed.value.notificationIds);
  const { data, error } = await query.select("id");
  if (error) return err(mapDbError(error));
  return ok({ updated: data?.length ?? 0 });
}

export type PreferenceMatrix = Record<NotificationCategory, Record<NotificationChannel, boolean>>;

/** Defaults mirror private.preference_enabled: in-app and email on, SMS and push off. */
export const defaultPreference = (channel: NotificationChannel) => channel === "in_app" || channel === "email";

export async function getPreferences(ctx: ServiceContext): Promise<Result<PreferenceMatrix>> {
  const { data, error } = await ctx.db
    .from("notification_preferences")
    .select("category, channel, enabled")
    .eq("user_id", ctx.userId);
  if (error) return err(mapDbError(error));
  const matrix = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c, { in_app: true, email: true, sms: false, push: false }]),
  ) as PreferenceMatrix;
  for (const row of data ?? []) {
    const cat = matrix[row.category as NotificationCategory];
    if (cat) cat[row.channel as NotificationChannel] = row.enabled;
  }
  return ok(matrix);
}

export async function updatePreferences(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(UpdatePreferencesInput, input);
  if (!parsed.ok) return parsed;
  const rows = parsed.value.preferences
    .filter((p) => (CONFIGURABLE_CHANNELS as readonly string[]).includes(p.channel))
    .map((p) => ({ user_id: ctx.userId, category: p.category, channel: p.channel, enabled: p.enabled }));
  const { error } = await ctx.db
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,category,channel" });
  return error ? err(mapDbError(error)) : ok(true);
}

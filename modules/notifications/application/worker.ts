import type { Db } from "@bahayplus/modules/authorization";
import { DeliveryError, type ChannelAdapter, type ExternalChannel } from "../domain/channels";

export type ChannelRunStats = {
  channel: ExternalChannel;
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
  skipped: number;
};

/**
 * Drains one channel's queue (service-role client required). Each message is claimed with a visibility
 * timeout, so a crashed worker's messages reappear and are retried; the database decides whether a
 * delivery is still allowed (revoked access, cancellation, max attempts) before handing it out.
 */
export async function processChannel(
  admin: Db,
  channel: ExternalChannel,
  adapter: ChannelAdapter | null,
  options: { batch?: number; visibilitySeconds?: number } = {},
): Promise<ChannelRunStats> {
  const stats: ChannelRunStats = { channel, claimed: 0, sent: 0, retrying: 0, failed: 0, skipped: 0 };
  const { data, error } = await admin.rpc("claim_notification_deliveries", {
    p_channel: channel,
    p_batch: options.batch ?? 20,
    p_visibility_seconds: options.visibilitySeconds ?? 120,
  });
  if (error) throw new Error(`claim failed: ${error.message}`);
  for (const row of data ?? []) {
    stats.claimed++;
    if (!adapter) {
      await admin.rpc("skip_notification_delivery", {
        p_delivery: row.delivery_id,
        p_msg_id: row.msg_id,
        p_reason: "channel_not_configured",
      });
      stats.skipped++;
      continue;
    }
    try {
      const result = await adapter.send({
        deliveryId: row.delivery_id,
        attempt: row.attempt,
        to: row.email,
        title: row.title,
        body: row.body,
        link: row.link,
        kind: row.kind,
      });
      const done = await admin.rpc("complete_notification_delivery", {
        p_delivery: row.delivery_id,
        p_msg_id: row.msg_id,
        p_provider: adapter.provider,
        p_provider_message_id: result.providerMessageId ?? (undefined as unknown as string),
      });
      if (done.error) throw new Error(done.error.message);
      stats.sent++;
    } catch (e) {
      const retryable = e instanceof DeliveryError ? e.retryable : true;
      const message = e instanceof Error ? e.message : "Unknown delivery error";
      const { data: outcome } = await admin.rpc("fail_notification_delivery", {
        p_delivery: row.delivery_id,
        p_msg_id: row.msg_id,
        p_error: message,
        p_retryable: retryable,
      });
      if (outcome === "failed") stats.failed++;
      else stats.retrying++;
    }
  }
  return stats;
}

/** Runs `processChannel` in batches until the queue has nothing claimable or the time budget is spent. */
export async function drainChannel(
  admin: Db,
  channel: ExternalChannel,
  adapter: ChannelAdapter | null,
  options: { batch?: number; budgetMs?: number } = {},
): Promise<ChannelRunStats> {
  const batch = options.batch ?? 20;
  const deadline = Date.now() + (options.budgetMs ?? 20_000);
  const total: ChannelRunStats = { channel, claimed: 0, sent: 0, retrying: 0, failed: 0, skipped: 0 };
  while (Date.now() < deadline) {
    const run = await processChannel(admin, channel, adapter, { batch });
    for (const k of ["claimed", "sent", "retrying", "failed", "skipped"] as const) total[k] += run[k];
    if (run.claimed < batch) break;
  }
  return total;
}

import { NextResponse } from "next/server";
import { drainChannel, type ChannelRunStats } from "@bahayplus/modules/notifications";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { emailAdapter } from "@/lib/notifications/adapters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Notification delivery worker. Call every minute (Vercel Cron, pg_cron + pg_net, or any scheduler)
 * with `Authorization: Bearer <JOB_RUNNER_SECRET>`. It first runs the in-database reminder worker
 * (also scheduled by pg_cron), then drains the external channel queues. Overlapping runs are safe:
 * queue messages are claimed with a visibility timeout and deliveries are idempotent.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Not allowed." } }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const reminders = await admin.rpc("run_reminder_worker");
  if (reminders.error) console.error("[jobs] reminder worker failed", { code: reminders.error.code });
  const channels: ChannelRunStats[] = [];
  try {
    channels.push(await drainChannel(admin, "email", emailAdapter()));
    // No SMS or push provider is integrated: anything queued there is recorded as not configured.
    channels.push(await drainChannel(admin, "sms", null, { budgetMs: 5_000 }));
    channels.push(await drainChannel(admin, "push", null, { budgetMs: 5_000 }));
  } catch (e) {
    console.error("[jobs] delivery worker failed", { message: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Job failed." } }, { status: 500 });
  }
  return NextResponse.json({ data: { reminders: reminders.data ?? null, channels } });
}

/** Vercel Cron issues GET requests (with `Authorization: Bearer $CRON_SECRET`). */
export const GET = POST;

import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Fallback/manual trigger for the daily bills job (generation + reminders). The primary schedule is
 * pg_cron inside the database; both paths call the same idempotent function keyed by Manila date,
 * so overlapping triggers never duplicate work.
 */
export async function POST(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Not allowed." } }, { status: 401 });
  }
  const { data, error } = await createSupabaseAdminClient().rpc("run_daily_bill_jobs", {
    p_today: undefined as unknown as string,
  });
  if (error) {
    console.error("[jobs] daily-bills failed", { code: error.code });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Job failed." } }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** Vercel Cron issues GET requests (with `Authorization: Bearer $CRON_SECRET`). */
export const GET = POST;

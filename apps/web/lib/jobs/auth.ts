import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

const matches = (presented: string, secret: string | undefined) => {
  if (!secret) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Constant-time check of `Authorization: Bearer <secret>` for internal job endpoints. Accepts
 * JOB_RUNNER_SECRET (manual / pg_net triggers) or CRON_SECRET (Vercel Cron). Disabled when neither is set.
 */
export function isAuthorizedJobRequest(request: Request): boolean {
  const env = serverEnv();
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!presented) return false;
  return matches(presented, env.JOB_RUNNER_SECRET) || matches(presented, env.CRON_SECRET);
}

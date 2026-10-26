import "server-only";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Rule = { limit: number; windowSeconds: number };

/** Production limits. Local/test environments multiply them so automated suites aren't throttled. */
export const RATE_LIMITS = {
  loginByIp: { limit: 20, windowSeconds: 300 },
  loginByEmail: { limit: 8, windowSeconds: 900 },
  signupByIp: { limit: 5, windowSeconds: 3600 },
  passwordResetByIp: { limit: 5, windowSeconds: 3600 },
  passwordResetByEmail: { limit: 3, windowSeconds: 3600 },
  invitationsByUser: { limit: 30, windowSeconds: 3600 },
  mfaVerifyByUser: { limit: 10, windowSeconds: 900 },
} satisfies Record<string, Rule>;

/** Client IP as seen by Vercel's edge (first X-Forwarded-For hop), or "unknown". */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Consumes one hit for every key; returns false if any rule is exceeded. Fails open (logs) if the
 * limiter itself is unavailable, so an outage of the counter never locks everyone out.
 */
export async function withinRateLimits(checks: { bucket: keyof typeof RATE_LIMITS; key: string }[]): Promise<boolean> {
  const factor = ["local", "test"].includes(serverEnv().APP_ENV) ? 100 : 1;
  const admin = createSupabaseAdminClient();
  const results = await Promise.all(
    checks.map(async ({ bucket, key }) => {
      const rule = RATE_LIMITS[bucket];
      const { data, error } = await admin.rpc("consume_rate_limit", {
        p_bucket: bucket,
        p_key: key.toLowerCase(),
        p_limit: rule.limit * factor,
        p_window_seconds: rule.windowSeconds,
      });
      if (error) {
        console.error("[rate-limit] unavailable", { bucket, code: error.code });
        return true;
      }
      return data === true;
    }),
  );
  return results.every(Boolean);
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again." as const;

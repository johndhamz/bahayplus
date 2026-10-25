import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/** Constant-time check of `Authorization: Bearer <JOB_RUNNER_SECRET>` for internal job endpoints. */
export function isAuthorizedJobRequest(request: Request): boolean {
  const secret = serverEnv().JOB_RUNNER_SECRET;
  if (!secret) return false; // job endpoints are disabled until a secret is configured
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

"use server";

import { redirect } from "next/navigation";
import { loadPlatformAccess } from "@bahayplus/modules/authorization";
import { validationFailed, type ActionResult } from "@bahayplus/types/action-result";
import { VerifyMfaInput } from "@bahayplus/validation/identity/auth";
import { getServiceContext } from "@/lib/auth/context";
import { safeNextPath } from "@/lib/config/routes";
import { TOO_MANY, withinRateLimits } from "@/lib/security/rate-limit";

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string };

const notAllowed = (): ActionResult<never> => ({
  ok: false,
  error: { code: "FORBIDDEN", message: "Two-step verification is only available to Bahay+ admins." },
});

/** MFA is required for platform admins only; anyone else is refused (the page itself 404s). */
async function adminContext() {
  const ctx = await getServiceContext();
  if (!ctx) return null;
  const access = await loadPlatformAccess(ctx);
  return access.ok ? ctx : null;
}

/** Starts authenticator-app enrollment and returns the QR code and setup key to show once. */
export async function startTotpEnrollmentAction(): Promise<ActionResult<TotpEnrollment>> {
  const ctx = await adminContext();
  if (!ctx) return notAllowed();
  const { data: factors, error: listError } = await ctx.db.auth.mfa.listFactors();
  if (listError) return dependencyFailed("list", listError);
  // A verified factor can only be replaced from an aal2 session (by support), never from here.
  if (factors.totp.length > 0) {
    return {
      ok: false,
      error: { code: "CONFLICT", message: "An authenticator app is already set up. Reload the page." },
    };
  }
  // Abandoned attempts leave unverified factors behind; clear them so the new one can be enrolled.
  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await ctx.db.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await ctx.db.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Bahay+ Admin",
    issuer: "Bahay+",
  });
  if (error) return dependencyFailed("enroll", error);
  return { ok: true, data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

/** Verifies a code (first enrollment or a later sign-in) and upgrades the session to aal2. */
export async function verifyTotpAction(input: unknown): Promise<ActionResult> {
  const parsed = VerifyMfaInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const ctx = await adminContext();
  if (!ctx) return notAllowed();
  if (!(await withinRateLimits([{ bucket: "mfaVerifyByUser", key: ctx.userId }]))) {
    return { ok: false, error: { code: "RATE_LIMITED", message: TOO_MANY } };
  }
  const { error } = await ctx.db.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) {
    if (error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "That code didn't work.",
          fieldErrors: { code: "That code didn't work. Codes change every 30 seconds — check your phone's clock." },
        },
      };
    }
    if (error.status === 429) return { ok: false, error: { code: "RATE_LIMITED", message: TOO_MANY } };
    return dependencyFailed("verify", error);
  }
  redirect(safeNextPath(parsed.data.next, "/admin"));
}

function dependencyFailed(step: string, error: { code?: string; status?: number }): ActionResult<never> {
  console.error(`[mfa] ${step} failed`, { code: error.code, status: error.status });
  return {
    ok: false,
    error: { code: "DEPENDENCY_FAILED", message: "We couldn't complete two-step verification. Please try again." },
  };
}

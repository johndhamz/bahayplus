import type { z } from "zod";
import type { AppError, AppErrorCode, Result } from "@bahayplus/types/result";

/** Serializable result returned by every Server Action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      error: { code: AppErrorCode; message: string; reason?: string; fieldErrors?: Record<string, string> };
    };

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

export function validationFailed(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      message: "Please check the highlighted fields.",
      fieldErrors: zodFieldErrors(error),
    },
  };
}

export function fromAppError(error: AppError): ActionResult<never> {
  const fieldErrors =
    error.code === "VALIDATION_FAILED"
      ? Object.fromEntries(error.issues.map((i) => [i.path.join(".") || "_form", i.message]))
      : undefined;
  return { ok: false, error: { code: error.code, message: error.message, reason: error.reason, fieldErrors } };
}

export function fromResult<T>(result: Result<T>, message?: string): ActionResult<T> {
  return result.ok ? { ok: true, data: result.value, message } : fromAppError(result.error);
}

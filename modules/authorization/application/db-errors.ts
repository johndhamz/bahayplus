import { appError, type AppError } from "@bahayplus/types/result";

type PostgrestLikeError = { code?: string; message?: string; details?: string | null; hint?: string | null };

const VALIDATION = new Set(["invalid_input", "invalid_role"]);
const FORBIDDEN = new Set(["forbidden", "role_escalation"]);
const CONFLICT = new Set([
  "last_owner",
  "duplicate_invitation",
  "already_member",
  "invitation_invalid",
  "invitation_used",
  "invitation_expired",
  "invitation_email_mismatch",
  "invitation_not_pending",
  "email_unverified",
  "slug_taken",
  "limit_reached",
  "property_archived",
  "amount_required",
  "already_paid",
  "overpayment",
  "duplicate_bill",
  "verification_open",
  "invalid_transition",
  "review_not_eligible",
  "duplicate_review",
  "review_locked",
]);

/**
 * Maps database errors to AppError. Business errors raised by our SQL functions use SQLSTATE P0001,
 * a stable key in `message` and a user-facing sentence in `details`.
 */
export function mapDbError(error: PostgrestLikeError): AppError {
  const key = error.message ?? "";
  const human = error.details ?? undefined;
  if (error.code === "P0001") {
    if (key === "unauthenticated") return appError.unauthenticated(human);
    if (key === "idempotency_mismatch")
      return {
        code: "IDEMPOTENCY_MISMATCH",
        message: human ?? "This request was already submitted with different details.",
        reason: key,
      };
    if (key === "not_found") return appError.notFound(human, key);
    if (FORBIDDEN.has(key)) return appError.forbidden(human, key);
    if (VALIDATION.has(key))
      return { code: "VALIDATION_FAILED", message: human ?? "Please check your input.", issues: [], reason: key };
    if (CONFLICT.has(key)) return appError.conflict(human ?? "That change conflicts with the current state.", key);
  }
  // 42501: insufficient_privilege (RLS / grants). PGRST116: no rows for .single().
  if (error.code === "42501") return appError.forbidden(undefined, "rls_denied");
  if (error.code === "PGRST116") return appError.notFound();
  if (error.code === "23505") return appError.conflict("That already exists.", "unique_violation");
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") {
    return { code: "VALIDATION_FAILED", message: "Please check your input.", issues: [], reason: "constraint" };
  }
  return appError.internal();
}

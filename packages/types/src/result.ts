export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type FieldIssue = { path: (string | number)[]; message: string };

export type AppError =
  | { code: "VALIDATION_FAILED"; message: string; issues: FieldIssue[] }
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "IDEMPOTENCY_MISMATCH"; message: string }
  | { code: "RATE_LIMITED"; message: string; retryAfterSeconds: number }
  | { code: "DEPENDENCY_FAILED"; message: string }
  | { code: "INTERNAL"; message: string };

export type AppErrorCode = AppError["code"];

export const appError = {
  validation: (issues: FieldIssue[], message = "Please check the highlighted fields."): AppError => ({
    code: "VALIDATION_FAILED",
    message,
    issues,
  }),
  unauthenticated: (message = "Please sign in to continue."): AppError => ({ code: "UNAUTHENTICATED", message }),
  forbidden: (message = "You don't have permission to do that."): AppError => ({ code: "FORBIDDEN", message }),
  notFound: (message = "We couldn't find what you were looking for."): AppError => ({ code: "NOT_FOUND", message }),
  conflict: (message: string): AppError => ({ code: "CONFLICT", message }),
  internal: (message = "Something went wrong. Please try again."): AppError => ({ code: "INTERNAL", message }),
};

export const HTTP_STATUS: Record<AppErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 409,
  RATE_LIMITED: 429,
  DEPENDENCY_FAILED: 502,
  INTERNAL: 500,
};

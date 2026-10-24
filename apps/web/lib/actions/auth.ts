"use server";

import { redirect } from "next/navigation";
import { AUTH_ROUTES, safeNextPath } from "@/lib/config/routes";
import { ForgotPasswordInput, LoginInput, ResetPasswordInput, SignupInput } from "@bahayplus/validation/identity/auth";
import { validationFailed, type ActionResult } from "@bahayplus/types/action-result";
import { publicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = LoginInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        error: { code: "FORBIDDEN", message: "Please verify your email first. Check your inbox for the link we sent." },
      };
    }
    // Same message for unknown email and wrong password (no account enumeration).
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Email or password is incorrect." } };
  }
  redirect(safeNextPath(parsed.data.next, "/app"));
}

export async function signupAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = SignupInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);

  const supabase = await createSupabaseServerClient();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${site}${AUTH_ROUTES.confirm}?next=/app`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) {
    if (error.code === "weak_password") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Please choose a stronger password.",
          fieldErrors: { password: "This password is too weak or has appeared in a data breach." },
        },
      };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        ok: false,
        error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." },
      };
    }
    return { ok: false, error: { code: "INTERNAL", message: "We couldn't create your account. Please try again." } };
  }
  // Supabase returns success for existing emails too (no enumeration); the email decides what happens.
  return { ok: true, data: { email: parsed.data.email } };
}

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = ForgotPasswordInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createSupabaseServerClient();
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}${AUTH_ROUTES.confirm}?next=${AUTH_ROUTES.resetPassword}`,
  });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return {
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a minute and try again." },
    };
  }
  // Always the same response, whether or not the email exists.
  return { ok: true, data: undefined, message: "If an account exists for that email, we've sent a reset link." };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = ResetPasswordInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Your reset link has expired. Please request a new one." },
    };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Choose a new password.",
          fieldErrors: { password: "Use a password you haven't used here before." },
        },
      };
    }
    if (error.code === "weak_password") {
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Please choose a stronger password.",
          fieldErrors: { password: "This password is too weak." },
        },
      };
    }
    return { ok: false, error: { code: "INTERNAL", message: "We couldn't update your password. Please try again." } };
  }
  return { ok: true, data: undefined, message: "Your password has been updated." };
}

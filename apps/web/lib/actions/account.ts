"use server";

import { revalidatePath } from "next/cache";
import { updateMyProfile } from "@bahayplus/modules/identity";
import { ChangePasswordInput } from "@bahayplus/validation/identity/auth";
import { fromResult, validationFailed, type ActionResult } from "@bahayplus/types/action-result";
import { getServiceContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updateProfileAction(input: unknown): Promise<ActionResult<true>> {
  const ctx = await getServiceContext();
  if (!ctx) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again." } };
  const result = await updateMyProfile(ctx, input);
  if (result.ok) revalidatePath("/account");
  return result.ok ? { ok: true, data: true, message: "Profile saved." } : fromResult(result);
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = ChangePasswordInput.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error);
  const ctx = await getServiceContext();
  if (!ctx) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again." } };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "Use a password you haven't used here before."
        : error.code === "weak_password"
          ? "This password is too weak."
          : "We couldn't update your password. Please try again.";
    return { ok: false, error: { code: "VALIDATION_FAILED", message, fieldErrors: { password: message } } };
  }
  return { ok: true, data: undefined, message: "Password updated." };
}

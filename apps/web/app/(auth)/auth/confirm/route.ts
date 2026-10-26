import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "email_change", "invite", "magiclink"]);

/**
 * Verifies email links (signup confirmation, password recovery, email change).
 * - `token_hash` (our custom templates): verified here; works on any device.
 * - `code` (Supabase's default templates, e.g. free-tier projects on the built-in sender): Supabase has
 *   already verified the email before redirecting; we exchange the PKCE code for a session. On a different
 *   device the code verifier cookie is missing, so the user is asked to log in instead of seeing an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/app");

  if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const target = error
      ? next === "/reset-password"
        ? "/forgot-password?error=link_device"
        : "/login?verified=1"
      : next;
    const response = NextResponse.redirect(new URL(target, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
}

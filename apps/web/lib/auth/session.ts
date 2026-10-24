import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginRedirectPath } from "@/lib/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * The verified current user for this request (deduplicated per render with React `cache`).
 * Uses getUser(), which validates the session with Supabase Auth — never trust getSession() on the server.
 *
 * Deliberately NOT wrapped in try/catch: reading cookies() must be allowed to opt the route into
 * dynamic rendering, and configuration errors must surface instead of silently logging users out.
 * An unreachable Auth server returns an error object (not a throw) and fails closed to `null`.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

/** Server-side gate for protected layouts/pages; complements the proxy redirect. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(returnTo));
  return user;
}

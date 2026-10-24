import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath, loginRedirectPath } from "@/lib/config/routes";
import type { Database } from "@bahayplus/types/database";

/**
 * Refreshes the Supabase session cookie and applies the coarse portal gate.
 * Fine-grained authorization (membership, roles) happens in portal layouts, services and RLS.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const protectedPath = isProtectedPath(request.nextUrl.pathname);

  let userId: string | null = null;
  if (url && key) {
    const supabase = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
        },
      },
    });
    try {
      // getClaims() verifies the JWT; do not replace with getSession() (unverified).
      const { data } = await supabase.auth.getClaims();
      userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    } catch {
      userId = null; // Auth unreachable: fail closed for protected routes.
    }
  }

  if (protectedPath && !userId) {
    const redirect = NextResponse.redirect(
      new URL(loginRedirectPath(request.nextUrl.pathname, request.nextUrl.search), request.url),
    );
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (protectedPath) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

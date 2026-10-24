export const PORTALS = ["app", "provider", "supplier", "worker", "admin"] as const;
export type Portal = (typeof PORTALS)[number];

export const PORTAL_HOME: Record<Portal, `/${Portal}`> = {
  app: "/app",
  provider: "/provider",
  supplier: "/supplier",
  worker: "/worker",
  admin: "/admin",
};

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  callback: "/auth/callback",
  confirm: "/auth/confirm",
} as const;

/** Returns the portal a pathname belongs to, or null for public paths. Matches whole segments only. */
export function portalOf(pathname: string): Portal | null {
  const first = pathname.split("/")[1] ?? "";
  return (PORTALS as readonly string[]).includes(first) ? (first as Portal) : null;
}

export function isProtectedPath(pathname: string): boolean {
  return portalOf(pathname) !== null || pathname === "/account" || pathname.startsWith("/account/");
}

/** Only allow same-origin relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://placeholder.local");
    if (url.origin !== "http://placeholder.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginRedirectPath(pathname: string, search = ""): string {
  return `${AUTH_ROUTES.login}?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

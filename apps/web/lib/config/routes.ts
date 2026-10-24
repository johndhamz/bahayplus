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

const PROTECTED_PREFIXES = ["/account", "/invite"];

export function isProtectedPath(pathname: string): boolean {
  return portalOf(pathname) !== null || PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Cookies remembering the last context opened per portal (a convenience only — always re-authorized). */
export const LAST_CONTEXT_COOKIE = {
  app: "bp_last_household",
  provider: "bp_last_provider",
  supplier: "bp_last_supplier",
} as const;

const CONTEXT_PATH =
  /^\/(app\/h|provider\/o|supplier\/o)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

/** Extracts the context id from a tenant-scoped path, e.g. /app/h/{id}/bills → { cookie, id }. */
export function contextFromPath(pathname: string): { cookie: string; id: string } | null {
  const match = CONTEXT_PATH.exec(pathname);
  if (!match) return null;
  const portal = match[1] === "app/h" ? "app" : match[1] === "provider/o" ? "provider" : "supplier";
  return { cookie: LAST_CONTEXT_COOKIE[portal], id: match[2]!.toLowerCase() };
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

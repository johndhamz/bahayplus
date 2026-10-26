import { describe, expect, it } from "vitest";
import { isNavActive, navHref, PORTAL_NAV } from "@/lib/config/navigation";
import { isProtectedPath, loginRedirectPath, portalOf, safeNextPath } from "@/lib/config/routes";

describe("route protection", () => {
  it.each(["/app", "/app/bills", "/provider", "/supplier/x", "/worker", "/admin/users", "/account", "/mfa"])(
    "%s is protected",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each(["/", "/login", "/signup", "/apple", "/administrator", "/preview", "/workers"])("%s is public", (path) =>
    expect(isProtectedPath(path)).toBe(false),
  );

  it("identifies the portal by whole path segment", () => {
    expect(portalOf("/provider/bookings")).toBe("provider");
    expect(portalOf("/providers")).toBeNull();
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/app/bills?x=1#top")).toBe("/app/bills?x=1#top");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %s",
    (value) => expect(safeNextPath(value as string | null | undefined, "/app")).toBe("/app"),
  );

  it("builds encoded login redirects", () => {
    expect(loginRedirectPath("/app/bills", "?a=1")).toBe("/login?next=%2Fapp%2Fbills%3Fa%3D1");
  });
});

describe("navigation", () => {
  it("builds hrefs from a context base path", () => {
    expect(navHref("/app", "")).toBe("/app");
    expect(navHref("/app/", "bills")).toBe("/app/bills");
  });

  it("marks home active only on exact match and sections on descendants", () => {
    expect(isNavActive("/app", "/app", "")).toBe(true);
    expect(isNavActive("/app/bills", "/app", "")).toBe(false);
    expect(isNavActive("/app/bills/123", "/app", "bills")).toBe(true);
    expect(isNavActive("/app/billsx", "/app", "bills")).toBe(false);
  });

  it("gives mobile-first portals at most four primary tabs", () => {
    for (const portal of ["app", "worker"] as const) {
      const primary = PORTAL_NAV[portal].flatMap((s) => s.items).filter((i) => i.primary);
      expect(primary.length).toBeGreaterThan(0);
      expect(primary.length).toBeLessThanOrEqual(4);
    }
  });

  it("has unique paths per portal", () => {
    for (const sections of Object.values(PORTAL_NAV)) {
      const paths = sections.flatMap((s) => s.items.map((i) => i.path));
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});

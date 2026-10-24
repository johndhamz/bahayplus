import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page shows the brand, tagline and auth entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Everything home. One app." })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Bahay+" })).toBeVisible();
    await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("signup page validates on the client before calling the server", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /full name/i })).toHaveAttribute("aria-invalid", "true");
  });

  test("unknown routes return the not-found page", async ({ page }) => {
    const response = await page.goto("/this-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("protected portals", () => {
  for (const portal of ["app", "provider", "supplier", "worker", "admin"]) {
    test(`/${portal} redirects anonymous visitors to login and preserves the destination`, async ({ page }) => {
      await page.goto(`/${portal}`);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=%2F${portal}$`));
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    });

    test(`/${portal} deep links are protected and never render portal content`, async ({ page, request }) => {
      const res = await request.get(`/${portal}/settings`, { maxRedirects: 0 });
      expect([307, 308]).toContain(res.status());
      expect(res.headers()["location"]).toContain(`/login?next=%2F${portal}%2Fsettings`);
      expect(res.headers()["cache-control"]).toContain("no-store");
      await page.goto(`/${portal}/settings`);
      await expect(page.locator("[data-portal]")).toHaveCount(0);
    });
  }

  test("login rejects open-redirect targets in ?next", async ({ page }) => {
    await page.goto("/login?next=https://evil.example");
    const hidden = await page.evaluate(() => document.querySelector("form")?.outerHTML ?? "");
    expect(hidden).not.toContain("evil.example");
  });
});

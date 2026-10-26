import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { adminClient } from "../support/supabase";
import { DEMO_ADMIN_TOTP_SECRET } from "../support/totp";
import {
  createConfirmedAdmin,
  createConfirmedUser,
  DEMO,
  DEMO_IDS,
  DEMO_PASSWORD,
  login,
  logout,
  passMfa,
} from "./support/auth";
import { latestLink } from "./support/mailpit";

// Auth journeys hit the real local Supabase; run them once (desktop + one phone).
test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "auth journeys run on two viewports");
});

test("sign up → verify email → create household → sign out", { tag: "@smoke" }, async ({ page, baseURL }) => {
  const email = `e2e-${randomUUID().slice(0, 8)}@bahayplus.test`;
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /full name/i }).fill("E2E Tester");
  await page.getByRole("textbox", { name: /^email/i }).fill(email);
  await page.getByLabel(/^password/i).fill("correct-horse-battery");
  await page.getByLabel(/confirm password/i).fill("correct-horse-battery");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible({ timeout: 20_000 });

  // Unverified users cannot sign in.
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(/verify your email/i);

  const link = await latestLink(email, /confirm/i, "/auth/confirm", baseURL!);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Set up your household" })).toBeVisible();
  await page.getByRole("textbox", { name: /household name/i }).fill("E2E Household");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: /Current: E2E Household/ })).toBeVisible();

  await logout(page);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
});

test("password reset via emailed link", async ({ page, baseURL }) => {
  // A throwaway confirmed user per run, so parallel projects never share an account.
  const email = await createConfirmedUser("reset");
  const temporary = `Reset-${randomUUID().slice(0, 12)}`;
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(/reset link/i, { timeout: 20_000 });
  const link = await latestLink(email, /reset/i, "/auth/confirm", baseURL!);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  // Re-using the current password is refused by Supabase Auth.
  await page.getByLabel(/^new password/i).fill(DEMO_PASSWORD);
  await page.getByLabel(/confirm new password/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(/haven't used/i);

  await page.getByLabel(/^new password/i).fill(temporary);
  await page.getByLabel(/confirm new password/i).fill(temporary);
  await page.getByRole("button", { name: "Update password" }).click();
  // New user without a household lands on household onboarding.
  await expect(page.getByRole("heading", { name: "Set up your household" })).toBeVisible({ timeout: 20_000 });
  await logout(page);
  await login(page, email, temporary);
  await expect(page.getByRole("heading", { name: "Set up your household" })).toBeVisible();
});

test("wrong password shows a generic error (no account enumeration)", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(DEMO.owner);
  await page.getByLabel(/^password/i).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
});

test("login returns to the protected page that was requested", async ({ page }) => {
  await login(page, DEMO.owner, undefined, `/app/h/${DEMO_IDS.delaCruzHousehold}/members`);
  await expect(page).toHaveURL(new RegExp(`/app/h/${DEMO_IDS.delaCruzHousehold}/members$`));
});

test("users cannot open households they don't belong to", async ({ page }) => {
  await login(page, DEMO.owner);
  const response = await page.goto(`/app/h/${DEMO_IDS.santosHousehold}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  const malformed = await page.goto("/app/h/not-a-uuid");
  expect(malformed?.status()).toBe(404);
});

test("a user with multiple households can switch context", async ({ page }) => {
  await login(page, DEMO.member);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/h\//);
  const switcher = page.getByRole("button", { name: /^Current:/ });
  await switcher.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /Dela Cruz Household/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /Santos Household/ })).toBeVisible();
  await menu.getByRole("menuitem", { name: /Santos Household/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/h/${DEMO_IDS.santosHousehold}$`));
  await expect(page.getByRole("button", { name: /Current: Santos Household/ })).toContainText("Guest");
  // The last-used household is remembered (and re-authorized) on the next visit.
  await page.goto("/app");
  await expect(page).toHaveURL(new RegExp(`/app/h/${DEMO_IDS.santosHousehold}$`));
});

test("platform admin portal is invisible to non-admins and needs two-step verification for admins", async ({
  page,
}) => {
  await login(page, DEMO.owner);
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.goto("/mfa"))?.status()).toBe(404);
  await page.goto("/app");
  await logout(page);

  // A correct password alone only reaches the code prompt.
  await login(page, DEMO.admin, undefined, "/admin");
  await expect(page).toHaveURL(/\/mfa\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "Two-step verification" })).toBeVisible();
  await page.getByLabel("Authentication code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText(/That code didn.t work/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/mfa/);

  await passMfa(page, DEMO_ADMIN_TOTP_SECRET);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
});

test("a new admin sets up an authenticator app before opening the admin portal", async ({ page }) => {
  const admin = await createConfirmedAdmin("mfa-enroll");
  try {
    await login(page, admin.email, undefined, "/admin");
    await expect(page).toHaveURL(/\/mfa/);
    await page.getByRole("button", { name: "Set up authenticator app" }).click();
    await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
    const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual(
      [],
    );
    await passMfa(page, secret);
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

    // The next sign-in asks for a code instead of offering enrollment again.
    await logout(page);
    await login(page, admin.email, undefined, "/admin");
    await expect(page.getByRole("button", { name: "Set up authenticator app" })).toHaveCount(0);
    await passMfa(page, secret);
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    await adminClient().auth.admin.deleteUser(admin.id);
  }
});

test("business portals are scoped to the organization and role", { tag: "@smoke" }, async ({ page }) => {
  await login(page, DEMO.provider, undefined, "/provider");
  await expect(page).toHaveURL(new RegExp(`/provider/o/${DEMO_IDS.mabuhayProvider}$`));
  await expect(page.getByRole("button", { name: /Current: Mabuhay Home Services/ })).toBeVisible();
  expect((await page.goto(`/supplier/o/${DEMO_IDS.bayanihanSupplier}`))?.status()).toBe(404);
  await page.goto("/provider");
  await logout(page);

  // Workers are sent to the worker portal instead of the business back-office.
  await login(page, DEMO.worker, undefined, `/provider/o/${DEMO_IDS.mabuhayProvider}`);
  await expect(page).toHaveURL(/\/worker$/);
});

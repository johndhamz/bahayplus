import { expect, test, type Page } from "@playwright/test";
import { loadLocalEnv } from "../support/env";
import { adminClient } from "../support/supabase";
import { createConfirmedUser, DEMO, DEMO_IDS, login, logout } from "./support/auth";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n");

async function registerProvider(page: Page, name: string) {
  await login(page, await createConfirmedUser("provider"), undefined, "/provider");
  await page.getByRole("textbox", { name: /business name/i }).fill(name);
  await page.getByRole("button", { name: "Register business" }).click();
  await expect(page).toHaveURL(/\/provider\/o\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return new URL(page.url()).pathname;
}

test("provider onboarding → admin approval → customer discovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(180_000);
  const name = `E2E Plumbing ${Date.now().toString(36)}`;
  const base = await registerProvider(page, name);
  await expect(page.getByRole("region", { name: "Marketplace summary" })).toContainText("Not listed");

  // Profile.
  await page.goto(`${base}/profile`);
  await page.getByRole("textbox", { name: /tagline/i }).fill("Fast leak repair in Pasig");
  await page.getByRole("textbox", { name: /^phone/i }).fill("+63 917 555 0101");
  await page.getByRole("checkbox", { name: /publish my profile/i }).check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Service with validation.
  await page.goto(`${base}/services`);
  const add = page.getByRole("region", { name: "Add a service" });
  await add.getByRole("textbox", { name: /service name/i }).fill("Leak repair");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(add.getByText("Enter a price.")).toBeVisible();
  await add.getByRole("textbox", { name: /^price/i }).fill("850");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByRole("region", { name: "Your services" })).toContainText("₱850.00");

  // Coverage.
  await page.goto(`${base}/coverage`);
  await page.getByRole("textbox", { name: /^province/i }).fill("Metro Manila");
  await page.getByRole("textbox", { name: /city/i }).fill("City of Pasig");
  await page.getByRole("button", { name: "Add area" }).click();
  await expect(page.getByRole("region", { name: "Areas you serve" })).toContainText("City of Pasig, Metro Manila");

  // Verification + document upload.
  await page.goto(`${base}/verification`);
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Submitted — waiting for review")).toBeVisible({ timeout: 20_000 });
  await page
    .getByLabel("Upload document")
    .first()
    .setInputFiles({ name: "dti.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("1 file uploaded").first()).toBeVisible({ timeout: 20_000 });
  await logout(page);

  // Admin approves (DTI verified, Mayor's permit not).
  await login(page, DEMO.admin, undefined, "/admin/verifications");
  await page
    .getByRole("region", { name: "Waiting for review" })
    .getByRole("link", { name: new RegExp(name) })
    .click();
  await page.getByRole("button", { name: "Start review" }).click();
  const decision = page.getByRole("region", { name: "Decision" });
  await decision
    .getByRole("group", { name: /mark each document/i })
    .getByRole("radio", { name: "Verified" })
    .first()
    .check();
  await decision
    .getByRole("textbox", { name: /message to the provider/i })
    .fill("DTI verified. Upload your current Mayor's permit next time.");
  await decision.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("button", { name: "Revoke verification" })).toBeVisible({ timeout: 20_000 });
  await logout(page);

  // A customer in Pasig finds the provider; the badge names only what was verified.
  await login(page, await createConfirmedUser("customer"));
  await page.getByRole("textbox", { name: /household name/i }).fill("Customer E2E");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\//, { timeout: 30_000 });
  const home = new URL(page.url()).pathname;
  await page.goto(`${home}/properties/new`);
  await page.getByRole("textbox", { name: /property name/i }).fill("Pasig home");
  await page.getByRole("textbox", { name: /city or municipality/i }).fill("Pasig City");
  await page.getByRole("textbox", { name: /^province/i }).fill("Metro Manila");
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByRole("heading", { name: "Pasig home", level: 1 })).toBeVisible();

  await page.goto(`${home}/services?q=${encodeURIComponent(name)}`);
  const providers = page.getByRole("region", { name: "Providers" });
  await expect(providers.getByRole("heading", { name })).toBeVisible();
  await expect(providers).toContainText("Checked: Business registration");
  await expect(providers).not.toContainText("Mayor's");
  // Location filter: a Makati-only search would exclude it; "Anywhere" includes it.
  await providers.getByRole("link", { name }).click();
  await expect(page.getByRole("region", { name: "What Bahay+ verified" })).toContainText("Business registration");
  await expect(page.getByRole("region", { name: "What Bahay+ verified" })).not.toContainText("Mayor");
  await expect(page.getByRole("region", { name: "Contact" })).toContainText("+63 917 555 0101");
  // Book Now was never enabled for this provider, so only quote requests are offered.
  await expect(page.getByRole("link", { name: "Request quote" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book now" })).toHaveCount(0);
});

test("customers can review a completed booking once", async ({ page }) => {
  // Fresh household + a completed booking with the demo provider, so the test is repeatable.
  await login(page, await createConfirmedUser("reviewer"));
  await page.getByRole("textbox", { name: /household name/i }).fill("Reviewer E2E");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\//, { timeout: 30_000 });
  const householdId = new URL(page.url()).pathname.split("/")[3]!;
  loadLocalEnv();
  const { error } = await adminClient().from("bookings").insert({
    household_id: householdId,
    organization_id: DEMO_IDS.mabuhayProvider,
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  expect(error).toBeNull();

  await page.goto(`/app/h/${householdId}/services`);
  const reviews = page.getByRole("region", { name: "Rate your recent services" });
  await reviews.getByRole("button", { name: "Submit review" }).click();
  await expect(reviews.getByRole("alert")).toContainText(/rating/i);
  await reviews.getByText("4 stars").click({ force: true });
  const comment = `Fixed our sink quickly ${Date.now().toString(36)}`;
  await reviews.getByRole("textbox", { name: /comment/i }).fill(comment);
  await reviews.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Thanks for your review!")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Rate your recent services" })).toHaveCount(0);
  await page.goto(`/app/h/${householdId}/services/providers/mabuhay-home-services-demo`);
  await expect(page.getByRole("region", { name: "Reviews" })).toContainText(comment);
});

test("unlisted providers cannot be opened by customers", async ({ page }) => {
  await login(
    page,
    DEMO.owner,
    undefined,
    `/app/h/${DEMO_IDS.delaCruzHousehold}/services/providers/does-not-exist-xyz`,
  );
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

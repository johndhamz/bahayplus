import { expect, test } from "@playwright/test";
import { expect as baseExpect, type Page } from "@playwright/test";
import { createConfirmedUser, DEMO, DEMO_IDS, login } from "./support/auth";

async function expectNotFound(page: Page) {
  await baseExpect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await baseExpect(page.locator("form")).toHaveCount(0);
  await baseExpect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
}

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(
    !["desktop", "mobile-375"].includes(testInfo.project.name),
    "household journeys run on desktop and the narrowest phone",
  );
});

test("owner manages properties: validate, add, edit, default, archive, restore", async ({ page }) => {
  const email = await createConfirmedUser("props");
  await login(page, email);
  await page.getByRole("textbox", { name: /household name/i }).fill("Properties E2E");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const base = new URL(page.url()).pathname;

  // Household with no properties.
  await expect(page.getByText("No properties yet")).toBeVisible();
  await page.getByRole("link", { name: "Add property" }).first().click();
  await expect(page.getByRole("heading", { name: "Add property", level: 1 })).toBeVisible();

  // Validation messages.
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByText("Give this property a name.")).toBeVisible();
  await expect(page.getByText("Enter the city or municipality.")).toBeVisible();
  await page.getByRole("textbox", { name: /property name/i }).fill("Family home");
  await page.getByRole("textbox", { name: /city or municipality/i }).fill("Quezon City");
  await page.getByRole("textbox", { name: /^province/i }).fill("Metro Manila");
  await page.getByRole("textbox", { name: /postal code/i }).fill("12");
  await page.getByRole("textbox", { name: /latitude/i }).fill("14.65");
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByText("Philippine postal codes have 4 digits.")).toBeVisible();
  await expect(page.getByText(/Enter both latitude and longitude/)).toBeVisible();
  await page.getByRole("textbox", { name: /postal code/i }).fill("1101");
  await page.getByRole("textbox", { name: /longitude/i }).fill("121.03");
  await page.getByRole("textbox", { name: /barangay/i }).fill("Malaya");
  await page.getByRole("button", { name: "Add property" }).click();

  await expect(page.getByRole("heading", { name: "Family home", level: 1 })).toBeVisible();
  await expect(page.getByText("Default property", { exact: true })).toBeVisible();

  // Edit.
  await page.getByRole("textbox", { name: /property name/i }).fill("Family home (QC)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Family home (QC)", level: 1 })).toBeVisible();

  // Second property, make it default.
  await page.goto(`${base}/properties/new`);
  await page.getByRole("textbox", { name: /property name/i }).fill("BGC condo");
  await page.getByRole("combobox", { name: /type/i }).selectOption("condominium");
  await page.getByRole("textbox", { name: /city or municipality/i }).fill("Taguig");
  await page.getByRole("textbox", { name: /^province/i }).fill("Metro Manila");
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByRole("heading", { name: "BGC condo", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Make default" }).click();
  await expect(page.getByText("Default property", { exact: true })).toBeVisible();

  // Archive (with confirmation) and restore.
  await page.getByRole("button", { name: "Archive" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("It will stop being your default property.");
  await dialog.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived properties are read-only")).toBeVisible();
  await page.goto(`${base}/properties`);
  await expect(page.getByRole("link", { name: /BGC condo/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Archived \(1\)/ }).click();
  await page.getByRole("link", { name: /BGC condo/ }).click();
  await page.getByRole("button", { name: "Restore property" }).click();
  await expect(page.getByRole("button", { name: "Make default" })).toBeVisible();

  // Dashboard shows properties and activity.
  await page.goto(base);
  await expect(page.getByRole("region", { name: "Properties" }).getByRole("link")).toHaveCount(3); // 2 cards + "All properties"
  await expect(page.getByRole("region", { name: "Recent activity" })).toContainText("Restored property “BGC condo”");
});

test("owner invites members; duplicates are rejected and the link is shown once", async ({ page }) => {
  const email = await createConfirmedUser("invites");
  await login(page, email);
  await page.getByRole("textbox", { name: /household name/i }).fill("Invites E2E");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\//);
  await page.goto(`${new URL(page.url()).pathname}/members`);

  const invitee = `invitee-${Date.now()}@bahayplus.test`;
  await page.getByRole("textbox", { name: /email address/i }).fill(invitee);
  await page.getByRole("combobox", { name: /role/i }).selectOption("manager");
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByRole("textbox", { name: "Invitation link" })).toHaveValue(
    /\/invite\/household\?token=[A-Za-z0-9_-]{43}$/,
  );
  await expect(page.getByRole("region", { name: "Invitations" })).toContainText(invitee);

  await page.getByRole("textbox", { name: /email address/i }).fill(invitee);
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: "pending invitation" })).toBeVisible();

  // Revoke.
  await page.getByRole("region", { name: "Invitations" }).getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel invitation" }).click();
  await expect(page.getByRole("region", { name: "Invitations" })).toContainText("Revoked");
});

test("a guest sees only household basics", async ({ page }) => {
  await login(page, DEMO.member, undefined, `/app/h/${DEMO_IDS.santosHousehold}`);
  await expect(page.getByRole("button", { name: /Current: Santos Household/ })).toContainText("Guest");
  await expect(page.getByRole("region", { name: "Properties" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Members" })).toHaveCount(0);
  // Nested pages stream behind the household loading boundary, so Next sends the not-found UI with
  // HTTP 200 + noindex; what matters is that no protected content is rendered.
  for (const path of ["properties", "members"]) {
    await page.goto(`/app/h/${DEMO_IDS.santosHousehold}/${path}`);
    await expectNotFound(page);
  }
});

test("a member can view but not manage properties", async ({ page }) => {
  await login(page, DEMO.member, undefined, `/app/h/${DEMO_IDS.delaCruzHousehold}/properties`);
  await expect(page.getByRole("link", { name: /Family home/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add property" })).toHaveCount(0);
  await page.getByRole("link", { name: /Family home/ }).click();
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /property name/i })).toHaveCount(0);
  await page.goto(`/app/h/${DEMO_IDS.delaCruzHousehold}/properties/new`);
  await expectNotFound(page);
});

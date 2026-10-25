import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, login } from "./support/auth";

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(
    !["desktop", "mobile-390"].includes(testInfo.project.name),
    "registry journeys run on desktop and one phone",
  );
});

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00,
]);

async function newHousehold(page: Page, name: string) {
  await login(page, await createConfirmedUser("registry"));
  await page.getByRole("textbox", { name: /household name/i }).fill(name);
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return new URL(page.url()).pathname;
}

test("assets: add with warranty, log maintenance, upload a receipt, archive", async ({ page }) => {
  const base = await newHousehold(page, "Assets E2E");
  await page.goto(`${base}/assets`);
  await expect(page.getByText("No items yet")).toBeVisible();
  await page.goto(`${base}/assets/new`);

  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Give this item a name.")).toBeVisible();
  await page.getByRole("textbox", { name: /^name/i }).fill("Sala aircon");
  await page.getByRole("combobox", { name: /category/i }).selectOption("aircon");
  await page.getByLabel(/purchase date/i).fill("2026-05-01");
  await page.getByLabel(/warranty ends/i).fill("2026-04-01");
  await page.getByRole("textbox", { name: /purchase price/i }).fill("32,999.50");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Warranty can't end before the purchase date.")).toBeVisible();
  await page.getByLabel(/warranty ends/i).fill("2031-05-01");
  await page.getByRole("textbox", { name: /maintenance every/i }).fill("6");
  await page.getByRole("button", { name: "Add item" }).click();

  await expect(page.getByRole("heading", { name: "Sala aircon", level: 1 })).toBeVisible();
  await expect(page.getByText("Bought for ₱32,999.50")).toBeVisible();
  await expect(page.getByText(/Warranty until/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Reminders" })).toContainText("Warranty ends");

  // Maintenance history.
  const history = page.getByRole("region", { name: "Maintenance history" });
  await history.getByRole("textbox", { name: /done by/i }).fill("Cool Breeze Aircon Services");
  await history.getByRole("textbox", { name: /^cost/i }).fill("1500");
  await history.getByRole("button", { name: "Add record" }).click();
  await expect(history.getByRole("listitem").filter({ hasText: "Cleaning" })).toContainText("₱1,500.00");

  // Upload a real JPEG; a disguised text file is rejected server-side.
  const files = page.getByRole("region", { name: "Photos & receipts" });
  const input = files.locator('input[type="file"]');
  await input.setInputFiles({ name: "receipt.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(files.getByRole("link", { name: "receipt.jpg" })).toBeVisible({ timeout: 20_000 });
  await input.setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not really an image at all"),
  });
  await expect(files.getByRole("alert")).toContainText(/don't match its type/, { timeout: 20_000 });
  await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(files.getByRole("alert")).toContainText("Choose a JPG, PNG, WEBP, HEIC image or a PDF.");

  // Archive removes it from the active list.
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await page.goto(`${base}/assets`);
  await expect(page.getByRole("link", { name: /Sala aircon/ })).toHaveCount(0);
  await page.goto(`${base}/assets?view=archived`);
  await expect(page.getByRole("link", { name: /Sala aircon/ })).toBeVisible();
});

test("pets and vehicles: records create reminders shown on the dashboard", async ({ page }) => {
  const base = await newHousehold(page, "Pets & Vehicles E2E");

  await page.goto(`${base}/pets/new`);
  await page.getByRole("textbox", { name: /^name/i }).fill("Bantay");
  await page.getByRole("textbox", { name: /breed/i }).fill("Aspin");
  await page.getByRole("textbox", { name: /care preferences/i }).fill("Chicken allergy. Walk at 6 AM.");
  await page.getByRole("button", { name: "Add pet" }).click();
  await expect(page.getByRole("heading", { name: "Bantay", level: 1 })).toBeVisible();
  const health = page.getByRole("region", { name: "Health & care records" });
  await health.getByRole("textbox", { name: /^what/i }).fill("Anti-rabies");
  const nextMonth = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  await health.getByLabel(/next due/i).fill(nextMonth);
  await health.getByRole("button", { name: "Add record" }).click();
  await expect(health.getByRole("listitem").filter({ hasText: "Vaccination: Anti-rabies" })).toBeVisible();

  await page.goto(`${base}/vehicles/new`);
  await page.getByRole("textbox", { name: /plate number/i }).fill("abc  1234");
  await page.getByRole("textbox", { name: /^make/i }).fill("Toyota");
  await page.getByRole("textbox", { name: /^model/i }).fill("Vios");
  await page
    .getByLabel(/LTO registration expires/i)
    .fill(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add vehicle" }).click();
  await expect(page.getByRole("heading", { name: /Toyota Vios · ABC 1234/, level: 1 })).toBeVisible();
  await expect(page.getByText("LTO renewal month: April")).toBeVisible();

  await page.goto(base);
  const reminders = page.getByRole("region", { name: "Upcoming reminders" });
  await expect(reminders).toContainText("LTO registration expires: Toyota Vios (ABC 1234)");
  await expect(reminders).toContainText("Vaccination due: Bantay — Anti-rabies");
  await expect(reminders.getByText("Overdue")).toBeVisible();
});

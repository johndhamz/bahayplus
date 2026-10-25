import { expect, test, type Page } from "@playwright/test";
import { loadLocalEnv } from "../support/env";
import { createConfirmedUser, login } from "./support/auth";

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(
    !["desktop", "mobile-390"].includes(testInfo.project.name),
    "finance journeys run on desktop and one phone",
  );
});

async function newHousehold(page: Page) {
  await login(page, await createConfirmedUser("bills"));
  await page.getByRole("textbox", { name: /household name/i }).fill("Bills E2E");
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/app\/h\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  return new URL(page.url()).pathname;
}

test("create a bill, record partial and full payments, see it in the budget", async ({ page }) => {
  const base = await newHousehold(page);
  await page.goto(`${base}/bills`);
  await expect(page.getByText("No bills yet")).toBeVisible();
  await page.getByRole("link", { name: "Add bill" }).click();

  await page.getByRole("button", { name: "Add bill" }).click();
  await expect(page.getByText(/Enter the biller/)).toBeVisible();
  await expect(page.getByText(/day of the month it's due/)).toBeVisible();
  await page.getByRole("combobox", { name: /^biller/i }).fill("Meralco");
  await page.getByRole("textbox", { name: /account number/i }).fill("0123-4567-8901");
  await page.getByRole("textbox", { name: /due day/i }).fill("31");
  await page.getByRole("button", { name: "Add bill" }).click();
  await expect(page.getByRole("heading", { name: "Meralco", level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Electricity · ••••8901")).toBeVisible();

  // Current month's bill awaits the statement amount.
  const history = page.getByRole("region", { name: "Bill history" });
  await history.getByRole("link").filter({ hasText: "Needs amount" }).first().click();
  await page.getByRole("textbox", { name: /amount on statement/i }).fill("2,450.75");
  await page.getByRole("button", { name: "Save amount" }).click();
  await expect(page.getByRole("region", { name: "Bill amounts" })).toContainText("₱2,450.75");

  // Partial payment.
  const record = page.getByRole("region", { name: "Record a payment" });
  await record.getByRole("textbox", { name: /amount paid/i }).fill("1,000");
  await record.getByRole("textbox", { name: /reference/i }).fill("GC-123456");
  await record.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Partially paid").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Bill amounts" })).toContainText("₱1,450.75");

  // Overpayment is refused with the remaining balance.
  await record.getByRole("textbox", { name: /amount paid/i }).fill("5,000");
  await record.getByRole("button", { name: "Record payment" }).click();
  await expect(record.getByRole("alert")).toContainText("remaining balance of ₱1,450.75");

  // Pay the rest → paid, reminders stop.
  await record.getByRole("textbox", { name: /amount paid/i }).fill("1,450.75");
  await record.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("region", { name: "Record a payment" })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Payments" })).toContainText("Ref GC-123456");
  const reminders = page.getByRole("region", { name: "Reminders" });
  await expect(reminders.getByText("Scheduled")).toHaveCount(0);
  await expect(reminders.getByText("Stopped (paid)").first()).toBeVisible();

  // Budget: the bill payment counts once under Utilities; add a manual expense and limits.
  await page.goto(`${base}/budget`);
  const bva = page.getByRole("region", { name: "Budget vs actual" });
  await expect(bva.getByRole("listitem").filter({ hasText: "Utilities" })).toContainText("₱2,450.75");
  const add = page.getByRole("region", { name: "Add an expense" });
  await add.getByRole("textbox", { name: /^amount/i }).fill("850.25");
  await add.getByRole("textbox", { name: /description/i }).fill("Palengke");
  await add.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("region", { name: /^Expenses in/ })).toContainText("Palengke", { timeout: 20_000 });
  const limits = page.getByRole("region", { name: /^Limits for/ });
  await limits.getByRole("textbox", { name: /^Utilities/ }).fill("2,000");
  await limits.getByRole("button", { name: "Save budget" }).click();
  await expect(bva.getByRole("listitem").filter({ hasText: "Utilities" })).toContainText("Over by ₱450.75", {
    timeout: 20_000,
  });
  await expect(page.getByRole("region", { name: "Month summary" })).toContainText("₱3,301.00");

  // Chart has an accessible table view.
  const trend = page.getByRole("region", { name: "Spending trend" });
  await trend.getByRole("button", { name: "Show table" }).click();
  await expect(trend.getByRole("table")).toContainText("₱3,301.00");
});

test("the internal job endpoint requires the shared secret", async ({ request }) => {
  loadLocalEnv();
  expect((await request.post("/api/internal/jobs/daily-bills")).status()).toBe(401);
  expect(
    (
      await request.post("/api/internal/jobs/daily-bills", { headers: { Authorization: "Bearer wrong-secret" } })
    ).status(),
  ).toBe(401);
  const ok = await request.post("/api/internal/jobs/daily-bills", {
    headers: { Authorization: `Bearer ${process.env.JOB_RUNNER_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toHaveProperty("data");
});

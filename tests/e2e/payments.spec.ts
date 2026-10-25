import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO, DEMO_IDS, login, logout } from "./support/auth";

const HOUSEHOLD = `/app/h/${DEMO_IDS.delaCruzHousehold}`;
const PROVIDER = `/provider/o/${DEMO_IDS.mabuhayProvider}`;

async function expectNoSeriousAxe(page: Page) {
  await page.waitForLoadState("load");
  const results = await new AxeBuilder({ page })
    // Toasts fade in; mid-animation frames report false contrast failures.
    .exclude('section[aria-label^="Notifications"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    blocking.map((v) => `${page.url()} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

function randomSlot(): string {
  const days = 40 + Math.floor(Math.random() * 500);
  const d = new Date(Date.now() + days * 86_400_000 + 8 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T${String(9 + Math.floor(Math.random() * 6)).padStart(2, "0")}:00`;
}

test("sandbox payment → verified success → partial refund → settlement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(240_000);
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/services/providers/mabuhay-home-services-demo`);
  await page.getByRole("listitem").filter({ hasText: "Leak repair" }).getByRole("link", { name: "Book now" }).click();
  await page.getByLabel("When").fill(randomSlot());
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const bookingUrl = page.url();

  const payment = page.getByRole("region", { name: "Payment" });
  await expect(payment).toContainText("Local sandbox (no real money)");
  await payment.getByRole("button", { name: /Pay ₱800\.00 online/ }).click();
  await expect(page).toHaveURL(/\/payments\/sandbox\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole("note", { name: "Sandbox notice" })).toContainText("payment sandbox");
  await expectNoSeriousAxe(page);
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page).toHaveURL(bookingUrl, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Payment" })).toContainText("Paid", { timeout: 20_000 });
  await logout(page);

  await login(page, DEMO.provider, undefined, `${PROVIDER}/payments`);
  await expectNoSeriousAxe(page);
  await page
    .getByRole("region", { name: "Payments received" })
    .getByRole("link", { name: "Leak repair" })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Amount (₱)" }).fill("300");
  await page.getByRole("textbox", { name: "Reason" }).fill("Shorter visit than booked");
  await page.getByRole("button", { name: "Refund" }).click();
  await expect(page.getByText("Partially refunded").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Payment history" })).toContainText("refund succeeded");
  await expectNoSeriousAxe(page);
  await logout(page);

  await login(page, DEMO.admin, undefined, "/admin/payments");
  await expectNoSeriousAxe(page);
  await page.getByRole("combobox", { name: "Business" }).selectOption({ label: "Mabuhay Home Services (demo)" });
  await page.getByRole("button", { name: "Create settlement" }).click();
  await expect(page.getByRole("region", { name: "Settlements" })).toContainText("Mabuhay Home Services (demo)", {
    timeout: 20_000,
  });
});

test("the payment webhook endpoint rejects unsigned and forged requests", async ({ request }) => {
  const res = await request.post("/api/webhooks/payments/sandbox", {
    data: { id: "evt_forged", type: "payment.succeeded", data: { reference: "x", amount: 1, currency: "PHP" } },
  });
  expect(res.status()).toBe(400);
  const forged = await request.post("/api/webhooks/payments/sandbox", {
    headers: { "x-bahayplus-sandbox-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
    data: { id: "evt_forged2", type: "payment.succeeded", data: { reference: "x", amount: 1, currency: "PHP" } },
  });
  expect(forged.status()).toBe(400);
  expect((await request.post("/api/webhooks/payments/paymongo", { data: {} })).status()).toBe(404);
});

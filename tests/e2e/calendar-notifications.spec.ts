import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loadLocalEnv } from "../support/env";
import { DEMO, DEMO_IDS, login, logout } from "./support/auth";
import { latestLink } from "./support/mailpit";

const HOUSEHOLD = `/app/h/${DEMO_IDS.delaCruzHousehold}`;

async function expectNoSeriousAxe(page: Page) {
  await page.waitForLoadState("load");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    blocking.map((v) => `${page.url()} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

/** A random future Manila slot so reruns don't collide on provider capacity. */
function randomSlot(): { local: string; month: string } {
  const days = 40 + Math.floor(Math.random() * 500);
  const d = new Date(Date.now() + days * 86_400_000 + 8 * 3_600_000);
  const date = d.toISOString().slice(0, 10);
  return { local: `${date}T${String(9 + Math.floor(Math.random() * 6)).padStart(2, "0")}:00`, month: date.slice(0, 7) };
}

test("urgent help: emergency notice, honest availability, and no-match state", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "runs on desktop and one phone");
  await login(page, DEMO.owner, undefined, HOUSEHOLD);
  await page.getByRole("link", { name: "Find urgent help" }).click();
  await expect(page).toHaveURL(/\/services\/urgent$/);
  const notice = page.getByRole("note", { name: "Emergency notice" });
  await expect(notice).toContainText("Call 911 now");
  await expect(notice).toContainText("can't guarantee");
  // Province/city come from the household's default property.
  await expect(page.getByRole("textbox", { name: "Province" })).toHaveValue("Metro Manila");
  await page.getByRole("combobox", { name: "What do you need?" }).selectOption("plumbing");
  await page.getByRole("button", { name: "Find providers" }).click();
  const results = page.getByRole("region", { name: /provider\(s\) available/ });
  await expect(results).toContainText("Mabuhay Home Services (demo)");
  await expect(results).toContainText("Availability updated");
  await expect(results).toContainText("Serves Quezon City, Metro Manila");
  await expect(results.getByRole("link", { name: /Call \+63 917 000 0000/ })).toHaveAttribute(
    "href",
    "tel:+639170000000",
  );
  await expectNoSeriousAxe(page);

  await page.getByRole("combobox", { name: "What do you need?" }).selectOption("locksmith");
  await page.getByRole("button", { name: "Find providers" }).click();
  await expect(page.getByText("No available urgent providers found")).toBeVisible();
});

test("booking → provider is notified in-app and by email; inbox marks read", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(180_000);
  loadLocalEnv();
  const slot = randomSlot();
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/services/providers/mabuhay-home-services-demo`);
  await page.getByRole("listitem").filter({ hasText: "Leak repair" }).getByRole("link", { name: "Book now" }).click();
  await page.getByLabel("When").fill(slot.local);
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const bookingId = page.url().split("/").pop()!;

  // The booking is on the household calendar in its month; the bills filter hides it.
  await page.goto(`${HOUSEHOLD}/calendar?month=${slot.month}`);
  const agenda = page.getByRole("region", { name: "Agenda" });
  await expect(agenda.getByRole("link", { name: "Leak repair" }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Category" }).selectOption("bills");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(agenda.locator(`a[href$="/bookings/${bookingId}"]`)).toHaveCount(0);
  await logout(page);

  // Email goes out through the delivery worker (Mailpit locally).
  const run = await request.post("/api/internal/jobs/deliver", {
    headers: { Authorization: `Bearer ${process.env.JOB_RUNNER_SECRET}` },
  });
  expect(run.status()).toBe(200);
  expect((await request.post("/api/internal/jobs/deliver")).status()).toBe(401);
  const link = await latestLink(
    DEMO.provider,
    /New booking: Leak repair/,
    `/bookings/${bookingId}`,
    testInfo.project.use.baseURL!,
  );
  expect(link).toContain(`/provider/o/${DEMO_IDS.mabuhayProvider}/bookings/${bookingId}`);

  await login(page, DEMO.provider, undefined, `/provider/o/${DEMO_IDS.mabuhayProvider}`);
  await page.getByRole("link", { name: /Notifications, \d+ unread/ }).click();
  await expect(page).toHaveURL(/\/account\/notifications$/);
  await page.getByRole("link", { name: "Unread" }).click();
  const item = page.getByRole("listitem").filter({ hasText: "New booking: Leak repair" }).first();
  await expect(item).toContainText("Email sent");
  await item.getByRole("button", { name: "New booking: Leak repair" }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/[0-9a-f-]{36}$`), { timeout: 20_000 });
  await expectNoSeriousAxe(page);
});

test("calendar filters and assignment; notification settings persist", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "runs on desktop and one phone");
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/calendar`);
  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  await expectNoSeriousAxe(page);

  await page.goto("/account/notifications/settings");
  const box = page.getByRole("checkbox", { name: "Bookings & quotations: email" });
  const before = await box.isChecked();
  await box.setChecked(!before);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Notification settings saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Bookings & quotations: email" })).toBeChecked({ checked: !before });
  await expect(page.getByRole("table")).toContainText("Not available");
  await expectNoSeriousAxe(page);
  await page.getByRole("checkbox", { name: "Bookings & quotations: email" }).setChecked(before);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Notification settings saved.")).toBeVisible();
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO, DEMO_IDS, login, logout } from "./support/auth";

const HOUSEHOLD = `/app/h/${DEMO_IDS.delaCruzHousehold}`;
const PROVIDER = `/provider/o/${DEMO_IDS.mabuhayProvider}`;

/** A random future Manila slot ("YYYY-MM-DDTHH:MM") so reruns don't collide on capacity. */
function randomSlot(hour = 9 + Math.floor(Math.random() * 6)): string {
  const days = 30 + Math.floor(Math.random() * 600);
  const d = new Date(Date.now() + days * 86_400_000 + 8 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

async function fillLine(page: Page, i: number, description: string, qty: string, price: string) {
  await page.getByRole("textbox", { name: `Item ${i} description` }).fill(description);
  await page.getByRole("textbox", { name: `Item ${i} quantity` }).fill(qty);
  await page.getByRole("textbox", { name: `Item ${i} unit price` }).fill(price);
}

test(
  "book now → provider completes → customer confirms; quote request → quotation → accepted booking",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
    test.setTimeout(240_000);
    const note = `E2E ${Date.now().toString(36)}`;

    // Customer books a Book Now service from the provider profile.
    await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/services/providers/mabuhay-home-services-demo`);
    await page.getByRole("link", { name: "Book now" }).first().click();
    await expect(page.getByRole("heading", { name: "Book a service" })).toBeVisible();
    await page.getByLabel("When").fill(randomSlot());
    await page.getByRole("textbox", { name: /notes for the provider/i }).fill(note);
    await page.getByRole("button", { name: "Book", exact: true }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    const bookingPath = new URL(page.url()).pathname.split("/bookings/")[1]!;

    // Quote request for a quote-only service.
    await page.goto(`${HOUSEHOLD}/services/providers/mabuhay-home-services-demo`);
    await page.getByRole("link", { name: "Request quote" }).last().click();
    await page.getByRole("textbox", { name: /^details/i }).fill(`Panel check ${note}`);
    await page.getByRole("button", { name: "Request quote" }).click();
    await expect(page).toHaveURL(/\/bookings\/requests\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(/hasn.t sent a quotation yet/)).toBeVisible();
    const requestId = page.url().split("/").pop()!;
    await logout(page);

    // Provider: sees the address of the confirmed booking, starts and completes it.
    await login(page, DEMO.provider, undefined, `${PROVIDER}/bookings/${bookingPath}`);
    await expect(page.getByRole("region", { name: "Details" })).toContainText("12 Sampaguita St.");
    await page.getByRole("button", { name: "Start job" }).click();
    await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Provider prepares and sends a quotation with live totals.
    await page.goto(`${PROVIDER}/quotations/${requestId}`);
    await page.getByRole("button", { name: "Create quotation" }).click();
    await fillLine(page, 1, "Panel inspection", "1", "1,200");
    await page.getByRole("button", { name: "Add line" }).click();
    await fillLine(page, 2, "Breaker replacement", "2", "450.50");
    await expect(page.getByRole("table", { name: /line items/i })).toContainText("₱2,101.00");
    await page.getByRole("button", { name: "Save & send to customer" }).click();
    await expect(page.getByRole("region", { name: /^Sent/ })).toContainText("₱2,101.00", { timeout: 20_000 });
    await logout(page);

    // Customer confirms completion, sees the review form, and accepts the quotation.
    await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/bookings/${bookingPath}`);
    await page.getByRole("button", { name: "Yes, the job is done" }).click();
    await expect(page.getByText("You confirmed completion")).toBeVisible({ timeout: 20_000 });
    await page.goto(`${HOUSEHOLD}/bookings/requests/${requestId}`);
    await page.getByRole("button", { name: "Accept" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Accept quotation" }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText("Waiting for provider")).toBeVisible();
    await expect(page.getByRole("region", { name: "Details" })).toContainText("₱2,101.00");
  },
);

test("project: quotation contract → change order approval → work order dispatch", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(240_000);
  const title = `Kitchen cabinets ${Date.now().toString(36)}`;

  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/projects?provider=mabuhay-home-services-demo`);
  await page.getByRole("textbox", { name: /project name/i }).fill(title);
  await page.getByRole("combobox", { name: /^type/i }).selectOption("cabinetry");
  await page.getByRole("button", { name: "Send project request" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const projectId = page.url().split("/").pop()!;
  await logout(page);

  // Provider quotes the project.
  await login(page, DEMO.provider, undefined, `${PROVIDER}/projects/${projectId}`);
  await page.getByRole("button", { name: "Prepare quotation" }).click();
  await page.getByRole("link", { name: "Continue the quotation draft" }).click();
  await fillLine(page, 1, "Upper and lower cabinets", "1", "85,000");
  await page.getByRole("button", { name: "Save & send to customer" }).click();
  await expect(page.getByRole("region", { name: /^Sent/ })).toContainText("₱85,000.00", { timeout: 20_000 });
  await logout(page);

  // Customer accepts the contract.
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/projects/${projectId}`);
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Accept quotation" }).click();
  await expect(page.getByRole("region", { name: "Project amounts" })).toContainText("₱85,000.00", { timeout: 20_000 });
  await logout(page);

  // Provider starts the project, proposes a change order and dispatches a worker.
  await login(page, DEMO.provider, undefined, `${PROVIDER}/projects/${projectId}`);
  await expect(page.getByText("Contract accepted")).toBeVisible();
  await page.getByRole("button", { name: "Start project" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  const changes = page.getByRole("region", { name: "Change orders" });
  await changes.getByRole("textbox", { name: /^change/i }).fill("Soft-close hinges");
  await changes.getByRole("textbox", { name: /price change/i }).fill("4,500");
  await changes.getByRole("button", { name: "Propose change order" }).click();
  await expect(changes).toContainText("Awaiting customer", { timeout: 20_000 });

  await page.getByRole("link", { name: "Create work order" }).click();
  const form = page.getByRole("region", { name: "New work order" });
  await form.getByLabel("Start (PHT)").fill(randomSlot(8));
  const end = await form.getByLabel("Start (PHT)").inputValue();
  await form.getByLabel("End (PHT)").fill(end.replace("T08:", "T17:"));
  await form.getByRole("textbox", { name: "New checklist item" }).fill("Photo before work");
  await form.getByRole("button", { name: "Add" }).click();
  await form.getByRole("button", { name: "Create work order" }).click();
  await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await page.getByRole("combobox", { name: "Worker" }).selectOption({ label: "Andres Bautista (demo)" });
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("region", { name: "Assigned worker" })).toContainText("Andres Bautista (demo)", {
    timeout: 20_000,
  });
  await page.getByRole("checkbox", { name: "Photo before work" }).click();
  await expect(page.getByRole("checkbox", { name: "Photo before work" })).toBeChecked({ timeout: 20_000 });
  await logout(page);

  // Customer approves the change order; the total updates.
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/projects/${projectId}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve change" }).click();
  await expect(page.getByRole("region", { name: "Project amounts" })).toContainText("₱89,500.00", { timeout: 20_000 });
});

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

test("transaction pages have no serious axe violations", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "accessibility audit runs on two viewports");
  test.setTimeout(180_000);
  await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/bookings`);
  await expectNoSeriousAxe(page);
  await page.goto(`${HOUSEHOLD}/bookings?provider=mabuhay-home-services-demo&mode=quote`);
  await expectNoSeriousAxe(page);
  await page.goto(`${HOUSEHOLD}/bookings/50000000-0000-4000-8000-000000000001`);
  await expectNoSeriousAxe(page);
  await page.goto(`${HOUSEHOLD}/projects`);
  await expectNoSeriousAxe(page);
  await logout(page);

  await login(page, DEMO.provider, undefined, `${PROVIDER}/bookings`);
  await expectNoSeriousAxe(page);
  for (const section of ["quotations", "work-orders", "projects"]) {
    await page.goto(`${PROVIDER}/${section}`);
    await expectNoSeriousAxe(page);
    const first = page.locator("main ul a").first();
    if (await first.count()) {
      await first.click();
      await page.waitForURL(new RegExp(`/${section}/[0-9a-f-]{36}$`));
      await expectNoSeriousAxe(page);
    }
  }
});

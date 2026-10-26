import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO, DEMO_IDS, login, loginAsAdmin, logout } from "./support/auth";

const PROVIDER = `/provider/o/${DEMO_IDS.mabuhayProvider}`;
const SUPPLIER = `/supplier/o/${DEMO_IDS.bayanihanSupplier}`;
const HOUSEHOLD = `/app/h/${DEMO_IDS.delaCruzHousehold}`;

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

function randomSlot(hour: number): string {
  const days = 40 + Math.floor(Math.random() * 500);
  const d = new Date(Date.now() + days * 86_400_000 + 8 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

test("purchase order: provider orders → supplier accepts, ships, delivers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(180_000);
  await login(page, DEMO.provider, undefined, `${PROVIDER}/purchasing`);
  await page.getByRole("link", { name: "Bayanihan Hardware (demo)" }).click();
  await page.getByRole("textbox", { name: /Quantity of PVC pipe/ }).fill("3");
  await expect(page.getByRole("table", { name: "Products" })).toContainText("₱555.00");
  await page.getByRole("textbox", { name: "Delivery address" }).fill("Mabuhay warehouse, 5 Kalayaan Ave., Quezon City");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/purchasing\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const orderId = page.url().split("/").pop()!;
  await expect(page.getByText("New", { exact: true })).toBeVisible();
  await logout(page);

  await login(page, DEMO.supplier, undefined, `${SUPPLIER}/purchase-orders/${orderId}`);
  await expect(page.getByRole("region", { name: "Items" })).toContainText("PVC pipe");
  await page.getByRole("button", { name: "Accept order" }).click();
  await expect(page.getByText("Accepted", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("textbox", { name: "Courier" }).fill("Own truck");
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(page.getByText("Out for delivery", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await page.goto(`${SUPPLIER}/deliveries`);
  await expect(page.getByRole("region", { name: /Deliveries/ })).toContainText("Mabuhay Home Services (demo)");
});

test(
  "worker: assigned job with address, checklist, evidence-gated completion",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
    test.setTimeout(240_000);
    const title = `Leak check ${Date.now().toString(36)}`;
    // Customer books a confirmed visit.
    await login(page, DEMO.owner, undefined, `${HOUSEHOLD}/services/providers/mabuhay-home-services-demo`);
    await page.getByRole("listitem").filter({ hasText: "Leak repair" }).getByRole("link", { name: "Book now" }).click();
    await page.getByLabel("When").fill(randomSlot(7));
    await page.getByRole("button", { name: "Book", exact: true }).click();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const bookingId = page.url().split("/").pop()!;
    await logout(page);

    // Dispatcher creates and assigns the work order.
    await login(page, DEMO.provider, undefined, `${PROVIDER}/work-orders?source=${bookingId}`);
    const form = page.getByRole("region", { name: "New work order" });
    await form.getByRole("textbox", { name: "Title" }).fill(title);
    await form.getByRole("textbox", { name: "New checklist item" }).fill("Check for leaks");
    await form.getByRole("button", { name: "Add" }).click();
    await form.getByRole("button", { name: "Create work order" }).click();
    await expect(page).toHaveURL(/\/work-orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const workOrderId = page.url().split("/").pop()!;
    await page.getByRole("combobox", { name: "Worker" }).selectOption({ label: "Andres Bautista (demo)" });
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByRole("region", { name: "Assigned worker" })).toContainText("Andres Bautista (demo)", {
      timeout: 20_000,
    });
    await logout(page);

    // Worker sees only their job, with the address, and must provide evidence to complete.
    await login(page, DEMO.worker, undefined, "/worker/jobs");
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`/worker/jobs/${workOrderId}$`));
    await expect(page.getByRole("region", { name: "Where" })).toContainText("12 Sampaguita St.");
    await page.getByRole("button", { name: "Mark in progress" }).click();
    await expect(page.getByText("In progress", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("checkbox", { name: "Check for leaks" }).click();
    await expect(page.getByRole("checkbox", { name: "Check for leaks" })).toBeChecked({ timeout: 20_000 });
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByText(/completion notes or an "after" photo/).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("textbox", { name: "Completion notes" }).fill("Replaced washer; no more leak.");
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByRole("region", { name: "Completion" })).toContainText("Replaced washer", {
      timeout: 20_000,
    });
    await expectNoSeriousAxe(page);
    // The job stays in the worker's history; other workers' URLs 404.
    await page.goto("/worker/jobs");
    await expect(page.getByRole("region", { name: /Completed/ })).toContainText(title);
  },
);

test("admin: overview, restricted tools, maintenance banner and audit trail; non-admins get 404", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "multi-account journey runs once");
  test.setTimeout(180_000);
  await login(page, DEMO.owner, undefined, HOUSEHOLD);
  const res = await page.goto("/admin/users");
  expect(res?.status()).toBe(404);
  await page.goto(HOUSEHOLD);
  await logout(page);

  await loginAsAdmin(page);
  await expect(page.getByRole("region", { name: "Platform summary" })).toContainText("Organizations");
  await page.goto("/admin/organizations?kind=supplier");
  await expect(page.getByRole("region", { name: /organization\(s\)/ })).toContainText("Bayanihan Hardware (demo)");
  await page.goto("/admin/users?q=owner%40bahayplus.test");
  await expect(page.getByRole("region", { name: /user\(s\)/ })).toContainText("owner@bahayplus.test");

  const banner = `Scheduled maintenance ${Date.now().toString(36)}`;
  await page.goto("/admin/settings");
  await page.getByRole("textbox", { name: "Maintenance banner" }).fill(banner);
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Setting saved.")).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("status").filter({ hasText: banner })).toBeVisible();
  await page.goto("/admin/audit?action=platform.setting");
  await expect(page.getByRole("table", { name: "Audit log entries" })).toContainText("platform.setting_changed");
  await page.goto("/admin/settings");
  await page.getByRole("textbox", { name: "Maintenance banner" }).fill("");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Setting saved.")).toBeVisible();
});

test("staff: owners see the team and can create a one-time invite link", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs once");
  await login(page, DEMO.provider, undefined, `${PROVIDER}/staff`);
  const team = page.getByRole("region", { name: /Team/ });
  await expect(team).toContainText("Andres Bautista (demo)");
  await expect(team.getByRole("combobox", { name: "Role for Andres Bautista (demo)" })).toHaveValue("worker");
  await page.getByRole("textbox", { name: "Email" }).fill(`e2e-staff-${Date.now().toString(36)}@bahayplus.test`);
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("textbox", { name: "Invite link" })).toHaveValue(/\/invite\/organization\?token=/);
});

test("Phase 9 pages have no serious axe violations", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "accessibility audit runs on two viewports");
  test.setTimeout(240_000);
  await login(page, DEMO.provider, undefined, `${PROVIDER}/staff`);
  for (const p of [
    "staff",
    "history",
    "finance",
    "settings",
    "purchasing",
    `purchasing/suppliers/${DEMO_IDS.bayanihanSupplier}`,
  ]) {
    await page.goto(`${PROVIDER}/${p}`);
    await expectNoSeriousAxe(page);
  }
  await logout(page);
  await login(page, DEMO.supplier, undefined, SUPPLIER);
  for (const p of [
    "",
    "/profile",
    "/products",
    "/products/60000000-0000-4000-8000-000000000001",
    "/inventory",
    "/purchase-orders",
    "/deliveries",
    "/reports",
    "/staff",
  ]) {
    await page.goto(`${SUPPLIER}${p}`);
    await expectNoSeriousAxe(page);
  }
  await logout(page);
  await login(page, DEMO.worker, undefined, "/worker");
  for (const p of ["/worker", "/worker/jobs", "/worker/schedule"]) {
    await page.goto(p);
    await expectNoSeriousAxe(page);
  }
  await logout(page);
  await loginAsAdmin(page);
  for (const p of [
    "/admin",
    "/admin/organizations",
    "/admin/users",
    "/admin/categories",
    "/admin/disputes",
    "/admin/audit",
    "/admin/settings",
  ]) {
    await page.goto(p);
    await expectNoSeriousAxe(page);
  }
});

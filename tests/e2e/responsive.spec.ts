import { expect, test, type Page } from "@playwright/test";

/**
 * Layout checks run in every Playwright project: mobile 375/390/430, tablet 768 and desktop 1280.
 * Shells are exercised through the /preview routes (labelled sample data), since portals require auth.
 */
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

test("landing page fits the viewport", async ({ page }) => {
  await page.goto("/");
  await expectNoHorizontalScroll(page);
});

test("auth pages fit the viewport", async ({ page }) => {
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole("button", { name: /log in|create account/i })).toBeVisible();
  }
});

test("customer shell: bottom navigation on mobile/tablet, sidebar on desktop", async ({ page }) => {
  await page.goto("/preview/customer");
  await expect(page.getByRole("note")).toContainText("sample data only");
  const bottomNav = page.getByRole("navigation", { name: "Home quick navigation" });
  const sidebar = page.getByRole("complementary").getByRole("navigation", { name: "Home navigation" });
  if (isDesktop(page)) {
    await expect(sidebar).toBeVisible();
    await expect(bottomNav).toBeHidden();
  } else {
    await expect(bottomNav).toBeVisible();
    await expect(sidebar).toBeHidden();
    // Touch targets in the bottom bar are at least 44px tall.
    const box = await bottomNav.getByRole("link", { name: "Bills" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await bottomNav.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Vehicles" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expectNoHorizontalScroll(page);
});

test("business shell: slide-out menu on small screens, collapsible sidebar on desktop", async ({ page }) => {
  await page.goto("/preview/business");
  await expect(page.getByRole("table", { name: /upcoming bookings/i })).toBeVisible();
  if (isDesktop(page)) {
    const collapse = page.getByRole("button", { name: "Collapse sidebar" });
    await expect(collapse).toBeVisible();
    await collapse.click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Expand sidebar" }).click();
  } else {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Work orders" })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expectNoHorizontalScroll(page);
});

test("component gallery renders without layout overflow", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByRole("heading", { level: 1, name: "Bahay+ design system" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

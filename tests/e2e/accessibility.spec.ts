import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Axe runs on desktop and one phone width; layout-specific checks live in responsive.spec.ts.
test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "accessibility audit runs on two viewports");
});

for (const path of ["/", "/login", "/signup", "/preview", "/preview/customer", "/preview/business"]) {
  test(`${path} has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("load");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual(
      [],
    );
  });
}

test("keyboard users can skip to main content", async ({ page }) => {
  await page.goto("/preview/business");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  // The preview page has its own header first; tab until the shell's skip link receives focus.
  for (let i = 0; i < 10 && !(await skip.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

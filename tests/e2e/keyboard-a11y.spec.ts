import { expect, test, type Page } from "@playwright/test";
import { DEMO, DEMO_IDS, login } from "./support/auth";

const HOUSEHOLD = `/app/h/${DEMO_IDS.delaCruzHousehold}`;

test("login form works with the keyboard alone and announces errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard journey runs on desktop");
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).focus();
  await page.keyboard.type(DEMO.owner);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^password/i)).toBeFocused();
  await page.keyboard.type("wrong-password-123");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toHaveText("Email or password is incorrect.", { timeout: 30_000 });
});

test("dialogs trap focus, close with Escape and return focus to the trigger", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "keyboard journey runs on desktop");
  await login(page, DEMO.provider, undefined, `/provider/o/${DEMO_IDS.mabuhayProvider}/staff`);
  const trigger = page.getByRole("button", { name: "Remove" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

/**
 * WCAG 2.5.8 Target Size (Minimum): a target passes if it is at least 24×24 CSS px, OR if a 24 px circle
 * centred on it does not intersect any other target (spacing exception). Inline links in text are exempt.
 */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector =
      "main button, main [role=button], main input:not([type=hidden]), main select, main textarea, main a, header button, header a, nav a";
    const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || el.closest("[aria-hidden=true], .sr-only"))
        return false;
      if (el.tagName === "A" && style.display === "inline" && el.closest("p, td, dd")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const rects = targets.map((el) => el.getBoundingClientRect());
    const distance = (cx: number, cy: number, r: DOMRect) =>
      Math.hypot(Math.max(r.left - cx, 0, cx - r.right), Math.max(r.top - cy, 0, cy - r.bottom));
    const out: string[] = [];
    targets.forEach((el, i) => {
      const r = rects[i]!;
      if (r.width >= 24 && r.height >= 24) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const crowded = rects.some(
        (o, j) => j !== i && !targets[j]!.contains(el) && !el.contains(targets[j]!) && distance(cx, cy, o) < 12,
      );
      if (crowded)
        out.push(
          `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    });
    return out;
  });
}

test("touch targets on key mobile pages are at least 24×24 px (WCAG 2.5.8)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "touch target audit runs on a phone viewport");
  test.setTimeout(120_000);
  await page.goto("/login");
  expect(await smallTargets(page), "/login").toEqual([]);
  await login(page, DEMO.owner, undefined, HOUSEHOLD);
  for (const path of [
    HOUSEHOLD,
    `${HOUSEHOLD}/bills`,
    `${HOUSEHOLD}/services`,
    `${HOUSEHOLD}/bookings`,
    `${HOUSEHOLD}/calendar`,
    "/account/notifications",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("load");
    expect(await smallTargets(page), path).toEqual([]);
  }
});

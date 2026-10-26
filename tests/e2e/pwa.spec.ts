import { expect, test } from "@playwright/test";
import { DEMO, DEMO_IDS, login } from "./support/auth";

test(
  "installable PWA: manifest, icons and a registered service worker",
  { tag: "@smoke" },
  async ({ page, request }, testInfo) => {
    test.skip(!["desktop", "mobile-390"].includes(testInfo.project.name), "runs on desktop and one phone");
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({
      short_name: "Bahay+",
      display: "standalone",
      start_url: "/app",
      theme_color: "#153D35",
    });
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await request.get(icon.src);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/$/);
    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  },
);

test("offline: navigation shows the offline page; caches never hold private pages", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs once");
  test.setTimeout(120_000);
  await login(page, DEMO.owner, undefined, `/app/h/${DEMO_IDS.delaCruzHousehold}`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Ensure the worker controls the page before going offline.
  await page.reload();
  await page.goto(`/app/h/${DEMO_IDS.delaCruzHousehold}/bills`);
  await context.setOffline(true);
  await page.goto(`/app/h/${DEMO_IDS.delaCruzHousehold}/budget`).catch(() => undefined);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.getByText("Emergency? Call 911")).toBeVisible();
  await context.setOffline(false);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  const disallowed = cached.filter(
    (p) =>
      !(
        p.startsWith("/_next/static/") ||
        p.startsWith("/icons/") ||
        p.startsWith("/icon") ||
        p === "/offline" ||
        p === "/manifest.webmanifest" ||
        p.startsWith("/apple-icon")
      ),
  );
  expect(disallowed).toEqual([]);
});

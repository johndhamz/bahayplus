import { expect, test, type Page } from "@playwright/test";
import { DEMO, DEMO_IDS, login } from "../e2e/support/auth";

/**
 * Budgets for a mid-range Android phone on a typical Philippine mobile connection.
 * Emulation: 4× CPU slowdown, 150 ms RTT, 1.6 Mbps down / 750 kbps up (between 3G and congested 4G).
 * Measured: compressed JavaScript transferred, Largest Contentful Paint, and DOMContentLoaded.
 */
const NETWORK = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};
const BUDGET = { jsKb: 450, lcpMs: 4000 };

async function measure(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let jsBytes = 0;
  const types = new Map<string, string>();
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    if (types.get(e.requestId) === "Script") jsBytes += e.encodedDataLength;
  });
  await page.goto(path, { waitUntil: "load" });
  const timings = await page.evaluate(
    () =>
      new Promise<{ lcp: number; dcl: number }>((resolve) => {
        let lcp = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        setTimeout(() => resolve({ lcp, dcl: nav.domContentLoadedEventEnd }), 1500);
      }),
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const result = {
    path,
    jsKb: Math.round(jsBytes / 1024),
    lcpMs: Math.round(timings.lcp),
    dclMs: Math.round(timings.dcl),
  };
  console.log(`[perf] ${JSON.stringify(result)}`);
  return result;
}

test("public pages stay within mobile budgets", async ({ page }) => {
  for (const path of ["/", "/login"]) {
    const r = await measure(page, path);
    expect(r.jsKb, `${path} JS`).toBeLessThan(BUDGET.jsKb);
    expect(r.lcpMs, `${path} LCP`).toBeLessThan(BUDGET.lcpMs);
  }
});

test("the household dashboard stays within mobile budgets", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, DEMO.owner, undefined, `/app/h/${DEMO_IDS.delaCruzHousehold}`);
  // Second visit: measures a returning user (static chunks cached, page rendered on the server).
  for (const path of [`/app/h/${DEMO_IDS.delaCruzHousehold}`, `/app/h/${DEMO_IDS.delaCruzHousehold}/bills`]) {
    const r = await measure(page, path);
    expect(r.jsKb, `${path} JS`).toBeLessThan(BUDGET.jsKb);
    expect(r.lcpMs, `${path} LCP`).toBeLessThan(BUDGET.lcpMs);
  }
});

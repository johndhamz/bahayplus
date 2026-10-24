import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/** Viewports required by the design brief: three phone widths, tablet and desktop. */
const phone = (width: number) => ({
  ...devices["Pixel 7"],
  viewport: { width, height: 844 },
  deviceScaleFactor: 2,
});

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Auth journeys hit a real local Supabase; keep concurrency modest so shared Docker hosts stay responsive.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  expect: { timeout: 10_000 },
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  // One retry everywhere: local Supabase on a shared Docker host occasionally returns gateway timeouts.
  // Tests that need it are reported as "flaky", never silently passed.
  retries: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "Asia/Manila",
    locale: "en-PH",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "mobile-375", use: phone(375) },
    { name: "mobile-390", use: phone(390) },
    { name: "mobile-430", use: phone(430) },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -w @bahayplus/web -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: { ENABLE_DESIGN_PREVIEW: "true" },
      },
});

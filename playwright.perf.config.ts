import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** Mobile performance budgets: mid-range Android, throttled CPU and network (see tests/performance). */
export default defineConfig({
  ...base,
  testDir: "./tests/performance",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [{ name: "mid-range-android", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } }],
});

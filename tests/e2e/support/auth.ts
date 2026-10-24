import { expect, type Page } from "@playwright/test";
import { loadLocalEnv } from "../../support/env";
import { adminClient } from "../../support/supabase";

export const DEMO_PASSWORD = "BahayPlus-dev-2026";
export const DEMO = {
  owner: "owner@bahayplus.test",
  member: "member@bahayplus.test",
  provider: "provider@bahayplus.test",
  worker: "worker@bahayplus.test",
  supplier: "supplier@bahayplus.test",
  admin: "admin@bahayplus.test",
} as const;

export const DEMO_IDS = {
  delaCruzHousehold: "20000000-0000-4000-8000-000000000001",
  santosHousehold: "20000000-0000-4000-8000-000000000002",
  mabuhayProvider: "30000000-0000-4000-8000-000000000001",
  bayanihanSupplier: "30000000-0000-4000-8000-000000000002",
} as const;

export async function login(page: Page, email: string, password = DEMO_PASSWORD, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Test-only: creates a confirmed user with the demo password via the service role. */
export async function createConfirmedUser(label: string): Promise<string> {
  loadLocalEnv();
  const email = `e2e-${label}-${crypto.randomUUID().slice(0, 8)}@bahayplus.test`;
  const { error } = await adminClient().auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return email;
}

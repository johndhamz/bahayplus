import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLocalEnv } from "../support/env";
import { adminClient, anonClient, createTestUser, cleanupTestUsers } from "../support/supabase";

const STATIC_DIR = join(process.cwd(), "apps/web/.next/static");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}

describe("sensitive data exposure", () => {
  it.skipIf(!existsSync(STATIC_DIR))("client bundles contain no server secrets (run after `npm run build`)", () => {
    loadLocalEnv();
    const secrets = [
      "SUPABASE_SECRET_KEY",
      "JOB_RUNNER_SECRET",
      "CRON_SECRET",
      "PAYMENTS_WEBHOOK_SECRET",
      "RESEND_API_KEY",
    ]
      .map((k) => process.env[k])
      .filter((v): v is string => !!v && v.length >= 16);
    const files = walk(STATIC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const leaks: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, "utf8");
      for (const s of secrets) if (code.includes(s)) leaks.push(`${file}: secret value`);
      if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(code)) leaks.push(`${file}: sb_secret_ key`);
      if (code.includes('"service_role"')) leaks.push(`${file}: service_role token`);
    }
    expect(leaks).toEqual([]);
  });

  it("signed-out API callers read nothing from tenant, financial or audit tables", async () => {
    const anon = anonClient();
    for (const table of [
      "households",
      "household_members",
      "properties",
      "assets",
      "pets",
      "vehicles",
      "files",
      "bills",
      "bill_payments",
      "expenses",
      "bookings",
      "quotations",
      "projects",
      "work_orders",
      "notifications",
      "reminders",
      "payment_intents",
      "refunds",
      "settlements",
      "audit_logs",
      "purchase_orders",
      "stock_movements",
      "disputes",
      "organization_members",
    ] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("rate limiter blocks after the limit and is callable only by the server", async () => {
    const key = `test-${crypto.randomUUID()}`;
    const hit = async () =>
      (
        await adminClient().rpc("consume_rate_limit", {
          p_bucket: "test",
          p_key: key,
          p_limit: 2,
          p_window_seconds: 600,
        })
      ).data;
    expect([await hit(), await hit(), await hit()]).toEqual([true, true, false]);
    const user = await createTestUser("rl-user");
    const fromClient = await user.client.rpc("consume_rate_limit", {
      p_bucket: "loginByIp",
      p_key: "1.2.3.4",
      p_limit: 0,
      p_window_seconds: 600,
    });
    expect(fromClient.error).not.toBeNull();
    const fromAnon = await anonClient().rpc("consume_rate_limit", {
      p_bucket: "loginByIp",
      p_key: "1.2.3.4",
      p_limit: 0,
      p_window_seconds: 600,
    });
    expect(fromAnon.error).not.toBeNull();
    await cleanupTestUsers();
  });
});

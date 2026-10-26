import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@bahayplus/types/database";
import type { ServiceContext } from "@bahayplus/modules/authorization";
import { requireEnv } from "./env";
import { totp } from "./totp";

export type TestClient = SupabaseClient<Database>;
export type TestUser = { id: string; email: string; password: string; client: TestClient; ctx: ServiceContext };

const url = () => requireEnv("NEXT_PUBLIC_SUPABASE_URL");

/** Service-role client: test setup/teardown only. Bypasses RLS. */
export function adminClient(): TestClient {
  return createClient<Database>(url(), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): TestClient {
  return createClient<Database>(url(), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const created: string[] = [];

export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@bahayplus.test`;
}

/** Creates a confirmed user and returns a client signed in as them (RLS applies). */
export async function createTestUser(
  label: string,
  options: { confirmed?: boolean; email?: string } = {},
): Promise<TestUser> {
  const email = options.email ?? uniqueEmail(label);
  const password = `Test-${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: options.confirmed ?? true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);
  const client = anonClient();
  if (options.confirmed ?? true) {
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`signIn failed: ${signIn.error.message}`);
  }
  return { id: data.user.id, email, password, client, ctx: { db: client, userId: data.user.id } };
}

/** Deletes users created in this file plus households/organizations they created. */
export async function cleanupTestUsers(): Promise<void> {
  const admin = adminClient();
  const ids = created.splice(0);
  if (ids.length === 0) return;
  await admin.from("households").delete().in("created_by", ids);
  await admin.from("organizations").delete().in("created_by", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}

/**
 * Enrolls an authenticator (TOTP) factor for the user and verifies it, upgrading their session to
 * aal2 — required for platform admin permissions. Returns the factor's secret.
 */
export async function verifySecondFactor(user: TestUser): Promise<string> {
  const { data, error } = await user.client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `test-${randomUUID()}`,
  });
  if (error) throw new Error(`mfa enroll failed: ${error.message}`);
  const verify = await user.client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (verify.error) throw new Error(`mfa verify failed: ${verify.error.message}`);
  return data.totp.secret;
}

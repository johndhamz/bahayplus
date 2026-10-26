import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listUsersForAdmin, updatePlatformSetting } from "@bahayplus/modules/admin";
import { loadPlatformAccess } from "@bahayplus/modules/authorization";
import { withDb } from "../support/db";
import { anonClient, cleanupTestUsers, createTestUser, verifySecondFactor, type TestUser } from "../support/supabase";
import { totp } from "../support/totp";

const reasonOf = (r: { ok: boolean; error?: { reason?: string; code?: string } }) =>
  r.ok ? "ok" : (r.error?.reason ?? r.error?.code);

let admin: TestUser;
let secret: string;

beforeAll(async () => {
  admin = await createTestUser("mfa-admin");
  await withDb((c) =>
    c.query(
      "insert into public.platform_admins (user_id, role_id) select $1, id from public.roles where scope = 'platform' and key = 'super_admin'",
      [admin.id],
    ),
  );
});
afterAll(async () => {
  await withDb((c) => c.query("delete from public.platform_admins where user_id = $1", [admin.id]));
  await cleanupTestUsers();
});

describe("platform admin powers require a second factor (S-02)", () => {
  it("a password-only session sees its admin row but holds no admin permissions", async () => {
    // The app needs the row to send the admin to the MFA step instead of a 404.
    expect((await loadPlatformAccess(admin.ctx)).ok).toBe(true);
    expect(reasonOf(await listUsersForAdmin(admin.ctx))).toBe("forbidden");
    expect(reasonOf(await updatePlatformSetting(admin.ctx, { key: "maintenance_banner", value: "x" }))).toBe(
      "forbidden",
    );
    const { data: audit } = await admin.client.from("audit_logs").select("id").limit(1);
    expect(audit).toEqual([]);
  });

  it("the same account gains its permissions once the session is verified with TOTP (aal2)", async () => {
    secret = await verifySecondFactor(admin);
    expect(reasonOf(await listUsersForAdmin(admin.ctx))).toBe("ok");
    const { data: audit } = await admin.client.from("audit_logs").select("id").limit(1);
    expect(audit).toHaveLength(1);
  });

  it("a new password sign-in starts at aal1 again until a code is entered", async () => {
    const fresh = anonClient();
    expect((await fresh.auth.signInWithPassword({ email: admin.email, password: admin.password })).error).toBeNull();
    const ctx = { db: fresh, userId: admin.id };
    expect((await fresh.auth.mfa.getAuthenticatorAssuranceLevel()).data?.nextLevel).toBe("aal2");
    expect(reasonOf(await listUsersForAdmin(ctx))).toBe("forbidden");

    const { data: factors } = await fresh.auth.mfa.listFactors();
    const wrong = await fresh.auth.mfa.challengeAndVerify({ factorId: factors!.totp[0]!.id, code: "000000" });
    expect(wrong.error).not.toBeNull();
    expect(reasonOf(await listUsersForAdmin(ctx))).toBe("forbidden");

    const right = await fresh.auth.mfa.challengeAndVerify({ factorId: factors!.totp[0]!.id, code: totp(secret) });
    expect(right.error).toBeNull();
    expect(reasonOf(await listUsersForAdmin(ctx))).toBe("ok");
  });
});

import { describe, expect, it } from "vitest";
import { EnvValidationError, parsePublicEnv, parseServerEnv } from "@/lib/env/schema";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx",
};

describe("environment validation", () => {
  it("accepts a valid public env and applies defaults", () => {
    const env = parsePublicEnv(validPublic);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("reports every missing public variable by name", () => {
    try {
      parsePublicEnv({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      expect((e as Error).message).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect((e as Error).message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it("rejects a non-URL Supabase URL", () => {
    expect(() => parsePublicEnv({ ...validPublic, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(EnvValidationError);
  });

  it("requires the server secret", () => {
    expect(() => parseServerEnv({})).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("refuses secrets exposed with the NEXT_PUBLIC_ prefix", () => {
    expect(() =>
      parseServerEnv({
        SUPABASE_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "x",
      }),
    ).toThrow(/NEXT_PUBLIC_/);
  });

  it("rejects a short job runner secret", () => {
    expect(() =>
      parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx", JOB_RUNNER_SECRET: "short" }),
    ).toThrow(/JOB_RUNNER_SECRET/);
  });
});

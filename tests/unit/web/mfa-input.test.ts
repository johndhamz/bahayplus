import { describe, expect, it } from "vitest";
import { VerifyMfaInput } from "@bahayplus/validation/identity/auth";

const factorId = "6f1c2b9e-3d4a-4c5b-8e7f-1a2b3c4d5e6f";

describe("VerifyMfaInput", () => {
  it("accepts a 6-digit code, ignoring spaces from a pasted '123 456'", () => {
    expect(VerifyMfaInput.parse({ factorId, code: "123 456" }).code).toBe("123456");
  });

  it.each(["12345", "1234567", "12a456", ""])("rejects %j", (code) => {
    expect(VerifyMfaInput.safeParse({ factorId, code }).success).toBe(false);
  });

  it("rejects a malformed factor id", () => {
    expect(VerifyMfaInput.safeParse({ factorId: "x", code: "123456" }).success).toBe(false);
  });
});

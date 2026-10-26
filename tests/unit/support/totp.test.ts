import { describe, expect, it } from "vitest";
import { totp } from "../../support/totp";

describe("test TOTP generator", () => {
  // RFC 6238 Appendix B (SHA-1 seed "12345678901234567890"), truncated to 6 digits.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("t=%i → %s", (seconds, code) => {
    expect(totp(secret, seconds * 1000)).toBe(code);
  });
});

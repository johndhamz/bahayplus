import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signatures: header `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
 * The timestamp is inside the signed payload, so an attacker can't refresh it; events older than the
 * tolerance are rejected (replay window), and the event id is unique in the database (exact replays).
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signPayload(secret: string, rawBody: string, timestampSeconds: number): string {
  const mac = createHmac("sha256", secret).update(`${timestampSeconds}.${rawBody}`).digest("hex");
  return `t=${timestampSeconds},v1=${mac}`;
}

export type SignatureCheck =
  { ok: true; signedAt: Date } | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

export function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return { ok: false, reason: "malformed" };
  if (Math.abs(nowSeconds - t) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "expired" };
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(v1, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "mismatch" };
  return { ok: true, signedAt: new Date(t * 1000) };
}

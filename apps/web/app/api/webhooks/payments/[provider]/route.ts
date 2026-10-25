import { NextResponse } from "next/server";
import { applyWebhook } from "@/lib/payments/server";

/**
 * Payment provider webhooks. The raw body is verified (signature + timestamp tolerance) BEFORE parsing;
 * the database then applies the event exactly once (unique provider event id, row-locked intent).
 * This is the only path by which a payment can become successful.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const result = await applyWebhook(provider, await request.text(), request.headers);
  switch (result.status) {
    case 404:
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown payment provider." } }, { status: 404 });
    case 400:
      // Unverified input is never recorded or applied.
      return NextResponse.json(
        { error: { code: "INVALID_SIGNATURE", message: "Webhook rejected.", reason: result.reason } },
        { status: 400 },
      );
    case 500:
      // A 5xx lets the provider retry; the unique event id keeps the retry idempotent.
      return NextResponse.json({ error: { code: "INTERNAL", message: "Processing failed." } }, { status: 500 });
    default:
      return NextResponse.json({ data: { outcome: result.outcome } });
  }
}

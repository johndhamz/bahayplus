import "server-only";
import { SandboxPaymentProvider, type PaymentProvider } from "@bahayplus/modules/payments";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * The configured payment provider, or null when online payments are disabled. No live gateway is
 * integrated; the sandbox is refused outside local/test so it can never run in production.
 */
export function paymentProvider(): PaymentProvider | null {
  const env = serverEnv();
  if (!env.PAYMENTS_PROVIDER || !env.PAYMENTS_WEBHOOK_SECRET) return null;
  if (env.PAYMENTS_PROVIDER === "sandbox") {
    if (env.APP_ENV !== "local" && env.APP_ENV !== "test") return null;
    return new SandboxPaymentProvider({
      webhookSecret: env.PAYMENTS_WEBHOOK_SECRET,
      siteUrl: publicEnv().NEXT_PUBLIC_SITE_URL,
    });
  }
  return null;
}

export function sandboxProvider(): SandboxPaymentProvider | null {
  const p = paymentProvider();
  return p instanceof SandboxPaymentProvider ? p : null;
}

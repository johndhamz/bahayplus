import "server-only";
import { MailpitEmailAdapter, ResendEmailAdapter, type ChannelAdapter } from "@bahayplus/modules/notifications";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/** The configured email adapter, or null when no provider is set up (deliveries are then marked not configured). */
export function emailAdapter(): ChannelAdapter | null {
  const env = serverEnv();
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  if (!env.EMAIL_FROM) return null;
  if (env.RESEND_API_KEY) return new ResendEmailAdapter({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, siteUrl });
  if (env.MAILPIT_URL && (env.APP_ENV === "local" || env.APP_ENV === "test"))
    return new MailpitEmailAdapter({ baseUrl: env.MAILPIT_URL, from: env.EMAIL_FROM, siteUrl });
  return null;
}

import { DeliveryError, isRetryableStatus, type ChannelAdapter, type OutboundMessage } from "../domain/channels";

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Plain, accessible transactional email. Links are absolute so they work from any mail client. */
export function renderEmail(
  message: OutboundMessage,
  siteUrl: string,
): { subject: string; text: string; html: string } {
  const url = message.link ? new URL(message.link, siteUrl).toString() : siteUrl;
  const settings = new URL("/account/notifications/settings", siteUrl).toString();
  const text = [message.title, message.body, "", `Open in Bahay+: ${url}`, "", `Manage notifications: ${settings}`]
    .filter((l, i) => l !== "" || i > 1)
    .join("\n");
  const html = `<!doctype html><html lang="en"><body style="font-family:Inter,Arial,sans-serif;background:#F6F3EB;padding:24px;color:#1f2a27">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px">
<p style="margin:0 0 4px;font-weight:700;color:#153D35">Bahay+</p>
<h1 style="font-size:18px;margin:12px 0 8px">${escapeHtml(message.title)}</h1>
${message.body ? `<p style="margin:0 0 16px;color:#4b5563">${escapeHtml(message.body)}</p>` : ""}
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#153D35;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none">Open in Bahay+</a></p>
<p style="font-size:12px;color:#6b7280;margin-top:24px"><a href="${escapeHtml(settings)}" style="color:#6b7280">Manage notification settings</a></p>
</div></body></html>`;
  return { subject: message.title, text, html };
}

async function post(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new DeliveryError(`Network error: ${e instanceof Error ? e.message : "unknown"}`, true);
  }
}

/** Production email via Resend's HTTP API. The delivery id is the idempotency key, so a retry never double-sends. */
export class ResendEmailAdapter implements ChannelAdapter {
  readonly channel = "email" as const;
  readonly provider = "resend";
  constructor(private readonly opts: { apiKey: string; from: string; siteUrl: string }) {}

  async send(message: OutboundMessage) {
    const email = renderEmail(message, this.opts.siteUrl);
    const res = await post("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.deliveryId,
      },
      body: JSON.stringify({
        from: this.opts.from,
        to: [message.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) throw new DeliveryError(`Resend responded ${res.status}`, isRetryableStatus(res.status));
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerMessageId: json.id };
  }
}

/** Local development only: delivers into the Mailpit inbox bundled with the Supabase CLI. */
export class MailpitEmailAdapter implements ChannelAdapter {
  readonly channel = "email" as const;
  readonly provider = "mailpit";
  constructor(private readonly opts: { baseUrl: string; from: string; siteUrl: string }) {}

  async send(message: OutboundMessage) {
    const email = renderEmail(message, this.opts.siteUrl);
    const res = await post(new URL("/api/v1/send", this.opts.baseUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: this.opts.from },
        To: [{ Email: message.to }],
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
        Headers: { "X-Bahayplus-Delivery": message.deliveryId },
      }),
    });
    if (!res.ok) throw new DeliveryError(`Mailpit responded ${res.status}`, isRetryableStatus(res.status));
    const json = (await res.json().catch(() => ({}))) as { ID?: string };
    return { providerMessageId: json.ID };
  }
}

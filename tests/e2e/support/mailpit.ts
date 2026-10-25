import { expect } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54724";

type MailpitSummary = { ID: string; Subject: string; Created: string };

/** Waits for the newest email to `to` whose subject matches, and returns the first link with `pathPart`. */
export async function latestLink(
  to: string,
  subject: RegExp,
  pathPart: string,
  baseURL: string,
  /** Called before each poll, e.g. to re-run a delivery worker until the email shows up. */
  nudge?: () => Promise<unknown>,
): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        await nudge?.();
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        const body = (await res.json()) as { messages: MailpitSummary[] };
        const message = body.messages.find((m) => subject.test(m.Subject));
        if (!message) return false;
        const detail = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as { HTML: string };
        const href = /href="([^"]+)"/g;
        for (const match of detail.HTML.matchAll(href)) {
          const url = match[1]!.replaceAll("&amp;", "&");
          if (url.includes(pathPart)) {
            // Emails use the configured site URL; point the link at the server under test.
            const parsed = new URL(url);
            link = `${baseURL}${parsed.pathname}${parsed.search}`;
            return true;
          }
        }
        return false;
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 3_000], message: `email "${subject}" to ${to}` },
    )
    .toBe(true);
  return link!;
}

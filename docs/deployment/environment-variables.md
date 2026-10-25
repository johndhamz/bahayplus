# Environment variables

Set these in Vercel (Project → Settings → Environment Variables), separately for **Preview/Staging** and **Production**. Never commit real values. `apps/web/.env.example` mirrors this list. The app validates the variables at startup (`apps/web/lib/env/schema.ts`) and refuses secrets that carry a `NEXT_PUBLIC_` prefix.

| Variable                               | Scope  | Required      | Description                                                                                                                                              |
| -------------------------------------- | ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | public | yes           | Supabase project API URL (`https://<ref>.supabase.co`). Also used to build the Content-Security-Policy.                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | yes           | Supabase publishable (anon) key. Safe in the browser; all access goes through RLS.                                                                       |
| `NEXT_PUBLIC_SITE_URL`                 | public | yes           | Canonical site URL (`https://bahayplus.ph`). Used in auth emails, invite links and notification emails.                                                  |
| `SUPABASE_SECRET_KEY`                  | server | yes           | Supabase secret (service-role) key. **Bypasses RLS.** Server only, never in client bundles; CI scans the bundles to enforce this.                        |
| `APP_ENV`                              | server | yes           | `staging` or `production`. `local`/`test` enable the payment sandbox and Mailpit; never use them on Vercel.                                              |
| `JOB_RUNNER_SECRET`                    | server | yes           | ≥32 characters. Bearer token for `/api/internal/jobs/*` (manual triggers or pg_net).                                                                     |
| `CRON_SECRET`                          | server | yes on Vercel | ≥32 characters. Vercel sends it as `Authorization: Bearer …` on cron calls.                                                                              |
| `EMAIL_FROM`                           | server | for email     | Sender, e.g. `Bahay+ <notifications@bahayplus.ph>`. Without it, email deliveries are recorded as `channel_not_configured`.                               |
| `RESEND_API_KEY`                       | server | for email     | Resend API key. The sending domain must be verified (SPF, DKIM, DMARC).                                                                                  |
| `PAYMENTS_PROVIDER`                    | server | no            | Leave **unset** in staging and production until a licensed provider adapter exists. Only `sandbox` is implemented, and it is refused outside local/test. |
| `PAYMENTS_WEBHOOK_SECRET`              | server | with provider | Webhook signing secret for the provider.                                                                                                                 |
| `ENABLE_DESIGN_PREVIEW`                | server | no            | `true` serves `/preview` sample-data pages in a production build. Keep it off in production.                                                             |
| `MAILPIT_URL`                          | server | local only    | Ignored outside `local`/`test`.                                                                                                                          |

Supabase project settings (not Vercel env):

- **Auth → URL configuration:** site URL = `NEXT_PUBLIC_SITE_URL`. Redirect URLs include `/auth/confirm` for staging and production.
- **Auth → SMTP:** a production SMTP provider for auth emails. The built-in sender is rate-limited and for testing only.
- **Auth → Rate limits:** keep the defaults or tighten them (sign-in, sign-up, OTP and password reset are throttled by Supabase Auth).
- **Database → Extensions:** `pg_cron`, `pgmq` and `pg_net`. Migrations create the first two.
- **API → Exposed schemas:** `public` only. The `private` schema must stay unexposed.

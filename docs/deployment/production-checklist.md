# Production deployment checklist

Do not launch with any unchecked item in **Blockers**.

## Blockers

- [ ] CI green on the release commit, including the full E2E suite and mobile performance budgets.
- [ ] Production Supabase: Singapore region, PITR enabled, daily backups verified, `private` schema not exposed.
- [ ] All required [environment variables](./environment-variables.md) set for Production; `APP_ENV=production`; `PAYMENTS_PROVIDER` **unset**; `ENABLE_DESIGN_PREVIEW` unset.
- [ ] Auth SMTP configured with a verified domain (SPF, DKIM, DMARC). The site URL and redirect URLs point to the production domain.
- [ ] Notification email: `EMAIL_FROM` and `RESEND_API_KEY` set, a test email received, or email deliberately disabled (recorded as not configured).
- [ ] Delivery worker scheduled: a Vercel per-minute cron (Pro) or pg_net calling `/api/internal/jobs/deliver`.
- [ ] Platform admins granted in SQL to named people only (`platform_admins`). Seed or demo accounts **do not exist** in production.
- [ ] Each admin has enrolled an authenticator app (first `/admin` visit) and knows the [lost-phone procedure](../operations/admin-mfa.md#an-admin-lost-their-phone). `auth.mfa_factors` holds no seeded factors.
- [ ] Legal: Terms of Service, Privacy Notice (Data Privacy Act), NPC registration and DPO decision, emergency disclaimer reviewed.
- [ ] Security findings marked "fix before launch" in [the audit](../security/audit-2026-10.md) resolved.
- [ ] Uptime monitor on `/api/health` and error alerting configured.

## Pre-release

- [ ] Migrations reviewed with `db push --dry-run` and applied to production.
- [ ] Rollback plan for this release written down (see [rollback](./rollback.md)).
- [ ] Support inbox staffed; incident contact list current.

## Post-release (first 30 minutes)

- [ ] `/api/health` returns 200 from outside the network.
- [ ] Sign up and sign in work; a verification email arrives.
- [ ] One booking flows from customer to provider; the provider receives the in-app notification.
- [ ] The Vercel function error rate and Supabase API 5xx rate are at baseline.
- [ ] No new `private.job_failures` rows or failed notification deliveries spike.

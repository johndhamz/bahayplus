# Staging deployment and production release

## One-time setup

1. **Supabase:** create two projects in the Singapore region, `bahayplus-staging` and `bahayplus-prod`. Enable PITR on production (Pro plan). Configure Auth URLs and SMTP (see [environment variables](./environment-variables.md)).
2. **Vercel:** import the repository and set **Root Directory = `apps/web`**. `apps/web/vercel.json` installs and builds from the monorepo root and pins the `sin1` region (close to the Supabase Singapore database).
3. **Environments:** Preview deployments use the staging Supabase project; Production uses the production project. Set the variables per environment.
4. **Crons:** `vercel.json` schedules `/api/internal/jobs/deliver` every minute (notification delivery and reminders) and `/api/internal/jobs/daily-bills` daily at 00:20 PHT as a fallback to pg_cron. Per-minute crons need a Vercel Pro plan. On Hobby, use pg_cron + pg_net to call the deliver endpoint with `JOB_RUNNER_SECRET`, or accept daily delivery.
5. **Domains:** add `bahayplus.ph` to the production project and `staging.bahayplus.ph` to the staging branch. HSTS is sent by the app.

## Staging deployment (every merge to `main`)

1. CI must be green: format, lint, typecheck, unit, production build, pgTAP, integration and security, and the E2E suite.
2. Apply migrations to staging: `npx supabase link --project-ref <staging>` then `npx supabase db push`.
3. The Vercel preview or staging deployment builds automatically. Check `https://staging…/api/health` for `{"status":"ok"}`.
4. Manual smoke on a mid-range Android phone over mobile data: sign up, create a household, add a property and a bill, browse providers, book, open the calendar, switch to the provider portal and confirm the booking, then install the PWA.

## Production release

Use the [production checklist](./production-checklist.md). Releases are promotions of a staging-verified commit:

1. Apply the same migrations to production (`db push --dry-run`, then `db push`).
2. Promote the verified deployment in Vercel ("Promote to Production"), or merge to the production branch.
3. Verify `/api/health`, sign in, and watch error rates for 30 minutes (see [monitoring](./monitoring-and-alerting.md)).

# Bahay+ — Launch readiness report

**Date:** 2026-10-26 · **Commit:** `e1c32eb` (Phase 11) · **Scope:** Phases 1–11

> **Verdict: ready for a staging deployment and a closed beta. _Not_ ready for a public production launch.** The code, schema and automated checks are in place, and static, unit, database, integration and security suites pass. The full end-to-end suite has not completed green in a single run on the development machine, which was heavily overloaded throughout. Several launch blockers also sit outside the code (provider accounts, legal and BSP decisions, MFA, edge rate limiting). See [§7](#7-launch-readiness-assessment).

---

## 1. Implemented feature inventory

| Area                       | What exists                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundation                 | Next.js 16 App Router (strict TS), Tailwind and shadcn/ui on the Bahay+ design system, npm-workspaces monorepo (`apps/web`, `modules/*`, `packages/{ui,types,validation}`), five portals behind one identity                                                                                                                   |
| Identity and access        | Email/password sign-up with verification, login, reset and per-device sign-out; household roles (owner…guest), organization roles (owner/manager/staff/worker) and platform roles (super admin/operations/support) as data; RLS on every table; a TypeScript permission mirror verified against the database                   |
| Households and properties  | Create, switch and settings; invitations (one-time links) and role management with last-owner protection; multiple Philippine-address properties, a default property, archive/restore; dashboard and activity feed                                                                                                             |
| Registry                   | Assets (warranty, maintenance history), pets (health records), vehicles (registration, insurance, maintenance); private file attachments verified by magic bytes, served through signed URLs                                                                                                                                   |
| Bills and budgets          | Bill accounts, generated bills, recorded payments (idempotent, concurrency-safe), reminders, monthly budgets, expenses and spending charts                                                                                                                                                                                     |
| Marketplace and trust      | Provider onboarding, services and pricing, coverage areas, portfolio, document verification with an admin review queue, verified badges, reviews only after completed bookings, locality-normalized search                                                                                                                     |
| Transactions               | Book Now with capacity control; requests and confirmations; reschedule and cancel; quotations (versioned, immutable once sent, expiring); projects with contracts, milestones, updates, change orders and warranty; work orders with checklists and overlap-safe assignments                                                   |
| Calendar and notifications | Unified calendar (bills, maintenance, pets, vehicles, bookings, milestones) with household, property, category and member filters plus assignment; durable reminder engine (pgmq); in-app and email notifications with preferences, retries, delivery records and failure logs; SMS and push as interfaces only                |
| Urgent discovery           | Opt-in urgent providers by area and category with availability freshness, contact methods and verification; 911 notice; no dispatch promise                                                                                                                                                                                    |
| Operational portals        | **Provider:** dashboard, staff, history, finance, settings, purchasing. **Supplier:** catalog, stock ledger, purchase orders and deliveries, reports. **Worker:** jobs, schedule, address, checklist, photos, evidence-gated completion. **Admin:** organizations, restricted users, categories, disputes, audit log, settings |
| Payments (architecture)    | Provider abstraction plus a labelled local sandbox; server-computed PHP intents; success only from signature-verified webhooks; refunds, commission, settlements, reconciliation; immutable payment events. Wallet: design document only                                                                                       |
| Production readiness       | PWA (manifest, icons, service worker, offline page); CSP and security headers; app rate limiting; performance indexes; `/api/health`; Vercel config with crons; CI pipeline; deployment, rollback, monitoring and backup documentation                                                                                         |

Database: 14 migrations, all additive. Docs index: [`docs/README.md`](./README.md).

## 2. Test execution results

Run on 2026-10-26 against a local Supabase stack (Docker) and a local production build. The machine was shared with other projects' Supabase stacks, with load averages between 4 and 40 and at times ~130 MB of free RAM. Timeouts below are attributed to that only where a rerun or the same test at another viewport passed.

| Suite                                                   | Result                                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format (Prettier), lint (ESLint, 0 warnings), typecheck | **Pass**                                                                                                                                                             |
| Unit and component (Vitest)                             | **180 / 180 pass** in UTC and in `TZ=Asia/Manila`                                                                                                                    |
| pgTAP (`supabase test db`)                              | **36 / 36 pass** (RLS coverage, household rules, security hardening)                                                                                                 |
| DB lint (`supabase db lint`)                            | **Clean**, after replaying all 14 migrations from scratch                                                                                                            |
| Integration (Vitest + Supabase)                         | **13 / 13 pass**                                                                                                                                                     |
| Security suites (9 files, run one file at a time)       | **145 / 145 pass**. Tenancy needed one rerun (setup timeout); the same happened to payments earlier. Running both projects in parallel produced timeouts under load. |
| Client bundle secret scan                               | **Pass** (no server secret values, `sb_secret_` keys or service-role tokens in `.next/static`)                                                                       |
| Production build                                        | **Pass**, including with placeholder-only config (as CI does)                                                                                                        |
| Mobile performance budgets                              | **Pass**: cold landing page 189 KB JS, LCP ≈ 1.0 s under 4× CPU, 150 ms RTT, 1.6 Mbps. Later pages were served from cache, so they are not cold measurements.        |
| `npm audit`                                             | **0 vulnerabilities**                                                                                                                                                |
| E2E (Playwright, 5 viewports)                           | **Not yet green in a single full run.** See below.                                                                                                                   |

E2E detail:

- **Latest complete per-spec run (Phase 10 code, 2026-10-25):** these passed:
  - auth 16/16;
  - calendar and notifications 5/5;
  - household management 8/8;
  - bills and budget 4/4;
  - portals 6/6;
  - payments 6/6;
  - navigation 70/70;
  - responsive 25/25;
  - accessibility 14/14.

  Not clean in that run:
  - marketplace passed 11/11 on rerun;
  - registry and transactions had failures caused by `createUser`/sign-in timeouts ("Processing this request timed out"). Each failing test passed in isolation at some point during the session.

- **Phase 11 additions:** passed in isolation:
  - PWA 3/3 (installability; offline fallback; caches contain only public static assets);
  - keyboard and accessibility 3/3 (keyboard-only login, dialog focus trap and return, WCAG 2.5.8 target size).
- **Current full run (Phase 11 code, in progress at writing):**
  - auth 16/16, household management 8/8, bills and budget 4/4 (2 flaky);
  - registry 4 failed. Rerun in isolation: 3/4 pass; the remaining failure is a 60 s timeout on desktop at load average 16, and the same test passed on mobile in 12 s;
  - the remaining specs had not finished.

**Requirement before launch:** the full Playwright suite must pass in CI on a clean runner (`.github/workflows/ci.yml` runs it on `main` and nightly). This has not been observed yet, because CI has not been run: nothing has been pushed to GitHub.

## 3. Security findings

Full report: [`docs/security/audit-2026-10.md`](./security/audit-2026-10.md). This is an internal review, not a third-party penetration test.

| ID   | Severity          | Finding                                                                            | Status                                                                                                                     |
| ---- | ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Medium (was High) | Auth runs in server actions, so Supabase sees the server IP for rate limiting      | **Mitigated in app:** per-IP and per-account limits for auth and invitations. **Add Vercel Firewall rules before launch.** |
| S-02 | Medium            | No MFA enforcement for platform admins                                             | **Open, fix before launch** (Supabase TOTP + require AAL2 on `/admin`)                                                     |
| S-03 | Medium            | Session cookies readable by JavaScript; CSP still allows `'unsafe-inline'` scripts | Open. Mitigated by React escaping and CSP; move to nonce-based CSP                                                         |
| S-04 | Low               | Abandoned (unregistered) uploads remain in private storage                         | Open. Add cleanup job                                                                                                      |
| S-05 | Low               | Invitation links are shared manually (no invitation email)                         | Open                                                                                                                       |
| S-06 | Low               | Webhook 400 responses reveal the rejection category                                | Accepted                                                                                                                   |

Positive controls verified by tests:

- RLS on every table, with no anon policies;
- server-only functions for money, jobs and the rate limiter;
- append-only audit, payment and stock histories;
- private document buckets;
- PHP-only currency constraints;
- cross-tenant isolation across households, organizations, workers, suppliers, payments and admin;
- webhook signature, replay and concurrency safety;
- no secrets in client bundles.

## 4. Known limitations

- **No live payment provider.** Only the labelled local sandbox exists; online payments stay disabled in staging and production. Bookings are paid off-platform.
- **Email** needs `EMAIL_FROM`, `RESEND_API_KEY` and a verified domain; until then deliveries are recorded as "not configured". **SMS and push** are interfaces only.
- The **delivery worker** needs a per-minute trigger (Vercel Pro cron or pg_cron + pg_net). On Vercel Hobby, cron frequency is daily.
- **Availability** is a simple concurrent-capacity model. There are no real provider calendars or crew schedules.
- **No image resizing**; uploaded photos are served at original size through signed URLs.
- **Invitations** are shared by link, not email. There is no self-service data export.
- **English only.** Filipino localisation is undecided (Q7).
- **Performance numbers are synthetic** (local network plus emulation). No real-device or field testing on provincial networks yet.
- **Accessibility:** automated axe, keyboard and target-size checks only. No manual screen-reader (TalkBack/VoiceOver) pass yet.

## 5. Remaining integrations

| Integration                         | Needed for                        | Notes                                                                                                                                                               |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Licensed payment provider (PSP/EMI) | Online payments                   | Implement `PaymentProvider`. Blocked on BSP decisions P-1–P-4 in [10 §7](./architecture/10-payments-and-wallet.md#7-decisions-required-before-launch-bsp-and-legal) |
| Resend (or another email provider)  | Notification and invitation email | Adapter exists; needs an account, verified domain and key                                                                                                           |
| Production SMTP for Supabase Auth   | Verification and reset emails     | The built-in sender is for testing only                                                                                                                             |
| SMS provider (Semaphore, M360, …)   | SMS reminders, phone OTP          | Interface and queue exist; vendor decision Q2                                                                                                                       |
| Web Push (VAPID) / FCM              | Push notifications                | Interface and queue exist                                                                                                                                           |
| Error tracking (Sentry)             | Production diagnostics            | Decision Q8                                                                                                                                                         |
| Uptime monitoring                   | Alerting                          | Point at `/api/health`                                                                                                                                              |
| Maps/geocoding (optional)           | Distance-based urgent discovery   | Decision Q6; area matching works without it                                                                                                                         |
| Wallet partner (future)             | Stored value                      | Design only; not to be built until the BSP decisions are resolved                                                                                                   |

## 6. Deployment instructions

Detailed guides are in [`docs/deployment/`](./deployment/). In short:

1. **Supabase:** create staging and production projects (Singapore). Enable PITR on production. Configure Auth site URL and redirect URLs (`/auth/confirm`) and production SMTP. Keep exposed schemas to `public`.
2. **Migrations:** `npx supabase link --project-ref <ref>`, then `npx supabase db push --dry-run`, then `npx supabase db push`. Staging first, then production. Never run the seed against hosted projects.
3. **Vercel:** import the repo with **Root Directory `apps/web`** (`vercel.json` builds from the monorepo root in `sin1` and schedules crons). Set the variables from [environment-variables.md](./deployment/environment-variables.md): `APP_ENV=staging|production`, Supabase URL and keys, `NEXT_PUBLIC_SITE_URL`, `JOB_RUNNER_SECRET`, `CRON_SECRET`, optional email variables. **Leave `PAYMENTS_PROVIDER` unset.**
4. **Verify:** `GET /api/health` should return `{"status":"ok"}`. Then run the manual smoke on a mid-range Android phone over mobile data and install the PWA.
5. **Release:** follow [production-checklist.md](./deployment/production-checklist.md). Roll back by promoting the previous Vercel deployment ([rollback.md](./deployment/rollback.md)).
6. **Operate:** monitoring and alert thresholds are in [monitoring-and-alerting.md](./deployment/monitoring-and-alerting.md); quarterly restore drills in [backup-and-recovery.md](./deployment/backup-and-recovery.md).

## 7. Launch readiness assessment

| Dimension                     | Status          | Basis                                                                                         |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| Functional scope (16 domains) | ✅ Built        | All approved domains implemented; non-approved features absent                                |
| Data security and tenancy     | ✅ Strong       | RLS everywhere, definer functions with permission checks, 145 security tests, pgTAP hardening |
| Financial integrity           | ✅ Architecture | Idempotency, row locks, immutable history, verified webhooks; no live money yet               |
| Static quality gates          | ✅ Pass         | Format, lint, typecheck, unit, pgTAP, integration, build                                      |
| End-to-end confidence         | ⚠️ Incomplete   | Specs pass individually; no single green full run yet; CI not yet executed                    |
| Performance                   | ⚠️ Synthetic    | Budgets pass under emulation; real-device and field testing pending                           |
| Accessibility                 | ⚠️ Automated    | axe + keyboard + target size pass; manual screen-reader audit pending                         |
| Operations                    | ⚠️ Documented   | Runbooks exist; monitoring and error tracking not yet provisioned                             |
| Legal and regulatory          | ❌ Open         | Terms, Privacy Notice, NPC registration, BSP questions (for payments)                         |

### Blockers for a public production launch

1. A green CI run on a clean runner, including the **full** Playwright suite.
2. Admin MFA (S-02) and Vercel Firewall rate limits (S-01 edge layer).
3. Production Supabase with PITR and verified backups, production Auth SMTP, and a scheduled delivery worker.
4. Legal: Terms of Service, Privacy Notice, Data Privacy Act/NPC registration, and an emergency-disclaimer review.
5. A third-party penetration test (recommended before handling real customer data at scale).

### Recommended path

1. Push to GitHub and get CI green.
2. Deploy to staging.
3. Run a closed beta with a few households and verified providers, with off-platform payments.
4. Close the blockers.
5. Do the public launch.
6. Online payments come later, as a separate release once a licensed provider and the BSP decisions are in place.

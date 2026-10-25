# 08 · Implementation Phases

Every phase follows the same loop: inspect repo → plan → implement → migrations → unit/integration tests → Playwright for critical flows → run lint/typecheck/tests/build → fix → summarize → list limitations. **No phase starts without explicit approval.**

| Phase | Name                                                                                    | Status   |
| ----- | --------------------------------------------------------------------------------------- | -------- |
| 1     | Foundation & design system                                                              | done     |
| 2     | Database foundation, auth, authorization, multi-tenant security                         | done     |
| 3     | Household management (households, members, invitations, properties, dashboard)          | done     |
| 4     | Asset registry, pets, vehicles (+ private attachments, due items)                       | done     |
| 5     | Bills & utilities, household budgeting (+ daily bill job, reminders)                    | done     |
| 6     | Provider marketplace & trust (registration, offerings, coverage, verification, reviews) | done     |
| 7     | Bookings, quotations, projects, work orders                                             | done     |
| 8     | Unified calendar, reminder engine & notifications, urgent provider discovery            | done     |
| 9     | Provider, supplier, worker & admin portals                                              | done     |
| 10    | Payment architecture & future wallet design (no stored value)                           | done     |
| 11    | Production readiness: PWA, performance, accessibility, QA, security, deployment, CI     | approved |

## Phase 7 implementation notes

- **Bookings** (`modules/bookings`, migration `…000900`): Book Now confirms instantly when the service and provider allow it **and** capacity remains (`provider_profiles.concurrent_capacity`, checked under a row lock on the provider). Otherwise the booking is `requested` and the provider confirms or declines. The state machine lives in `transition_booking`, mirrored for the UI by `allowedBookingActions`. Every change writes `booking_events` (append-only). Bookings are idempotent per household via `idempotency_key`. The exact address is released to the provider only after confirmation (`booking_location`).
- **Quotations:** versioned per service request. A draft is editable only by the provider. A sent quotation is immutable (DB guard). A new version supersedes the old one. Customers never see drafts. Acceptance is allowed only while `valid_until ≥ Manila today` and locks the price into the resulting booking.
- **Projects:** request → (site visit) → quotation → contract accepted (`quoted` + `contract_quotation_id`) → `active` → `completed` with warranty. Change orders must be approved by the customer before `approved_changes_centavos` moves. There is at most one pending change order per project.
- **Work orders:** created from a confirmed booking or an active project. A worker is assigned only if that worker holds `work_orders.perform`. Overlapping assignments for one worker are rejected by a `tstzrange` exclusion constraint. Checklists must be complete before a work order is completed. Completing a booking's last work order completes the booking.
- **UI:** the customer portal has `/bookings` (list, plus new booking/quote via `?provider=&service=&mode=`), `/bookings/[id]`, `/bookings/requests/[id]` and `/projects`. The provider portal has `/bookings`, `/quotations`, `/work-orders` and `/projects`. The worker portal UI is Phase 9.
- **Sign-out is per device** (`scope: "local"`, D-11).

## Phase 8 implementation notes

- **Durable jobs** (migration `…001000`, D-13): pgmq queues `reminders`, `notification_email`, `notification_sms` and `notification_push`. A message is archived only after it is handled. If a worker crashes, the message reappears after its visibility timeout. pg_cron only wakes the workers: `bahayplus-reminder-worker` runs every minute and `bahayplus-registry-reminders` runs daily at 00:15 PHT.
- **Notification pipeline:** `private.create_notification` writes one notification per recipient and dedupe key (exactly once), plus one `notification_deliveries` row per channel, following the recipient's preferences. Defaults: in-app and email on, SMS and push off. In-app is delivered in the database. Email is queued and sent by the app worker `POST /api/internal/jobs/deliver` (bearer `JOB_RUNNER_SECRET`) through a `ChannelAdapter`: Resend in production, Mailpit locally (`modules/notifications`).
- **Retries and failures:** retryable failures back off 30 s → 60 s → 120 s … up to 1 h, through `pgmq.set_vt`. A delivery fails after `max_attempts` (default 5) or on a non-retryable error. Every attempt is logged in `private.notification_delivery_attempts`. Reminder processing failures go to `private.job_failures`. Resend receives the delivery id as its idempotency key. A claim keeps reading past stale messages (deleted or already handled) until it has a full batch, and the endpoint drains in batches within a time budget, so a backlog can't starve new deliveries.
- **Access is re-checked at send time:** a removed member's queued email is skipped (`access_revoked`). Reminder fan-out uses current memberships, filtered by each reminder's `audience_permission`.
- **SMS and push are interfaces only.** Their queues exist, and `private.channel_settings` marks them disabled. A stored preference produces a `skipped / channel_not_configured` record, never "sent". Without `EMAIL_FROM` and a provider, email deliveries are skipped the same way.
- **Reminder engine** (`public.reminders`):
  - Sources: registry items (7 days before and on the due date, 08:00 PHT), confirmed bookings (24 h before) and project milestones (the day before). Bills keep their Phase 5 schedule but now go through the same pipeline.
  - Reminders are unique per `(household, dedupe_key)`. A source change cancels stale reminders (`source_changed`).
  - Cancelling or declining a booking cancels its reminders (`booking_cancelled`), including emails not yet sent.
- **Calendar:** `public.household_calendar(households[], from, to)` is security-invoker, so each source table's RLS applies. It combines bills, registry due items, bookings, milestones and site visits. Timed items are bucketed by their Manila date. Filters: household (this one or all of mine), category, property and assigned member. Assignments live in `calendar_assignments` (`calendar.assign` for owner, manager and member). Bookings default to the person who booked.
- **Urgent discovery:** `/app/h/[id]/services/urgent` uses `public.search_urgent_providers`. It returns listed providers that opted in (`provider_profiles.accepts_urgent`), offer an urgent-eligible category and serve the area. Results show service area, availability, freshness (stale after 24 h, flagged and sorted lower, never hidden), contact methods and verification. Unavailable providers are counted separately. The page always shows a 911 notice and makes no dispatch or response-time promise.
- **UI:** a header bell shows the unread count. `/account/notifications` is the inbox (all/unread, per-channel delivery status, mark read). `/account/notifications/settings` holds preferences, with SMS and push shown as not available. The household calendar has a month grid (tablet and up) and an agenda (all sizes).

## Phase 9 implementation notes

- **No new identity:** all four portals use the same `organizations`, `organization_members`, roles and platform roles. New permissions: `catalog.manage`, `orders.view`, `orders.manage`, `purchasing.manage` and `finance.view` (organization); `platform.users.manage`, `platform.categories.manage` and `platform.disputes.manage` (platform). Staff management is one shared component used by both business portals.
- **Provider portal:** adds an operations row on the dashboard, Staff, Job history, Financial summary, Settings (availability and Book Now capacity) and Purchasing. The financial summary shows only recorded values: agreed booking prices, completed project contracts and delivered purchases. No payments are processed.
- **Supplier domain** (migration `…001100`):
  - `supplier_profiles` (published = listed), `products`, and an append-only `stock_movements` ledger: on hand = sum of movements.
  - `purchase_orders` with snapshotted names, so neither side needs read access to the other's organization; plus `purchase_order_lines` and `deliveries`.
  - Order lifecycle: submitted → accepted, which reserves stock and is checked under product row locks so stock is never oversold → shipped, which writes fulfilment movements idempotently and creates a delivery → delivered (by the supplier, or confirmed by the buyer). Rejected and cancelled orders require a reason.
  - Delivery failures can be re-attempted. Buyers are service-provider organizations.
  - `product_inventory` returns rows only to the supplier's own catalog and order staff. Buyers see active products and prices, never stock.
- **Worker portal:**
  - Pages: Today, Jobs, Schedule, and job details. Job details show the address (`work_order_location`), checklist, before/after photos (shared `work_order` files; workers upload without being household members) and status updates.
  - Completing a job requires the checklist plus evidence: completion notes or an after/evidence photo (`evidence_required`).
  - Assignments stay active after completion so workers keep their history; cancellation releases them.
- **Admin portal:**
  - Pages: overview, organizations (suspend/reinstate), users (restricted directory), categories, disputes, audit log and settings.
  - Every command is a definer function that checks a specific platform permission and writes `audit_logs` with the reason.
  - Support sees masked emails and nothing inside households or businesses. Platform staff can read a booking only while it is under dispute.
  - Settings `maintenance_banner` (shown in every portal) and `urgent_stale_hours` (used by urgent discovery) are live.
- **Disputes** open automatically when a customer reports a problem with a completed job. Operations take a dispute and resolve or dismiss it, and both sides are notified.

## Phase 10 implementation notes

See [10 · Payments architecture and future PHP wallet](./10-payments-and-wallet.md).

- **Migration `…001200`:** commission rates, payment intents, refunds, an append-only `payment_events` log, a `private.webhook_events` replay ledger, settlements and settlement items, and reconciliation runs and items.
- **Success only from verified events:** `apply_payment_event` (service role only) runs after the webhook signature check (HMAC-SHA256 over `t.body`, ±5 min). Event ids are unique per provider, intent rows are locked, and amount and currency are checked. A late failure never downgrades a success.
- **Provider abstraction** (`PaymentProvider`): only an explicitly labelled **local sandbox** adapter exists, and it is refused unless `APP_ENV` is local or test. Its checkout page delivers outcomes as signed webhooks through the same verified path. In production, `PAYMENTS_PROVIDER` is unset, so the pay buttons stay hidden.
- **Refunds** are partial and capped under a row lock (`overrefund`), idempotent per key, and confirmed only by provider events. Owners and managers (`payments.refund`) or platform finance can request them.
- **Commission** uses exact integer bps, frozen at success, with per-organization overrides that can't be backdated. **Settlements** charge commission on the net; refunds after settlement become negative adjustments, and each payment or refund is settled once. **Reconciliation** classifies provider report lines against the ledger.
- **Pages:** a customer payment panel on bookings, the sandbox checkout, provider Payments (with refunds and settlements), and admin Payments (settlements, commission, reconciliation).

## Phase details

### 1 · Foundation & design system

Next.js App Router (strict TS), Tailwind, shadcn/ui, Lucide, design tokens, fonts; Supabase client/server utilities; env validation; ESLint/Prettier/Vitest/Playwright; shared component library; route shells for `/`, `/login`, `/signup` and the five portals behind an auth gate; labelled sample-data previews.
**Exit:** app runs; lint, typecheck, unit and E2E navigation tests pass; layouts verified at 375/390/430 px, tablet and desktop.

### 2 · Database foundation, auth & tenancy security

Migrations: `profiles`, `households`, `household_members`, `household_invitations`, `properties`, `organizations`, `organization_members`, `roles`, `permissions`, `role_permissions`, `audit_logs`. Email/password sign-up, verification, login, logout, password reset, profile. RLS for every tenant table; definer functions for invitation acceptance and membership changes; last-owner protection; server-side authorization helpers; context selector; local seed; security integration tests.
**Exit:** the seven security properties in the Phase 2 brief are proven by automated tests.

### 3 · Household management

Create/edit/switch households, invite members, assign roles, remove memberships, multiple properties (PH address, optional coordinates), archive, default property, household dashboard, recent activity.
**Exit:** owner/manager flows E2E; permission and edge-case tests (duplicate/expired invitations, archived property references, no properties).

### 4 · Asset registry, pets, vehicles

Assets (warranty, maintenance history), pets (vaccinations, vet & grooming history, care preferences), vehicles (registration, insurance, mileage, service history), private Storage attachments, maintenance/expiry reminders stored as data for the Phase 5 engine, references usable by future service requests.
**Exit:** CRUD with cross-household isolation and storage access tests.

### 5 · Calendar & reminders

Durable jobs (outbox, pgmq, pg_cron), notification port (email + in-app), unified calendar, reminder delivery that is idempotent under retries.

### 6 · Bills & budgeting

Biller catalog, bill accounts, bills, **recorded** payments, budgets, expenses, derived expenses via events.

### 7 · Organizations & provider trust

Provider/supplier onboarding, org members, locations, verification requests with documents, admin review queue, trust levels.

### 8 · Marketplace & service orders

Categories, provider services, service areas, search; request → quotation → booking → appointment; reviews; payments port with `manual` adapter.

### 9 · Field worker operations

Work orders, assignments, worker portal, status events, photo evidence, completion.

### 10 · Urgent provider discovery

PostGIS proximity, availability, broadcast with expiry, race-safe offer acceptance.

### 11 · Renovation & custom projects

Projects, milestones, change orders, documents.

### 12 · Supplier, inventory & logistics

Products, stock ledger, purchase orders, deliveries.

### 13 · Business & admin operations, launch hardening

Org reports, admin console, DPA export/deletion, observability, security review, load tests, backup drill.

## Explicitly out of scope until approved

Digital Home Vault (standalone), rental/tenant management, family tasks & chores, shared household expenses, recurring service payments, direct utility bill payments, cashback & rewards, messaging, referral & rewards, and **any** Bahay+ Wallet functionality beyond the payments port.

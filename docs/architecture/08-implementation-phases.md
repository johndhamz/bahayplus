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
| 8     | Unified calendar, reminder engine & notifications, urgent provider discovery            | approved |
| 9     | Provider, supplier, worker & admin portals                                              | approved |
| 10    | Payment architecture & future wallet design (no stored value)                           | approved |
| 11    | Production readiness: PWA, performance, accessibility, QA, security, deployment, CI     | approved |

## Phase 7 implementation notes

- **Bookings** (`modules/bookings`, migration `…000900`): Book Now confirms instantly when the service and provider allow it **and** capacity remains (`provider_profiles.concurrent_capacity`, checked under a row lock on the provider). Otherwise the booking is `requested` and the provider confirms or declines. The state machine lives in `transition_booking`, mirrored for the UI by `allowedBookingActions`. Every change writes `booking_events` (append-only). Bookings are idempotent per household via `idempotency_key`. The exact address is released to the provider only after confirmation (`booking_location`).
- **Quotations:** versioned per service request. A draft is editable only by the provider. A sent quotation is immutable (DB guard). A new version supersedes the old one. Customers never see drafts. Acceptance is allowed only while `valid_until ≥ Manila today` and locks the price into the resulting booking.
- **Projects:** request → (site visit) → quotation → contract accepted (`quoted` + `contract_quotation_id`) → `active` → `completed` with warranty. Change orders must be approved by the customer before `approved_changes_centavos` moves. There is at most one pending change order per project.
- **Work orders:** created from a confirmed booking or an active project. A worker is assigned only if that worker holds `work_orders.perform`. Overlapping assignments for one worker are rejected by a `tstzrange` exclusion constraint. Checklists must be complete before a work order is completed. Completing a booking's last work order completes the booking.
- **UI:** the customer portal has `/bookings` (list, plus new booking/quote via `?provider=&service=&mode=`), `/bookings/[id]`, `/bookings/requests/[id]` and `/projects`. The provider portal has `/bookings`, `/quotations`, `/work-orders` and `/projects`. The worker portal UI is Phase 9.
- **Sign-out is per device** (`scope: "local"`, D-11).

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

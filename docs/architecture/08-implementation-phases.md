# 08 · Implementation Phases

Every phase follows the same loop: inspect repo → plan → implement → migrations → unit/integration tests → Playwright for critical flows → run lint/typecheck/tests/build → fix → summarize → list limitations. **No phase starts without explicit approval.**

| Phase | Name | Domains | Status |
|-------|------|---------|--------|
| 1 | Foundation & design system | — (platform) | approved |
| 2 | Database foundation, auth, authorization, multi-tenant security | 1 | approved |
| 3 | Household management (households, members, invitations, properties, dashboard) | 2, 3 | approved |
| 4 | Asset registry, pets, vehicles (+ attachments, basic reminders) | 4, 5, 6 | approved |
| 5 | Calendar & reminders engine, notifications, durable jobs | 9 | proposed |
| 6 | Bills & budgeting | 7, 8 | proposed |
| 7 | Organizations & provider trust | 16 (org side), 11 | proposed |
| 8 | Marketplace & service orders (+ payments port, manual adapter) | 10, 13 | proposed |
| 9 | Field worker operations | 13 (work orders) | proposed |
| 10 | Urgent provider discovery | 12 | proposed |
| 11 | Renovation & custom projects | 14 | proposed |
| 12 | Supplier, inventory & logistics | 15 | proposed |
| 13 | Business & admin operations, launch hardening | 16 | proposed |

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

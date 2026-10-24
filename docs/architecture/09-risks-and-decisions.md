# 09 · Risks & Open Decisions

## Technical risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R1 | **Scope size** — 16 domains, 5 portals | Slow delivery, shallow quality | Strict phase gates; each phase shippable; defer non-critical UI polish per phase |
| R2 | **RLS mistakes leak tenant data** | Severe (privacy, DPA breach) | Defence in depth (service checks + RLS); pgTAP matrix per table; CI check for RLS-enabled; no service role in request paths |
| R3 | **RLS performance** on membership joins | Slow pages at scale | `security definer` helpers, `(select auth.uid())`, composite indexes, `EXPLAIN` tests on hot queries |
| R4 | **Cross-tenant workflows** (household ↔ provider) | Over-sharing customer PII | Dual-sided policies; address/contact revealed only post-confirmation; column-limited views for provider side |
| R5 | **Background job reliability** on serverless | Missed or duplicated reminders | Postgres-native queue + outbox; idempotent handlers; unique occurrence keys; dead-letter + admin retry |
| R6 | **Money handling errors** | Financial disputes | Integer centavos, `Money` value object, PHP-only check constraint, allocation tests |
| R7 | **Timezone bugs** | Wrong due dates | `date` vs `timestamptz` rules; injected `Clock`; CI in two TZs |
| R8 | **Vendor lock-in / cost** (Supabase, Vercel, Maps, SMS) | Cost spikes | Ports for every vendor; budget alerts; cache geocoding |
| R9 | **Regulatory** — e-money (BSP), Data Privacy Act (NPC), consumer protection, contractor licensing | Legal exposure | No stored value; partner-licensed wallet only; privacy notices/consent; verification captures permits (DTI/SEC, BIR 2303, Mayor's permit, PCAB for contractors) |
| R10 | **Sensitive documents** (government IDs, clearances) | Breach impact | Private buckets, short-lived signed URLs, access audit, retention & deletion policy, encryption for ID numbers |
| R11 | **Single Next.js app for 5 portals** | Bundle bloat, coupling | Route-group layouts, server components by default, per-portal code splitting, import rules |
| R12 | **Next.js / Supabase API churn** (e.g. middleware → proxy, auth helpers) | Rework | Pin versions; wrap framework APIs in `platform/`; upgrade deliberately |
| R13 | **Fake data shown as real** | Trust & compliance | Sample data isolated in `src/preview`, visually labelled, lint-blocked from real routes |
| R14 | **Mobile connectivity** for field workers | Lost status updates | Idempotent status events with client-generated ids; offline queue (PWA) considered in Phase 9 |

## Open decisions (need an owner)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| Q1 | Sign-in methods at launch | Email/password, email OTP, phone OTP, Google, Facebook | Email + Google at Phase 2; phone OTP once SMS vendor chosen (phone is primary identity for many PH users) |
| Q2 | SMS vendor | Semaphore, Twilio, M360, others | Decide by cost & PH deliverability before phone OTP |
| Q3 | Online payment collection in marketplace MVP? | Off-platform only / PSP (PayMongo, Xendit, Maya, …) / escrow-like holds | Start off-platform with recorded payments; add PSP behind port after legal review |
| Q4 | Monetization | Commission, provider subscription, lead fees, household premium | Affects pricing/ledger tables — decide before Phase 8 |
| Q5 | Job runner | pgmq + pg_cron (Postgres-native) vs Inngest/Trigger.dev | Postgres-native (fewer vendors); revisit if workflows get long-running |
| Q6 | Maps & geocoding | Google Maps, Mapbox, OSM/Nominatim | Decide before Phase 10; PSGC-only addresses work until then |
| Q7 | Languages | English only / English + Filipino | Centralize strings from Phase 1; decide before launch |
| Q8 | Error tracking & logging | Sentry, Axiom, Better Stack, Vercel only | Sentry (free tier) + structured logs |
| Q9 | Data residency & NPC registration | Supabase Singapore + disclosure / other | Confirm with counsel |
| Q10 | Provider verification method | Manual admin review / third-party KYC | Manual in Phase 7, port for KYC vendor |
| Q11 | Reviews moderation policy | Post-booking only, edit window, provider replies | Post-completed-booking only, one per booking |
| Q12 | Field worker identity | Must workers have accounts? | Yes — needed for assignments & audit |
| Q13 | Domain & email sending domain | — | Needed before Phase 2 email flows |
| Q14 | Package manager / monorepo | npm single package vs pnpm + Turborepo monorepo | See D-01 |

## Decision log

| ID | Date | Decision | Rationale |
|----|------|----------|-----------|
| D-01 | 2026-10-24 | Single npm package; `src/contracts` + `src/shared` kept dependency-clean for later extraction to `packages/*` | No mobile app yet; avoids monorepo tooling overhead; extraction is mechanical. Revisit when React Native work starts |
| D-02 | 2026-10-24 | Modular monolith, one Supabase project | See [01](./01-overview.md#1-architectural-style) |
| D-03 | 2026-10-24 | Tenant context in URL, not session | Multi-tab safety, shareable links, simpler server authorization |
| D-04 | 2026-10-24 | Money as `bigint` centavos, PHP-only check constraint | Exactness; matches requirements |
| D-05 | 2026-10-24 | Text + check constraints instead of Postgres enums | Easier additive migrations |
| D-06 | 2026-10-24 | Platform admin flag in a table, not JWT `user_metadata` | `user_metadata` is user-editable |
| D-07 | 2026-10-24 | Bahay+ does not hold funds; payments behind `PaymentGateway` port, `manual` adapter first | Regulatory (BSP) — wallet only via licensed partner |

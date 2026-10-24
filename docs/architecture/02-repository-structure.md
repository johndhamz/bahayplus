# 02 · Repository Structure

## Decision: npm-workspaces monorepo (D-01, revised)

The repository follows the product owner's recommended layout: one Next.js app under `apps/web`, framework-independent domain modules under `modules/`, and shared packages under `packages/`. npm workspaces link them; Turbopack compiles workspace packages from source, so there is no separate build step. The `packages/validation` and `packages/types` packages are dependency-light so a future React Native app can consume them unchanged.

## Layout

```
bahayplus/
├── apps/
│   └── web/                         # @bahayplus/web — Next.js App Router (presentation + adapters)
│       ├── app/
│       │   ├── (public)/            # /
│       │   ├── (auth)/              # /login, /signup, password reset, auth callbacks
│       │   ├── app/                 # Customer portal   /app
│       │   ├── provider/            # Provider portal   /provider
│       │   ├── supplier/            # Supplier portal   /supplier
│       │   ├── worker/              # Field worker      /worker
│       │   ├── admin/               # Super admin       /admin
│       │   ├── preview/             # Design previews with labelled SAMPLE data (not served in prod by default)
│       │   └── api/                 # v1 REST (mobile/integrations) + internal job endpoints
│       ├── components/              # App-specific components (layout shell, portal widgets)
│       ├── hooks/
│       ├── lib/
│       │   ├── actions/             # Server Actions (thin adapters → modules)
│       │   ├── auth/                # session + request context resolution
│       │   ├── config/              # routes, navigation, site, service catalog
│       │   ├── env/                 # validated environment (public / server)
│       │   ├── supabase/            # server / browser / admin / proxy clients
│       │   └── preview/             # sample data — importable only by app/preview (lint-enforced)
│       └── proxy.ts                 # session refresh + coarse portal gate
├── modules/                         # @bahayplus/modules — domain modules, no Next.js/React
│   └── <module>/
│       ├── domain/                  # entities, value objects, pure rules
│       ├── application/             # use cases, authorization policies
│       ├── infrastructure/          # Supabase repositories, provider adapters
│       └── index.ts                 # public API (import as @bahayplus/modules/<module>)
├── packages/
│   ├── ui/                          # @bahayplus/ui — design tokens, shadcn/ui primitives, shared components
│   ├── types/                       # @bahayplus/types — shared kernel (Money, dates, Result) + generated DB types
│   └── validation/                  # @bahayplus/validation — Zod contracts shared by web, API and mobile
├── supabase/
│   ├── migrations/                  # timestamped SQL (source of truth)
│   ├── seed.sql                     # local reference data + local-only demo accounts
│   └── tests/                       # pgTAP database / RLS tests
├── tests/
│   ├── unit/                        # Vitest: shared kernel, domain logic, components (jsdom)
│   ├── integration/                 # Vitest against local Supabase: services, repositories
│   ├── security/                    # Vitest against local Supabase: tenant isolation, privilege escalation
│   ├── e2e/                         # Playwright journeys (5 viewports)
│   └── performance/                 # Load / query-plan checks
├── docs/
└── .github/workflows/               # CI
```

## Module names

| Module                       | Owns                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `identity`                   | profiles, auth flows, account settings                                                                               |
| `authorization`              | roles, permissions, role_permissions, policy checks, tenant context                                                  |
| `households`                 | households, household members, invitations                                                                           |
| `properties`                 | properties, PH addresses, property activity                                                                          |
| `assets`, `pets`, `vehicles` | household registries                                                                                                 |
| `bills`, `budgets`           | bills & utilities, budgeting & expenses                                                                              |
| `scheduling`                 | unified calendar, reminders engine                                                                                   |
| `notifications`              | notification channels, preferences, delivery records                                                                 |
| `providers`                  | provider organizations, profiles, trust & verification, reviews                                                      |
| `marketplace`                | categories, offerings, search, service areas, urgent discovery                                                       |
| `bookings`                   | bookings, quotations, appointments, work orders                                                                      |
| `projects`                   | renovation & custom projects                                                                                         |
| `suppliers`, `inventory`     | supplier catalog, stock, purchase orders, deliveries                                                                 |
| `payments`                   | payment interfaces, intents, settlements, reconciliation                                                             |
| `organizations`, `audit`     | shared organization membership; audit trail _(added to the recommended list because several modules depend on them)_ |

## Import rules (ESLint-enforced)

| From                                                        | May import                                    | Must not import                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/types`, `packages/validation`, `modules/*/domain` | each other, `zod`                             | Next.js, React, Supabase, `@bahayplus/ui`, `apps/web`                                             |
| `modules/*/application`, `modules/*/infrastructure`         | domain, packages, Supabase types              | Next.js, React, `@bahayplus/ui`, `apps/web`                                                       |
| `packages/ui`                                               | React, Next.js primitives, `@bahayplus/types` | Supabase, `apps/web`                                                                              |
| `apps/web`                                                  | everything above                              | `@/lib/preview/*` (except `app/preview`), `@/lib/supabase/admin` (except jobs/admin/internal API) |

The service-role client (`apps/web/lib/supabase/admin.ts`) starts with `import "server-only"`.

## Naming

- Files `kebab-case`; React components export `PascalCase`.
- DB `snake_case`, plural tables, `uuid` keys; API/TS `camelCase`; mapping happens in repositories.
- Migrations `YYYYMMDDHHMMSS_<module>_<change>.sql`.

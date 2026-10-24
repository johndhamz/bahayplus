# 02 · Repository Structure

## Decision: single package now, extractable contracts later

The repository starts as **one Next.js package** (npm), not a pnpm/Turbo monorepo. Typed contracts live in `src/contracts/`, have **no** dependency other than Zod and the shared kernel, and are linted to stay that way. When the React Native app starts, `src/contracts` and `src/shared` move to `packages/contracts` and `packages/shared` with no code changes. (Rationale and alternative in [09 › D-01](./09-risks-and-decisions.md#decision-log).)

## Layout

```
bahayplus/
├── docs/                         # Architecture, ADRs, runbooks
├── e2e/                          # Playwright specs (by portal) + fixtures
├── supabase/
│   ├── config.toml
│   ├── migrations/               # Timestamped SQL migrations (source of truth)
│   ├── tests/                    # pgTAP RLS / constraint tests (`supabase test db`)
│   └── seed.sql                  # Local-only reference data (categories, billers) — no fake users
├── public/
├── src/
│   ├── app/                      # Next.js routes ONLY (thin)
│   │   ├── (public)/             # /, marketing pages
│   │   ├── (auth)/               # /login, /signup, /auth/callback
│   │   ├── app/                  # Customer portal  (/app)
│   │   ├── provider/             # Provider portal  (/provider)
│   │   ├── supplier/             # Supplier portal  (/supplier)
│   │   ├── worker/               # Field worker     (/worker)
│   │   ├── admin/                # Super admin      (/admin)
│   │   └── api/
│   │       ├── v1/               # Public typed REST for mobile/integrations
│   │       └── internal/jobs/    # Job runner endpoints (secret-protected)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (generated, lightly themed)
│   │   ├── layout/               # AppShell, Sidebar, Header, MobileBottomNavigation, Breadcrumbs
│   │   ├── data/                 # DataTable, FilterPanel, SearchInput, StatCard
│   │   ├── feedback/             # EmptyState, ErrorState, LoadingSkeleton, ConfirmationDialog, StatusBadge
│   │   ├── forms/                # FormField and RHF helpers
│   │   └── domain/               # Presentational domain cards: ServiceCard, ProviderCard …
│   ├── contracts/                # Zod schemas + inferred types per module (shared with mobile)
│   │   └── <module>/…
│   ├── modules/                  # Domain modules (see 03)
│   │   └── <module>/
│   │       ├── domain/           # Entities, value objects, pure rules (no I/O)
│   │       ├── application/      # Use cases / services, authorization policies
│   │       ├── infrastructure/   # Supabase repositories, adapters
│   │       ├── actions.ts        # Server Actions (thin adapters)
│   │       └── index.ts          # Module public API — the only import surface
│   ├── platform/                 # Cross-cutting technical services
│   │   ├── supabase/             # client/server/admin clients, generated types
│   │   ├── auth/                 # session, current-user, context resolution, guards
│   │   ├── audit/
│   │   ├── jobs/                 # queue, outbox, runner
│   │   ├── notifications/        # ports + adapters
│   │   ├── payments/             # PaymentGateway port, manual adapter
│   │   ├── storage/
│   │   ├── idempotency/
│   │   └── env/                  # validated environment
│   ├── shared/                   # Shared kernel: Money, dates (Asia/Manila), Result, ids, errors
│   ├── config/                   # Navigation definitions, feature flags, site config
│   ├── preview/                  # Sample data for isolated visual previews ONLY (labelled)
│   └── styles/                   # globals.css, design tokens
├── tests/                        # Vitest setup, test utils, integration test helpers
├── .env.example
├── eslint.config.mjs · prettier.config.mjs · vitest.config.ts · playwright.config.ts
└── package.json
```

## Import rules

Enforced with ESLint (`no-restricted-imports` / boundaries rules):

| From | May import | Must not import |
|------|------------|-----------------|
| `shared/` | nothing internal | everything else |
| `contracts/` | `shared/`, `zod` | modules, platform, React, Next |
| `modules/*/domain` | `shared/`, own `domain/` | Next, React, Supabase, other modules |
| `modules/*/application` | own `domain/`, `contracts/`, `shared/`, platform **ports**, other modules' `index.ts` | Next, React, another module's internals |
| `modules/*/infrastructure` | Supabase, platform adapters | Next presentation code |
| `app/`, `components/` | modules' `index.ts`, `contracts/`, `components/` | module internals, `platform/supabase/admin` |
| `preview/` | anything | — but nothing outside Storybook-style preview routes may import it |
| `platform/supabase/admin` | — | Must start with `import 'server-only'` |

## Naming

- Files: `kebab-case.ts`; React components `PascalCase` exports.
- DB: `snake_case`, plural table names, `id uuid` PKs (`gen_random_uuid()`), FK `<entity>_id`.
- API/TS: `camelCase`. Mapping happens in repositories, never in components.
- Migrations: `YYYYMMDDHHMMSS_<module>_<change>.sql`.

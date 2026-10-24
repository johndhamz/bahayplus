# Bahay+

_Everything home. One app._

Bahay+ is a Philippines-first household operating system and home-services marketplace. It covers households, properties, members, pets, vehicles, bills, budgets and calendars. Five portals serve customers, service providers, suppliers, field workers and platform admins.

- **Architecture docs:** [`docs/`](./docs/README.md)
- **Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · Vitest · Playwright

## Repository layout

```
apps/web            Next.js app — routes, layouts, server actions (thin adapters)
modules/            Domain modules — framework-independent business logic
packages/ui         Design tokens, shadcn/ui primitives, shared components
packages/types      Shared kernel (Money in centavos, Asia/Manila dates, Result) + generated DB types
packages/validation Zod contracts shared by web, API and the future mobile app
supabase/           Migrations, seed, pgTAP tests
tests/              unit · integration · security · e2e · performance
```

Details and import rules: [`docs/architecture/02-repository-structure.md`](./docs/architecture/02-repository-structure.md).

## Getting started

Prerequisites: Node.js ≥ 22.12 (developed on 24), npm 11, and Docker (for local Supabase).

```bash
npm install
npm run db:start                 # local Supabase on ports 547xx (see supabase/config.toml)
npm run db:status                # copy the Publishable and Secret keys
cp apps/web/.env.example apps/web/.env.local   # then paste the keys
npm run dev                      # http://localhost:3000
```

Local auth emails (verification, password reset) are caught by the Supabase mail viewer at http://127.0.0.1:54724.

### Environment variables

All variables are validated at startup (`apps/web/lib/env`). See [`apps/web/.env.example`](./apps/web/.env.example).

| Variable                               | Scope           | Purpose                                                |
| -------------------------------------- | --------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | public          | Supabase API URL                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public          | Publishable (anon) key — RLS applies                   |
| `NEXT_PUBLIC_SITE_URL`                 | public          | Absolute site URL for auth email links                 |
| `SUPABASE_SECRET_KEY`                  | **server only** | Service-role key — bypasses RLS; jobs/admin/tests only |
| `JOB_RUNNER_SECRET`                    | **server only** | Shared secret for internal job endpoints               |
| `APP_ENV`                              | server          | `local` / `test` / `staging` / `production`            |
| `ENABLE_DESIGN_PREVIEW`                | server          | Serve `/preview` (sample data) in a production build   |

## Scripts

| Command                           | What it does                                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Run the web app                                                     |
| `npm run lint`                    | ESLint (incl. layer-boundary rules), zero warnings allowed          |
| `npm run typecheck`               | Next route typegen + `tsc` for the app, packages, modules and tests |
| `npm test`                        | Vitest unit + component tests                                       |
| `npm run test:integration`        | Vitest integration + security suites against local Supabase         |
| `npm run test:db`                 | pgTAP database tests (`supabase test db`)                           |
| `npm run test:e2e`                | Playwright at 375 / 390 / 430 px, tablet (768) and desktop (1280)   |
| `npm run db:reset`                | Recreate the local DB from migrations + seed                        |
| `npm run db:types`                | Regenerate `packages/types/src/database.ts`                         |

## Design system

Premium Modern Filipino: Primary `#153D35`, Background `#F6F3EB`, Accent `#E5C58A`, Terracotta `#C57A59`, Sage `#E0E9E2`, Surface `#FFFFFF`. Headings use Plus Jakarta Sans and body text uses Inter. The tokens live in [`packages/ui/src/styles/tokens.css`](./packages/ui/src/styles/tokens.css). The live gallery is at `/preview` in development, and every value on that page is clearly labelled **sample data**.

## Ground rules

- Money is integer centavos, PHP only, and is never a float.
- Timestamps are stored in UTC and shown in Asia/Manila time.
- Tenant data is protected by Postgres RLS **and** server-side authorization.
- Service-role secrets never reach the browser.
- Sample data appears only on `/preview` and is always labelled.
- Not-approved features (wallet, messaging, rewards, rentals, …) are not built. See [`docs/`](./docs/README.md).

# 07 · Testing Strategy

## Layers

| Layer               | Tool                             | Scope                                                                                            | Runs against                                | Target                                            |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------- |
| Unit                | Vitest                           | `shared/` (Money, dates), `domain/` rules & state machines, contracts, pure utils                | Nothing external                            | Fast (< 10 s), ≥ 90% lines on `shared` + `domain` |
| Component           | Vitest + Testing Library + jsdom | Shared UI components: rendering, states, a11y roles, keyboard                                    | jsdom                                       | Every component in `components/`                  |
| Service integration | Vitest (node)                    | Application services + repositories through real Postgres with RLS, signed in as different users | Local Supabase (`supabase start`, Docker)   | Every command/query                               |
| Database / RLS      | pgTAP via `supabase test db`     | Policy matrix: role × table × operation; constraints; triggers; helper functions                 | Local Supabase                              | Every `public` table                              |
| E2E                 | Playwright                       | Critical journeys per portal, auth redirects, responsive layouts                                 | `next build && next start` + local Supabase | Critical flows only                               |
| Accessibility       | `@axe-core/playwright`           | Zero serious/critical violations on key pages                                                    | Same as E2E                                 | Every portal landing page                         |

## RLS test matrix (example)

For each tenant table, tests assert as **anon**, **outsider** (authenticated, other household), each **role**, and **service role**:

| Actor    | select          | insert | update | delete |
| -------- | --------------- | ------ | ------ | ------ |
| anon     | ✗               | ✗      | ✗      | ✗      |
| outsider | ✗ (0 rows)      | ✗      | ✗      | ✗      |
| guest    | ✓ (basics only) | ✗      | ✗      | ✗      |
| member   | ✓               | ✓      | ✓      | ✗      |
| owner    | ✓               | ✓      | ✓      | ✓      |

A meta-test queries `pg_tables` and fails if any `public` table has RLS disabled or no policies.

## Test data

- **Factories** (`tests/factories/*`) create users via the Auth admin API and rows via service role, each test in its own household/org — no shared mutable fixtures.
- `supabase/seed.sql` holds only reference data (service categories, billers, PSGC subset). No fake users or transactions are seeded into any non-local environment.
- UI sample data lives in `src/preview/` and is rendered with a visible **"Sample data"** badge; tests assert real routes never import it.

## E2E critical flows (grow per phase)

| Phase | Flows                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Public pages render; unauthenticated access to each portal redirects to `/login?next=`; responsive shells at 375/390/430/768/1280 |
| 2     | Sign up → confirm → create household → invite member → member accepts; role restrictions visible                                  |
| 3+    | Registry CRUD; reminder fires; bill recorded → expense appears; request → quote → booking → work order → completion → review      |

E2E uses dedicated test accounts created by the setup project (`e2e/global-setup.ts`) and stored `storageState` per role.

## CI pipeline (GitHub Actions)

```
install → lint → typecheck → unit+component
       → supabase start → db reset (migrations) → supabase test db → integration
       → next build → playwright (chromium; webkit + mobile emulation on main)
```

Merge gates: all green, no skipped tests without a linked issue, migration lint (`supabase db lint`), generated DB types up to date.

## Rules

- Tests are executed before any claim that they pass; CI output is the record.
- Bugs get a failing test first.
- Time-dependent tests inject a clock (`Clock` port); never rely on wall time or the machine timezone (CI runs with `TZ=UTC` _and_ a job with `TZ=Asia/Manila`).
- Money tests cover rounding/allocation (e.g. splitting ₱100.00 into 3 lines).

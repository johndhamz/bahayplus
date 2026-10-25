# Database migration procedure

Migrations live in `supabase/migrations/` and are **forward-only and additive**. They are applied by the Supabase CLI and never edited after they reach staging.

## Authoring

1. Create `supabase/migrations/<UTC timestamp>_<name>.sql`.
2. Every new table: `enable row level security`, at least one policy, explicit `revoke` and `grant`. Every new `security definer` function: `set search_path = ''`, an explicit permission check, and a `revoke` from `public, anon`. `supabase/tests/00_rls_coverage.test.sql` and `03_security_hardening.test.sql` fail the build otherwise.
3. Locally:
   ```bash
   npm run db:reset    # replays every migration + seed
   npm run db:lint     # plpgsql lint, must report no issues
   npm run test:db     # pgTAP
   npm run db:types    # regenerate packages/types/src/database.ts and commit it
   npm run test:integration
   ```
4. **Expand, then contract.** Never drop or rename a column in the same release that stops using it. Ship the code that no longer needs it first, then drop it in a later migration.

## Applying to staging and production

```bash
npx supabase login
npx supabase link --project-ref <staging-ref>
npx supabase db push --dry-run   # review the SQL that will run
npx supabase db push             # applies pending migrations in order
```

- Staging first, then smoke-test, then production with the same commands and the production project ref.
- Apply migrations **before** promoting the Vercel deployment that depends on them. Additive migrations keep the previous deployment working.
- Never run `db reset` against a hosted project. `supabase/seed.sql` is local-only demo data.
- Long-running index builds on large tables: use `create index concurrently` in a migration of its own (outside a transaction).

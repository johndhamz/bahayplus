# Backup and recovery

| Asset                   | Mechanism                                                                                                                                                          | RPO         | RTO (target) |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------ |
| Postgres (all data)     | Supabase daily backups plus **PITR** (Pro add-on) on production                                                                                                    | ≤ 2 minutes | 1 hour       |
| Storage (files, photos) | Supabase Storage (S3-backed, replicated). Weekly `supabase storage` export of `household-files` and `organization-files` to an encrypted, access-controlled bucket | 7 days      | 4 hours      |
| Code and config         | Git (GitHub) plus Vercel deployment history                                                                                                                        | 0           | minutes      |
| Secrets                 | Vercel and Supabase dashboards; a sealed copy in the company password manager                                                                                      | n/a         | 1 hour       |

## Restore drill (quarterly)

1. Restore production PITR to a **new** Supabase project at "now minus 1 hour".
2. Point a preview deployment at it and run `npm run test:e2e:smoke` against it (`E2E_BASE_URL`).
3. Record the time taken and any gaps in this file.

## Data subject requests (Data Privacy Act)

- Account deletion removes the auth user. Memberships cascade. `audit_logs.actor_id` intentionally keeps the bare id (no foreign key) for accountability.
- Exports: a platform admin assembles the user's own records with SQL. A self-service export is a roadmap item.

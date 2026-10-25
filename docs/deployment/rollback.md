# Rollback strategy

## Application (fast, preferred)

- Vercel keeps every deployment. **Instant rollback:** Deployments, then the previous production deployment, then "Promote to Production" (or `vercel rollback`). This takes seconds and needs no rebuild.
- Because migrations are additive (expand → contract), the previous deployment runs against the newer schema.

## Database

- **Never** roll back by editing or deleting applied migrations.
- To undo a bad migration, write a new forward migration that reverses it, test it with `db reset`, then push it to staging and production.
- Data damage (bad bulk update, accidental deletes): restore with **PITR** to a new branch or project at a timestamp just before the incident. Extract the affected rows and re-apply them through a reviewed SQL script. Restoring the whole production database in place is a last resort, because it discards every write since the restore point.
- Financial tables (`payment_events`, `audit_logs`, `stock_movements`) are append-only. Corrections are compensating entries, never deletes.

## Feature-level kill switches

- **Online payments:** unset `PAYMENTS_PROVIDER` and redeploy. Pay buttons disappear, and existing records and webhooks remain intact.
- **Email:** unset `EMAIL_FROM`. Deliveries are recorded as `channel_not_configured`.
- **Maintenance banner:** Admin → Platform settings → maintenance banner (instant, audited).
- **A misbehaving organization:** Admin → Organizations → Suspend (audited; members lose access and the business is delisted).
- **Background jobs:** `select cron.unschedule('bahayplus-reminder-worker');` (re-create from the migration when fixed).

-- Phase 11 security audit assertions (complements 00_rls_coverage).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select array_agg(tablename || '.' || policyname order by tablename, policyname)
     from pg_policies where schemaname = 'public' and (roles && array['anon', 'public']::name[])),
  null,
  'no RLS policy is granted to anon or public: the API requires sign-in for all tenant data'
);

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('apply_payment_event', 'attach_payment_reference', 'attach_refund_reference', 'claim_notification_deliveries',
                        'complete_notification_delivery', 'fail_notification_delivery', 'skip_notification_delivery',
                        'run_reminder_worker', 'run_daily_bill_jobs', 'consume_rate_limit')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  null,
  'server-only functions (verified payment events, delivery worker, jobs) are not callable by signed-in users'
);

-- RLS policies call private.* helpers, so API roles need USAGE on the schema; what must hold is that
-- private tables grant them nothing (and the schema is not exposed by PostgREST — see supabase/config.toml).
select is(
  (select array_agg(c.relname order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relkind = 'r'
      and (has_table_privilege('authenticated', c.oid, 'select') or has_table_privilege('anon', c.oid, 'select'))),
  null,
  'private tables (job runs, webhook replay ledger, delivery attempts, settings) are unreadable by API roles');

select is(
  (select array_agg(t order by t) from unnest(array['audit_logs', 'payment_events', 'stock_movements']) t
    where not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                      where c.relname = t and c.relnamespace = 'public'::regnamespace and g.tgname like '%immutable%')),
  null,
  'financial and audit histories are append-only (immutability triggers present)'
);

select is(
  (select array_agg(id order by id) from storage.buckets where id in ('household-files', 'organization-files') and public),
  null,
  'household and verification document buckets are private'
);

select is(
  (select array_agg(t order by t)
     from unnest(array['payment_intents', 'refunds', 'settlements', 'settlement_items', 'payment_events', 'audit_logs',
                       'notification_deliveries', 'stock_movements', 'purchase_orders', 'reminders']) t
    where has_table_privilege('authenticated', 'public.' || t, 'insert')
       or has_table_privilege('authenticated', 'public.' || t, 'update')
       or has_table_privilege('authenticated', 'public.' || t, 'delete')),
  null,
  'money, audit, delivery and order tables cannot be written directly by signed-in users'
);

select is(
  (select array_agg(t order by t)
     from unnest(array['payment_intents', 'refunds', 'audit_logs', 'households', 'properties', 'bills', 'files']) t
    where has_table_privilege('anon', 'public.' || t, 'select')
      and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.roles && array['anon', 'public']::name[])),
  null,
  'anonymous visitors cannot read household, financial or file records'
);

select is(
  (select array_agg(c.conrelid::regclass::text order by 1)
     from pg_constraint c
    where c.contype = 'c' and c.connamespace = 'public'::regnamespace
      and pg_get_constraintdef(c.oid) like '%currency%' and pg_get_constraintdef(c.oid) not like '%PHP%'),
  null,
  'every currency column is constrained to PHP'
);

select * from finish();
rollback;

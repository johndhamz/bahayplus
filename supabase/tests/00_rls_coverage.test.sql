-- Every table exposed through the API must have RLS enabled and at least one policy,
-- and every SECURITY DEFINER function must pin its search_path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select array_agg(c.relname order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null,
  'all public tables have RLS enabled'
);

select is(
  (select array_agg(c.relname order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  null,
  'all public tables have at least one policy'
);

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  null,
  'all SECURITY DEFINER functions pin search_path'
);

select is(
  (select array_agg(p.proname order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon cannot execute any SECURITY DEFINER function'
);

select * from finish();
rollback;

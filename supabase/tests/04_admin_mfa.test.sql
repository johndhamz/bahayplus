-- Admin MFA (S-02): platform permissions exist only in sessions verified with a second factor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create or replace function pg_temp.act_as(p_user uuid, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@mfa.test', now(), '{}', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id, role_id)
  select '00000000-0000-0000-0000-0000000000c1', id from public.roles where scope = 'platform' and key = 'super_admin';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal1');
select is(private.has_platform_permission('platform.access'), false, 'a password-only (aal1) admin session has no platform permissions');
select is((select count(*)::int from public.platform_admins where user_id = auth.uid()), 1,
  'an aal1 admin can still see its own admin row (so the app can ask for the second factor)');
select is((select count(*)::int from public.audit_logs), 0, 'an aal1 admin cannot read the audit log');
select throws_ok($$ select * from public.admin_list_users(null, 10, 0) $$, 'P0001', 'forbidden',
  'admin functions refuse an aal1 session');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1', 'aal2');
select is(private.has_platform_permission('platform.access'), true, 'the same admin verified with MFA (aal2) has its permissions');
select lives_ok($$ select * from public.admin_list_users(null, 10, 0) $$, 'admin functions work in an aal2 session');
reset role;

select * from finish();
rollback;

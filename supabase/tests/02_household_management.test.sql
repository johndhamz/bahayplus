-- Default property integrity and activity-feed visibility by role.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'o@t.test', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'g@t.test', now(), 'authenticated', 'authenticated');
insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', 'One', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d2', 'Two', '00000000-0000-0000-0000-0000000000c1');
insert into public.household_members (household_id, user_id, role_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', private.household_role_id('owner')),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', private.household_role_id('owner')),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', private.household_role_id('guest'));
insert into public.properties (id, household_id, name, property_type) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'A', 'house'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'B', 'house');

select is((select default_property_id from public.households where id = '00000000-0000-0000-0000-0000000000d1'),
  '00000000-0000-0000-0000-0000000000e1'::uuid, 'first property becomes the default');
select throws_ok($$ update public.households set default_property_id = '00000000-0000-0000-0000-0000000000e2' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23503', null, 'cannot default to another household''s property');
update public.properties set archived_at = now() where id = '00000000-0000-0000-0000-0000000000e1';
select is((select default_property_id from public.households where id = '00000000-0000-0000-0000-0000000000d1'), null, 'archiving the default clears it');
select is((select is_active from public.properties where id = '00000000-0000-0000-0000-0000000000e1'), false, 'archived properties are inactive');
select throws_ok($$ update public.households set default_property_id = '00000000-0000-0000-0000-0000000000e1' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'P0001', 'property_archived', 'archived property cannot become default');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select ok((select count(*) from public.household_activity where household_id = '00000000-0000-0000-0000-0000000000d1') >= 3, 'owner sees property and member activity');
select throws_ok($$ insert into public.household_activity (household_id, kind, required_permission) values ('00000000-0000-0000-0000-0000000000d1', 'x.y', 'household.view') $$,
  '42501', null, 'activity cannot be written directly');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.household_activity where required_permission <> 'household.view'), 0, 'guest only sees basic household activity');
reset role;

select * from finish();
rollback;

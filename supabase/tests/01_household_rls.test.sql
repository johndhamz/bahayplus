-- Household RLS matrix: owner, member, guest, outsider and anon on households, properties and members.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- Fixtures (as superuser).
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@t.test', now(), '{"full_name":"Owner"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'member@t.test', now(), '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'guest@t.test', now(), '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'outsider@t.test', now(), '{}', 'authenticated', 'authenticated');

insert into public.households (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000b1', 'Home', '00000000-0000-0000-0000-0000000000a1');
insert into public.household_members (household_id, user_id, role_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', private.household_role_id('owner')),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', private.household_role_id('member')),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3', private.household_role_id('guest'));
insert into public.properties (household_id, name, property_type, created_by) values
  ('00000000-0000-0000-0000-0000000000b1', 'Main', 'house', '00000000-0000-0000-0000-0000000000a1');

-- Owner
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.households), 1, 'owner sees the household');
select is((select count(*)::int from public.household_members), 3, 'owner sees all members');
select lives_ok($$ insert into public.properties (household_id, name, property_type) values ('00000000-0000-0000-0000-0000000000b1', 'Second', 'condominium') $$, 'owner can add a property');
select is((select count(*)::int from public.properties), 2, 'owner sees both properties');
reset role;

-- Member
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.properties), 2, 'member sees properties');
select throws_ok($$ insert into public.properties (household_id, name, property_type) values ('00000000-0000-0000-0000-0000000000b1', 'Nope', 'house') $$,
  '42501', null, 'member cannot add a property');
update public.households set name = 'Member rename' where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select is((select name from public.households where id = '00000000-0000-0000-0000-0000000000b1'), 'Home', 'member cannot rename the household');

-- Guest
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.households), 1, 'guest sees household basics');
select is((select count(*)::int from public.properties), 0, 'guest cannot see properties');
select is((select count(*)::int from public.household_members), 1, 'guest sees only their own membership row');
reset role;

-- Outsider
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from public.households), 0, 'outsider sees no household');
select is((select count(*)::int from public.properties), 0, 'outsider sees no properties');
select throws_ok($$ insert into public.household_members (household_id, user_id, role_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4', private.household_role_id('owner')) $$,
  '42501', null, 'outsider cannot insert a membership');
select throws_ok($$ select public.change_household_member_role((select id from public.household_members limit 1), 'owner') $$,
  'P0001', 'not_found', 'outsider cannot change roles');
reset role;

-- Anonymous
set local role anon;
select is((select count(*)::int from public.households), 0, 'anon sees nothing');
reset role;

-- Last-owner protection applies to superuser writes too.
select throws_ok($$ delete from public.household_members where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'P0001', 'last_owner', 'the last owner cannot be removed');

select * from finish();
rollback;

-- =============================================================================
-- LOCAL DEVELOPMENT SEED ONLY. Runs on `supabase db reset`; never applied to hosted projects.
-- Demo accounts (password for all: BahayPlus-dev-2026):
--   owner@bahayplus.test     owns "Dela Cruz Household (demo)" — 2 properties
--   member@bahayplus.test    member of that household; also guest in "Santos Household (demo)"
--   provider@bahayplus.test  owns service provider "Mabuhay Home Services (demo)"
--   worker@bahayplus.test    field worker at Mabuhay Home Services
--   supplier@bahayplus.test  owns supplier "Bayanihan Hardware (demo)"
--   admin@bahayplus.test     platform super admin
-- Reference data (roles, permissions) lives in migrations, not here.
-- =============================================================================

do $$
declare
  v_password text := extensions.crypt('BahayPlus-dev-2026', extensions.gen_salt('bf'));
  v_user record;
begin
  for v_user in
    select * from (values
      ('10000000-0000-4000-8000-000000000001'::uuid, 'owner@bahayplus.test', 'Maria Dela Cruz (demo)'),
      ('10000000-0000-4000-8000-000000000002'::uuid, 'member@bahayplus.test', 'Jose Dela Cruz (demo)'),
      ('10000000-0000-4000-8000-000000000003'::uuid, 'provider@bahayplus.test', 'Ramon Reyes (demo)'),
      ('10000000-0000-4000-8000-000000000004'::uuid, 'worker@bahayplus.test', 'Andres Bautista (demo)'),
      ('10000000-0000-4000-8000-000000000005'::uuid, 'supplier@bahayplus.test', 'Liza Garcia (demo)'),
      ('10000000-0000-4000-8000-000000000006'::uuid, 'admin@bahayplus.test', 'Platform Admin (demo)'),
      ('10000000-0000-4000-8000-000000000007'::uuid, 'santos@bahayplus.test', 'Ana Santos (demo)')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email, v_password, now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_user.full_name), now(), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user.id, v_user.id::text,
            jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end;
$$;

-- Households
insert into public.households (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Dela Cruz Household (demo)', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Santos Household (demo)', '10000000-0000-4000-8000-000000000007');

insert into public.household_members (household_id, user_id, role_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', private.household_role_id('owner')),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', private.household_role_id('member')),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000007', private.household_role_id('owner')),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', private.household_role_id('guest'));

insert into public.properties (household_id, name, property_type, address_line, barangay, city_municipality, province, postal_code, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Family home (demo)', 'house', '12 Sampaguita St.', 'Barangay Malaya', 'Quezon City', 'Metro Manila', '1101', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', 'BGC condo (demo)', 'condominium', 'Unit 2304, Tower 1', 'Fort Bonifacio', 'Taguig', 'Metro Manila', '1634', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Santos residence (demo)', 'townhouse', '8 Narra Ave.', 'Barangay San Isidro', 'Antipolo', 'Rizal', '1870', '10000000-0000-4000-8000-000000000007');

-- Organizations
insert into public.organizations (id, kind, name, slug, created_by) values
  ('30000000-0000-4000-8000-000000000001', 'service_provider', 'Mabuhay Home Services (demo)', 'mabuhay-home-services-demo', '10000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000002', 'supplier', 'Bayanihan Hardware (demo)', 'bayanihan-hardware-demo', '10000000-0000-4000-8000-000000000005');

insert into public.organization_members (organization_id, user_id, role_id) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', private.organization_role_id('owner')),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', private.organization_role_id('worker')),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', private.organization_role_id('owner'));

-- Platform admin (granted directly in SQL — the only way admin roles are assigned).
insert into public.platform_admins (user_id, role_id) values
  ('10000000-0000-4000-8000-000000000006', (select id from public.roles where scope = 'platform' and key = 'super_admin'));

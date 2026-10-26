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

-- Admins must pass TOTP two-step verification (migration 20261025001500). The demo admin's
-- authenticator uses this PUBLIC, local-only secret: add it to an authenticator app as a setup key
-- (or let the E2E helper compute codes). Never seed a factor anywhere but local/CI databases.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at) values
  ('10000000-0000-4000-8000-0000000000f6', '10000000-0000-4000-8000-000000000006', 'Demo authenticator', 'totp', 'verified',
   'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', now(), now());

-- -----------------------------------------------------------------------------
-- Marketplace demo (local only): a verified, published provider with services and coverage.
-- -----------------------------------------------------------------------------
update public.provider_profiles set
  tagline = 'Plumbing, electrical and aircon care in Metro Manila (demo)',
  description = 'Licensed technicians serving Quezon City, Pasig and Taguig. This is demo data for local development.',
  phone = '+63 917 000 0000', email = 'hello@mabuhay.example',
  accepts_book_now = true, accepts_quote_requests = true, accepts_contact = true,
  availability_status = 'available', is_published = true, accepts_urgent = true,
  business_hours = '{"mon":[["08:00","18:00"]],"tue":[["08:00","18:00"]],"wed":[["08:00","18:00"]],"thu":[["08:00","18:00"]],"fri":[["08:00","18:00"]],"sat":[["09:00","15:00"]]}'
where organization_id = '30000000-0000-4000-8000-000000000001';

insert into public.provider_services (organization_id, category_id, title, description, pricing_model, price_centavos, unit_label, duration_minutes, allows_book_now)
select '30000000-0000-4000-8000-000000000001', id, t.title, t.descr, t.model, t.price, t.unit, t.minutes, t.book
from (values
  ('plumbing', 'Leak repair', 'Faucets, pipes and fixtures', 'starting_at', 80000::bigint, '', 60, true),
  ('aircon', 'Aircon cleaning (split type)', 'Indoor and outdoor unit cleaning', 'fixed', 150000::bigint, 'per unit', 90, true),
  ('electrical', 'Electrical inspection', 'Safety check of wiring and panel', 'quote_only', null::bigint, '', null::int, false)
) as t(slug, title, descr, model, price, unit, minutes, book)
join public.service_categories c on c.slug = t.slug;

insert into public.service_areas (organization_id, province, city_municipality) values
  ('30000000-0000-4000-8000-000000000001', 'Metro Manila', 'Quezon City'),
  ('30000000-0000-4000-8000-000000000001', 'Metro Manila', 'Pasig'),
  ('30000000-0000-4000-8000-000000000001', 'Metro Manila', 'Taguig');

insert into public.verification_requests (id, organization_id, status, submitted_by, decided_at, expires_on, decision_notes)
values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'approved',
        '10000000-0000-4000-8000-000000000003', now(), (now() + interval '1 year')::date, 'Demo approval');
insert into public.verification_items (request_id, organization_id, item_type, reference_number, valid_until, status) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'business_registration', 'DTI-DEMO-0001', (now() + interval '3 years')::date, 'verified'),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'mayors_permit', 'MP-DEMO-2026', (now() + interval '1 year')::date, 'verified');

-- A completed demo booking so the Dela Cruz household can leave a review.
insert into public.bookings (id, household_id, organization_id, status, completed_at)
values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'completed', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Supplier demo (local only): a published supplier with products and opening stock.
-- -----------------------------------------------------------------------------
update public.supplier_profiles set
  description = 'Plumbing, electrical and construction supplies for contractors in Metro Manila (demo).',
  phone = '+63 2 8000 0000', email = 'orders@bayanihan.example', address = '45 Rizal Ave., Caloocan (demo)',
  delivery_areas = 'Metro Manila', min_order_centavos = 50000, is_published = true
where organization_id = '30000000-0000-4000-8000-000000000002';

insert into public.products (id, organization_id, sku, name, description, category, unit, unit_price_centavos, reorder_level) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'PVC-12', 'PVC pipe ½" × 3 m', 'Schedule 40', 'Plumbing', 'pc', 18500, 20),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'WASHER-KIT', 'Faucet washer kit', '24 assorted washers', 'Plumbing', 'kit', 9500, 10),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'BRK-20A', 'Circuit breaker 20A', 'Plug-in type', 'Electrical', 'pc', 42000, 5),
  ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', 'TAPE-ELEC', 'Electrical tape', '19 mm × 10 m', 'Electrical', 'roll', 4500, 30),
  ('60000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', 'CEMENT-40', 'Portland cement 40 kg', '', 'Construction', 'bag', 26000, 15);

insert into public.stock_movements (organization_id, product_id, quantity, reason, note, idempotency_key)
select '30000000-0000-4000-8000-000000000002', id, q, 'receipt', 'Opening stock (demo)', 'seed-opening-' || sku
from (values ('60000000-0000-4000-8000-000000000001'::uuid, 'PVC-12', 120), ('60000000-0000-4000-8000-000000000002'::uuid, 'WASHER-KIT', 40),
             ('60000000-0000-4000-8000-000000000003'::uuid, 'BRK-20A', 8), ('60000000-0000-4000-8000-000000000004'::uuid, 'TAPE-ELEC', 200),
             ('60000000-0000-4000-8000-000000000005'::uuid, 'CEMENT-40', 3)) as t(id, sku, q);

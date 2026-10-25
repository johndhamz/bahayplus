-- =============================================================================
-- Phase 6 · Provider marketplace & trust
--
-- Listing rule: a provider appears in the marketplace only when its profile is published, the
-- organization is active, and it holds a current APPROVED verification (not expired/revoked).
-- Verification transitions are platform-admin-only SECURITY DEFINER functions (audited).
-- Badges show exactly which items were verified (e.g. DTI registration, Mayor's permit).
-- Providers never gain access to household data: marketplace tables hold only business data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions for booking services (households)
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('household', 'services.view', 'See bookings, quotations and service history'),
  ('household', 'services.book', 'Request services, book providers and write reviews');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('household', 'owner', 'services.view'), ('household', 'owner', 'services.book'),
  ('household', 'manager', 'services.view'), ('household', 'manager', 'services.book'),
  ('household', 'member', 'services.view'), ('household', 'member', 'services.book')
);

-- -----------------------------------------------------------------------------
-- Service taxonomy (platform reference data)
-- -----------------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  division text not null check (division in ('home', 'pet', 'vehicle', 'renovation')),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  urgent_eligible boolean not null default false,
  sort_order smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger service_categories_updated_at before update on public.service_categories for each row execute function private.set_updated_at();

insert into public.service_categories (division, slug, name, description, urgent_eligible, sort_order) values
  ('home', 'plumbing', 'Plumbing', 'Leaks, clogs, pipes, fixtures and water pumps', true, 10),
  ('home', 'electrical', 'Electrical', 'Wiring, outlets, breakers and lighting', true, 20),
  ('home', 'aircon', 'Aircon services', 'Cleaning, repair and installation', false, 30),
  ('home', 'cleaning', 'Home cleaning', 'General and deep cleaning', false, 40),
  ('home', 'pest-control', 'Pest control', 'Termites, cockroaches, rodents', false, 50),
  ('home', 'locksmith', 'Locksmith', 'Lockouts, lock changes and repairs', true, 60),
  ('home', 'appliance-repair', 'Appliance repair', 'Refrigerators, washing machines, water heaters', false, 70),
  ('home', 'gardening', 'Gardening & landscaping', 'Lawn, trees and garden care', false, 80),
  ('home', 'handyman', 'Handyman', 'Small repairs and installations', true, 90),
  ('pet', 'pet-grooming', 'Pet grooming', 'Bathing, trimming and nail care', false, 10),
  ('pet', 'vet-home-visit', 'Vet home visit', 'Check-ups and vaccinations at home', false, 20),
  ('pet', 'pet-sitting', 'Pet sitting & boarding', 'Feeding, walking and overnight care', false, 30),
  ('pet', 'pet-training', 'Pet training', 'Obedience and behaviour training', false, 40),
  ('vehicle', 'car-maintenance', 'Car maintenance (PMS)', 'Preventive maintenance and oil change', false, 10),
  ('vehicle', 'car-repair', 'Car repair', 'Mechanical and electrical repairs', false, 20),
  ('vehicle', 'roadside-assistance', 'Roadside assistance', 'Towing, flat tires, battery jump-start', true, 30),
  ('vehicle', 'car-wash', 'Car wash & detailing', 'Exterior wash, interior detailing', false, 40),
  ('vehicle', 'motorcycle-service', 'Motorcycle service', 'Tune-up and repairs', false, 50),
  ('renovation', 'renovation', 'Home renovation', 'Kitchens, bathrooms and full renovations', false, 10),
  ('renovation', 'carpentry', 'Carpentry & cabinetry', 'Cabinets, shelves and woodwork', false, 20),
  ('renovation', 'custom-furniture', 'Custom furniture', 'Made-to-order furniture', false, 30),
  ('renovation', 'painting', 'Painting', 'Interior and exterior painting', false, 40),
  ('renovation', 'roofing', 'Roofing & waterproofing', 'Leaks, gutters and roof repairs', true, 50),
  ('renovation', 'masonry-tiling', 'Masonry & tiling', 'Tiles, concrete and walls', false, 60);

-- -----------------------------------------------------------------------------
-- Locality normalisation for service-area matching (no maps provider required).
-- "City of Makati" / "Makati City" / "makati" → "makati"; "Brgy. San Antonio" → "san antonio".
-- -----------------------------------------------------------------------------
create or replace function public.normalize_locality(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(p_value, '')),
    '^(city of|municipality of|barangay|brgy\.?|bgy\.?)\s+', ''),
    '\s+(city|municipality)$', ''),
    '[^a-z0-9ñ ]+', ' ', 'g')), '');
$$;

-- -----------------------------------------------------------------------------
-- Provider profile (1:1 with service-provider organizations)
-- -----------------------------------------------------------------------------
create table public.provider_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  tagline text not null default '' check (char_length(tagline) <= 120),
  description text not null default '' check (char_length(description) <= 3000),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text not null default '' check (website = '' or website ~ '^https://'),
  messenger_url text not null default '' check (messenger_url = '' or messenger_url ~ '^https://(m\.me|www\.facebook\.com|facebook\.com)/'),
  year_established smallint check (year_established is null or year_established between 1900 and 2100),
  team_size smallint check (team_size is null or team_size between 1 and 10000),
  -- {"mon":[["08:00","17:00"]], ...} — validated in the application contract.
  business_hours jsonb not null default '{}'::jsonb,
  accepts_book_now boolean not null default false,
  accepts_quote_requests boolean not null default true,
  accepts_contact boolean not null default true,
  availability_status text not null default 'unavailable' check (availability_status in ('available', 'limited', 'unavailable')),
  availability_updated_at timestamptz,
  is_published boolean not null default false,
  rating_count integer not null default 0,
  rating_sum integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger provider_profiles_updated_at before update on public.provider_profiles for each row execute function private.set_updated_at();

create or replace function private.check_provider_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select kind from public.organizations where id = new.organization_id) <> 'service_provider' then
    perform private.raise_app_error('invalid_input', 'Only service-provider organizations have a marketplace profile.');
  end if;
  if tg_op = 'UPDATE' and new.availability_status is distinct from old.availability_status then
    new.availability_updated_at := now();
  end if;
  return new;
end;
$$;
create trigger provider_profiles_check before insert or update on public.provider_profiles for each row execute function private.check_provider_org();

-- Every new service-provider org gets an (unpublished) profile.
create or replace function private.create_provider_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'service_provider' then
    insert into public.provider_profiles (organization_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger organizations_provider_profile after insert on public.organizations for each row execute function private.create_provider_profile();
insert into public.provider_profiles (organization_id) select id from public.organizations where kind = 'service_provider' on conflict do nothing;

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid not null references public.service_categories (id),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  pricing_model text not null check (pricing_model in ('fixed', 'starting_at', 'hourly', 'per_unit', 'quote_only')),
  price_centavos bigint check (price_centavos is null or price_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  unit_label text not null default '' check (char_length(unit_label) <= 40),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 15 and 10080),
  allows_book_now boolean not null default false,
  allows_quote boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pricing_model = 'quote_only') = (price_centavos is null)),
  check (not allows_book_now or pricing_model in ('fixed', 'starting_at', 'hourly', 'per_unit'))
);
create index provider_services_org_idx on public.provider_services (organization_id) where is_active;
create index provider_services_category_idx on public.provider_services (category_id) where is_active;
create trigger provider_services_updated_at before update on public.provider_services for each row execute function private.set_updated_at();

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  province text not null check (char_length(btrim(province)) between 2 and 100),
  -- Null city = the whole province; null barangay = the whole city/municipality.
  city_municipality text check (city_municipality is null or char_length(btrim(city_municipality)) between 2 and 100),
  barangay text check (barangay is null or char_length(btrim(barangay)) between 2 and 100),
  province_norm text generated always as (public.normalize_locality(province)) stored,
  city_norm text generated always as (public.normalize_locality(city_municipality)) stored,
  barangay_norm text generated always as (public.normalize_locality(barangay)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (barangay is null or city_municipality is not null)
);
create unique index service_areas_unique on public.service_areas (organization_id, province_norm, coalesce(city_norm, ''), coalesce(barangay_norm, ''));
create index service_areas_match_idx on public.service_areas (province_norm, city_norm, barangay_norm);
create trigger service_areas_updated_at before update on public.service_areas for each row execute function private.set_updated_at();

create or replace function public.provider_serves(p_org uuid, p_province text, p_city text, p_barangay text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.service_areas a
    where a.organization_id = p_org
      and a.province_norm = public.normalize_locality(p_province)
      and (a.city_norm is null or public.normalize_locality(p_city) is null or a.city_norm = public.normalize_locality(p_city))
      and (a.barangay_norm is null or public.normalize_locality(p_barangay) is null or a.barangay_norm = public.normalize_locality(p_barangay))
  );
$$;

-- -----------------------------------------------------------------------------
-- Organization files: private verification documents + public portfolio
-- -----------------------------------------------------------------------------
create table public.organization_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bucket text not null check (bucket in ('organization-files', 'provider-portfolio')),
  object_path text not null unique,
  entity_type text not null check (entity_type in ('verification_item', 'portfolio')),
  entity_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (object_path like organization_id::text || '/' || entity_type || '/' || entity_id::text || '/%'),
  check ((entity_type = 'portfolio') = (bucket = 'provider-portfolio'))
);
create index organization_files_entity_idx on public.organization_files (entity_type, entity_id);
create trigger organization_files_updated_at before update on public.organization_files for each row execute function private.set_updated_at();

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category_id uuid references public.service_categories (id),
  completed_on date,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_items_org_idx on public.portfolio_items (organization_id);
create trigger portfolio_items_updated_at before update on public.portfolio_items for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected', 'expired', 'revoked')),
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewer_id uuid references auth.users (id) on delete set null,
  review_started_at timestamptz,
  decided_at timestamptz,
  -- Shown to the provider.
  decision_notes text not null default '' check (char_length(decision_notes) <= 2000),
  -- Admin-only (not selectable by providers; see column grants).
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  expires_on date,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or expires_on is not null),
  check (status <> 'revoked' or revoked_reason is not null)
);
-- One open (submitted/under review) request per organization at a time.
create unique index verification_requests_one_open on public.verification_requests (organization_id) where status in ('submitted', 'under_review');
create index verification_requests_queue_idx on public.verification_requests (status, submitted_at);
create trigger verification_requests_updated_at before update on public.verification_requests for each row execute function private.set_updated_at();

create table public.verification_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_type text not null check (item_type in ('business_registration', 'mayors_permit', 'bir_registration', 'government_id',
                                               'professional_license', 'nbi_clearance', 'insurance')),
  reference_number text not null default '' check (char_length(reference_number) <= 80),
  valid_until date,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, item_type)
);
create index verification_items_request_idx on public.verification_items (request_id);
create trigger verification_items_updated_at before update on public.verification_items for each row execute function private.set_updated_at();

-- Current approved verification of a provider (null if none or expired/revoked).
create or replace function private.current_verification(p_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.verification_requests
  where organization_id = p_org and status = 'approved' and expires_on >= private.manila_today()
  order by decided_at desc limit 1;
$$;

create or replace function private.is_listed_provider(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles pp join public.organizations o on o.id = pp.organization_id
    where pp.organization_id = p_org and pp.is_published and o.status = 'active' and o.kind = 'service_provider'
  ) and private.current_verification(p_org) is not null;
$$;

-- -----------------------------------------------------------------------------
-- Bookings (minimal; Phase 7 adds the full lifecycle). Reviews depend on completed bookings.
-- -----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  provider_service_id uuid references public.provider_services (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null))
);
create index bookings_household_idx on public.bookings (household_id, created_at desc);
create index bookings_org_idx on public.bookings (organization_id, created_at desc);
create trigger bookings_updated_at before update on public.bookings for each row execute function private.set_updated_at();

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  provider_reply text check (provider_reply is null or char_length(provider_reply) <= 1000),
  provider_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_org_idx on public.reviews (organization_id, created_at desc);
create trigger reviews_updated_at before update on public.reviews for each row execute function private.set_updated_at();

create or replace function private.refresh_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
begin
  update public.provider_profiles set
    rating_count = (select count(*) from public.reviews where organization_id = v_org),
    rating_sum = (select coalesce(sum(rating), 0) from public.reviews where organization_id = v_org)
  where organization_id = v_org;
  return coalesce(new, old);
end;
$$;
create trigger reviews_rating after insert or update of rating or delete on public.reviews for each row execute function private.refresh_provider_rating();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.service_categories enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.service_areas enable row level security;
alter table public.organization_files enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.verification_requests enable row level security;
alter table public.verification_items enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

create policy service_categories_read on public.service_categories for select to authenticated using (true);

-- Marketplace data: public when listed; always visible to the provider's own team and platform admins.
create or replace function private.can_see_provider(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_listed_provider(p_org)
      or private.is_organization_member(p_org)
      or private.has_platform_permission('platform.access');
$$;

-- Listed providers' organization rows (name, slug, kind) are public to signed-in users.
create policy organizations_listed_select on public.organizations for select to authenticated
  using ((select private.is_listed_provider(id)));
-- ...but never who created them.
revoke select on public.organizations from authenticated, anon;
grant select (id, kind, name, slug, status, created_at, updated_at) on public.organizations to authenticated;

create policy provider_profiles_select on public.provider_profiles for select to authenticated using ((select private.can_see_provider(organization_id)));
create policy provider_profiles_update on public.provider_profiles for update to authenticated
  using ((select private.has_organization_permission(organization_id, 'organization.update')))
  with check ((select private.has_organization_permission(organization_id, 'organization.update')));

do $$
declare
  t text;
begin
  foreach t in array array['provider_services', 'service_areas', 'portfolio_items'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select private.can_see_provider(organization_id)))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select private.has_organization_permission(organization_id, ''organization.update'')))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select private.has_organization_permission(organization_id, ''organization.update''))) with check ((select private.has_organization_permission(organization_id, ''organization.update'')))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select private.has_organization_permission(organization_id, ''organization.update'')))', t);
  end loop;
end;
$$;

-- Organization files: portfolio metadata follows provider visibility; verification documents are
-- restricted to the business's managers and verification admins.
create policy organization_files_select on public.organization_files for select to authenticated using (
  case when entity_type = 'portfolio' then (select private.can_see_provider(organization_id))
       else (select private.has_organization_permission(organization_id, 'organization.update'))
            or (select private.has_platform_permission('platform.verifications.decide')) end
);
create policy organization_files_insert on public.organization_files for insert to authenticated
  with check ((select private.has_organization_permission(organization_id, 'organization.update')));
create policy organization_files_delete on public.organization_files for delete to authenticated
  using ((select private.has_organization_permission(organization_id, 'organization.update')));

create policy verification_requests_select on public.verification_requests for select to authenticated using (
  (select private.has_organization_permission(organization_id, 'organization.update'))
  or (select private.has_platform_permission('platform.verifications.decide'))
);
create policy verification_items_select on public.verification_items for select to authenticated using (
  (select private.has_organization_permission(organization_id, 'organization.update'))
  or (select private.has_platform_permission('platform.verifications.decide'))
);

create policy bookings_select on public.bookings for select to authenticated using (
  (select private.has_household_permission(household_id, 'services.view'))
  or (select private.is_organization_member(organization_id))
);

create policy reviews_select on public.reviews for select to authenticated using (
  (select private.can_see_provider(organization_id)) or (select private.is_household_member(household_id))
);

-- Column privileges
revoke insert, update, delete on public.service_categories from authenticated;
revoke insert, update on public.provider_profiles from authenticated;
grant update (tagline, description, phone, email, website, messenger_url, year_established, team_size, business_hours,
  accepts_book_now, accepts_quote_requests, accepts_contact, availability_status, is_published) on public.provider_profiles to authenticated;
revoke update on public.provider_services, public.service_areas, public.portfolio_items from authenticated;
grant update (category_id, title, description, pricing_model, price_centavos, unit_label, duration_minutes, allows_book_now, allows_quote, is_active)
  on public.provider_services to authenticated;
grant update (title, description, category_id, completed_on, sort_order) on public.portfolio_items to authenticated;
revoke insert, update, delete on public.verification_requests, public.verification_items, public.bookings, public.reviews from authenticated;
-- Providers may not read internal admin notes.
revoke select on public.verification_requests from authenticated;
grant select (id, organization_id, status, submitted_by, submitted_at, reviewer_id, review_started_at, decided_at, decision_notes,
  expires_on, revoked_reason, created_at, updated_at) on public.verification_requests to authenticated;

-- -----------------------------------------------------------------------------
-- Storage buckets
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('organization-files', 'organization-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('provider-portfolio', 'provider-portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_org_object(p_bucket text, p_name text, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_org uuid;
begin
  if array_length(v_parts, 1) <> 4
     or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or (p_bucket = 'organization-files' and v_parts[2] <> 'verification_item')
     or (p_bucket = 'provider-portfolio' and v_parts[2] <> 'portfolio') then
    return false;
  end if;
  v_org := v_parts[1]::uuid;
  if p_mode = 'view' then
    return private.has_organization_permission(v_org, 'organization.update')
        or (p_bucket = 'organization-files' and private.has_platform_permission('platform.verifications.decide'));
  end if;
  return private.has_organization_permission(v_org, 'organization.update');
end;
$$;

create policy organization_files_read on storage.objects for select to authenticated
  using (bucket_id = 'organization-files' and (select private.can_access_org_object(bucket_id, name, 'view')));
create policy organization_files_write on storage.objects for insert to authenticated
  with check (bucket_id in ('organization-files', 'provider-portfolio') and (select private.can_access_org_object(bucket_id, name, 'manage')));
create policy organization_files_remove on storage.objects for delete to authenticated
  using (bucket_id in ('organization-files', 'provider-portfolio') and (select private.can_access_org_object(bucket_id, name, 'manage')));

-- -----------------------------------------------------------------------------
-- Verification workflow
-- -----------------------------------------------------------------------------
create or replace function public.submit_verification_request(p_org uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request uuid;
  v_item jsonb;
begin
  if not private.has_organization_permission(p_org, 'organization.update') then
    perform private.raise_app_error('forbidden', 'Only owners and managers can submit verification.');
  end if;
  if (select kind from public.organizations where id = p_org) <> 'service_provider' then
    perform private.raise_app_error('invalid_input', 'Only service providers are verified.');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.raise_app_error('invalid_input', 'Add at least one document to verify.');
  end if;
  if exists (select 1 from public.verification_requests where organization_id = p_org and status in ('submitted', 'under_review')) then
    perform private.raise_app_error('verification_open', 'A verification request is already being reviewed.');
  end if;
  insert into public.verification_requests (organization_id, submitted_by) values (p_org, auth.uid()) returning id into v_request;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.verification_items (request_id, organization_id, item_type, reference_number, valid_until)
    values (v_request, p_org, v_item ->> 'item_type', coalesce(v_item ->> 'reference_number', ''), (v_item ->> 'valid_until')::date);
  end loop;
  perform private.write_audit('verification.submitted', 'verification_request', v_request, null, p_org,
    jsonb_build_object('items', (select jsonb_agg(item_type) from public.verification_items where request_id = v_request)));
  return v_request;
end;
$$;

create or replace function public.start_verification_review(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.verification_requests%rowtype;
begin
  if not private.has_platform_permission('platform.verifications.decide') then
    perform private.raise_app_error('forbidden', 'Only verification admins can review requests.');
  end if;
  select * into v_req from public.verification_requests where id = p_request for update;
  if not found then
    perform private.raise_app_error('not_found', 'Request not found.');
  end if;
  if v_req.status <> 'submitted' then
    perform private.raise_app_error('invalid_transition', 'Only submitted requests can move to review.');
  end if;
  update public.verification_requests set status = 'under_review', reviewer_id = auth.uid(), review_started_at = now() where id = p_request;
  perform private.write_audit('verification.review_started', 'verification_request', p_request, null, v_req.organization_id, '{}'::jsonb);
end;
$$;

-- p_item_decisions: [{"item_id": "...", "status": "verified"|"rejected", "note": "..."}]
create or replace function public.decide_verification(
  p_request uuid, p_decision text, p_item_decisions jsonb, p_decision_notes text, p_internal_notes text, p_expires_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.verification_requests%rowtype;
  v_d jsonb;
begin
  if not private.has_platform_permission('platform.verifications.decide') then
    perform private.raise_app_error('forbidden', 'Only verification admins can decide requests.');
  end if;
  if p_decision not in ('approved', 'rejected') then
    perform private.raise_app_error('invalid_input', 'Decision must be approved or rejected.');
  end if;
  select * into v_req from public.verification_requests where id = p_request for update;
  if not found then
    perform private.raise_app_error('not_found', 'Request not found.');
  end if;
  if v_req.status <> 'under_review' then
    perform private.raise_app_error('invalid_transition', 'Start the review before deciding.');
  end if;
  -- Reviewers cannot approve their own organization.
  if private.is_organization_member(v_req.organization_id) then
    perform private.raise_app_error('forbidden', 'You cannot decide verification for an organization you belong to.');
  end if;
  for v_d in select * from jsonb_array_elements(coalesce(p_item_decisions, '[]'::jsonb)) loop
    update public.verification_items set status = v_d ->> 'status', reviewer_note = coalesce(v_d ->> 'note', '')
    where id = (v_d ->> 'item_id')::uuid and request_id = p_request and (v_d ->> 'status') in ('verified', 'rejected');
  end loop;
  if p_decision = 'approved' then
    if not exists (select 1 from public.verification_items where request_id = p_request and status = 'verified') then
      perform private.raise_app_error('invalid_input', 'Mark at least one document as verified before approving.');
    end if;
    if p_expires_on is null or p_expires_on <= private.manila_today() then
      perform private.raise_app_error('invalid_input', 'Choose a future expiry date for the verification.');
    end if;
    -- Remaining pending items are not verified.
    update public.verification_items set status = 'rejected', reviewer_note = 'Not verified in this review'
    where request_id = p_request and status = 'pending';
    -- Older approvals are superseded.
    update public.verification_requests set status = 'expired'
    where organization_id = v_req.organization_id and status = 'approved' and id <> p_request;
  end if;
  update public.verification_requests set status = p_decision, decided_at = now(), reviewer_id = auth.uid(),
    decision_notes = coalesce(p_decision_notes, ''), internal_notes = coalesce(p_internal_notes, ''),
    expires_on = case when p_decision = 'approved' then p_expires_on end
  where id = p_request;
  perform private.write_audit('verification.' || p_decision, 'verification_request', p_request, null, v_req.organization_id,
    jsonb_build_object('expires_on', p_expires_on,
      'verified_items', (select jsonb_agg(item_type) from public.verification_items where request_id = p_request and status = 'verified')));
end;
$$;

create or replace function public.revoke_verification(p_request uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.verification_requests%rowtype;
begin
  if not private.has_platform_permission('platform.verifications.decide') then
    perform private.raise_app_error('forbidden', 'Only verification admins can revoke verification.');
  end if;
  select * into v_req from public.verification_requests where id = p_request for update;
  if not found then
    perform private.raise_app_error('not_found', 'Request not found.');
  end if;
  if v_req.status <> 'approved' then
    perform private.raise_app_error('invalid_transition', 'Only approved verifications can be revoked.');
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    perform private.raise_app_error('invalid_input', 'Give a reason for revoking.');
  end if;
  update public.verification_requests set status = 'revoked', revoked_reason = btrim(p_reason), decided_at = now(), reviewer_id = auth.uid()
  where id = p_request;
  perform private.write_audit('verification.revoked', 'verification_request', p_request, null, v_req.organization_id,
    jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

-- Daily expiry (folded into the daily job runner below).
create or replace function private.expire_verifications(p_today date default private.manila_today())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.verification_requests set status = 'expired'
    where status = 'approved' and expires_on < p_today
    returning id, organization_id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;
select cron.schedule('bahayplus-expire-verifications', '10 16 * * *', $$select private.expire_verifications()$$);

-- What a badge may claim: verified items of the current approved request.
create or replace function public.provider_verified_items(p_org uuid)
returns table (item_type text, valid_until date, verified_until date)
language sql
stable
security definer
set search_path = ''
as $$
  select i.item_type, i.valid_until, r.expires_on
  from public.verification_items i join public.verification_requests r on r.id = i.request_id
  where r.id = private.current_verification(p_org) and i.status = 'verified'
    and private.can_see_provider(p_org)
  order by i.item_type;
$$;

-- -----------------------------------------------------------------------------
-- Reviews
-- -----------------------------------------------------------------------------
create or replace function public.submit_review(p_booking uuid, p_rating smallint, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking;
  if not found or not private.is_household_member(v_booking.household_id) then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  if not private.has_household_permission(v_booking.household_id, 'services.book') then
    perform private.raise_app_error('forbidden', 'You cannot review services for this household.');
  end if;
  if v_booking.status <> 'completed' then
    perform private.raise_app_error('review_not_eligible', 'You can review a provider after the service is completed.');
  end if;
  if v_booking.completed_at < now() - interval '90 days' then
    perform private.raise_app_error('review_not_eligible', 'Reviews must be written within 90 days of the service.');
  end if;
  if exists (select 1 from public.reviews where booking_id = p_booking) then
    perform private.raise_app_error('duplicate_review', 'This service has already been reviewed.');
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    perform private.raise_app_error('invalid_input', 'Choose a rating from 1 to 5.');
  end if;
  insert into public.reviews (booking_id, organization_id, household_id, reviewer_id, rating, comment)
  values (p_booking, v_booking.organization_id, v_booking.household_id, auth.uid(), p_rating, left(coalesce(btrim(p_comment), ''), 2000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.edit_review(p_review uuid, p_rating smallint, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews%rowtype;
begin
  select * into v_review from public.reviews where id = p_review for update;
  if not found or v_review.reviewer_id is distinct from auth.uid() then
    perform private.raise_app_error('forbidden', 'Only the author can edit this review.');
  end if;
  if v_review.created_at < now() - interval '30 days' then
    perform private.raise_app_error('review_locked', 'Reviews can be edited for 30 days.');
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    perform private.raise_app_error('invalid_input', 'Choose a rating from 1 to 5.');
  end if;
  update public.reviews set rating = p_rating, comment = left(coalesce(btrim(p_comment), ''), 2000) where id = p_review;
end;
$$;

create or replace function public.reply_to_review(p_review uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review public.reviews%rowtype;
begin
  select * into v_review from public.reviews where id = p_review for update;
  if not found or not private.has_organization_permission(v_review.organization_id, 'organization.update') then
    perform private.raise_app_error('forbidden', 'Only the provider''s owners and managers can reply.');
  end if;
  if p_reply is null or char_length(btrim(p_reply)) not between 2 and 1000 then
    perform private.raise_app_error('invalid_input', 'Write a reply of 2–1000 characters.');
  end if;
  update public.reviews set provider_reply = btrim(p_reply), provider_replied_at = now() where id = p_review;
end;
$$;

-- -----------------------------------------------------------------------------
-- Search (security invoker → RLS limits results to listed providers or your own)
-- -----------------------------------------------------------------------------
create or replace function public.search_providers(
  p_query text default null, p_category text default null, p_division text default null,
  p_province text default null, p_city text default null, p_barangay text default null,
  p_limit integer default 20, p_offset integer default 0
)
returns table (
  organization_id uuid, name text, slug text, tagline text, availability_status text, availability_updated_at timestamptz,
  rating_count integer, rating_sum integer, min_price_centavos bigint, categories text[], verified_items text[],
  accepts_book_now boolean, accepts_quote_requests boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.name, o.slug, pp.tagline, pp.availability_status, pp.availability_updated_at, pp.rating_count, pp.rating_sum,
         min(s.price_centavos), array_agg(distinct c.name order by c.name),
         (select array_agg(v.item_type order by v.item_type) from public.provider_verified_items(o.id) v),
         pp.accepts_book_now, pp.accepts_quote_requests
  from public.organizations o
  join public.provider_profiles pp on pp.organization_id = o.id
  join public.provider_services s on s.organization_id = o.id and s.is_active
  join public.service_categories c on c.id = s.category_id
  where private.is_listed_provider(o.id)
    and (p_category is null or c.slug = p_category)
    and (p_division is null or c.division = p_division)
    and (nullif(btrim(p_query), '') is null
         or o.name ilike '%' || btrim(p_query) || '%' or pp.tagline ilike '%' || btrim(p_query) || '%'
         or s.title ilike '%' || btrim(p_query) || '%' or c.name ilike '%' || btrim(p_query) || '%')
    and (public.normalize_locality(p_province) is null or public.provider_serves(o.id, p_province, p_city, p_barangay))
  group by o.id, o.name, o.slug, pp.tagline, pp.availability_status, pp.availability_updated_at, pp.rating_count, pp.rating_sum,
           pp.accepts_book_now, pp.accepts_quote_requests
  order by case pp.availability_status when 'available' then 0 when 'limited' then 1 else 2 end,
           (pp.rating_sum::numeric / nullif(pp.rating_count, 0)) desc nulls last, o.name
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

revoke all on function public.submit_verification_request(uuid, jsonb) from public, anon;
revoke all on function public.start_verification_review(uuid) from public, anon;
revoke all on function public.decide_verification(uuid, text, jsonb, text, text, date) from public, anon;
revoke all on function public.revoke_verification(uuid, text) from public, anon;
revoke all on function public.provider_verified_items(uuid) from public, anon;
revoke all on function public.submit_review(uuid, smallint, text) from public, anon;
revoke all on function public.edit_review(uuid, smallint, text) from public, anon;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.submit_verification_request(uuid, jsonb) to authenticated;
grant execute on function public.start_verification_review(uuid) to authenticated;
grant execute on function public.decide_verification(uuid, text, jsonb, text, text, date) to authenticated;
grant execute on function public.revoke_verification(uuid, text) to authenticated;
grant execute on function public.provider_verified_items(uuid) to authenticated;
grant execute on function public.submit_review(uuid, smallint, text) to authenticated;
grant execute on function public.edit_review(uuid, smallint, text) to authenticated;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
grant execute on function public.search_providers(text, text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.provider_serves(uuid, text, text, text) to authenticated;
grant execute on function public.normalize_locality(text) to authenticated;

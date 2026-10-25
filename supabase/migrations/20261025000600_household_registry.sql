-- =============================================================================
-- Phase 4 · Household registry: assets, pets, vehicles, maintenance records, attachments
--
-- Ownership integrity: every child row carries household_id and a composite FK to its parent
-- (parent_id, household_id), so a record can never point at another household's asset/pet/vehicle.
-- Sensitive veterinary records require pet.health.view; grooming history only needs registry.view.
-- Files live in the private `household-files` bucket under {household_id}/{entity_type}/{entity_id}/…
-- and Storage RLS mirrors table RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('household', 'registry.view', 'View assets, pets and vehicles'),
  ('household', 'registry.manage', 'Add and edit assets, pets, vehicles and their records'),
  ('household', 'pet.health.view', 'View veterinary and vaccination records'),
  ('household', 'pet.health.manage', 'Add and edit veterinary and vaccination records');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('household', 'owner', 'registry.view'), ('household', 'owner', 'registry.manage'),
  ('household', 'owner', 'pet.health.view'), ('household', 'owner', 'pet.health.manage'),
  ('household', 'manager', 'registry.view'), ('household', 'manager', 'registry.manage'),
  ('household', 'manager', 'pet.health.view'), ('household', 'manager', 'pet.health.manage'),
  ('household', 'member', 'registry.view'), ('household', 'member', 'registry.manage'),
  ('household', 'member', 'pet.health.view'), ('household', 'member', 'pet.health.manage'),
  ('household', 'limited', 'registry.view')
);

-- -----------------------------------------------------------------------------
-- Assets
-- -----------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in (
    'aircon', 'refrigerator', 'washing_machine', 'kitchen_appliance', 'water_heater', 'water_system',
    'electronics', 'electrical', 'furniture', 'tools', 'outdoor', 'other')),
  brand text not null default '' check (char_length(brand) <= 80),
  model text not null default '' check (char_length(model) <= 80),
  serial_number text not null default '' check (char_length(serial_number) <= 80),
  purchase_date date,
  purchase_price_centavos bigint check (purchase_price_centavos is null or purchase_price_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  warranty_expires_on date,
  maintenance_interval_months smallint check (maintenance_interval_months is null or maintenance_interval_months between 1 and 120),
  last_maintained_on date,
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (property_id, household_id) references public.properties (id, household_id),
  check (warranty_expires_on is null or purchase_date is null or warranty_expires_on >= purchase_date)
);
create index assets_household_idx on public.assets (household_id) where archived_at is null;
create index assets_property_idx on public.assets (property_id);
create trigger assets_updated_at before update on public.assets for each row execute function private.set_updated_at();

create table public.asset_service_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  household_id uuid not null,
  serviced_on date not null,
  kind text not null check (kind in ('maintenance', 'cleaning', 'repair', 'inspection', 'installation', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  provider_name text not null default '' check (char_length(provider_name) <= 120),
  cost_centavos bigint check (cost_centavos is null or cost_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  -- Link to a Bahay+ booking once bookings exist (Phase 7 adds the FK).
  booking_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (asset_id, household_id) references public.assets (id, household_id) on delete cascade
);
create index asset_service_records_asset_idx on public.asset_service_records (asset_id, serviced_on desc);
create trigger asset_service_records_updated_at before update on public.asset_service_records for each row execute function private.set_updated_at();

-- Keep assets.last_maintained_on in sync with routine service records.
create or replace function private.sync_asset_last_maintained()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset uuid := coalesce(new.asset_id, old.asset_id);
begin
  update public.assets a set last_maintained_on = (
    select max(serviced_on) from public.asset_service_records r
    where r.asset_id = v_asset and r.kind in ('maintenance', 'cleaning', 'inspection')
  ) where a.id = v_asset;
  return coalesce(new, old);
end;
$$;
create trigger asset_service_records_sync after insert or update or delete on public.asset_service_records
  for each row execute function private.sync_asset_last_maintained();

-- New links to archived properties are refused; existing links survive archiving.
create or replace function private.check_asset_property_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.property_id is not null and (tg_op = 'INSERT' or new.property_id is distinct from old.property_id)
     and exists (select 1 from public.properties where id = new.property_id and archived_at is not null) then
    perform private.raise_app_error('property_archived', 'Choose an active property; archived properties cannot receive new items.');
  end if;
  return new;
end;
$$;
create trigger assets_property_active before insert or update of property_id on public.assets
  for each row execute function private.check_asset_property_active();

-- -----------------------------------------------------------------------------
-- Pets
-- -----------------------------------------------------------------------------
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  species text not null check (species in ('dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster', 'reptile', 'other')),
  breed text not null default '' check (char_length(breed) <= 80),
  sex text not null default 'unknown' check (sex in ('male', 'female', 'unknown')),
  birth_date date,
  color_markings text not null default '' check (char_length(color_markings) <= 120),
  microchip_number text not null default '' check (char_length(microchip_number) <= 40),
  care_preferences text not null default '' check (char_length(care_preferences) <= 2000),
  notes text not null default '' check (char_length(notes) <= 2000),
  photo_file_id uuid,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index pets_household_idx on public.pets (household_id) where archived_at is null;
create trigger pets_updated_at before update on public.pets for each row execute function private.set_updated_at();

create table public.pet_health_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null,
  household_id uuid not null,
  kind text not null check (kind in ('vaccination', 'vet_visit', 'deworming', 'medication', 'grooming', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  occurred_on date not null,
  next_due_on date,
  clinic_or_provider text not null default '' check (char_length(clinic_or_provider) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  cost_centavos bigint check (cost_centavos is null or cost_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  booking_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pet_id, household_id) references public.pets (id, household_id) on delete cascade,
  check (next_due_on is null or next_due_on >= occurred_on)
);
create index pet_health_records_pet_idx on public.pet_health_records (pet_id, occurred_on desc);
create trigger pet_health_records_updated_at before update on public.pet_health_records for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Vehicles
-- -----------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('car', 'suv', 'van', 'pickup', 'motorcycle', 'tricycle', 'other')),
  make text not null check (char_length(btrim(make)) between 1 and 60),
  model text not null check (char_length(btrim(model)) between 1 and 60),
  year smallint check (year is null or year between 1950 and 2100),
  plate_number text not null default '' check (plate_number = upper(plate_number) and plate_number ~ '^[A-Z0-9 -]{0,12}$'),
  color text not null default '' check (char_length(color) <= 40),
  mileage_km integer check (mileage_km is null or mileage_km >= 0),
  registration_expires_on date,
  insurance_provider text not null default '' check (char_length(insurance_provider) <= 120),
  insurance_expires_on date,
  maintenance_interval_months smallint check (maintenance_interval_months is null or maintenance_interval_months between 1 and 60),
  maintenance_interval_km integer check (maintenance_interval_km is null or maintenance_interval_km between 500 and 100000),
  last_maintained_on date,
  last_maintained_km integer,
  notes text not null default '' check (char_length(notes) <= 2000),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index vehicles_plate_unique on public.vehicles (household_id, plate_number)
  where archived_at is null and plate_number <> '';
create index vehicles_household_idx on public.vehicles (household_id) where archived_at is null;
create trigger vehicles_updated_at before update on public.vehicles for each row execute function private.set_updated_at();

create table public.vehicle_service_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  household_id uuid not null,
  serviced_on date not null,
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  kind text not null check (kind in ('preventive_maintenance', 'oil_change', 'repair', 'tires', 'battery', 'inspection',
                                     'registration_renewal', 'insurance_renewal', 'car_wash', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  provider_name text not null default '' check (char_length(provider_name) <= 120),
  cost_centavos bigint check (cost_centavos is null or cost_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  booking_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, household_id) references public.vehicles (id, household_id) on delete cascade
);
create index vehicle_service_records_vehicle_idx on public.vehicle_service_records (vehicle_id, serviced_on desc);
create trigger vehicle_service_records_updated_at before update on public.vehicle_service_records for each row execute function private.set_updated_at();

create or replace function private.sync_vehicle_from_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle uuid := coalesce(new.vehicle_id, old.vehicle_id);
begin
  update public.vehicles v set
    mileage_km = greatest(coalesce(v.mileage_km, 0), coalesce((select max(odometer_km) from public.vehicle_service_records where vehicle_id = v_vehicle), 0)),
    last_maintained_on = (select max(serviced_on) from public.vehicle_service_records
                          where vehicle_id = v_vehicle and kind in ('preventive_maintenance', 'oil_change', 'inspection')),
    last_maintained_km = (select odometer_km from public.vehicle_service_records
                          where vehicle_id = v_vehicle and kind in ('preventive_maintenance', 'oil_change', 'inspection')
                          order by serviced_on desc, created_at desc limit 1)
  where v.id = v_vehicle;
  return coalesce(new, old);
end;
$$;
create trigger vehicle_service_records_sync after insert or update or delete on public.vehicle_service_records
  for each row execute function private.sync_vehicle_from_service();

-- -----------------------------------------------------------------------------
-- Attachments (metadata for Storage objects)
-- -----------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  bucket text not null default 'household-files' check (bucket = 'household-files'),
  object_path text not null unique,
  entity_type text not null check (entity_type in ('asset', 'pet', 'pet_health', 'vehicle')),
  entity_id uuid not null,
  purpose text not null check (purpose in ('photo', 'receipt', 'manual', 'warranty', 'vet_record', 'document', 'other')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Path must start with the owning household and entity: {household}/{entity_type}/{entity_id}/…
  check (object_path like household_id::text || '/' || entity_type || '/' || entity_id::text || '/%')
);
create index files_entity_idx on public.files (entity_type, entity_id);
create trigger files_updated_at before update on public.files for each row execute function private.set_updated_at();

alter table public.pets add constraint pets_photo_fk foreign key (photo_file_id) references public.files (id) on delete set null;

create or replace function private.check_pet_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.photo_file_id is not null and not exists (
    select 1 from public.files f
    where f.id = new.photo_file_id and f.entity_type = 'pet' and f.entity_id = new.id and f.content_type like 'image/%'
  ) then
    perform private.raise_app_error('invalid_input', 'The photo must be an image uploaded for this pet.');
  end if;
  return new;
end;
$$;
create trigger pets_photo_check before insert or update of photo_file_id on public.pets
  for each row execute function private.check_pet_photo();

-- The entity a file is attached to must belong to the same household.
create or replace function private.check_file_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  v_ok := case new.entity_type
    when 'asset' then exists (select 1 from public.assets where id = new.entity_id and household_id = new.household_id)
    when 'pet' then exists (select 1 from public.pets where id = new.entity_id and household_id = new.household_id)
    when 'pet_health' then exists (select 1 from public.pet_health_records where id = new.entity_id and household_id = new.household_id)
    when 'vehicle' then exists (select 1 from public.vehicles where id = new.entity_id and household_id = new.household_id)
  end;
  if not coalesce(v_ok, false) then
    perform private.raise_app_error('not_found', 'The record this file belongs to was not found.');
  end if;
  return new;
end;
$$;
create trigger files_entity_check before insert or update on public.files for each row execute function private.check_file_entity();

create or replace function private.file_permission(p_entity_type text, p_mode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity_type = 'pet_health' then 'pet.health.' || p_mode
    else 'registry.' || p_mode
  end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.assets enable row level security;
alter table public.asset_service_records enable row level security;
alter table public.pets enable row level security;
alter table public.pet_health_records enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_service_records enable row level security;
alter table public.files enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['assets', 'asset_service_records', 'pets', 'vehicles', 'vehicle_service_records'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using ((select private.has_household_permission(household_id, ''registry.view'')))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check ((select private.has_household_permission(household_id, ''registry.manage'')))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using ((select private.has_household_permission(household_id, ''registry.manage''))) with check ((select private.has_household_permission(household_id, ''registry.manage'')))', t);
  end loop;
  -- Service records may be deleted (corrections); assets/pets/vehicles are archived instead.
  foreach t in array array['asset_service_records', 'vehicle_service_records'] loop
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using ((select private.has_household_permission(household_id, ''registry.manage'')))', t);
  end loop;
end;
$$;

-- Health records: grooming is ordinary registry data; everything else is sensitive.
create policy pet_health_records_select on public.pet_health_records for select to authenticated using (
  (select private.has_household_permission(household_id, case when kind = 'grooming' then 'registry.view' else 'pet.health.view' end))
);
create policy pet_health_records_insert on public.pet_health_records for insert to authenticated with check (
  (select private.has_household_permission(household_id, case when kind = 'grooming' then 'registry.manage' else 'pet.health.manage' end))
);
create policy pet_health_records_update on public.pet_health_records for update to authenticated
  using ((select private.has_household_permission(household_id, case when kind = 'grooming' then 'registry.manage' else 'pet.health.manage' end)))
  with check ((select private.has_household_permission(household_id, case when kind = 'grooming' then 'registry.manage' else 'pet.health.manage' end)));
create policy pet_health_records_delete on public.pet_health_records for delete to authenticated using (
  (select private.has_household_permission(household_id, case when kind = 'grooming' then 'registry.manage' else 'pet.health.manage' end))
);

create policy files_select on public.files for select to authenticated
  using ((select private.has_household_permission(household_id, private.file_permission(entity_type, 'view'))));
create policy files_insert on public.files for insert to authenticated
  with check ((select private.has_household_permission(household_id, private.file_permission(entity_type, 'manage'))));
create policy files_delete on public.files for delete to authenticated
  using ((select private.has_household_permission(household_id, private.file_permission(entity_type, 'manage'))));

-- Ownership columns are immutable for API users.
revoke update on public.assets, public.asset_service_records, public.pets, public.pet_health_records,
  public.vehicles, public.vehicle_service_records, public.files from authenticated;
grant update (property_id, name, category, brand, model, serial_number, purchase_date, purchase_price_centavos,
  warranty_expires_on, maintenance_interval_months, notes, archived_at) on public.assets to authenticated;
grant update (serviced_on, kind, description, provider_name, cost_centavos, booking_id) on public.asset_service_records to authenticated;
grant update (name, species, breed, sex, birth_date, color_markings, microchip_number, care_preferences, notes,
  photo_file_id, archived_at) on public.pets to authenticated;
grant update (kind, title, occurred_on, next_due_on, clinic_or_provider, notes, cost_centavos, booking_id)
  on public.pet_health_records to authenticated;
grant update (vehicle_type, make, model, year, plate_number, color, mileage_km, registration_expires_on,
  insurance_provider, insurance_expires_on, maintenance_interval_months, maintenance_interval_km, notes, archived_at)
  on public.vehicles to authenticated;
grant update (serviced_on, odometer_km, kind, description, provider_name, cost_centavos, booking_id)
  on public.vehicle_service_records to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private bucket with type/size limits; access mirrors table RLS by path.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-files', 'household-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_household_object(p_name text, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
begin
  -- {household_uuid}/{entity_type}/{entity_uuid}/{file}
  if array_length(v_parts, 1) <> 4
     or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[2] not in ('asset', 'pet', 'pet_health', 'vehicle')
     or v_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_household_permission(v_parts[1]::uuid, private.file_permission(v_parts[2], p_mode));
end;
$$;

create policy household_files_read on storage.objects for select to authenticated
  using (bucket_id = 'household-files' and (select private.can_access_household_object(name, 'view')));
create policy household_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'household-files' and (select private.can_access_household_object(name, 'manage')));
create policy household_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'household-files' and (select private.can_access_household_object(name, 'manage')));

-- -----------------------------------------------------------------------------
-- Due items: the reminder sources (consumed by dashboards now, the reminder engine in Phase 8).
-- security_invoker so the caller's RLS on the underlying tables applies.
-- -----------------------------------------------------------------------------
create or replace view public.registry_due_items
with (security_invoker = true) as
  select a.household_id, 'asset'::text as subject_type, a.id as subject_id, a.name as subject_name,
         'warranty_expiry'::text as due_kind, a.warranty_expires_on as due_on
  from public.assets a where a.archived_at is null and a.warranty_expires_on is not null
union all
  select a.household_id, 'asset', a.id, a.name, 'asset_maintenance',
         (coalesce(a.last_maintained_on, a.purchase_date, a.created_at::date) + make_interval(months => a.maintenance_interval_months))::date
  from public.assets a where a.archived_at is null and a.maintenance_interval_months is not null
union all
  select r.household_id, 'pet', p.id, p.name || ' — ' || r.title, 'pet_' || r.kind, r.next_due_on
  from public.pet_health_records r join public.pets p on p.id = r.pet_id
  where p.archived_at is null and r.next_due_on is not null
    -- only the latest record per pet + title drives the next due date
    and not exists (select 1 from public.pet_health_records later
                    where later.pet_id = r.pet_id and lower(later.title) = lower(r.title) and later.occurred_on > r.occurred_on)
union all
  select v.household_id, 'vehicle', v.id, v.make || ' ' || v.model || coalesce(' (' || nullif(v.plate_number, '') || ')', ''),
         'vehicle_registration', v.registration_expires_on
  from public.vehicles v where v.archived_at is null and v.registration_expires_on is not null
union all
  select v.household_id, 'vehicle', v.id, v.make || ' ' || v.model || coalesce(' (' || nullif(v.plate_number, '') || ')', ''),
         'vehicle_insurance', v.insurance_expires_on
  from public.vehicles v where v.archived_at is null and v.insurance_expires_on is not null
union all
  select v.household_id, 'vehicle', v.id, v.make || ' ' || v.model || coalesce(' (' || nullif(v.plate_number, '') || ')', ''),
         'vehicle_maintenance',
         (coalesce(v.last_maintained_on, v.created_at::date) + make_interval(months => v.maintenance_interval_months))::date
  from public.vehicles v where v.archived_at is null and v.maintenance_interval_months is not null;

grant select on public.registry_due_items to authenticated;

-- -----------------------------------------------------------------------------
-- Activity for registry changes (reuses the Phase 3 feed).
-- -----------------------------------------------------------------------------
create or replace function private.registry_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := tg_argv[0];
  v_label text;
begin
  -- Read fields via jsonb: the trigger is shared by tables with different columns.
  v_label := case when v_kind = 'vehicle' then (to_jsonb(new) ->> 'make') || ' ' || (to_jsonb(new) ->> 'model')
                  else to_jsonb(new) ->> 'name' end;
  if tg_op = 'INSERT' then
    perform private.record_activity(new.household_id, v_kind || '.added', 'registry.view', jsonb_build_object('name', v_label));
  elsif old.archived_at is null and new.archived_at is not null then
    perform private.record_activity(new.household_id, v_kind || '.archived', 'registry.view', jsonb_build_object('name', v_label));
  end if;
  return new;
end;
$$;
create trigger assets_activity after insert or update of archived_at on public.assets
  for each row execute function private.registry_activity('asset');
create trigger pets_activity after insert or update of archived_at on public.pets
  for each row execute function private.registry_activity('pet');
create trigger vehicles_activity after insert or update of archived_at on public.vehicles
  for each row execute function private.registry_activity('vehicle');

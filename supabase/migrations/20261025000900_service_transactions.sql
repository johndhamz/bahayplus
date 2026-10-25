-- =============================================================================
-- Phase 7 · Bookings, quotations, projects and work orders
--
-- Rules
--  - Bookings: Book Now confirms instantly only if the provider has capacity in that window;
--    capacity checks lock the provider row so concurrent requests cannot double book.
--  - Quotations are versioned. Lines are editable only while draft; a SENT quotation is immutable
--    (send a new version); an ACCEPTED quotation can never change. Acceptance is atomic.
--  - Projects change scope/price only through change orders the customer explicitly approves.
--  - Work orders come from accepted bookings/projects; workers cannot hold overlapping active
--    assignments (exclusion constraint).
--  - Money: quotation amounts, agreed booking amounts and (Phase 10) payments/settlements are kept
--    in separate records. Nothing here charges anyone.
--  - Privacy: providers get a customer's address only for confirmed work, via booking_location().
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Organization permissions for operations
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('organization', 'bookings.view', 'See bookings, requests and quotations'),
  ('organization', 'bookings.manage', 'Confirm, reschedule and cancel bookings; send quotations'),
  ('organization', 'work_orders.manage', 'Create and assign work orders'),
  ('organization', 'work_orders.perform', 'Work on assigned work orders'),
  ('organization', 'projects.manage', 'Manage renovation projects and change orders');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('organization', 'owner', 'bookings.view'), ('organization', 'owner', 'bookings.manage'),
  ('organization', 'owner', 'work_orders.manage'), ('organization', 'owner', 'work_orders.perform'),
  ('organization', 'owner', 'projects.manage'),
  ('organization', 'manager', 'bookings.view'), ('organization', 'manager', 'bookings.manage'),
  ('organization', 'manager', 'work_orders.manage'), ('organization', 'manager', 'work_orders.perform'),
  ('organization', 'manager', 'projects.manage'),
  ('organization', 'staff', 'bookings.view'), ('organization', 'staff', 'bookings.manage'),
  ('organization', 'staff', 'work_orders.manage'), ('organization', 'staff', 'work_orders.perform'),
  ('organization', 'worker', 'work_orders.perform')
);

alter table public.provider_profiles add column concurrent_capacity smallint not null default 1 check (concurrent_capacity between 1 and 50);
grant update (concurrent_capacity) on public.provider_profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Service requests (quote requests) and quotations
-- -----------------------------------------------------------------------------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null,
  provider_service_id uuid references public.provider_services (id) on delete set null,
  category_id uuid references public.service_categories (id),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  preferred_date date,
  asset_id uuid,
  pet_id uuid,
  vehicle_id uuid,
  status text not null default 'open' check (status in ('open', 'quoted', 'accepted', 'declined', 'cancelled')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, idempotency_key),
  unique (id, household_id),
  foreign key (property_id, household_id) references public.properties (id, household_id),
  foreign key (asset_id, household_id) references public.assets (id, household_id),
  foreign key (pet_id, household_id) references public.pets (id, household_id),
  foreign key (vehicle_id, household_id) references public.vehicles (id, household_id)
);
create index service_requests_org_idx on public.service_requests (organization_id, created_at desc);
create index service_requests_household_idx on public.service_requests (household_id, created_at desc);
create trigger service_requests_updated_at before update on public.service_requests for each row execute function private.set_updated_at();

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete cascade,
  version integer not null check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'superseded', 'withdrawn')),
  valid_until date,
  notes text not null default '' check (char_length(notes) <= 2000),
  total_centavos bigint not null default 0 check (total_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, version),
  check (status = 'draft' or valid_until is not null)
);
create unique index quotations_one_accepted on public.quotations (service_request_id) where status = 'accepted';
create trigger quotations_updated_at before update on public.quotations for each row execute function private.set_updated_at();

create table public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position smallint not null default 1,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  unit_label text not null default '' check (char_length(unit_label) <= 20),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  -- quantity × unit price, rounded half away from zero to the centavo.
  line_total_centavos bigint generated always as (round(quantity * unit_price_centavos)::bigint) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotation_lines_quote_idx on public.quotation_lines (quotation_id, position);
create trigger quotation_lines_updated_at before update on public.quotation_lines for each row execute function private.set_updated_at();

-- Lines are editable only while the quotation is a draft; totals follow the lines.
create or replace function private.guard_quotation_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote uuid := coalesce(new.quotation_id, old.quotation_id);
begin
  if (select status from public.quotations where id = v_quote) <> 'draft' then
    perform private.raise_app_error('quotation_locked', 'Sent quotations cannot be edited. Create a new version instead.');
  end if;
  return coalesce(new, old);
end;
$$;
create trigger quotation_lines_guard before insert or update or delete on public.quotation_lines for each row execute function private.guard_quotation_lines();

create or replace function private.recompute_quotation_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote uuid := coalesce(new.quotation_id, old.quotation_id);
begin
  update public.quotations set total_centavos = (select coalesce(sum(line_total_centavos), 0) from public.quotation_lines where quotation_id = v_quote)
  where id = v_quote;
  return coalesce(new, old);
end;
$$;
create trigger quotation_lines_total after insert or update or delete on public.quotation_lines for each row execute function private.recompute_quotation_total();

-- Accepted (and other decided) quotations are frozen: amounts, validity and lines never change.
create or replace function private.guard_quotation_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('accepted', 'rejected', 'superseded', 'withdrawn') and
     (new.total_centavos, new.valid_until, new.notes, new.version, new.status)
       is distinct from (old.total_centavos, old.valid_until, old.notes, old.version, old.status) then
    perform private.raise_app_error('quotation_locked', 'This quotation has been decided and cannot change.');
  end if;
  if old.status = 'sent' and new.status = 'sent' and
     (new.total_centavos, new.valid_until, new.notes) is distinct from (old.total_centavos, old.valid_until, old.notes) then
    perform private.raise_app_error('quotation_locked', 'Sent quotations cannot be edited. Create a new version instead.');
  end if;
  return new;
end;
$$;
create trigger quotations_guard before update on public.quotations for each row execute function private.guard_quotation_update();

-- -----------------------------------------------------------------------------
-- Bookings (extends the Phase 6 table)
-- -----------------------------------------------------------------------------
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined'));
alter table public.bookings
  add column property_id uuid,
  add column service_request_id uuid references public.service_requests (id) on delete set null,
  add column quotation_id uuid references public.quotations (id) on delete set null,
  add column title text not null default '',
  add column customer_notes text not null default '' check (char_length(customer_notes) <= 2000),
  add column scheduled_start timestamptz,
  add column scheduled_end timestamptz,
  add column agreed_amount_centavos bigint check (agreed_amount_centavos is null or agreed_amount_centavos >= 0),
  add column currency char(3) not null default 'PHP' check (currency = 'PHP'),
  add column pricing_note text not null default '',
  add column asset_id uuid,
  add column pet_id uuid,
  add column vehicle_id uuid,
  add column cancelled_by text check (cancelled_by in ('customer', 'provider')),
  add column cancellation_reason text,
  add column customer_confirmation text check (customer_confirmation in ('confirmed', 'disputed')),
  add column customer_confirmed_at timestamptz,
  add column idempotency_key text,
  add constraint bookings_window check (scheduled_end is null or scheduled_end > scheduled_start),
  add constraint bookings_property_fk foreign key (property_id, household_id) references public.properties (id, household_id),
  add constraint bookings_asset_fk foreign key (asset_id, household_id) references public.assets (id, household_id),
  add constraint bookings_pet_fk foreign key (pet_id, household_id) references public.pets (id, household_id),
  add constraint bookings_vehicle_fk foreign key (vehicle_id, household_id) references public.vehicles (id, household_id),
  add constraint bookings_id_household_key unique (id, household_id),
  add constraint bookings_id_org_key unique (id, organization_id);
create unique index bookings_idempotency on public.bookings (household_id, idempotency_key) where idempotency_key is not null;
create index bookings_org_window_idx on public.bookings (organization_id, scheduled_start) where status in ('confirmed', 'in_progress');

-- Phase 4 service records may now point at bookings.
alter table public.asset_service_records add constraint asset_service_records_booking_fk foreign key (booking_id) references public.bookings (id) on delete set null;
alter table public.pet_health_records add constraint pet_health_records_booking_fk foreign key (booking_id) references public.bookings (id) on delete set null;
alter table public.vehicle_service_records add constraint vehicle_service_records_booking_fk foreign key (booking_id) references public.bookings (id) on delete set null;

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  household_id uuid not null,
  organization_id uuid not null,
  actor_id uuid,
  actor_side text not null check (actor_side in ('customer', 'provider', 'system')),
  kind text not null check (kind ~ '^[a-z_]+$'),
  from_status text,
  to_status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);
revoke update, delete on public.booking_events from authenticated;

create or replace function private.log_booking_event(p_booking uuid, p_side text, p_kind text, p_from text, p_to text, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.booking_events (booking_id, household_id, organization_id, actor_id, actor_side, kind, from_status, to_status, payload)
  select b.id, b.household_id, b.organization_id, auth.uid(), p_side, p_kind, p_from, p_to, coalesce(p_payload, '{}'::jsonb)
  from public.bookings b where b.id = p_booking;
$$;

-- Capacity check; callers must hold a lock on the provider row (see lock_provider()).
create or replace function private.provider_has_capacity(p_org uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.bookings b
          where b.organization_id = p_org and b.status in ('confirmed', 'in_progress')
            and (p_exclude is null or b.id <> p_exclude)
            and tstzrange(b.scheduled_start, b.scheduled_end) && tstzrange(p_start, p_end))
       < (select concurrent_capacity from public.provider_profiles where organization_id = p_org);
$$;

create or replace function private.lock_provider(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select 1 from public.provider_profiles where organization_id = p_org for update;
$$;

-- Book Now / request a booking for a listed service.
create or replace function public.request_booking(
  p_household uuid, p_service uuid, p_property uuid, p_start timestamptz, p_notes text, p_idempotency_key text,
  p_asset uuid default null, p_pet uuid default null, p_vehicle uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.provider_services%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_existing uuid;
  v_end timestamptz;
  v_status text;
  v_id uuid;
begin
  if not private.has_household_permission(p_household, 'services.book') then
    perform private.raise_app_error('forbidden', 'You cannot book services for this household.');
  end if;
  select id into v_existing from public.bookings where household_id = p_household and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;
  select * into v_service from public.provider_services where id = p_service and is_active;
  if not found or not private.is_listed_provider(v_service.organization_id) then
    perform private.raise_app_error('not_found', 'This service is not available.');
  end if;
  if not exists (select 1 from public.properties where id = p_property and household_id = p_household and archived_at is null) then
    perform private.raise_app_error('invalid_input', 'Choose one of your active properties.');
  end if;
  if p_start is null or p_start < now() + interval '1 hour' then
    perform private.raise_app_error('invalid_input', 'Choose a time at least an hour from now.');
  end if;
  v_end := p_start + make_interval(mins => coalesce(v_service.duration_minutes, 120));
  -- Serialize capacity decisions for this provider.
  perform private.lock_provider(v_service.organization_id);
  select * into v_profile from public.provider_profiles where organization_id = v_service.organization_id;
  if v_service.allows_book_now and v_profile.accepts_book_now then
    if not private.provider_has_capacity(v_service.organization_id, p_start, v_end) then
      perform private.raise_app_error('slot_unavailable', 'That time is already fully booked. Please choose another time.');
    end if;
    v_status := 'confirmed';
  else
    v_status := 'requested';
  end if;
  insert into public.bookings (household_id, organization_id, provider_service_id, property_id, title, customer_notes, scheduled_start, scheduled_end,
    agreed_amount_centavos, pricing_note, asset_id, pet_id, vehicle_id, status, idempotency_key)
  values (p_household, v_service.organization_id, p_service, p_property, v_service.title, left(coalesce(p_notes, ''), 2000), p_start, v_end,
    v_service.price_centavos, v_service.pricing_model, p_asset, p_pet, p_vehicle, v_status, p_idempotency_key)
  returning id into v_id;
  perform private.log_booking_event(v_id, 'customer', 'created', null, v_status, jsonb_build_object('book_now', v_status = 'confirmed'));
  return v_id;
end;
$$;

create or replace function private.booking_side(p_booking public.bookings, p_mode text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.has_organization_permission(p_booking.organization_id, case when p_mode = 'manage' then 'bookings.manage' else 'bookings.view' end) then
    return 'provider';
  elsif private.has_household_permission(p_booking.household_id, case when p_mode = 'manage' then 'services.book' else 'services.view' end) then
    return 'customer';
  end if;
  return null;
end;
$$;

create or replace function public.transition_booking(p_booking uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
  v_side text;
  v_to text;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  v_side := private.booking_side(v_b, 'manage');
  if v_side is null then
    perform private.raise_app_error(case when private.booking_side(v_b, 'view') is null then 'not_found' else 'forbidden' end, 'You cannot change this booking.');
  end if;
  v_to := case
    when p_action = 'confirm' and v_side = 'provider' and v_b.status = 'requested' then 'confirmed'
    when p_action = 'decline' and v_side = 'provider' and v_b.status = 'requested' then 'declined'
    when p_action = 'start' and v_side = 'provider' and v_b.status = 'confirmed' then 'in_progress'
    when p_action = 'complete' and v_side = 'provider' and v_b.status in ('confirmed', 'in_progress') then 'completed'
    when p_action = 'cancel' and v_b.status in ('requested', 'confirmed') then 'cancelled'
  end;
  if v_to is null then
    perform private.raise_app_error('invalid_transition', 'That change is not allowed for this booking right now.');
  end if;
  if p_action = 'cancel' and (p_reason is null or char_length(btrim(p_reason)) < 3) then
    perform private.raise_app_error('invalid_input', 'Give a short reason for cancelling.');
  end if;
  if v_to = 'confirmed' then
    if v_b.scheduled_start is null then
      perform private.raise_app_error('invalid_input', 'Set a schedule before confirming.');
    end if;
    perform private.lock_provider(v_b.organization_id);
    if not private.provider_has_capacity(v_b.organization_id, v_b.scheduled_start, v_b.scheduled_end, v_b.id) then
      perform private.raise_app_error('slot_unavailable', 'You are fully booked at that time. Reschedule first.');
    end if;
  end if;
  update public.bookings set status = v_to,
    completed_at = case when v_to = 'completed' then now() end,
    cancelled_by = case when v_to = 'cancelled' then v_side end,
    cancellation_reason = case when v_to in ('cancelled', 'declined') then nullif(btrim(coalesce(p_reason, '')), '') end
  where id = p_booking;
  -- Cancelling a booking cancels its open work orders.
  if v_to in ('cancelled', 'declined') then
    update public.work_orders set status = 'cancelled' where booking_id = p_booking and status not in ('completed', 'cancelled');
  end if;
  perform private.log_booking_event(p_booking, v_side, p_action, v_b.status, v_to, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.reschedule_booking(p_booking uuid, p_start timestamptz, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
  v_side text;
  v_end timestamptz;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  v_side := private.booking_side(v_b, 'manage');
  if v_side is null then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  if v_b.status not in ('requested', 'confirmed') then
    perform private.raise_app_error('invalid_transition', 'Only upcoming bookings can be rescheduled.');
  end if;
  if p_start is null or p_start < now() + interval '1 hour' then
    perform private.raise_app_error('invalid_input', 'Choose a time at least an hour from now.');
  end if;
  v_end := p_start + coalesce(v_b.scheduled_end - v_b.scheduled_start, interval '2 hours');
  if v_b.status = 'confirmed' then
    perform private.lock_provider(v_b.organization_id);
    if not private.provider_has_capacity(v_b.organization_id, p_start, v_end, v_b.id) then
      perform private.raise_app_error('slot_unavailable', 'That time is already fully booked.');
    end if;
  end if;
  update public.bookings set scheduled_start = p_start, scheduled_end = v_end where id = p_booking;
  update public.work_orders set scheduled_start = p_start, scheduled_end = v_end where booking_id = p_booking and status not in ('completed', 'cancelled');
  perform private.log_booking_event(p_booking, v_side, 'rescheduled', v_b.status, v_b.status,
    jsonb_build_object('from', v_b.scheduled_start, 'to', p_start, 'reason', p_reason));
end;
$$;

create or replace function public.confirm_booking_completion(p_booking uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or not private.has_household_permission(v_b.household_id, 'services.book') then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  if v_b.status <> 'completed' then
    perform private.raise_app_error('invalid_transition', 'You can confirm once the provider marks the job completed.');
  end if;
  if p_outcome not in ('confirmed', 'disputed') then
    perform private.raise_app_error('invalid_input', 'Choose confirmed or disputed.');
  end if;
  if v_b.customer_confirmation is not null then
    perform private.raise_app_error('invalid_transition', 'You already responded for this booking.');
  end if;
  update public.bookings set customer_confirmation = p_outcome, customer_confirmed_at = now() where id = p_booking;
  perform private.log_booking_event(p_booking, 'customer', 'completion_' || p_outcome, 'completed', 'completed', jsonb_build_object('note', p_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Quote requests & quotations: commands
-- -----------------------------------------------------------------------------
create or replace function public.create_service_request(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_payload ->> 'household_id')::uuid;
  v_org uuid := (p_payload ->> 'organization_id')::uuid;
  v_key text := p_payload ->> 'idempotency_key';
  v_id uuid;
begin
  if not private.has_household_permission(v_household, 'services.book') then
    perform private.raise_app_error('forbidden', 'You cannot request services for this household.');
  end if;
  select id into v_id from public.service_requests where household_id = v_household and idempotency_key = v_key;
  if v_id is not null then
    return v_id;
  end if;
  if not private.is_listed_provider(v_org) then
    perform private.raise_app_error('not_found', 'This provider is not available.');
  end if;
  if not exists (select 1 from public.properties where id = (p_payload ->> 'property_id')::uuid and household_id = v_household and archived_at is null) then
    perform private.raise_app_error('invalid_input', 'Choose one of your active properties.');
  end if;
  insert into public.service_requests (household_id, organization_id, property_id, provider_service_id, category_id, title, description,
    preferred_date, asset_id, pet_id, vehicle_id, idempotency_key)
  values (v_household, v_org, (p_payload ->> 'property_id')::uuid, (p_payload ->> 'provider_service_id')::uuid,
    coalesce((p_payload ->> 'category_id')::uuid, (select category_id from public.provider_services where id = (p_payload ->> 'provider_service_id')::uuid)),
    p_payload ->> 'title', coalesce(p_payload ->> 'description', ''), (p_payload ->> 'preferred_date')::date,
    (p_payload ->> 'asset_id')::uuid, (p_payload ->> 'pet_id')::uuid, (p_payload ->> 'vehicle_id')::uuid, v_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- Creates the next draft version for a request (copying lines from the latest version if any).
create or replace function public.create_quotation_draft(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests%rowtype;
  v_prev public.quotations%rowtype;
  v_id uuid;
begin
  select * into v_req from public.service_requests where id = p_request for update;
  if not found or not private.has_organization_permission(v_req.organization_id, 'bookings.manage') then
    perform private.raise_app_error('not_found', 'Request not found.');
  end if;
  if v_req.status in ('accepted', 'declined', 'cancelled') then
    perform private.raise_app_error('invalid_transition', 'This request is closed.');
  end if;
  if exists (select 1 from public.quotations where service_request_id = p_request and status = 'draft') then
    perform private.raise_app_error('draft_exists', 'Finish or delete the current draft first.');
  end if;
  select * into v_prev from public.quotations where service_request_id = p_request order by version desc limit 1;
  insert into public.quotations (service_request_id, organization_id, household_id, version, notes)
  values (p_request, v_req.organization_id, v_req.household_id, coalesce(v_prev.version, 0) + 1, coalesce(v_prev.notes, ''))
  returning id into v_id;
  if v_prev.id is not null then
    insert into public.quotation_lines (quotation_id, position, description, quantity, unit_label, unit_price_centavos)
    select v_id, position, description, quantity, unit_label, unit_price_centavos from public.quotation_lines where quotation_id = v_prev.id;
  end if;
  return v_id;
end;
$$;

create or replace function public.send_quotation(p_quotation uuid, p_valid_until date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotations%rowtype;
begin
  select * into v_q from public.quotations where id = p_quotation for update;
  if not found or not private.has_organization_permission(v_q.organization_id, 'bookings.manage') then
    perform private.raise_app_error('not_found', 'Quotation not found.');
  end if;
  if v_q.status <> 'draft' then
    perform private.raise_app_error('quotation_locked', 'Only drafts can be sent.');
  end if;
  if not exists (select 1 from public.quotation_lines where quotation_id = p_quotation) then
    perform private.raise_app_error('invalid_input', 'Add at least one line item.');
  end if;
  if p_valid_until is null or p_valid_until < private.manila_today() then
    perform private.raise_app_error('invalid_input', 'Choose a validity date from today onward.');
  end if;
  -- A new version supersedes earlier sent versions.
  update public.quotations set status = 'superseded' where service_request_id = v_q.service_request_id and status = 'sent';
  update public.quotations set status = 'sent', valid_until = p_valid_until, sent_at = now() where id = p_quotation;
  update public.service_requests set status = 'quoted' where id = v_q.service_request_id and status = 'open';
end;
$$;

create or replace function public.withdraw_quotation(p_quotation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotations%rowtype;
begin
  select * into v_q from public.quotations where id = p_quotation for update;
  if not found or not private.has_organization_permission(v_q.organization_id, 'bookings.manage') then
    perform private.raise_app_error('not_found', 'Quotation not found.');
  end if;
  if v_q.status = 'draft' then
    delete from public.quotations where id = p_quotation;
  elsif v_q.status = 'sent' then
    update public.quotations set status = 'withdrawn' where id = p_quotation;
  else
    perform private.raise_app_error('quotation_locked', 'This quotation was already decided.');
  end if;
end;
$$;

create or replace function public.decide_quotation(p_quotation uuid, p_decision text, p_start timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quotations%rowtype;
  v_req public.service_requests%rowtype;
  v_booking uuid;
begin
  select * into v_q from public.quotations where id = p_quotation for update;
  if not found or not private.has_household_permission(v_q.household_id, 'services.view') then
    perform private.raise_app_error('not_found', 'Quotation not found.');
  end if;
  if not private.has_household_permission(v_q.household_id, 'services.book') then
    perform private.raise_app_error('forbidden', 'You cannot accept or reject quotations for this household.');
  end if;
  if p_decision not in ('accepted', 'rejected') then
    perform private.raise_app_error('invalid_input', 'Decision must be accepted or rejected.');
  end if;
  if v_q.status <> 'sent' then
    perform private.raise_app_error('quotation_not_open', 'This quotation is no longer open.');
  end if;
  if v_q.valid_until < private.manila_today() then
    perform private.raise_app_error('quotation_expired', 'This quotation has expired. Ask the provider for a new one.');
  end if;
  select * into v_req from public.service_requests where id = v_q.service_request_id for update;
  update public.quotations set status = p_decision, decided_at = now(), decided_by = auth.uid() where id = p_quotation;
  if p_decision = 'rejected' then
    return null;
  end if;
  -- Accepting closes the request and creates a booking at the quoted, now-frozen amount
  -- (project quotations instead become the project contract; see accept_project_quotation).
  update public.service_requests set status = 'accepted' where id = v_req.id;
  if exists (select 1 from public.projects where service_request_id = v_req.id) then
    return null;
  end if;
  insert into public.bookings (household_id, organization_id, provider_service_id, property_id, service_request_id, quotation_id, title,
    customer_notes, scheduled_start, scheduled_end, agreed_amount_centavos, pricing_note, asset_id, pet_id, vehicle_id, status)
  values (v_q.household_id, v_q.organization_id, v_req.provider_service_id, v_req.property_id, v_req.id, v_q.id, v_req.title,
    v_req.description, p_start, case when p_start is not null then p_start + interval '2 hours' end, v_q.total_centavos,
    'Quotation v' || v_q.version, v_req.asset_id, v_req.pet_id, v_req.vehicle_id, 'requested')
  returning id into v_booking;
  perform private.log_booking_event(v_booking, 'customer', 'created_from_quotation', null, 'requested', jsonb_build_object('quotation_id', v_q.id, 'version', v_q.version));
  return v_booking;
end;
$$;

-- -----------------------------------------------------------------------------
-- Projects (renovation & custom work) and change orders
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null,
  kind text not null check (kind in ('renovation', 'custom_furniture', 'carpentry', 'cabinetry', 'painting', 'roofing', 'other')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'requested' check (status in ('requested', 'site_visit_scheduled', 'quoted', 'active', 'on_hold', 'completed', 'cancelled')),
  site_visit_at timestamptz,
  service_request_id uuid references public.service_requests (id) on delete set null,
  contract_quotation_id uuid references public.quotations (id) on delete set null,
  contract_amount_centavos bigint check (contract_amount_centavos is null or contract_amount_centavos >= 0),
  approved_changes_centavos bigint not null default 0,
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  start_date date,
  target_end_date date,
  completed_at timestamptz,
  warranty_until date,
  warranty_terms text not null default '' check (char_length(warranty_terms) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, household_id) references public.properties (id, household_id),
  check (target_end_date is null or start_date is null or target_end_date >= start_date)
);
create index projects_household_idx on public.projects (household_id, created_at desc);
create index projects_org_idx on public.projects (organization_id, created_at desc);
create trigger projects_updated_at before update on public.projects for each row execute function private.set_updated_at();

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  position smallint not null default 1,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  due_on date,
  amount_centavos bigint check (amount_centavos is null or amount_centavos >= 0),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones (project_id, position);
create trigger project_milestones_updated_at before update on public.project_milestones for each row execute function private.set_updated_at();

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  author_side text not null check (author_side in ('customer', 'provider')),
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  percent_complete smallint check (percent_complete between 0 and 100),
  created_at timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

create table public.change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  -- Signed: positive adds cost, negative reduces it.
  amount_delta_centavos bigint not null check (amount_delta_centavos between -1000000000000 and 1000000000000),
  schedule_delta_days integer not null default 0 check (schedule_delta_days between -365 and 365),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'withdrawn')),
  proposed_by uuid default auth.uid() references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create trigger change_orders_updated_at before update on public.change_orders for each row execute function private.set_updated_at();

create or replace function private.project_side(p_project public.projects, p_mode text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.has_organization_permission(p_project.organization_id, case when p_mode = 'manage' then 'projects.manage' else 'bookings.view' end) then
    return 'provider';
  elsif private.has_household_permission(p_project.household_id, case when p_mode = 'manage' then 'services.book' else 'services.view' end) then
    return 'customer';
  end if;
  return null;
end;
$$;

create or replace function public.create_project_request(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_payload ->> 'household_id')::uuid;
  v_org uuid := (p_payload ->> 'organization_id')::uuid;
  v_id uuid;
begin
  if not private.has_household_permission(v_household, 'services.book') then
    perform private.raise_app_error('forbidden', 'You cannot request projects for this household.');
  end if;
  if not private.is_listed_provider(v_org) then
    perform private.raise_app_error('not_found', 'This provider is not available.');
  end if;
  if not exists (select 1 from public.properties where id = (p_payload ->> 'property_id')::uuid and household_id = v_household and archived_at is null) then
    perform private.raise_app_error('invalid_input', 'Choose one of your active properties.');
  end if;
  insert into public.projects (household_id, organization_id, property_id, kind, title, description, target_end_date)
  values (v_household, v_org, (p_payload ->> 'property_id')::uuid, p_payload ->> 'kind', p_payload ->> 'title',
          coalesce(p_payload ->> 'description', ''), (p_payload ->> 'target_end_date')::date)
  returning id into v_id;
  return v_id;
end;
$$;

-- Provider-side project management: site visit, contract from an accepted quote, status, milestones, warranty.
create or replace function public.update_project(p_project uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_status text := p_payload ->> 'status';
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or private.project_side(v_p, 'manage') is distinct from 'provider' then
    perform private.raise_app_error(case when private.project_side(v_p, 'view') is null then 'not_found' else 'forbidden' end, 'You cannot manage this project.');
  end if;
  if v_p.status in ('completed', 'cancelled') then
    perform private.raise_app_error('invalid_transition', 'This project is closed.');
  end if;
  if v_status is not null and v_status not in ('site_visit_scheduled', 'quoted', 'active', 'on_hold', 'completed') then
    perform private.raise_app_error('invalid_input', 'Invalid project status.');
  end if;
  if v_status = 'active' and v_p.contract_amount_centavos is null then
    perform private.raise_app_error('contract_required', 'The customer must accept a quotation before work starts.');
  end if;
  update public.projects set
    site_visit_at = coalesce((p_payload ->> 'site_visit_at')::timestamptz, site_visit_at),
    status = coalesce(v_status, status),
    start_date = coalesce((p_payload ->> 'start_date')::date, start_date),
    target_end_date = coalesce((p_payload ->> 'target_end_date')::date, target_end_date),
    completed_at = case when v_status = 'completed' then now() else completed_at end,
    warranty_until = coalesce((p_payload ->> 'warranty_until')::date, warranty_until),
    warranty_terms = coalesce(p_payload ->> 'warranty_terms', warranty_terms)
  where id = p_project;
end;
$$;

-- Customer accepts a project quotation: the contract amount is fixed from the quotation.
create or replace function public.accept_project_quotation(p_project uuid, p_quotation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_q public.quotations%rowtype;
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or private.project_side(v_p, 'manage') is distinct from 'customer' then
    perform private.raise_app_error('forbidden', 'Only the household can accept the project quotation.');
  end if;
  select * into v_q from public.quotations where id = p_quotation and service_request_id = v_p.service_request_id;
  if not found then
    perform private.raise_app_error('not_found', 'Quotation not found for this project.');
  end if;
  perform public.decide_quotation(p_quotation, 'accepted', null);
  update public.projects set contract_quotation_id = p_quotation, contract_amount_centavos = v_q.total_centavos, status = 'quoted' where id = p_project;
end;
$$;

-- Provider links a quote request to the project so quotations can be versioned the normal way.
create or replace function public.start_project_quotation(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_req uuid;
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or private.project_side(v_p, 'manage') is distinct from 'provider' then
    perform private.raise_app_error('forbidden', 'You cannot quote this project.');
  end if;
  if v_p.service_request_id is null then
    insert into public.service_requests (household_id, organization_id, property_id, title, description, idempotency_key, created_by)
    values (v_p.household_id, v_p.organization_id, v_p.property_id, v_p.title, v_p.description, 'project:' || v_p.id, v_p.created_by)
    returning id into v_req;
    update public.projects set service_request_id = v_req where id = p_project;
  else
    v_req := v_p.service_request_id;
  end if;
  return public.create_quotation_draft(v_req);
end;
$$;

create or replace function public.propose_change_order(p_project uuid, p_title text, p_description text, p_amount_delta bigint, p_schedule_delta integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_id uuid;
begin
  select * into v_p from public.projects where id = p_project for update;
  if not found or private.project_side(v_p, 'manage') is distinct from 'provider' then
    perform private.raise_app_error('forbidden', 'Only the contractor can propose change orders.');
  end if;
  if v_p.contract_amount_centavos is null or v_p.status in ('completed', 'cancelled') then
    perform private.raise_app_error('invalid_transition', 'Change orders apply to active contracts.');
  end if;
  if exists (select 1 from public.change_orders where project_id = p_project and status = 'proposed') then
    perform private.raise_app_error('change_order_pending', 'Wait for the customer to decide on the current change order.');
  end if;
  insert into public.change_orders (project_id, number, title, description, amount_delta_centavos, schedule_delta_days)
  values (p_project, coalesce((select max(number) from public.change_orders where project_id = p_project), 0) + 1,
          btrim(p_title), coalesce(p_description, ''), p_amount_delta, coalesce(p_schedule_delta, 0))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.decide_change_order(p_change_order uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co public.change_orders%rowtype;
  v_p public.projects%rowtype;
begin
  select * into v_co from public.change_orders where id = p_change_order for update;
  if not found then
    perform private.raise_app_error('not_found', 'Change order not found.');
  end if;
  select * into v_p from public.projects where id = v_co.project_id for update;
  -- Explicit customer approval is required; the contractor cannot approve their own change order.
  if private.project_side(v_p, 'manage') is distinct from 'customer' then
    perform private.raise_app_error('forbidden', 'Only the household can approve or reject change orders.');
  end if;
  if v_co.status <> 'proposed' then
    perform private.raise_app_error('invalid_transition', 'This change order was already decided.');
  end if;
  if p_decision not in ('approved', 'rejected') then
    perform private.raise_app_error('invalid_input', 'Decision must be approved or rejected.');
  end if;
  if p_decision = 'approved' and v_p.contract_amount_centavos + v_p.approved_changes_centavos + v_co.amount_delta_centavos < 0 then
    perform private.raise_app_error('invalid_input', 'The project total cannot go below zero.');
  end if;
  update public.change_orders set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_change_order;
  if p_decision = 'approved' then
    update public.projects set approved_changes_centavos = approved_changes_centavos + v_co.amount_delta_centavos,
      target_end_date = case when target_end_date is not null then target_end_date + v_co.schedule_delta_days else null end
    where id = v_p.id;
  end if;
  perform private.write_audit('project.change_order_' || p_decision, 'change_order', p_change_order, v_p.household_id, v_p.organization_id,
    jsonb_build_object('amount_delta_centavos', v_co.amount_delta_centavos));
end;
$$;

create or replace function public.post_project_update(p_project uuid, p_body text, p_percent smallint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_side text;
  v_id uuid;
begin
  select * into v_p from public.projects where id = p_project;
  v_side := case when found then private.project_side(v_p, 'manage') end;
  if v_side is null then
    perform private.raise_app_error('not_found', 'Project not found.');
  end if;
  insert into public.project_updates (project_id, author_side, body, percent_complete)
  values (p_project, v_side, btrim(p_body), case when v_side = 'provider' then p_percent end)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Work orders
-- -----------------------------------------------------------------------------
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'assigned', 'en_route', 'in_progress', 'completed', 'cancelled')),
  completion_notes text not null default '' check (char_length(completion_notes) <= 2000),
  completed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  check (num_nonnulls(booking_id, project_id) = 1)
);
create index work_orders_org_idx on public.work_orders (organization_id, scheduled_start);
create index work_orders_booking_idx on public.work_orders (booking_id);
create trigger work_orders_updated_at before update on public.work_orders for each row execute function private.set_updated_at();

create table public.work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  worker_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid default auth.uid() references auth.users (id) on delete set null,
  active boolean not null default true,
  time_window tstzrange not null,
  unassigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A worker cannot hold two overlapping active assignments.
  constraint work_order_assignments_no_overlap exclude using gist (worker_id with =, time_window with &&) where (active)
);
create index work_order_assignments_worker_idx on public.work_order_assignments (worker_id) where active;
create unique index work_order_assignments_one_active on public.work_order_assignments (work_order_id) where active;
create trigger work_order_assignments_updated_at before update on public.work_order_assignments for each row execute function private.set_updated_at();

create table public.work_order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  position smallint not null default 1,
  label text not null check (char_length(btrim(label)) between 2 and 200),
  is_done boolean not null default false,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_order_checklist_idx on public.work_order_checklist_items (work_order_id, position);
create trigger work_order_checklist_updated_at before update on public.work_order_checklist_items for each row execute function private.set_updated_at();

create or replace function private.is_assigned_worker(p_work_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.work_order_assignments where work_order_id = p_work_order and worker_id = (select auth.uid()) and active);
$$;

create or replace function public.create_work_order(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_project public.projects%rowtype;
  v_org uuid;
  v_household uuid;
  v_start timestamptz := (p_payload ->> 'scheduled_start')::timestamptz;
  v_end timestamptz := (p_payload ->> 'scheduled_end')::timestamptz;
  v_id uuid;
  v_item text;
begin
  if p_payload ? 'booking_id' and p_payload ->> 'booking_id' is not null then
    select * into v_booking from public.bookings where id = (p_payload ->> 'booking_id')::uuid;
    if not found or not private.has_organization_permission(v_booking.organization_id, 'work_orders.manage') then
      perform private.raise_app_error('not_found', 'Booking not found.');
    end if;
    if v_booking.status not in ('confirmed', 'in_progress') then
      perform private.raise_app_error('invalid_transition', 'Work orders are created from confirmed bookings.');
    end if;
    v_org := v_booking.organization_id;
    v_household := v_booking.household_id;
    v_start := coalesce(v_start, v_booking.scheduled_start);
    v_end := coalesce(v_end, v_booking.scheduled_end);
  else
    select * into v_project from public.projects where id = (p_payload ->> 'project_id')::uuid;
    if not found or not private.has_organization_permission(v_project.organization_id, 'work_orders.manage') then
      perform private.raise_app_error('not_found', 'Project not found.');
    end if;
    if v_project.status not in ('active', 'quoted', 'site_visit_scheduled') then
      perform private.raise_app_error('invalid_transition', 'Work orders need an open project.');
    end if;
    v_org := v_project.organization_id;
    v_household := v_project.household_id;
  end if;
  if v_start is null or v_end is null or v_end <= v_start then
    perform private.raise_app_error('invalid_input', 'Set a valid schedule.');
  end if;
  insert into public.work_orders (organization_id, household_id, booking_id, project_id, title, instructions, scheduled_start, scheduled_end)
  values (v_org, v_household, v_booking.id, v_project.id, coalesce(nullif(p_payload ->> 'title', ''), v_booking.title, v_project.title),
          coalesce(p_payload ->> 'instructions', ''), v_start, v_end)
  returning id into v_id;
  for v_item in select jsonb_array_elements_text(coalesce(p_payload -> 'checklist', '[]'::jsonb)) loop
    insert into public.work_order_checklist_items (work_order_id, position, label)
    values (v_id, (select coalesce(max(position), 0) + 1 from public.work_order_checklist_items where work_order_id = v_id), btrim(v_item));
  end loop;
  return v_id;
end;
$$;

-- Assign or reassign a worker. History is kept; overlaps are rejected by the exclusion constraint.
create or replace function public.assign_work_order(p_work_order uuid, p_worker uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo public.work_orders%rowtype;
begin
  select * into v_wo from public.work_orders where id = p_work_order for update;
  if not found or not private.has_organization_permission(v_wo.organization_id, 'work_orders.manage') then
    perform private.raise_app_error('not_found', 'Work order not found.');
  end if;
  if v_wo.status in ('completed', 'cancelled') then
    perform private.raise_app_error('invalid_transition', 'This work order is closed.');
  end if;
  if not exists (select 1 from public.organization_members m join public.roles r on r.id = m.role_id
                 where m.organization_id = v_wo.organization_id and m.user_id = p_worker and m.status = 'active'
                   and private.role_has_permission(m.role_id, 'work_orders.perform')) then
    perform private.raise_app_error('invalid_input', 'Choose an active team member who can do field work.');
  end if;
  update public.work_order_assignments set active = false, unassigned_at = now() where work_order_id = p_work_order and active;
  begin
    insert into public.work_order_assignments (work_order_id, organization_id, worker_id, time_window)
    values (p_work_order, v_wo.organization_id, p_worker, tstzrange(v_wo.scheduled_start, v_wo.scheduled_end));
  exception when exclusion_violation then
    perform private.raise_app_error('worker_unavailable', 'That worker already has a job at this time.');
  end;
  update public.work_orders set status = case when status = 'scheduled' then 'assigned' else status end where id = p_work_order;
end;
$$;

create or replace function public.update_work_order_status(p_work_order uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo public.work_orders%rowtype;
  v_allowed boolean;
begin
  select * into v_wo from public.work_orders where id = p_work_order for update;
  if not found or not (private.has_organization_permission(v_wo.organization_id, 'work_orders.manage') or private.is_assigned_worker(p_work_order)) then
    perform private.raise_app_error('not_found', 'Work order not found.');
  end if;
  v_allowed := (v_wo.status, p_status) in (('assigned', 'en_route'), ('assigned', 'in_progress'), ('en_route', 'in_progress'),
                                            ('in_progress', 'completed'), ('scheduled', 'cancelled'), ('assigned', 'cancelled'));
  if not v_allowed then
    perform private.raise_app_error('invalid_transition', 'That status change is not allowed.');
  end if;
  if p_status = 'cancelled' and not private.has_organization_permission(v_wo.organization_id, 'work_orders.manage') then
    perform private.raise_app_error('forbidden', 'Only dispatchers can cancel work orders.');
  end if;
  if p_status = 'completed' and exists (select 1 from public.work_order_checklist_items where work_order_id = p_work_order and not is_done) then
    perform private.raise_app_error('checklist_incomplete', 'Finish the checklist before completing the job.');
  end if;
  update public.work_orders set status = p_status, completion_notes = coalesce(p_notes, completion_notes),
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_work_order;
  if p_status in ('completed', 'cancelled') then
    update public.work_order_assignments set active = false, unassigned_at = now() where work_order_id = p_work_order and active;
  end if;
  -- The booking follows its work order.
  if v_wo.booking_id is not null and p_status = 'in_progress' then
    update public.bookings set status = 'in_progress' where id = v_wo.booking_id and status = 'confirmed';
  elsif v_wo.booking_id is not null and p_status = 'completed' then
    update public.bookings set status = 'completed', completed_at = now() where id = v_wo.booking_id and status in ('confirmed', 'in_progress');
    perform private.log_booking_event(v_wo.booking_id, 'provider', 'complete', 'in_progress', 'completed', jsonb_build_object('work_order_id', p_work_order));
  end if;
end;
$$;

create or replace function public.toggle_checklist_item(p_item uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo uuid;
  v_org uuid;
  v_status text;
begin
  select i.work_order_id, w.organization_id, w.status into v_wo, v_org, v_status
  from public.work_order_checklist_items i join public.work_orders w on w.id = i.work_order_id where i.id = p_item;
  if v_wo is null or not (private.has_organization_permission(v_org, 'work_orders.manage') or private.is_assigned_worker(v_wo)) then
    perform private.raise_app_error('not_found', 'Checklist item not found.');
  end if;
  if v_status in ('completed', 'cancelled') then
    perform private.raise_app_error('invalid_transition', 'This work order is closed.');
  end if;
  update public.work_order_checklist_items set is_done = p_done, done_at = case when p_done then now() end, done_by = case when p_done then auth.uid() end
  where id = p_item;
end;
$$;

-- Address of the job: revealed to the provider's team only for confirmed or later bookings.
create or replace function public.booking_location(p_booking uuid)
returns table (property_name text, address_line text, barangay text, city_municipality text, province text, postal_code text, latitude numeric, longitude numeric, notes text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.address_line, p.barangay, p.city_municipality, p.province, p.postal_code, p.latitude, p.longitude, p.notes
  from public.bookings b join public.properties p on p.id = b.property_id
  where b.id = p_booking
    and (private.has_household_permission(b.household_id, 'services.view')
         or (b.status in ('confirmed', 'in_progress', 'completed') and private.is_organization_member(b.organization_id)
             and (private.has_organization_permission(b.organization_id, 'bookings.view')
                  or exists (select 1 from public.work_orders w join public.work_order_assignments a on a.work_order_id = w.id
                             where w.booking_id = b.id and a.worker_id = auth.uid() and a.active))));
$$;


-- -----------------------------------------------------------------------------
-- RLS for shared (household ↔ provider) records
-- -----------------------------------------------------------------------------
alter table public.service_requests enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.booking_events enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_updates enable row level security;
alter table public.change_orders enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_assignments enable row level security;
alter table public.work_order_checklist_items enable row level security;

create policy service_requests_select on public.service_requests for select to authenticated using (
  (select private.has_household_permission(household_id, 'services.view')) or (select private.has_organization_permission(organization_id, 'bookings.view'))
);
-- Customers never see draft quotations.
create policy quotations_select on public.quotations for select to authenticated using (
  (select private.has_organization_permission(organization_id, 'bookings.view'))
  or (status <> 'draft' and (select private.has_household_permission(household_id, 'services.view')))
);
create policy quotation_lines_select on public.quotation_lines for select to authenticated using (
  exists (select 1 from public.quotations q where q.id = quotation_id)
);
create policy quotation_lines_insert on public.quotation_lines for insert to authenticated with check (
  exists (select 1 from public.quotations q where q.id = quotation_id and private.has_organization_permission(q.organization_id, 'bookings.manage'))
);
create policy quotation_lines_update on public.quotation_lines for update to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id and private.has_organization_permission(q.organization_id, 'bookings.manage')))
  with check (exists (select 1 from public.quotations q where q.id = quotation_id and private.has_organization_permission(q.organization_id, 'bookings.manage')));
create policy quotation_lines_delete on public.quotation_lines for delete to authenticated using (
  exists (select 1 from public.quotations q where q.id = quotation_id and private.has_organization_permission(q.organization_id, 'bookings.manage'))
);

drop policy bookings_select on public.bookings;
create policy bookings_select on public.bookings for select to authenticated using (
  (select private.has_household_permission(household_id, 'services.view'))
  or (select private.has_organization_permission(organization_id, 'bookings.view'))
  or exists (select 1 from public.work_orders w where w.booking_id = bookings.id and private.is_assigned_worker(w.id))
);
create policy booking_events_select on public.booking_events for select to authenticated using (
  (select private.has_household_permission(household_id, 'services.view')) or (select private.has_organization_permission(organization_id, 'bookings.view'))
);

create policy projects_select on public.projects for select to authenticated using (
  (select private.has_household_permission(household_id, 'services.view')) or (select private.has_organization_permission(organization_id, 'bookings.view'))
);
create policy project_milestones_select on public.project_milestones for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id));
create policy project_milestones_write on public.project_milestones for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and private.has_organization_permission(p.organization_id, 'projects.manage') and p.status not in ('completed', 'cancelled')))
  with check (exists (select 1 from public.projects p where p.id = project_id and private.has_organization_permission(p.organization_id, 'projects.manage') and p.status not in ('completed', 'cancelled')));
create policy project_updates_select on public.project_updates for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id));
create policy change_orders_select on public.change_orders for select to authenticated using (exists (select 1 from public.projects p where p.id = project_id));

-- Workers see only work orders assigned to them; dispatchers see their organization's.
create policy work_orders_select on public.work_orders for select to authenticated using (
  (select private.has_organization_permission(organization_id, 'work_orders.manage'))
  or (select private.is_assigned_worker(id))
  or (select private.has_household_permission(household_id, 'services.view'))
);
create policy work_order_assignments_select on public.work_order_assignments for select to authenticated using (
  (select private.has_organization_permission(organization_id, 'work_orders.manage')) or worker_id = (select auth.uid())
  or exists (select 1 from public.work_orders w where w.id = work_order_id and private.has_household_permission(w.household_id, 'services.view'))
);
create policy work_order_checklist_select on public.work_order_checklist_items for select to authenticated using (
  exists (select 1 from public.work_orders w where w.id = work_order_id)
);
create policy work_order_checklist_write on public.work_order_checklist_items for insert to authenticated with check (
  exists (select 1 from public.work_orders w where w.id = work_order_id and private.has_organization_permission(w.organization_id, 'work_orders.manage') and w.status not in ('completed', 'cancelled'))
);
create policy work_order_checklist_delete on public.work_order_checklist_items for delete to authenticated using (
  exists (select 1 from public.work_orders w where w.id = work_order_id and private.has_organization_permission(w.organization_id, 'work_orders.manage') and w.status not in ('completed', 'cancelled'))
);

-- Writes go through the functions above; only a few direct writes are allowed (column-scoped).
revoke insert, update, delete on public.service_requests, public.quotations, public.booking_events, public.projects,
  public.project_updates, public.change_orders, public.work_orders, public.work_order_assignments from authenticated;
revoke update on public.work_order_checklist_items, public.project_milestones, public.quotation_lines from authenticated;
grant update (position, description, quantity, unit_label, unit_price_centavos) on public.quotation_lines to authenticated;
grant update (position, title, due_on, amount_centavos, status, completed_at) on public.project_milestones to authenticated;
grant update (notes) on public.quotations to authenticated;
create policy quotations_update_draft on public.quotations for update to authenticated
  using (status = 'draft' and (select private.has_organization_permission(organization_id, 'bookings.manage')))
  with check (status = 'draft' and (select private.has_organization_permission(organization_id, 'bookings.manage')));

-- -----------------------------------------------------------------------------
-- Shared files: requests, projects and work orders (household bucket; both sides may access).
-- -----------------------------------------------------------------------------
alter table public.files drop constraint files_entity_type_check;
alter table public.files add constraint files_entity_type_check
  check (entity_type in ('asset', 'pet', 'pet_health', 'vehicle', 'bill', 'bill_payment', 'service_request', 'project', 'work_order'));
alter table public.files drop constraint files_purpose_check;
alter table public.files add constraint files_purpose_check
  check (purpose in ('photo', 'receipt', 'manual', 'warranty', 'vet_record', 'document', 'statement', 'before_photo', 'after_photo', 'evidence', 'other'));

-- Access to a file on a shared record: household side by permission, provider side by org role
-- (workers only for their assigned work orders).
create or replace function private.can_access_shared_entity(p_entity_type text, p_entity_id uuid, p_mode text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_household uuid;
  v_org uuid;
begin
  if p_entity_type = 'service_request' then
    select household_id, organization_id into v_household, v_org from public.service_requests where id = p_entity_id;
    return private.has_household_permission(v_household, case when p_mode = 'manage' then 'services.book' else 'services.view' end)
        or (p_mode = 'view' and private.has_organization_permission(v_org, 'bookings.view'));
  elsif p_entity_type = 'project' then
    select household_id, organization_id into v_household, v_org from public.projects where id = p_entity_id;
    return private.has_household_permission(v_household, case when p_mode = 'manage' then 'services.book' else 'services.view' end)
        or private.has_organization_permission(v_org, case when p_mode = 'manage' then 'projects.manage' else 'bookings.view' end);
  elsif p_entity_type = 'work_order' then
    select household_id, organization_id into v_household, v_org from public.work_orders where id = p_entity_id;
    return (p_mode = 'view' and private.has_household_permission(v_household, 'services.view'))
        or private.has_organization_permission(v_org, 'work_orders.manage')
        or private.is_assigned_worker(p_entity_id);
  end if;
  return false;
end;
$$;

create or replace function private.file_permission(p_entity_type text, p_mode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity_type = 'pet_health' then 'pet.health.' || p_mode
    when p_entity_type in ('bill', 'bill_payment') then 'bills.' || p_mode
    when p_entity_type in ('service_request', 'project', 'work_order') then 'shared'
    else 'registry.' || p_mode
  end;
$$;

create or replace function private.can_access_file_row(p_household uuid, p_entity_type text, p_entity_id uuid, p_mode text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.file_permission(p_entity_type, p_mode) = 'shared' then private.can_access_shared_entity(p_entity_type, p_entity_id, p_mode)
    else private.has_household_permission(p_household, private.file_permission(p_entity_type, p_mode))
  end;
$$;

drop policy files_select on public.files;
drop policy files_insert on public.files;
drop policy files_delete on public.files;
create policy files_select on public.files for select to authenticated using ((select private.can_access_file_row(household_id, entity_type, entity_id, 'view')));
create policy files_insert on public.files for insert to authenticated with check ((select private.can_access_file_row(household_id, entity_type, entity_id, 'manage')));
create policy files_delete on public.files for delete to authenticated using ((select private.can_access_file_row(household_id, entity_type, entity_id, 'manage')));

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
    when 'bill' then exists (select 1 from public.bills where id = new.entity_id and household_id = new.household_id)
    when 'bill_payment' then exists (select 1 from public.bill_payments where id = new.entity_id and household_id = new.household_id)
    when 'service_request' then exists (select 1 from public.service_requests where id = new.entity_id and household_id = new.household_id)
    when 'project' then exists (select 1 from public.projects where id = new.entity_id and household_id = new.household_id)
    when 'work_order' then exists (select 1 from public.work_orders where id = new.entity_id and household_id = new.household_id)
  end;
  if not coalesce(v_ok, false) then
    perform private.raise_app_error('not_found', 'The record this file belongs to was not found.');
  end if;
  return new;
end;
$$;

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
  if array_length(v_parts, 1) <> 4
     or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[2] not in ('asset', 'pet', 'pet_health', 'vehicle', 'bill', 'bill_payment', 'service_request', 'project', 'work_order')
     or v_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.can_access_file_row(v_parts[1]::uuid, v_parts[2], v_parts[3]::uuid, p_mode);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants for commands
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.request_booking(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, uuid)',
    'public.transition_booking(uuid, text, text)',
    'public.reschedule_booking(uuid, timestamptz, text)',
    'public.confirm_booking_completion(uuid, text, text)',
    'public.booking_location(uuid)',
    'public.create_service_request(jsonb)',
    'public.create_quotation_draft(uuid)',
    'public.send_quotation(uuid, date)',
    'public.withdraw_quotation(uuid)',
    'public.decide_quotation(uuid, text, timestamptz)',
    'public.create_project_request(jsonb)',
    'public.update_project(uuid, jsonb)',
    'public.accept_project_quotation(uuid, uuid)',
    'public.start_project_quotation(uuid)',
    'public.propose_change_order(uuid, text, text, bigint, integer)',
    'public.decide_change_order(uuid, text, text)',
    'public.post_project_update(uuid, text, smallint)',
    'public.create_work_order(jsonb)',
    'public.assign_work_order(uuid, uuid)',
    'public.update_work_order_status(uuid, text, text)',
    'public.toggle_checklist_item(uuid, boolean)'
  ] loop
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end;
$$;

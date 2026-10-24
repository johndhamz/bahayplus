-- =============================================================================
-- Phase 3 · Household management
--  - households.default_property_id (same-household, active properties only)
--  - household_activity: permission-filtered activity feed written by triggers
--  - property archive/restore semantics and safety rules
-- =============================================================================

-- Composite key so a household can only reference its own properties.
alter table public.properties add constraint properties_id_household_key unique (id, household_id);

alter table public.households
  add column default_property_id uuid,
  add constraint households_default_property_fk
    foreign key (default_property_id, id) references public.properties (id, household_id)
    on delete set null (default_property_id);

-- Only active properties can be the default; archiving the default clears it.
create or replace function private.check_default_property()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.default_property_id is not null and new.default_property_id is distinct from old.default_property_id then
    if exists (select 1 from public.properties where id = new.default_property_id and (archived_at is not null or not is_active)) then
      perform private.raise_app_error('property_archived', 'An archived or inactive property cannot be the default.');
    end if;
  end if;
  return new;
end;
$$;
create trigger households_default_property_check before update of default_property_id on public.households
  for each row execute function private.check_default_property();

create or replace function private.normalize_property_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Archiving always deactivates; restoring reactivates.
  if new.archived_at is not null then
    new.is_active := false;
  elsif tg_op = 'UPDATE' and old.archived_at is not null and new.archived_at is null then
    new.is_active := true;
  end if;
  -- Household ownership of a property never changes.
  if tg_op = 'UPDATE' and new.household_id <> old.household_id then
    perform private.raise_app_error('forbidden', 'A property cannot be moved to another household.');
  end if;
  return new;
end;
$$;
create trigger properties_normalize_state before insert or update on public.properties
  for each row execute function private.normalize_property_state();

create or replace function private.clear_default_on_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.archived_at is not null or not new.is_active) then
    update public.households set default_property_id = null
    where id = new.household_id and default_property_id = new.id;
  end if;
  return new;
end;
$$;
create trigger properties_clear_default after update of archived_at, is_active on public.properties
  for each row execute function private.clear_default_on_archive();

-- A household's first active property becomes its default automatically.
create or replace function private.default_first_property()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.households set default_property_id = new.id
  where id = new.household_id and default_property_id is null and new.archived_at is null;
  return new;
end;
$$;
create trigger properties_default_first after insert on public.properties
  for each row execute function private.default_first_property();

grant update (name, default_property_id) on public.households to authenticated;

-- -----------------------------------------------------------------------------
-- Activity feed
-- -----------------------------------------------------------------------------
create table public.household_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  actor_id uuid,
  kind text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  -- Readers need this permission in the household to see the row.
  required_permission text not null references public.permissions (key),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index household_activity_feed_idx on public.household_activity (household_id, occurred_at desc);
create index household_activity_property_idx on public.household_activity (property_id, occurred_at desc) where property_id is not null;

alter table public.household_activity enable row level security;
create policy household_activity_select on public.household_activity for select to authenticated
  using ((select private.has_household_permission(household_id, required_permission)));
revoke insert, update, delete on public.household_activity from anon, authenticated;

create or replace function private.record_activity(
  p_household uuid, p_kind text, p_permission text, p_metadata jsonb, p_property uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_activity (household_id, property_id, actor_id, kind, required_permission, metadata)
  values (p_household, p_property, auth.uid(), p_kind, p_permission, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function private.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1))
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = p_user;
$$;

create or replace function private.property_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.household_id, 'property.created', 'property.view',
      jsonb_build_object('name', new.name, 'type', new.property_type), new.id);
  elsif old.archived_at is null and new.archived_at is not null then
    perform private.record_activity(new.household_id, 'property.archived', 'property.view',
      jsonb_build_object('name', new.name), new.id);
  elsif old.archived_at is not null and new.archived_at is null then
    perform private.record_activity(new.household_id, 'property.restored', 'property.view',
      jsonb_build_object('name', new.name), new.id);
  elsif (new.name, new.property_type, new.address_line, new.barangay, new.city_municipality, new.province,
         new.postal_code, new.latitude, new.longitude, new.notes, new.is_active)
        is distinct from
        (old.name, old.property_type, old.address_line, old.barangay, old.city_municipality, old.province,
         old.postal_code, old.latitude, old.longitude, old.notes, old.is_active) then
    perform private.record_activity(new.household_id, 'property.updated', 'property.view',
      jsonb_build_object('name', new.name), new.id);
  end if;
  return new;
end;
$$;
create trigger properties_activity after insert or update on public.properties
  for each row execute function private.property_activity();

create or replace function private.household_activity_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name <> old.name then
    perform private.record_activity(new.id, 'household.renamed', 'household.view',
      jsonb_build_object('from', old.name, 'to', new.name));
  end if;
  if new.default_property_id is distinct from old.default_property_id and new.default_property_id is not null then
    perform private.record_activity(new.id, 'household.default_property_set', 'property.view',
      jsonb_build_object('name', (select name from public.properties where id = new.default_property_id)),
      new.default_property_id);
  end if;
  return new;
end;
$$;
create trigger households_activity after update on public.households
  for each row execute function private.household_activity_on_update();

create or replace function private.member_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.household_members%rowtype := coalesce(new, old);
  v_meta jsonb := jsonb_build_object('member', private.display_name(v_row.user_id));
begin
  -- Skip when the whole household is being deleted.
  if not exists (select 1 from public.households where id = v_row.household_id) then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    perform private.record_activity(new.household_id, 'member.joined', 'household.members.view',
      v_meta || jsonb_build_object('role', (select key from public.roles where id = new.role_id)));
  elsif tg_op = 'DELETE' then
    perform private.record_activity(old.household_id, 'member.removed', 'household.members.view', v_meta);
  else
    if new.role_id <> old.role_id then
      perform private.record_activity(new.household_id, 'member.role_changed', 'household.members.view',
        v_meta || jsonb_build_object('role', (select key from public.roles where id = new.role_id)));
    end if;
    if new.status <> old.status then
      perform private.record_activity(new.household_id,
        case when new.status = 'suspended' then 'member.suspended' else 'member.reactivated' end,
        'household.members.view', v_meta);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger household_members_activity after insert or update or delete on public.household_members
  for each row execute function private.member_activity();

create or replace function private.invitation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.household_id, 'invitation.sent', 'household.invitations.manage',
      jsonb_build_object('email', new.email, 'role', (select key from public.roles where id = new.role_id)));
  elsif new.status = 'revoked' and old.status = 'pending' then
    perform private.record_activity(new.household_id, 'invitation.revoked', 'household.invitations.manage',
      jsonb_build_object('email', new.email));
  end if;
  return new;
end;
$$;
create trigger household_invitations_activity after insert or update on public.household_invitations
  for each row execute function private.invitation_activity();

-- Household creation is recorded once the owner membership exists (the member trigger covers "joined").

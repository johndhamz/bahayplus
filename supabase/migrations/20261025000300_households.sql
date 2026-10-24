-- =============================================================================
-- Phase 2 · Household tenancy: households, members, invitations, properties
--
-- Write model: membership and invitation changes go ONLY through the SECURITY DEFINER
-- functions below (no INSERT/UPDATE/DELETE policies exist on those tables). Each function
-- enforces permissions, rank-based escalation rules, last-owner protection and audit.
-- Read model: RLS policies built on private.has_household_permission().
--
-- Errors raised for callers use SQLSTATE P0001 with a stable machine key as the message
-- (e.g. 'last_owner') and a human sentence in DETAIL.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger households_updated_at before update on public.households
  for each row execute function private.set_updated_at();

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null,
  role_scope text not null default 'household' check (role_scope = 'household'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id),
  foreign key (role_id, role_scope) references public.roles (id, scope)
);
create index household_members_user_idx on public.household_members (user_id, household_id) where status = 'active';
create index household_members_role_idx on public.household_members (role_id);
create trigger household_members_updated_at before update on public.household_members
  for each row execute function private.set_updated_at();

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id uuid not null,
  role_scope text not null default 'household' check (role_scope = 'household'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (role_id, role_scope) references public.roles (id, scope),
  check (expires_at > created_at)
);
-- At most one live invitation per email per household.
create unique index household_invitations_one_pending on public.household_invitations (household_id, email)
  where status = 'pending';
create index household_invitations_household_idx on public.household_invitations (household_id, created_at desc);
create trigger household_invitations_updated_at before update on public.household_invitations
  for each row execute function private.set_updated_at();

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  property_type text not null check (property_type in ('house', 'condominium', 'apartment', 'townhouse', 'other')),
  address_line text not null default '' check (char_length(address_line) <= 200),
  barangay text not null default '' check (char_length(barangay) <= 100),
  city_municipality text not null default '' check (char_length(city_municipality) <= 100),
  province text not null default '' check (char_length(province) <= 100),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{4}$'),
  -- Philippine bounding box (approx.): lat 4–22 N, lon 116–127 E.
  latitude numeric(8, 6) check (latitude is null or latitude between 4 and 22),
  longitude numeric(9, 6) check (longitude is null or longitude between 116 and 127),
  notes text not null default '' check (char_length(notes) <= 2000),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (archived_at is null or is_active = false)
);
create index properties_household_idx on public.properties (household_id) where archived_at is null;
create trigger properties_updated_at before update on public.properties
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.household_role_of(p_household uuid, p_user uuid)
returns table (role_id uuid, role_key text, rank smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.key, r.rank
  from public.household_members m
  join public.roles r on r.id = m.role_id
  join public.households h on h.id = m.household_id
  where m.household_id = p_household and m.user_id = p_user and m.status = 'active' and h.archived_at is null;
$$;

create or replace function private.is_household_member(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.household_role_of(p_household, (select auth.uid())));
$$;

create or replace function private.has_household_permission(p_household uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.household_role_of(p_household, (select auth.uid())) hr
    where private.role_has_permission(hr.role_id, p_permission)
  );
$$;

create or replace function private.household_role_id(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.roles where scope = 'household' and key = p_key;
$$;

create or replace function private.raise_app_error(p_key text, p_detail text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_key, detail = p_detail;
end;
$$;

create or replace function private.new_invitation_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

create or replace function private.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Last-owner protection (applies to every writer, including service_role).
-- -----------------------------------------------------------------------------
create or replace function private.protect_last_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role uuid := private.household_role_id('owner');
  v_still_owner boolean;
begin
  if old.role_id <> v_owner_role or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  v_still_owner := tg_op = 'UPDATE' and new.role_id = v_owner_role and new.status = 'active';
  if v_still_owner then
    return new;
  end if;
  -- Deleting the household itself cascades to members; allow that.
  if not exists (select 1 from public.households where id = old.household_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = old.household_id and id <> old.id and role_id = v_owner_role and status = 'active'
  ) then
    perform private.raise_app_error('last_owner', 'A household must always have at least one active owner.');
  end if;
  return coalesce(new, old);
end;
$$;
create trigger household_members_last_owner before update or delete on public.household_members
  for each row execute function private.protect_last_household_owner();

create or replace function private.audit_household_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('household.member_added', 'household_member', new.id, new.household_id, null,
      jsonb_build_object('user_id', new.user_id, 'role', (select key from public.roles where id = new.role_id)));
  elsif tg_op = 'UPDATE' then
    if new.role_id <> old.role_id then
      perform private.write_audit('household.member_role_changed', 'household_member', new.id, new.household_id, null,
        jsonb_build_object('user_id', new.user_id,
          'from', (select key from public.roles where id = old.role_id),
          'to', (select key from public.roles where id = new.role_id)));
    end if;
    if new.status <> old.status then
      perform private.write_audit('household.member_status_changed', 'household_member', new.id, new.household_id, null,
        jsonb_build_object('user_id', new.user_id, 'from', old.status, 'to', new.status));
    end if;
  else
    perform private.write_audit('household.member_removed', 'household_member', old.id, old.household_id, null,
      jsonb_build_object('user_id', old.user_id, 'role', (select key from public.roles where id = old.role_id)));
  end if;
  return coalesce(new, old);
end;
$$;
create trigger household_members_audit after insert or update or delete on public.household_members
  for each row execute function private.audit_household_members();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.properties enable row level security;

create policy households_select on public.households for select to authenticated
  using ((select private.is_household_member(id)));
create policy households_update on public.households for update to authenticated
  using ((select private.has_household_permission(id, 'household.update')))
  with check ((select private.has_household_permission(id, 'household.update')));
-- Direct updates may only touch the name; everything else goes through functions.
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;

create policy household_members_select on public.household_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_household_permission(household_id, 'household.members.view'))
  );

create policy household_invitations_select on public.household_invitations for select to authenticated
  using ((select private.has_household_permission(household_id, 'household.invitations.manage')));
-- Never expose token hashes through the API.
revoke select on public.household_invitations from authenticated, anon;
grant select (id, household_id, email, role_id, role_scope, status, invited_by, expires_at, accepted_by, accepted_at, revoked_at, created_at, updated_at)
  on public.household_invitations to authenticated;

create policy properties_select on public.properties for select to authenticated
  using ((select private.has_household_permission(household_id, 'property.view')));
create policy properties_insert on public.properties for insert to authenticated
  with check ((select private.has_household_permission(household_id, 'property.manage')) and created_by = (select auth.uid()));
create policy properties_update on public.properties for update to authenticated
  using ((select private.has_household_permission(household_id, 'property.manage')))
  with check ((select private.has_household_permission(household_id, 'property.manage')));
-- No delete policy: properties are archived, never hard-deleted by users.
revoke update on public.properties from authenticated;
grant update (name, property_type, address_line, barangay, city_municipality, province, postal_code, latitude, longitude, notes, is_active, archived_at)
  on public.properties to authenticated;

-- -----------------------------------------------------------------------------
-- Commands
-- -----------------------------------------------------------------------------
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
begin
  if v_user is null then
    perform private.raise_app_error('unauthenticated', 'Sign in to create a household.');
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    perform private.raise_app_error('invalid_input', 'Household name must be 1–80 characters.');
  end if;
  if (select count(*) from public.household_members where user_id = v_user) >= 20 then
    perform private.raise_app_error('limit_reached', 'You can belong to at most 20 households.');
  end if;

  insert into public.households (name, created_by) values (btrim(p_name), v_user) returning id into v_household;
  insert into public.household_members (household_id, user_id, role_id)
  values (v_household, v_user, private.household_role_id('owner'));
  perform private.write_audit('household.created', 'household', v_household, v_household, null,
    jsonb_build_object('name', btrim(p_name)));
  return v_household;
end;
$$;

-- Validates that the caller may set `p_new_role` on a member currently holding `p_target_role`.
create or replace function private.assert_household_role_change(
  p_household uuid, p_target_user uuid, p_target_role text, p_new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_rank smallint;
  v_target_rank smallint;
  v_new_rank smallint;
begin
  select rank into v_actor_rank from private.household_role_of(p_household, v_actor);
  if v_actor_rank is null then
    perform private.raise_app_error('not_found', 'Household not found.');
  end if;
  if not private.has_household_permission(p_household, 'household.members.manage') then
    perform private.raise_app_error('forbidden', 'You cannot manage members of this household.');
  end if;
  select rank into v_target_rank from public.roles where scope = 'household' and key = p_target_role;
  if p_new_role is not null then
    select rank into v_new_rank from public.roles where scope = 'household' and key = p_new_role;
    if v_new_rank is null then
      perform private.raise_app_error('invalid_role', 'Unknown household role.');
    end if;
  end if;
  -- Owner role changes (granting or affecting an owner) require owners.manage.
  if (p_target_role = 'owner' or p_new_role = 'owner')
     and not private.has_household_permission(p_household, 'household.owners.manage') then
    perform private.raise_app_error('role_escalation', 'Only an owner can grant or change the owner role.');
  end if;
  -- Non-owners may only act on members ranked strictly below them, and only assign roles below their own.
  if v_actor_rank < 100 then
    if v_target_rank >= v_actor_rank and p_target_user <> v_actor then
      perform private.raise_app_error('forbidden', 'You can only manage members with a lower role than yours.');
    end if;
    if v_new_rank is not null and v_new_rank >= v_actor_rank then
      perform private.raise_app_error('role_escalation', 'You cannot assign a role equal to or higher than your own.');
    end if;
  end if;
  -- Nobody can raise their own role.
  if p_target_user = v_actor and v_new_rank is not null and v_new_rank > v_target_rank then
    perform private.raise_app_error('role_escalation', 'You cannot raise your own role.');
  end if;
end;
$$;

create or replace function public.change_household_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
  v_current text;
begin
  select * into v_member from public.household_members where id = p_member for update;
  if not found or not private.is_household_member(v_member.household_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  select key into v_current from public.roles where id = v_member.role_id;
  if v_current = p_role then
    return;
  end if;
  perform private.assert_household_role_change(v_member.household_id, v_member.user_id, v_current, p_role);
  update public.household_members set role_id = private.household_role_id(p_role) where id = p_member;
end;
$$;

create or replace function public.set_household_member_status(p_member uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
  v_current text;
begin
  if p_status not in ('active', 'suspended') then
    perform private.raise_app_error('invalid_input', 'Status must be active or suspended.');
  end if;
  select * into v_member from public.household_members where id = p_member for update;
  if not found or not private.is_household_member(v_member.household_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  if v_member.user_id = auth.uid() then
    perform private.raise_app_error('forbidden', 'You cannot change your own membership status.');
  end if;
  select key into v_current from public.roles where id = v_member.role_id;
  perform private.assert_household_role_change(v_member.household_id, v_member.user_id, v_current, null);
  update public.household_members set status = p_status where id = p_member;
end;
$$;

create or replace function public.remove_household_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
  v_current text;
begin
  select * into v_member from public.household_members where id = p_member for update;
  if not found or not private.is_household_member(v_member.household_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  -- Leaving voluntarily is always allowed (subject to last-owner protection).
  if v_member.user_id <> auth.uid() then
    select key into v_current from public.roles where id = v_member.role_id;
    perform private.assert_household_role_change(v_member.household_id, v_member.user_id, v_current, null);
  end if;
  delete from public.household_members where id = p_member;
end;
$$;

create or replace function public.invite_household_member(p_household uuid, p_email text, p_role text)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_actor_rank smallint;
  v_role_rank smallint;
  v_token text := private.new_invitation_token();
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if not private.is_household_member(p_household) then
    perform private.raise_app_error('not_found', 'Household not found.');
  end if;
  if not private.has_household_permission(p_household, 'household.invitations.manage') then
    perform private.raise_app_error('forbidden', 'You cannot invite members to this household.');
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.raise_app_error('invalid_input', 'Enter a valid email address.');
  end if;
  select rank into v_actor_rank from private.household_role_of(p_household, auth.uid());
  select rank into v_role_rank from public.roles where scope = 'household' and key = p_role;
  if v_role_rank is null then
    perform private.raise_app_error('invalid_role', 'Unknown household role.');
  end if;
  if (p_role = 'owner' and not private.has_household_permission(p_household, 'household.owners.manage'))
     or (v_actor_rank < 100 and v_role_rank >= v_actor_rank) then
    perform private.raise_app_error('role_escalation', 'You cannot invite someone with a role equal to or higher than your own.');
  end if;
  if exists (
    select 1 from public.household_members m join auth.users u on u.id = m.user_id
    where m.household_id = p_household and lower(u.email) = v_email
  ) then
    perform private.raise_app_error('already_member', 'That person is already a member of this household.');
  end if;
  -- Expire stale pending invitations for this email so a fresh one can be issued.
  update public.household_invitations set status = 'expired'
  where household_id = p_household and email = v_email and status = 'pending' and household_invitations.expires_at <= now();
  if exists (select 1 from public.household_invitations where household_id = p_household and email = v_email and status = 'pending') then
    perform private.raise_app_error('duplicate_invitation', 'There is already a pending invitation for that email.');
  end if;
  if (select count(*) from public.household_invitations where household_id = p_household and status = 'pending') >= 50 then
    perform private.raise_app_error('limit_reached', 'This household has too many pending invitations.');
  end if;

  insert into public.household_invitations (household_id, email, role_id, token_hash, invited_by, expires_at)
  values (p_household, v_email, private.household_role_id(p_role), private.hash_token(v_token), auth.uid(), v_expires)
  returning id into v_id;
  perform private.write_audit('household.invitation_created', 'household_invitation', v_id, p_household, null,
    jsonb_build_object('email', v_email, 'role', p_role));
  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.revoke_household_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.household_invitations%rowtype;
begin
  select * into v_inv from public.household_invitations where id = p_invitation for update;
  if not found or not private.has_household_permission(v_inv.household_id, 'household.invitations.manage') then
    perform private.raise_app_error('not_found', 'Invitation not found.');
  end if;
  if v_inv.status <> 'pending' then
    perform private.raise_app_error('invitation_not_pending', 'Only pending invitations can be revoked.');
  end if;
  update public.household_invitations set status = 'revoked', revoked_at = now() where id = p_invitation;
  perform private.write_audit('household.invitation_revoked', 'household_invitation', p_invitation, v_inv.household_id, null,
    jsonb_build_object('email', v_inv.email));
end;
$$;

-- Preview for the invitee before accepting. Reveals nothing without the secret token.
create or replace function public.get_household_invitation(p_token text)
returns table (household_name text, role_key text, invited_email text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name, r.key, i.email,
         case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
         i.expires_at
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  join public.roles r on r.id = i.role_id
  where i.token_hash = private.hash_token(p_token) and auth.uid() is not null;
$$;

create or replace function public.accept_household_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_user_email text;
  v_confirmed timestamptz;
  v_inv public.household_invitations%rowtype;
begin
  if v_user is null then
    perform private.raise_app_error('unauthenticated', 'Sign in to accept the invitation.');
  end if;
  select * into v_inv from public.household_invitations where token_hash = private.hash_token(p_token) for update;
  if not found then
    perform private.raise_app_error('invitation_invalid', 'This invitation link is not valid.');
  end if;
  if v_inv.status = 'accepted' then
    perform private.raise_app_error('invitation_used', 'This invitation has already been used.');
  end if;
  if v_inv.status in ('revoked', 'expired') or v_inv.expires_at <= now() then
    perform private.raise_app_error('invitation_expired', 'This invitation has expired or was cancelled. Ask for a new one.');
  end if;
  select lower(email), email_confirmed_at into v_user_email, v_confirmed from auth.users where id = v_user;
  if v_confirmed is null then
    perform private.raise_app_error('email_unverified', 'Verify your email address before accepting invitations.');
  end if;
  if v_user_email is distinct from v_inv.email then
    perform private.raise_app_error('invitation_email_mismatch', 'This invitation was sent to a different email address.');
  end if;
  if exists (select 1 from public.household_members where household_id = v_inv.household_id and user_id = v_user) then
    perform private.raise_app_error('already_member', 'You are already a member of this household.');
  end if;

  insert into public.household_members (household_id, user_id, role_id, invited_by)
  values (v_inv.household_id, v_user, v_inv.role_id, v_inv.invited_by);
  update public.household_invitations set status = 'accepted', accepted_by = v_user, accepted_at = now() where id = v_inv.id;
  perform private.write_audit('household.invitation_accepted', 'household_invitation', v_inv.id, v_inv.household_id, null, '{}'::jsonb);
  return v_inv.household_id;
end;
$$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.change_household_member_role(uuid, text) from public, anon;
revoke all on function public.set_household_member_status(uuid, text) from public, anon;
revoke all on function public.remove_household_member(uuid) from public, anon;
revoke all on function public.invite_household_member(uuid, text, text) from public, anon;
revoke all on function public.revoke_household_invitation(uuid) from public, anon;
revoke all on function public.get_household_invitation(text) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.change_household_member_role(uuid, text) to authenticated;
grant execute on function public.set_household_member_status(uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
grant execute on function public.invite_household_member(uuid, text, text) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.get_household_invitation(text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;

-- =============================================================================
-- Phase 2 · Organization tenancy: provider/supplier organizations, members, invitations
-- Same write model as households: SECURITY DEFINER commands, read-only RLS policies.
-- =============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('service_provider', 'supplier')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  -- Platform-controlled lifecycle. Suspended organizations keep data but lose access.
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null,
  role_scope text not null default 'organization' check (role_scope = 'organization'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  foreign key (role_id, role_scope) references public.roles (id, scope)
);
create index organization_members_user_idx on public.organization_members (user_id, organization_id) where status = 'active';
create index organization_members_role_idx on public.organization_members (role_id);
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id uuid not null,
  role_scope text not null default 'organization' check (role_scope = 'organization'),
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
create unique index organization_invitations_one_pending on public.organization_invitations (organization_id, email)
  where status = 'pending';
create index organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
create trigger organization_invitations_updated_at before update on public.organization_invitations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.organization_role_of(p_org uuid, p_user uuid)
returns table (role_id uuid, role_key text, rank smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.key, r.rank
  from public.organization_members m
  join public.roles r on r.id = m.role_id
  join public.organizations o on o.id = m.organization_id
  where m.organization_id = p_org and m.user_id = p_user and m.status = 'active' and o.status = 'active';
$$;

create or replace function private.is_organization_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.organization_role_of(p_org, (select auth.uid())));
$$;

create or replace function private.has_organization_permission(p_org uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.organization_role_of(p_org, (select auth.uid())) r
    where private.role_has_permission(r.role_id, p_permission)
  );
$$;

create or replace function private.organization_role_id(p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.roles where scope = 'organization' and key = p_key;
$$;

-- People who share at least one active household or organization with the caller.
create or replace function private.shares_tenant_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = p_user
  ) or exists (
    select 1 from public.organization_members a
    join public.organization_members b on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = p_user
  );
$$;

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.shares_tenant_with(id))
    or (select private.has_platform_permission('platform.users.view'))
  );
-- Users may edit only their display fields.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, locale) on public.profiles to authenticated;

create or replace function private.protect_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_role uuid := private.organization_role_id('owner');
begin
  if old.role_id <> v_owner_role or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role_id = v_owner_role and new.status = 'active' then
    return new;
  end if;
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = old.organization_id and id <> old.id and role_id = v_owner_role and status = 'active'
  ) then
    perform private.raise_app_error('last_owner', 'An organization must always have at least one active owner.');
  end if;
  return coalesce(new, old);
end;
$$;
create trigger organization_members_last_owner before update or delete on public.organization_members
  for each row execute function private.protect_last_organization_owner();

create or replace function private.audit_organization_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('organization.member_added', 'organization_member', new.id, null, new.organization_id,
      jsonb_build_object('user_id', new.user_id, 'role', (select key from public.roles where id = new.role_id)));
  elsif tg_op = 'UPDATE' then
    if new.role_id <> old.role_id then
      perform private.write_audit('organization.member_role_changed', 'organization_member', new.id, null, new.organization_id,
        jsonb_build_object('user_id', new.user_id,
          'from', (select key from public.roles where id = old.role_id),
          'to', (select key from public.roles where id = new.role_id)));
    end if;
    if new.status <> old.status then
      perform private.write_audit('organization.member_status_changed', 'organization_member', new.id, null, new.organization_id,
        jsonb_build_object('user_id', new.user_id, 'from', old.status, 'to', new.status));
    end if;
  else
    perform private.write_audit('organization.member_removed', 'organization_member', old.id, null, old.organization_id,
      jsonb_build_object('user_id', old.user_id, 'role', (select key from public.roles where id = old.role_id)));
  end if;
  return coalesce(new, old);
end;
$$;
create trigger organization_members_audit after insert or update or delete on public.organization_members
  for each row execute function private.audit_organization_members();

create or replace function private.audit_organization_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> old.status then
    perform private.write_audit('organization.status_changed', 'organization', new.id, null, new.id,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger organizations_status_audit after update on public.organizations
  for each row execute function private.audit_organization_status();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (
    exists (select 1 from public.organization_members m
            where m.organization_id = organizations.id and m.user_id = (select auth.uid()) and m.status = 'active')
    or (select private.has_platform_permission('platform.access'))
  );
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.has_organization_permission(id, 'organization.update')))
  with check ((select private.has_organization_permission(id, 'organization.update')));
revoke update on public.organizations from authenticated;
grant update (name) on public.organizations to authenticated;

create policy organization_members_select on public.organization_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_organization_permission(organization_id, 'organization.members.view'))
    or (select private.has_platform_permission('platform.access'))
  );

create policy organization_invitations_select on public.organization_invitations for select to authenticated
  using ((select private.has_organization_permission(organization_id, 'organization.invitations.manage')));
revoke select on public.organization_invitations from authenticated, anon;
grant select (id, organization_id, email, role_id, role_scope, status, invited_by, expires_at, accepted_by, accepted_at, revoked_at, created_at, updated_at)
  on public.organization_invitations to authenticated;

-- -----------------------------------------------------------------------------
-- Commands
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(p_kind text, p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    perform private.raise_app_error('unauthenticated', 'Sign in to register a business.');
  end if;
  if p_kind not in ('service_provider', 'supplier') then
    perform private.raise_app_error('invalid_input', 'Choose service provider or supplier.');
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    perform private.raise_app_error('invalid_input', 'Business name must be 2–120 characters.');
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$' then
    perform private.raise_app_error('invalid_input', 'Use 3–60 lowercase letters, numbers and dashes for the handle.');
  end if;
  if exists (select 1 from public.organizations where slug = p_slug) then
    perform private.raise_app_error('slug_taken', 'That handle is already taken.');
  end if;
  if (select count(*) from public.organization_members m join public.roles r on r.id = m.role_id
      where m.user_id = v_user and r.key = 'owner') >= 10 then
    perform private.raise_app_error('limit_reached', 'You can own at most 10 organizations.');
  end if;

  insert into public.organizations (kind, name, slug, created_by) values (p_kind, btrim(p_name), p_slug, v_user)
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role_id)
  values (v_org, v_user, private.organization_role_id('owner'));
  perform private.write_audit('organization.created', 'organization', v_org, null, v_org,
    jsonb_build_object('kind', p_kind, 'name', btrim(p_name), 'slug', p_slug));
  return v_org;
end;
$$;

create or replace function private.assert_organization_role_change(
  p_org uuid, p_target_user uuid, p_target_role text, p_new_role text
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
  select rank into v_actor_rank from private.organization_role_of(p_org, v_actor);
  if v_actor_rank is null then
    perform private.raise_app_error('not_found', 'Organization not found.');
  end if;
  if not private.has_organization_permission(p_org, 'organization.members.manage') then
    perform private.raise_app_error('forbidden', 'You cannot manage staff of this organization.');
  end if;
  select rank into v_target_rank from public.roles where scope = 'organization' and key = p_target_role;
  if p_new_role is not null then
    select rank into v_new_rank from public.roles where scope = 'organization' and key = p_new_role;
    if v_new_rank is null then
      perform private.raise_app_error('invalid_role', 'Unknown organization role.');
    end if;
  end if;
  if (p_target_role = 'owner' or p_new_role = 'owner')
     and not private.has_organization_permission(p_org, 'organization.owners.manage') then
    perform private.raise_app_error('role_escalation', 'Only an owner can grant or change the owner role.');
  end if;
  if v_actor_rank < 100 then
    if v_target_rank >= v_actor_rank and p_target_user <> v_actor then
      perform private.raise_app_error('forbidden', 'You can only manage staff with a lower role than yours.');
    end if;
    if v_new_rank is not null and v_new_rank >= v_actor_rank then
      perform private.raise_app_error('role_escalation', 'You cannot assign a role equal to or higher than your own.');
    end if;
  end if;
  if p_target_user = v_actor and v_new_rank is not null and v_new_rank > v_target_rank then
    perform private.raise_app_error('role_escalation', 'You cannot raise your own role.');
  end if;
end;
$$;

create or replace function public.change_organization_member_role(p_member uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_current text;
begin
  select * into v_member from public.organization_members where id = p_member for update;
  if not found or not private.is_organization_member(v_member.organization_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  select key into v_current from public.roles where id = v_member.role_id;
  if v_current = p_role then
    return;
  end if;
  perform private.assert_organization_role_change(v_member.organization_id, v_member.user_id, v_current, p_role);
  update public.organization_members set role_id = private.organization_role_id(p_role) where id = p_member;
end;
$$;

create or replace function public.set_organization_member_status(p_member uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_current text;
begin
  if p_status not in ('active', 'suspended') then
    perform private.raise_app_error('invalid_input', 'Status must be active or suspended.');
  end if;
  select * into v_member from public.organization_members where id = p_member for update;
  if not found or not private.is_organization_member(v_member.organization_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  if v_member.user_id = auth.uid() then
    perform private.raise_app_error('forbidden', 'You cannot change your own membership status.');
  end if;
  select key into v_current from public.roles where id = v_member.role_id;
  perform private.assert_organization_role_change(v_member.organization_id, v_member.user_id, v_current, null);
  update public.organization_members set status = p_status where id = p_member;
end;
$$;

create or replace function public.remove_organization_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_current text;
begin
  select * into v_member from public.organization_members where id = p_member for update;
  if not found or not private.is_organization_member(v_member.organization_id) then
    perform private.raise_app_error('not_found', 'Member not found.');
  end if;
  if v_member.user_id <> auth.uid() then
    select key into v_current from public.roles where id = v_member.role_id;
    perform private.assert_organization_role_change(v_member.organization_id, v_member.user_id, v_current, null);
  end if;
  delete from public.organization_members where id = p_member;
end;
$$;

create or replace function public.invite_organization_member(p_org uuid, p_email text, p_role text)
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
  if not private.is_organization_member(p_org) then
    perform private.raise_app_error('not_found', 'Organization not found.');
  end if;
  if not private.has_organization_permission(p_org, 'organization.invitations.manage') then
    perform private.raise_app_error('forbidden', 'You cannot invite staff to this organization.');
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.raise_app_error('invalid_input', 'Enter a valid email address.');
  end if;
  select rank into v_actor_rank from private.organization_role_of(p_org, auth.uid());
  select rank into v_role_rank from public.roles where scope = 'organization' and key = p_role;
  if v_role_rank is null then
    perform private.raise_app_error('invalid_role', 'Unknown organization role.');
  end if;
  if (p_role = 'owner' and not private.has_organization_permission(p_org, 'organization.owners.manage'))
     or (v_actor_rank < 100 and v_role_rank >= v_actor_rank) then
    perform private.raise_app_error('role_escalation', 'You cannot invite someone with a role equal to or higher than your own.');
  end if;
  if exists (
    select 1 from public.organization_members m join auth.users u on u.id = m.user_id
    where m.organization_id = p_org and lower(u.email) = v_email
  ) then
    perform private.raise_app_error('already_member', 'That person is already on your team.');
  end if;
  update public.organization_invitations set status = 'expired'
  where organization_id = p_org and email = v_email and status = 'pending' and organization_invitations.expires_at <= now();
  if exists (select 1 from public.organization_invitations where organization_id = p_org and email = v_email and status = 'pending') then
    perform private.raise_app_error('duplicate_invitation', 'There is already a pending invitation for that email.');
  end if;

  insert into public.organization_invitations (organization_id, email, role_id, token_hash, invited_by, expires_at)
  values (p_org, v_email, private.organization_role_id(p_role), private.hash_token(v_token), auth.uid(), v_expires)
  returning id into v_id;
  perform private.write_audit('organization.invitation_created', 'organization_invitation', v_id, null, p_org,
    jsonb_build_object('email', v_email, 'role', p_role));
  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.revoke_organization_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations%rowtype;
begin
  select * into v_inv from public.organization_invitations where id = p_invitation for update;
  if not found or not private.has_organization_permission(v_inv.organization_id, 'organization.invitations.manage') then
    perform private.raise_app_error('not_found', 'Invitation not found.');
  end if;
  if v_inv.status <> 'pending' then
    perform private.raise_app_error('invitation_not_pending', 'Only pending invitations can be revoked.');
  end if;
  update public.organization_invitations set status = 'revoked', revoked_at = now() where id = p_invitation;
  perform private.write_audit('organization.invitation_revoked', 'organization_invitation', p_invitation, null, v_inv.organization_id,
    jsonb_build_object('email', v_inv.email));
end;
$$;

create or replace function public.get_organization_invitation(p_token text)
returns table (organization_name text, organization_kind text, role_key text, invited_email text, status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, o.kind, r.key, i.email,
         case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
         i.expires_at
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  join public.roles r on r.id = i.role_id
  where i.token_hash = private.hash_token(p_token) and auth.uid() is not null;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_user_email text;
  v_confirmed timestamptz;
  v_inv public.organization_invitations%rowtype;
begin
  if v_user is null then
    perform private.raise_app_error('unauthenticated', 'Sign in to accept the invitation.');
  end if;
  select * into v_inv from public.organization_invitations where token_hash = private.hash_token(p_token) for update;
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
  if exists (select 1 from public.organization_members where organization_id = v_inv.organization_id and user_id = v_user) then
    perform private.raise_app_error('already_member', 'You are already on this team.');
  end if;

  insert into public.organization_members (organization_id, user_id, role_id, invited_by)
  values (v_inv.organization_id, v_user, v_inv.role_id, v_inv.invited_by);
  update public.organization_invitations set status = 'accepted', accepted_by = v_user, accepted_at = now() where id = v_inv.id;
  perform private.write_audit('organization.invitation_accepted', 'organization_invitation', v_inv.id, null, v_inv.organization_id, '{}'::jsonb);
  return v_inv.organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
revoke all on function public.change_organization_member_role(uuid, text) from public, anon;
revoke all on function public.set_organization_member_status(uuid, text) from public, anon;
revoke all on function public.remove_organization_member(uuid) from public, anon;
revoke all on function public.invite_organization_member(uuid, text, text) from public, anon;
revoke all on function public.revoke_organization_invitation(uuid) from public, anon;
revoke all on function public.get_organization_invitation(text) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.change_organization_member_role(uuid, text) to authenticated;
grant execute on function public.set_organization_member_status(uuid, text) to authenticated;
grant execute on function public.remove_organization_member(uuid) to authenticated;
grant execute on function public.invite_organization_member(uuid, text, text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.get_organization_invitation(text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Context listing for the tenant switcher: every active context of the caller.
-- -----------------------------------------------------------------------------
create or replace function public.my_contexts()
returns table (kind text, id uuid, name text, role_key text, org_kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'household', h.id, h.name, r.key, null::text
  from public.household_members m
  join public.households h on h.id = m.household_id
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and h.archived_at is null
  union all
  select 'organization', o.id, o.name, r.key, o.kind
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and o.status = 'active'
  union all
  select 'platform', null, 'Bahay+ Admin', r.key, null::text
  from public.platform_admins a
  join public.roles r on r.id = a.role_id
  where a.user_id = (select auth.uid())
  order by 1, 3;
$$;
revoke all on function public.my_contexts() from public, anon;
grant execute on function public.my_contexts() to authenticated;

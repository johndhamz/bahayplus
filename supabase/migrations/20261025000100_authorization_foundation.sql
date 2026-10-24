-- =============================================================================
-- Phase 2 · Authorization foundation
-- Roles, permissions and role_permissions are reference data; authority is always
-- contextual (a membership in one household or organization) — there is no global
-- role column on profiles. Platform admins are granted only server-side.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Roles & permissions (reference data)
-- -----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('household', 'organization', 'platform')),
  key text not null check (key ~ '^[a-z_]+$'),
  name text not null,
  description text not null default '',
  -- Higher rank = more privileged within the scope. Used to prevent privilege escalation.
  rank smallint not null check (rank between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, key),
  unique (scope, rank),
  -- Enables composite FKs that pin a membership's role to the right scope.
  unique (id, scope)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('household', 'organization', 'platform')),
  key text not null unique check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, scope)
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index role_permissions_permission_idx on public.role_permissions (permission_id);

create trigger roles_updated_at before update on public.roles
  for each row execute function private.set_updated_at();
create trigger permissions_updated_at before update on public.permissions
  for each row execute function private.set_updated_at();
create trigger role_permissions_updated_at before update on public.role_permissions
  for each row execute function private.set_updated_at();

-- A role may only be granted permissions of its own scope.
create or replace function private.check_role_permission_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select scope from public.roles where id = new.role_id)
     is distinct from (select scope from public.permissions where id = new.permission_id) then
    raise exception 'role/permission scope mismatch' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger role_permissions_scope before insert or update on public.role_permissions
  for each row execute function private.check_role_permission_scope();

insert into public.roles (scope, key, name, description, rank) values
  ('household', 'owner',   'Owner',   'Household head. Full control, including owners and deletion.', 100),
  ('household', 'manager', 'Manager', 'Trusted adult. Manages members, invitations and properties.', 80),
  ('household', 'member',  'Member',  'Family member. Sees the household and its properties.', 50),
  ('household', 'limited', 'Limited member', 'Tenant, kasambahay, driver or caregiver. Sees household basics only.', 30),
  ('household', 'guest',   'Guest',   'Temporary read-only access to household basics.', 10),
  ('organization', 'owner',   'Owner',   'Business owner. Full control, including owners and deletion.', 100),
  ('organization', 'manager', 'Manager', 'Runs operations and manages staff.', 80),
  ('organization', 'staff',   'Staff',   'Day-to-day operations.', 50),
  ('organization', 'worker',  'Worker',  'Field worker. Sees only assigned work.', 30),
  ('platform', 'super_admin', 'Super admin', 'Full platform administration.', 100),
  ('platform', 'operations',  'Operations',  'Verification decisions, catalogs, organizations.', 80),
  ('platform', 'support',     'Support',     'Read-mostly support access.', 50);

insert into public.permissions (scope, key, description) values
  ('household', 'household.view', 'View household basics'),
  ('household', 'household.update', 'Edit household details'),
  ('household', 'household.delete', 'Delete or archive the household'),
  ('household', 'household.members.view', 'See the member list'),
  ('household', 'household.members.manage', 'Change roles of and remove non-owner members'),
  ('household', 'household.owners.manage', 'Grant or revoke the owner role'),
  ('household', 'household.invitations.manage', 'Create and revoke invitations'),
  ('household', 'property.view', 'View properties'),
  ('household', 'property.manage', 'Create, edit and archive properties'),
  ('organization', 'organization.view', 'View the organization'),
  ('organization', 'organization.update', 'Edit organization details'),
  ('organization', 'organization.delete', 'Delete the organization'),
  ('organization', 'organization.members.view', 'See staff'),
  ('organization', 'organization.members.manage', 'Change roles of and remove non-owner staff'),
  ('organization', 'organization.owners.manage', 'Grant or revoke the owner role'),
  ('organization', 'organization.invitations.manage', 'Invite staff'),
  ('platform', 'platform.access', 'Open the admin portal'),
  ('platform', 'platform.users.view', 'View user accounts'),
  ('platform', 'platform.organizations.manage', 'Suspend or reinstate organizations'),
  ('platform', 'platform.verifications.decide', 'Approve or reject verification requests'),
  ('platform', 'platform.audit.view', 'Read the audit log'),
  ('platform', 'platform.settings.manage', 'Change platform settings'),
  ('platform', 'platform.admins.manage', 'Grant or revoke platform admin roles');

-- Role → permission grants.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  -- household
  ('household', 'owner', 'household.view'), ('household', 'owner', 'household.update'),
  ('household', 'owner', 'household.delete'), ('household', 'owner', 'household.members.view'),
  ('household', 'owner', 'household.members.manage'), ('household', 'owner', 'household.owners.manage'),
  ('household', 'owner', 'household.invitations.manage'), ('household', 'owner', 'property.view'),
  ('household', 'owner', 'property.manage'),
  ('household', 'manager', 'household.view'), ('household', 'manager', 'household.update'),
  ('household', 'manager', 'household.members.view'), ('household', 'manager', 'household.members.manage'),
  ('household', 'manager', 'household.invitations.manage'), ('household', 'manager', 'property.view'),
  ('household', 'manager', 'property.manage'),
  ('household', 'member', 'household.view'), ('household', 'member', 'household.members.view'),
  ('household', 'member', 'property.view'),
  ('household', 'limited', 'household.view'), ('household', 'limited', 'property.view'),
  ('household', 'guest', 'household.view'),
  -- organization
  ('organization', 'owner', 'organization.view'), ('organization', 'owner', 'organization.update'),
  ('organization', 'owner', 'organization.delete'), ('organization', 'owner', 'organization.members.view'),
  ('organization', 'owner', 'organization.members.manage'), ('organization', 'owner', 'organization.owners.manage'),
  ('organization', 'owner', 'organization.invitations.manage'),
  ('organization', 'manager', 'organization.view'), ('organization', 'manager', 'organization.update'),
  ('organization', 'manager', 'organization.members.view'), ('organization', 'manager', 'organization.members.manage'),
  ('organization', 'manager', 'organization.invitations.manage'),
  ('organization', 'staff', 'organization.view'), ('organization', 'staff', 'organization.members.view'),
  ('organization', 'worker', 'organization.view'),
  -- platform
  ('platform', 'super_admin', 'platform.access'), ('platform', 'super_admin', 'platform.users.view'),
  ('platform', 'super_admin', 'platform.organizations.manage'), ('platform', 'super_admin', 'platform.verifications.decide'),
  ('platform', 'super_admin', 'platform.audit.view'), ('platform', 'super_admin', 'platform.settings.manage'),
  ('platform', 'super_admin', 'platform.admins.manage'),
  ('platform', 'operations', 'platform.access'), ('platform', 'operations', 'platform.users.view'),
  ('platform', 'operations', 'platform.organizations.manage'), ('platform', 'operations', 'platform.verifications.decide'),
  ('platform', 'operations', 'platform.audit.view'),
  ('platform', 'support', 'platform.access'), ('platform', 'support', 'platform.users.view')
);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Reference data is readable by signed-in users (role pickers, permission-aware UI). No write policies:
-- changes ship as migrations.
create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  locale text not null default 'en-PH' check (locale in ('en-PH', 'fil-PH')),
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Platform admins — granted server-side only (no insert/update/delete policies).
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id uuid not null,
  role_scope text not null default 'platform' check (role_scope = 'platform'),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (role_id, role_scope) references public.roles (id, scope)
);
create index platform_admins_role_idx on public.platform_admins (role_id);
create trigger platform_admins_updated_at before update on public.platform_admins
  for each row execute function private.set_updated_at();
alter table public.platform_admins enable row level security;

-- -----------------------------------------------------------------------------
-- Permission helpers (SECURITY DEFINER so policies can read membership tables
-- without recursive RLS; search_path pinned; not exposed through the API).
-- -----------------------------------------------------------------------------
create or replace function private.role_has_permission(p_role_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = p_role_id and p.key = p_permission
  );
$$;

create or replace function private.platform_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select role_id from public.platform_admins where user_id = (select auth.uid());
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function private.has_platform_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.role_has_permission(private.platform_role_id(), p_permission), false);
$$;

create policy platform_admins_read on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_platform_permission('platform.users.view')));

-- Profiles: own row, plus people you share a household or organization with (so member lists can show names).
-- (private.shares_tenant_with is defined in the tenancy migration.)
alter table public.profiles enable row level security;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

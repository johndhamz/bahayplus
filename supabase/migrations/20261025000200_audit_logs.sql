-- =============================================================================
-- Phase 2 · Audit trail
-- Append-only. Rows are written by SECURITY DEFINER functions and triggers only;
-- nobody (including service_role through the API) may update or delete them.
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  -- No FK: the log must survive account deletion without being rewritten.
  actor_id uuid,
  -- 'user' when performed by a signed-in user, 'system' for service-role / job / migration changes.
  actor_type text not null check (actor_type in ('user', 'system')),
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text not null,
  target_id uuid,
  household_id uuid,
  organization_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_logs_household_idx on public.audit_logs (household_id, occurred_at desc) where household_id is not null;
create index audit_logs_organization_idx on public.audit_logs (organization_id, occurred_at desc) where organization_id is not null;
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);

alter table public.audit_logs enable row level security;

create policy audit_logs_platform_read on public.audit_logs for select to authenticated
  using ((select private.has_platform_permission('platform.audit.view')));

revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated, service_role;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end;
$$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_mutation();

create or replace function private.write_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_household_id uuid default null,
  p_organization_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.audit_logs (actor_id, actor_type, action, target_type, target_id, household_id, organization_id, metadata)
  values (v_actor, case when v_actor is null then 'system' else 'user' end, p_action, p_target_type, p_target_id,
          p_household_id, p_organization_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
revoke all on function private.write_audit(text, text, uuid, uuid, uuid, jsonb) from public;

-- Platform admin grants/revocations are always audited, whoever performs them.
create or replace function private.audit_platform_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('platform.admin_granted', 'user', new.user_id, null, null,
      jsonb_build_object('role', (select key from public.roles where id = new.role_id)));
  elsif tg_op = 'UPDATE' then
    perform private.write_audit('platform.admin_role_changed', 'user', new.user_id, null, null,
      jsonb_build_object('from', (select key from public.roles where id = old.role_id),
                         'to', (select key from public.roles where id = new.role_id)));
  else
    perform private.write_audit('platform.admin_revoked', 'user', old.user_id, null, null,
      jsonb_build_object('role', (select key from public.roles where id = old.role_id)));
  end if;
  return coalesce(new, old);
end;
$$;
create trigger platform_admins_audit after insert or update or delete on public.platform_admins
  for each row execute function private.audit_platform_admins();

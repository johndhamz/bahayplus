-- =============================================================================
-- Phase 8: unified calendar, notification delivery, reminder engine, urgent discovery.
--
-- Durable jobs use pgmq (Postgres message queue): a message stays in the queue until it is
-- archived, and reappears after its visibility timeout if a worker crashes, so delivery survives
-- restarts and is retried with backoff. pg_cron only *wakes* the workers; it is not the queue.
--   reminders            → processed inside Postgres (fan-out to in-app notifications)
--   notification_email   → processed by the app (/api/internal/jobs/deliver) via an email adapter
--   notification_sms / notification_push → interfaces only; no provider is configured
-- =============================================================================

create extension if not exists pgmq;

select pgmq.create('reminders');
select pgmq.create('notification_email');
select pgmq.create('notification_sms');
select pgmq.create('notification_push');

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('household', 'calendar.assign', 'Assign calendar items to household members');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('household', 'owner', 'calendar.assign'),
  ('household', 'manager', 'calendar.assign'),
  ('household', 'member', 'calendar.assign')
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.user_has_household_permission(p_user uuid, p_household uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.household_role_of(p_household, p_user) hr where private.role_has_permission(hr.role_id, p_permission));
$$;

create or replace function private.user_has_organization_permission(p_user uuid, p_org uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.organization_role_of(p_org, p_user) r where private.role_has_permission(r.role_id, p_permission));
$$;

-- A Manila wall-clock time on a Manila calendar date, as an absolute instant.
create or replace function private.manila_at(p_date date, p_hour integer default 8)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date + make_time(p_hour, 0, 0)) at time zone 'Asia/Manila';
$$;

-- -----------------------------------------------------------------------------
-- Notifications: categories, tenant scope, access re-check, inbox visibility
-- -----------------------------------------------------------------------------
create or replace function private.notification_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case split_part(p_kind, '.', 1)
    when 'bill' then 'bills'
    when 'asset' then 'assets'
    when 'pet' then 'pets'
    when 'vehicle' then 'vehicles'
    when 'booking' then 'bookings'
    when 'quotation' then 'bookings'
    when 'service_request' then 'bookings'
    when 'work_order' then 'bookings'
    when 'project' then 'projects'
    when 'change_order' then 'projects'
    else 'account' end;
$$;

alter table public.notifications
  add column organization_id uuid references public.organizations (id) on delete cascade,
  add column category text not null default 'account'
    check (category in ('bills', 'assets', 'pets', 'vehicles', 'bookings', 'projects', 'account')),
  -- Permission the recipient must still hold when a delivery is attempted (revoked access ⇒ skipped).
  add column required_permission text references public.permissions (key),
  -- False when the user turned off in-app notifications for this category.
  add column show_in_inbox boolean not null default true,
  add column reminder_id uuid;
update public.notifications set category = private.notification_category(kind), required_permission = 'bills.view' where kind = 'bill.reminder';
create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc) where show_in_inbox;

-- -----------------------------------------------------------------------------
-- Preferences (absence of a row = default: in-app and email on, SMS and push off)
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('bills', 'assets', 'pets', 'vehicles', 'bookings', 'projects', 'account')),
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel)
);
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function private.set_updated_at();

-- Which external channels have a configured delivery provider. SMS/push stay false until one is integrated.
create table private.channel_settings (
  channel text primary key check (channel in ('email', 'sms', 'push')),
  enabled boolean not null default false,
  note text not null default ''
);
insert into private.channel_settings (channel, enabled, note) values
  ('email', true, 'Delivered by the app worker; skipped with channel_not_configured when no email adapter is set'),
  ('sms', false, 'No SMS provider integrated'),
  ('push', false, 'No push provider integrated');

create or replace function private.preference_enabled(p_user uuid, p_category text, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select enabled from public.notification_preferences where user_id = p_user and category = p_category and channel = p_channel),
    p_channel in ('in_app', 'email'));
$$;

-- -----------------------------------------------------------------------------
-- Delivery records and attempt log
-- -----------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push')),
  status text not null check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  skip_reason text check (skip_reason in ('preference_disabled', 'channel_not_configured', 'access_revoked', 'no_address')),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz,
  last_error text,
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One delivery per notification and channel: retries reuse the row, never duplicate it.
  unique (notification_id, channel),
  check ((status = 'skipped') = (skip_reason is not null))
);
create index notification_deliveries_recipient_idx on public.notification_deliveries (recipient_id, created_at desc);
create index notification_deliveries_pending_idx on public.notification_deliveries (channel, status) where status in ('queued', 'sending');
create trigger notification_deliveries_updated_at before update on public.notification_deliveries for each row execute function private.set_updated_at();

create table private.notification_delivery_attempts (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.notification_deliveries (id) on delete cascade,
  attempt integer not null,
  outcome text not null check (outcome in ('sent', 'failed', 'skipped', 'cancelled')),
  error text,
  created_at timestamptz not null default now()
);
create index notification_delivery_attempts_delivery_idx on private.notification_delivery_attempts (delivery_id);

-- Failures of background jobs (reminder processing etc.) for operators.
create table private.job_failures (
  id bigint generated always as identity primary key,
  job_name text not null,
  ref text,
  error text not null,
  created_at timestamptz not null default now()
);

-- Creates one notification (exactly once per recipient + dedupe key) and its per-channel deliveries,
-- honouring the recipient's preferences. Returns null for duplicates.
create or replace function private.create_notification(
  p_recipient uuid, p_household uuid, p_org uuid, p_kind text, p_title text, p_body text, p_link text,
  p_dedupe text, p_permission text default null, p_reminder uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text := private.notification_category(p_kind);
  v_in_app boolean := private.preference_enabled(p_recipient, v_category, 'in_app');
  v_id uuid;
  v_delivery uuid;
  v_channel text;
  v_channel_enabled boolean;
begin
  insert into public.notifications (recipient_id, household_id, organization_id, kind, category, title, body, link, dedupe_key,
                                    required_permission, show_in_inbox, reminder_id)
  values (p_recipient, p_household, p_org, p_kind, v_category, left(p_title, 200), left(coalesce(p_body, ''), 1000), p_link, p_dedupe,
          p_permission, v_in_app, p_reminder)
  on conflict (recipient_id, dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;

  insert into public.notification_deliveries (notification_id, recipient_id, channel, status, skip_reason, sent_at, attempts)
  values (v_id, p_recipient, 'in_app', case when v_in_app then 'sent' else 'skipped' end,
          case when v_in_app then null else 'preference_disabled' end, case when v_in_app then now() end, case when v_in_app then 1 else 0 end);

  foreach v_channel in array array['email', 'sms', 'push'] loop
    if private.preference_enabled(p_recipient, v_category, v_channel) then
      select enabled into v_channel_enabled from private.channel_settings where channel = v_channel;
      if coalesce(v_channel_enabled, false) then
        insert into public.notification_deliveries (notification_id, recipient_id, channel, status, next_attempt_at)
        values (v_id, p_recipient, v_channel, 'queued', now())
        returning id into v_delivery;
        perform pgmq.send('notification_' || v_channel, jsonb_build_object('delivery_id', v_delivery));
      else
        insert into public.notification_deliveries (notification_id, recipient_id, channel, status, skip_reason)
        values (v_id, p_recipient, v_channel, 'skipped', 'channel_not_configured');
      end if;
    end if;
  end loop;
  return v_id;
end;
$$;

-- Fan-out to the current members of a household holding a permission (removed members get nothing).
create or replace function private.notify_household(
  p_household uuid, p_permission text, p_kind text, p_title text, p_body text, p_link text, p_dedupe text,
  p_reminder uuid default null, p_exclude uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_count integer := 0;
begin
  for v_user in
    select m.user_id from public.household_members m
    join public.households h on h.id = m.household_id
    where m.household_id = p_household and m.status = 'active' and h.archived_at is null
      and private.role_has_permission(m.role_id, p_permission)
      and (p_exclude is null or m.user_id <> p_exclude)
  loop
    if private.create_notification(v_user, p_household, null, p_kind, p_title, p_body, p_link, p_dedupe, p_permission, p_reminder) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function private.notify_organization(
  p_org uuid, p_permission text, p_kind text, p_title text, p_body text, p_link text, p_dedupe text, p_exclude uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_count integer := 0;
begin
  for v_user in
    select m.user_id from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org and m.status = 'active' and o.status = 'active'
      and private.role_has_permission(m.role_id, p_permission)
      and (p_exclude is null or m.user_id <> p_exclude)
  loop
    if private.create_notification(v_user, null, p_org, p_kind, p_title, p_body, p_link, p_dedupe, p_permission) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function private.notification_still_allowed(p_notification uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when n.required_permission is null then true
    when n.household_id is not null then private.user_has_household_permission(n.recipient_id, n.household_id, n.required_permission)
    when n.organization_id is not null then private.user_has_organization_permission(n.recipient_id, n.organization_id, n.required_permission)
    else true end
  from public.notifications n where n.id = p_notification;
$$;

-- -----------------------------------------------------------------------------
-- External delivery worker API (service role only; called by /api/internal/jobs/deliver)
-- -----------------------------------------------------------------------------
create or replace function public.claim_notification_deliveries(p_channel text, p_batch integer default 20, p_visibility_seconds integer default 120)
returns table (delivery_id uuid, msg_id bigint, attempt integer, email text, title text, body text, link text, kind text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg record;
  v_d public.notification_deliveries%rowtype;
  v_n public.notifications%rowtype;
  v_email text;
  v_queue text := 'notification_' || p_channel;
  v_read integer;
  v_returned integer := 0;
  v_rounds integer := 0;
  v_batch integer := least(greatest(p_batch, 1), 100);
begin
  if p_channel not in ('email', 'sms', 'push') then
    perform private.raise_app_error('invalid_input', 'Unknown channel.');
  end if;
  -- Keep reading until a full batch is claimable: stale messages (deleted, already sent, deferred)
  -- are archived or hidden as we go and must not starve fresh ones behind them.
  loop
  v_read := 0;
  v_rounds := v_rounds + 1;
  for v_msg in select * from pgmq.read(v_queue, greatest(p_visibility_seconds, 30), v_batch - v_returned) loop
    v_read := v_read + 1;
    select * into v_d from public.notification_deliveries where id = (v_msg.message ->> 'delivery_id')::uuid for update skip locked;
    if not found then
      -- Deleted (cascade) or being handled by another worker; drop unknown ids, leave locked ones.
      if not exists (select 1 from public.notification_deliveries where id = (v_msg.message ->> 'delivery_id')::uuid) then
        perform pgmq.archive(v_queue, v_msg.msg_id);
      end if;
      continue;
    end if;
    if v_d.status not in ('queued', 'sending') then
      -- Already sent, cancelled or given up: idempotent no-op.
      perform pgmq.archive(v_queue, v_msg.msg_id);
      continue;
    end if;
    if v_d.next_attempt_at is not null and v_d.next_attempt_at > now() and v_d.status = 'queued' then
      perform pgmq.set_vt(v_queue, v_msg.msg_id, greatest(1, extract(epoch from v_d.next_attempt_at - now())::integer));
      continue;
    end if;
    if not coalesce(private.notification_still_allowed(v_d.notification_id), false) then
      update public.notification_deliveries set status = 'skipped', skip_reason = 'access_revoked' where id = v_d.id;
      insert into private.notification_delivery_attempts (delivery_id, attempt, outcome, error) values (v_d.id, v_d.attempts, 'skipped', 'access_revoked');
      perform pgmq.archive(v_queue, v_msg.msg_id);
      continue;
    end if;
    -- Poison-message guard: a worker that keeps crashing mid-send must not retry forever.
    if v_d.attempts >= v_d.max_attempts then
      update public.notification_deliveries set status = 'failed', last_error = coalesce(last_error, 'max attempts reached') where id = v_d.id;
      insert into private.notification_delivery_attempts (delivery_id, attempt, outcome, error) values (v_d.id, v_d.attempts, 'failed', 'max attempts reached');
      perform pgmq.archive(v_queue, v_msg.msg_id);
      continue;
    end if;
    select * into v_n from public.notifications where id = v_d.notification_id;
    select u.email into v_email from auth.users u where u.id = v_d.recipient_id;
    if p_channel = 'email' and coalesce(v_email, '') = '' then
      update public.notification_deliveries set status = 'skipped', skip_reason = 'no_address' where id = v_d.id;
      perform pgmq.archive(v_queue, v_msg.msg_id);
      continue;
    end if;
    update public.notification_deliveries set status = 'sending', attempts = attempts + 1 where id = v_d.id;
    delivery_id := v_d.id; msg_id := v_msg.msg_id; attempt := v_d.attempts + 1; email := v_email;
    title := v_n.title; body := v_n.body; link := v_n.link; kind := v_n.kind;
    v_returned := v_returned + 1;
    return next;
  end loop;
  exit when v_read = 0 or v_returned >= v_batch or v_rounds >= 50;
  end loop;
end;
$$;

create or replace function public.complete_notification_delivery(p_delivery uuid, p_msg_id bigint, p_provider text, p_provider_message_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.notification_deliveries%rowtype;
begin
  update public.notification_deliveries
  set status = 'sent', sent_at = now(), provider = p_provider, provider_message_id = p_provider_message_id, last_error = null, next_attempt_at = null
  where id = p_delivery and status = 'sending'
  returning * into v_d;
  if found then
    insert into private.notification_delivery_attempts (delivery_id, attempt, outcome) values (p_delivery, v_d.attempts, 'sent');
    perform pgmq.archive('notification_' || v_d.channel, p_msg_id);
  end if;
end;
$$;

-- Records a failed attempt. Retryable failures back off exponentially (30s, 60s, 120s, … capped at 1h)
-- by delaying the queue message; the delivery fails permanently after max_attempts.
create or replace function public.fail_notification_delivery(p_delivery uuid, p_msg_id bigint, p_error text, p_retryable boolean default true)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.notification_deliveries%rowtype;
  v_delay integer;
begin
  select * into v_d from public.notification_deliveries where id = p_delivery for update;
  if not found or v_d.status <> 'sending' then
    return 'ignored';
  end if;
  insert into private.notification_delivery_attempts (delivery_id, attempt, outcome, error) values (p_delivery, v_d.attempts, 'failed', left(p_error, 1000));
  if not p_retryable or v_d.attempts >= v_d.max_attempts then
    update public.notification_deliveries set status = 'failed', last_error = left(p_error, 1000), next_attempt_at = null where id = p_delivery;
    perform pgmq.archive('notification_' || v_d.channel, p_msg_id);
    return 'failed';
  end if;
  v_delay := least(3600, 30 * power(2, greatest(v_d.attempts - 1, 0))::integer);
  update public.notification_deliveries
  set status = 'queued', last_error = left(p_error, 1000), next_attempt_at = now() + make_interval(secs => v_delay)
  where id = p_delivery;
  perform pgmq.set_vt('notification_' || v_d.channel, p_msg_id, v_delay);
  return 'retry';
end;
$$;

-- The app has no adapter for this channel (e.g. no email provider configured): record it honestly.
create or replace function public.skip_notification_delivery(p_delivery uuid, p_msg_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.notification_deliveries%rowtype;
begin
  update public.notification_deliveries set status = 'skipped', skip_reason = p_reason, next_attempt_at = null
  where id = p_delivery and status = 'sending'
  returning * into v_d;
  if found then
    insert into private.notification_delivery_attempts (delivery_id, attempt, outcome, error) values (p_delivery, v_d.attempts, 'skipped', p_reason);
    perform pgmq.archive('notification_' || v_d.channel, p_msg_id);
  end if;
end;
$$;

revoke all on function public.claim_notification_deliveries(text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.fail_notification_delivery(uuid, bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(text, integer, integer) to service_role;
grant execute on function public.complete_notification_delivery(uuid, bigint, text, text) to service_role;
grant execute on function public.fail_notification_delivery(uuid, bigint, text, boolean) to service_role;
revoke all on function public.skip_notification_delivery(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.skip_notification_delivery(uuid, bigint, text) to service_role;

-- -----------------------------------------------------------------------------
-- Reminder engine
-- -----------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source_type text not null check (source_type ~ '^[a-z_]{3,40}$'),
  source_id uuid not null,
  category text not null check (category in ('bills', 'assets', 'pets', 'vehicles', 'bookings', 'projects', 'account')),
  audience_permission text not null references public.permissions (key),
  kind text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  link text check (link is null or link ~ '^/'),
  -- The date or instant being reminded about (for change detection).
  due_on date,
  due_at timestamptz,
  remind_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'queued', 'sent', 'cancelled', 'failed')),
  cancel_reason text check (cancel_reason in ('user', 'source_changed', 'booking_cancelled', 'not_needed', 'source_removed')),
  attempts integer not null default 0,
  last_error text,
  recipients integer,
  processed_at timestamptz,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, dedupe_key),
  check ((status = 'cancelled') = (cancel_reason is not null))
);
create index reminders_due_idx on public.reminders (remind_at) where status = 'scheduled';
create index reminders_source_idx on public.reminders (source_type, source_id);
create trigger reminders_updated_at before update on public.reminders for each row execute function private.set_updated_at();
alter table public.notifications add constraint notifications_reminder_fk foreign key (reminder_id) references public.reminders (id) on delete set null;

-- Schedules (or refreshes) a reminder. Reminders whose time passed more than a day ago are not created.
create or replace function private.schedule_reminder(
  p_household uuid, p_source_type text, p_source_id uuid, p_category text, p_permission text, p_kind text,
  p_title text, p_body text, p_link text, p_remind_at timestamptz, p_dedupe text, p_due_on date default null, p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_remind_at < now() - interval '1 day' then
    return null;
  end if;
  insert into public.reminders (household_id, source_type, source_id, category, audience_permission, kind, title, body, link,
                                remind_at, dedupe_key, due_on, due_at)
  values (p_household, p_source_type, p_source_id, p_category, p_permission, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 1000), p_link,
          p_remind_at, p_dedupe, p_due_on, p_due_at)
  on conflict (household_id, dedupe_key) do update
    set title = excluded.title, body = excluded.body, link = excluded.link
    where public.reminders.status = 'scheduled'
  returning id into v_id;
  return v_id;
end;
$$;

-- Cancels pending reminders for a source, plus any email/SMS/push deliveries not yet sent for that
-- source's reminders (including ones already fanned out — no "upcoming visit" email after a cancellation).
create or replace function private.cancel_reminders(p_source_type text, p_source_id uuid, p_reason text, p_keep_dedupe text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.reminders set status = 'cancelled', cancel_reason = p_reason, processed_at = now()
  where source_type = p_source_type and source_id = p_source_id and status in ('scheduled', 'queued')
    and (p_keep_dedupe is null or dedupe_key <> p_keep_dedupe);
  get diagnostics v_count = row_count;
  update public.notification_deliveries d set status = 'cancelled', next_attempt_at = null
  from public.notifications n
  join public.reminders r on r.id = n.reminder_id
  where d.notification_id = n.id and d.status = 'queued'
    and r.source_type = p_source_type and r.source_id = p_source_id
    and (p_keep_dedupe is null or r.dedupe_key <> p_keep_dedupe);
  return v_count;
end;
$$;

-- Moves due reminders onto the durable queue.
create or replace function private.enqueue_due_reminders(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.reminders where status = 'scheduled' and remind_at <= p_now
    order by remind_at limit 1000 for update skip locked
  loop
    update public.reminders set status = 'queued' where id = v_id;
    perform pgmq.send('reminders', jsonb_build_object('reminder_id', v_id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Delivers one queued reminder: fan-out to the household's *current* members with the audience
-- permission. Notification dedupe keys make a redelivered message a no-op.
create or replace function private.deliver_reminder(p_reminder uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reminders%rowtype;
  v_count integer;
begin
  select * into v_r from public.reminders where id = p_reminder for update;
  if not found or v_r.status <> 'queued' then
    return 0;
  end if;
  v_count := private.notify_household(v_r.household_id, v_r.audience_permission, v_r.kind, v_r.title, v_r.body, v_r.link,
                                      'reminder:' || v_r.id, v_r.id);
  update public.reminders set status = 'sent', processed_at = now(), recipients = v_count, attempts = attempts + 1, last_error = null
  where id = p_reminder;
  return v_count;
end;
$$;

create or replace function private.process_reminder_queue(p_batch integer default 100, p_max_reads integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg record;
  v_id uuid;
  v_sent integer := 0;
  v_failed integer := 0;
  v_retry integer := 0;
begin
  for v_msg in select * from pgmq.read('reminders', 60, p_batch) loop
    v_id := (v_msg.message ->> 'reminder_id')::uuid;
    begin
      perform private.deliver_reminder(v_id);
      perform pgmq.archive('reminders', v_msg.msg_id);
      v_sent := v_sent + 1;
    exception when others then
      -- The subtransaction rolled back; the message reappears after its visibility timeout.
      insert into private.job_failures (job_name, ref, error) values ('reminders', v_id::text, sqlerrm);
      update public.reminders set attempts = attempts + 1, last_error = left(sqlerrm, 1000) where id = v_id;
      if v_msg.read_ct >= p_max_reads then
        update public.reminders set status = 'failed', processed_at = now() where id = v_id and status = 'queued';
        perform pgmq.archive('reminders', v_msg.msg_id);
        v_failed := v_failed + 1;
      else
        v_retry := v_retry + 1;
      end if;
    end;
  end loop;
  return jsonb_build_object('delivered', v_sent, 'retrying', v_retry, 'failed', v_failed);
end;
$$;

create or replace function private.run_reminder_worker()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enqueued integer := private.enqueue_due_reminders();
begin
  return private.process_reminder_queue() || jsonb_build_object('enqueued', v_enqueued);
end;
$$;

create or replace function public.run_reminder_worker()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.run_reminder_worker();
$$;
revoke all on function public.run_reminder_worker() from public, anon, authenticated;
grant execute on function public.run_reminder_worker() to service_role;

-- --- Sources ------------------------------------------------------------------

-- Registry items (assets, pets, vehicles): reminders 7 days before and on the due date, 08:00 Manila.
create or replace function private.sync_registry_reminders(p_today date default private.manila_today())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_offset integer;
  v_category text;
  v_permission text;
  v_count integer := 0;
  v_title text;
begin
  -- Reminders whose underlying date changed or disappeared (maintenance logged, archived) are cancelled.
  update public.reminders r set status = 'cancelled', cancel_reason = 'source_changed', processed_at = now()
  where r.status in ('scheduled', 'queued') and r.category in ('assets', 'pets', 'vehicles')
    and not exists (select 1 from public.registry_due_items d
                    where d.subject_id = r.source_id and d.due_kind = r.source_type and d.due_on = r.due_on);

  for v_item in
    select * from public.registry_due_items d
    where d.due_kind <> 'bill_due' and d.due_on between p_today and p_today + 7
  loop
    v_category := case v_item.subject_type when 'asset' then 'assets' when 'pet' then 'pets' else 'vehicles' end;
    v_permission := case v_item.subject_type when 'pet' then 'pet.health.view' else 'registry.view' end;
    foreach v_offset in array array[7, 0] loop
      continue when v_item.due_on - v_offset < p_today;
      v_title := v_item.subject_name || ': ' || replace(replace(v_item.due_kind, 'pet_', ''), '_', ' ')
                 || case when v_offset = 0 then ' today' else ' in 7 days' end;
      if private.schedule_reminder(
           v_item.household_id, v_item.due_kind, v_item.subject_id, v_category, v_permission,
           v_item.subject_type || '.reminder', v_title, 'Due ' || to_char(v_item.due_on, 'Mon DD, YYYY'),
           '/app/h/' || v_item.household_id || '/' || v_item.subject_type || 's/' || v_item.subject_id,
           private.manila_at(v_item.due_on - v_offset, 8),
           v_item.due_kind || ':' || v_item.subject_id || ':' || v_item.due_on || ':' || v_offset,
           v_item.due_on) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Bookings: one reminder 24 hours before a confirmed visit (or right away if booked closer than that).
create or replace function private.booking_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dedupe text;
begin
  if new.status = 'confirmed' and new.scheduled_start is not null and new.scheduled_start > now() + interval '1 hour' then
    v_dedupe := 'booking:' || new.id || ':' || extract(epoch from new.scheduled_start)::bigint;
    perform private.cancel_reminders('booking', new.id, 'source_changed', v_dedupe);
    perform private.schedule_reminder(
      new.household_id, 'booking', new.id, 'bookings', 'services.view', 'booking.reminder',
      'Upcoming service: ' || coalesce(nullif(new.title, ''), 'booking'),
      to_char(new.scheduled_start at time zone 'Asia/Manila', 'Dy Mon DD, HH12:MI AM') || ' (PHT)',
      '/app/h/' || new.household_id || '/bookings/' || new.id,
      greatest(new.scheduled_start - interval '24 hours', now()), v_dedupe, null, new.scheduled_start);
  else
    perform private.cancel_reminders('booking', new.id,
      case when new.status in ('cancelled', 'declined') then 'booking_cancelled' else 'not_needed' end);
  end if;
  return new;
end;
$$;
create trigger bookings_reminders after insert or update of status, scheduled_start on public.bookings
  for each row execute function private.booking_reminders();

-- Project milestones: reminder the day before the due date, 08:00 Manila.
create or replace function private.milestone_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
  v_dedupe text;
begin
  if tg_op = 'DELETE' then
    perform private.cancel_reminders('project_milestone', old.id, 'source_removed');
    return old;
  end if;
  select * into v_p from public.projects where id = new.project_id;
  if new.due_on is not null and new.status <> 'done' and v_p.status in ('quoted', 'active') then
    v_dedupe := 'milestone:' || new.id || ':' || new.due_on;
    perform private.cancel_reminders('project_milestone', new.id, 'source_changed', v_dedupe);
    perform private.schedule_reminder(
      v_p.household_id, 'project_milestone', new.id, 'projects', 'services.view', 'project.milestone',
      v_p.title || ': ' || new.title || ' due tomorrow', 'Due ' || to_char(new.due_on, 'Mon DD, YYYY'),
      '/app/h/' || v_p.household_id || '/projects/' || v_p.id,
      greatest(private.manila_at(new.due_on - 1, 8), least(now(), private.manila_at(new.due_on, 8))), v_dedupe, new.due_on);
  else
    perform private.cancel_reminders('project_milestone', new.id, 'not_needed');
  end if;
  return new;
end;
$$;
create trigger project_milestones_reminders after insert or update of due_on, status or delete on public.project_milestones
  for each row execute function private.milestone_reminders();

-- Bill reminders keep their per-bill schedule (Phase 5) and now go through the shared notification
-- pipeline, so preferences, email delivery and delivery records apply to them too.
create or replace function private.process_bill_reminders(p_today date default private.manila_today())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rem record;
  v_sent integer := 0;
  v_title text;
begin
  for v_rem in
    select r.id, r.bill_id, r.offset_days, b.household_id, b.due_on, b.status, a.provider_name, a.nickname
    from public.bill_reminders r
    join public.bills b on b.id = r.bill_id
    join public.bill_accounts a on a.id = b.bill_account_id
    where r.status = 'scheduled' and r.remind_on <= p_today
    order by r.remind_on
    for update of r skip locked
  loop
    if v_rem.status = 'paid' then
      update public.bill_reminders set status = 'cancelled', cancel_reason = 'paid', processed_at = now() where id = v_rem.id;
      continue;
    end if;
    v_title := coalesce(nullif(v_rem.nickname, ''), v_rem.provider_name) || case
      when v_rem.offset_days > 0 then ' is due in ' || v_rem.offset_days || ' day' || case when v_rem.offset_days = 1 then '' else 's' end
      when v_rem.offset_days = 0 then ' is due today'
      else ' is overdue' end;
    perform private.notify_household(v_rem.household_id, 'bills.view', 'bill.reminder', v_title,
      'Due ' || to_char(v_rem.due_on, 'Mon DD, YYYY'), '/app/h/' || v_rem.household_id || '/bills/' || v_rem.bill_id,
      'bill_reminder:' || v_rem.id);
    update public.bill_reminders set status = 'sent', processed_at = now() where id = v_rem.id;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

-- Daily: bills (Phase 5 job) then registry reminders, recorded in the job ledger.
create or replace function private.run_daily_reminder_sync(p_today date default private.manila_today())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into private.job_runs (job_name, run_key, status) values ('registry_reminders', p_today::text, 'running')
  on conflict (job_name, run_key) do update set attempts = private.job_runs.attempts + 1, status = 'running', started_at = now(), error = null
    where private.job_runs.status <> 'succeeded';
  if not found then
    return jsonb_build_object('skipped', true);
  end if;
  begin
    v_count := private.sync_registry_reminders(p_today);
    update private.job_runs set status = 'succeeded', stats = jsonb_build_object('scheduled', v_count), finished_at = now()
    where job_name = 'registry_reminders' and run_key = p_today::text;
    return jsonb_build_object('scheduled', v_count);
  exception when others then
    update private.job_runs set status = 'failed', error = sqlerrm, finished_at = now()
    where job_name = 'registry_reminders' and run_key = p_today::text;
    insert into private.job_failures (job_name, ref, error) values ('registry_reminders', p_today::text, sqlerrm);
    return jsonb_build_object('failed', true, 'error', sqlerrm);
  end;
end;
$$;

select cron.schedule('bahayplus-reminder-worker', '* * * * *', $$select private.run_reminder_worker()$$);
-- 00:15 Asia/Manila (16:15 UTC).
select cron.schedule('bahayplus-registry-reminders', '15 16 * * *', $$select private.run_daily_reminder_sync()$$);

-- -----------------------------------------------------------------------------
-- Transaction events → notifications (Phase 7 workflows)
-- -----------------------------------------------------------------------------
create or replace function private.notify_booking_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
  v_title text;
  v_hh_link text;
  v_org_link text;
  v_to_household boolean;
  v_kind text;
  v_msg text;
begin
  select * into v_b from public.bookings where id = new.booking_id;
  v_title := coalesce(nullif(v_b.title, ''), 'Service booking');
  v_hh_link := '/app/h/' || v_b.household_id || '/bookings/' || v_b.id;
  v_org_link := '/provider/o/' || v_b.organization_id || '/bookings/' || v_b.id;
  case new.kind
    when 'created' then v_to_household := false; v_kind := 'booking.requested';
      v_msg := case when new.to_status = 'confirmed' then 'New booking: ' else 'New booking request: ' end || v_title;
    when 'created_from_quotation' then v_to_household := false; v_kind := 'booking.requested'; v_msg := 'Quotation accepted: ' || v_title;
    when 'confirm' then v_to_household := true; v_kind := 'booking.confirmed'; v_msg := 'Booking confirmed: ' || v_title;
    when 'decline' then v_to_household := true; v_kind := 'booking.declined'; v_msg := 'Booking declined: ' || v_title;
    when 'complete' then v_to_household := true; v_kind := 'booking.completed'; v_msg := 'Job marked completed: ' || v_title || ' — please confirm';
    when 'cancel' then v_to_household := new.actor_side = 'provider'; v_kind := 'booking.cancelled'; v_msg := 'Booking cancelled: ' || v_title;
    when 'rescheduled' then v_to_household := new.actor_side = 'provider'; v_kind := 'booking.rescheduled'; v_msg := 'Booking rescheduled: ' || v_title;
    when 'completion_disputed' then v_to_household := false; v_kind := 'booking.disputed'; v_msg := 'Customer reported a problem: ' || v_title;
    else return new;
  end case;
  if v_to_household then
    perform private.notify_household(v_b.household_id, 'services.view', v_kind, v_msg, '', v_hh_link, 'booking_event:' || new.id, null, auth.uid());
  else
    perform private.notify_organization(v_b.organization_id, 'bookings.view', v_kind, v_msg, '', v_org_link, 'booking_event:' || new.id, auth.uid());
  end if;
  return new;
end;
$$;
create trigger booking_events_notify after insert on public.booking_events for each row execute function private.notify_booking_event();

create or replace function private.notify_quotation_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.service_requests%rowtype;
  v_org text;
  v_project uuid;
begin
  if new.status = 'sent' and old.status = 'draft' then
    select * into v_req from public.service_requests where id = new.service_request_id;
    select name into v_org from public.organizations where id = v_req.organization_id;
    select id into v_project from public.projects where service_request_id = v_req.id;
    perform private.notify_household(v_req.household_id, 'services.view', 'quotation.sent',
      'New quotation from ' || v_org, v_req.title,
      case when v_project is not null then '/app/h/' || v_req.household_id || '/projects/' || v_project
           else '/app/h/' || v_req.household_id || '/bookings/requests/' || v_req.id end,
      'quotation_sent:' || new.id, null, auth.uid());
  end if;
  return new;
end;
$$;
create trigger quotations_notify after update of status on public.quotations for each row execute function private.notify_quotation_sent();

create or replace function private.notify_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Project-linked requests are created by the provider; only customer requests notify.
  if new.idempotency_key not like 'project:%' then
    perform private.notify_organization(new.organization_id, 'bookings.view', 'service_request.created',
      'New quote request: ' || new.title, '', '/provider/o/' || new.organization_id || '/quotations/' || new.id,
      'service_request:' || new.id, auth.uid());
  end if;
  return new;
end;
$$;
create trigger service_requests_notify after insert on public.service_requests for each row execute function private.notify_service_request();

create or replace function private.notify_project_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_organization(new.organization_id, 'bookings.view', 'project.requested',
    'New project request: ' || new.title, '', '/provider/o/' || new.organization_id || '/projects/' || new.id,
    'project_request:' || new.id, auth.uid());
  return new;
end;
$$;
create trigger projects_notify after insert on public.projects for each row execute function private.notify_project_request();

create or replace function private.notify_change_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects%rowtype;
begin
  select * into v_p from public.projects where id = new.project_id;
  if tg_op = 'INSERT' and new.status = 'proposed' then
    perform private.notify_household(v_p.household_id, 'services.view', 'change_order.proposed',
      'Change order needs your approval: ' || new.title, v_p.title, '/app/h/' || v_p.household_id || '/projects/' || v_p.id,
      'change_order:' || new.id || ':proposed', null, auth.uid());
  elsif tg_op = 'UPDATE' and old.status = 'proposed' and new.status in ('approved', 'rejected') then
    perform private.notify_organization(v_p.organization_id, 'bookings.view', 'change_order.decided',
      'Change order ' || new.status || ': ' || new.title, v_p.title, '/provider/o/' || v_p.organization_id || '/projects/' || v_p.id,
      'change_order:' || new.id || ':' || new.status, auth.uid());
  end if;
  return new;
end;
$$;
create trigger change_orders_notify after insert or update of status on public.change_orders for each row execute function private.notify_change_order();

-- -----------------------------------------------------------------------------
-- Unified calendar
-- -----------------------------------------------------------------------------
create table public.calendar_assignments (
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null check (item_key ~ '^[a-z_]+:[0-9a-f-]{36}(:[0-9a-z_-]+)?$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, item_key)
);
create trigger calendar_assignments_updated_at before update on public.calendar_assignments for each row execute function private.set_updated_at();

create or replace function public.assign_calendar_item(p_household uuid, p_item_key text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_household_permission(p_household, 'calendar.assign') then
    perform private.raise_app_error('forbidden', 'You cannot assign calendar items in this household.');
  end if;
  if p_user is null then
    delete from public.calendar_assignments where household_id = p_household and item_key = p_item_key;
    return;
  end if;
  if not exists (select 1 from private.household_role_of(p_household, p_user)) then
    perform private.raise_app_error('invalid_input', 'Choose a current member of this household.');
  end if;
  insert into public.calendar_assignments (household_id, item_key, user_id) values (p_household, p_item_key, p_user)
  on conflict (household_id, item_key) do update set user_id = excluded.user_id, assigned_by = auth.uid();
end;
$$;

-- Every dated item across modules for the given households and Manila date range (inclusive).
-- SECURITY INVOKER: each source table's RLS decides what the caller can see.
create or replace function public.household_calendar(p_households uuid[], p_from date, p_to date)
returns table (
  item_key text, household_id uuid, category text, kind text, title text, starts_at timestamptz, ends_at timestamptz,
  all_day_on date, property_id uuid, assignee_id uuid, status text, link text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    -- Bills (utility due dates)
    select 'bill:' || b.id as item_key, b.household_id, 'bills' as category, 'bill_due' as kind,
           coalesce(nullif(a.nickname, ''), a.provider_name) || ' due' as title, null::timestamptz as starts_at, null::timestamptz as ends_at,
           b.due_on as all_day_on, a.property_id, null::uuid as default_assignee, b.status, '/bills/' || b.id as path
    from public.bills b join public.bill_accounts a on a.id = b.bill_account_id
    where b.household_id = any (p_households) and b.due_on between p_from and p_to
    union all
    -- Assets, pets and vehicles (maintenance, warranty, vaccinations, registration…)
    select d.due_kind || ':' || d.subject_id || ':' || d.due_on, d.household_id,
           case d.subject_type when 'asset' then 'assets' when 'pet' then 'pets' else 'vehicles' end,
           d.due_kind, d.subject_name || ' — ' || replace(replace(d.due_kind, 'pet_', ''), '_', ' '), null, null, d.due_on,
           case when d.subject_type = 'asset' then (select a.property_id from public.assets a where a.id = d.subject_id) end,
           null, 'due', '/' || d.subject_type || 's/' || d.subject_id
    from public.registry_due_items d
    where d.household_id = any (p_households) and d.due_kind <> 'bill_due' and d.due_on between p_from and p_to
    union all
    -- Service bookings (timed)
    select 'booking:' || b.id, b.household_id, 'bookings', 'booking', coalesce(nullif(b.title, ''), 'Service booking'),
           b.scheduled_start, b.scheduled_end, null, b.property_id, b.created_by, b.status, '/bookings/' || b.id
    from public.bookings b
    where b.household_id = any (p_households) and b.scheduled_start is not null
      and b.status in ('requested', 'confirmed', 'in_progress', 'completed')
      and (b.scheduled_start at time zone 'Asia/Manila')::date between p_from and p_to
    union all
    -- Renovation milestones and site visits
    select 'project_milestone:' || m.id, p.household_id, 'projects', 'project_milestone', p.title || ': ' || m.title,
           null, null, m.due_on, p.property_id, null, m.status, '/projects/' || p.id
    from public.project_milestones m join public.projects p on p.id = m.project_id
    where p.household_id = any (p_households) and m.due_on between p_from and p_to and p.status not in ('cancelled')
    union all
    select 'project_visit:' || p.id, p.household_id, 'projects', 'site_visit', 'Site visit: ' || p.title,
           p.site_visit_at, p.site_visit_at + interval '1 hour', null, p.property_id, p.created_by, p.status, '/projects/' || p.id
    from public.projects p
    where p.household_id = any (p_households) and p.site_visit_at is not null and p.status in ('requested', 'site_visit_scheduled')
      and (p.site_visit_at at time zone 'Asia/Manila')::date between p_from and p_to
  )
  select i.item_key, i.household_id, i.category, i.kind, i.title, i.starts_at, i.ends_at, i.all_day_on, i.property_id,
         coalesce(ca.user_id, i.default_assignee), i.status, '/app/h/' || i.household_id || i.path
  from items i
  left join public.calendar_assignments ca on ca.household_id = i.household_id and ca.item_key = i.item_key
  order by coalesce(i.all_day_on, (i.starts_at at time zone 'Asia/Manila')::date), i.starts_at nulls first, i.title;
$$;

-- -----------------------------------------------------------------------------
-- Urgent provider discovery
-- -----------------------------------------------------------------------------
alter table public.provider_profiles add column accepts_urgent boolean not null default false;
grant update (accepts_urgent) on public.provider_profiles to authenticated;

-- Listed providers that opted into urgent calls, serve the area and offer an urgent-eligible category.
-- No dispatch, no promised response time: this is discovery with honest freshness data.
create or replace function public.search_urgent_providers(
  p_category text, p_province text, p_city text default null, p_barangay text default null, p_stale_hours integer default 24
)
returns table (
  organization_id uuid, name text, slug text, tagline text, availability_status text, availability_updated_at timestamptz,
  is_stale boolean, phone text, messenger_url text, verified_items text[], service_titles text[], area_label text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.name, o.slug, pp.tagline, pp.availability_status, pp.availability_updated_at,
         pp.availability_updated_at is null or pp.availability_updated_at < now() - make_interval(hours => p_stale_hours),
         case when pp.accepts_contact then pp.phone else '' end,
         case when pp.accepts_contact then pp.messenger_url else '' end,
         (select array_agg(v.item_type order by v.item_type) from public.provider_verified_items(o.id) v),
         array_agg(distinct s.title order by s.title),
         (select coalesce(nullif(a.barangay, '') || ', ', '') || coalesce(nullif(a.city_municipality, '') || ', ', 'All of ') || a.province
          from public.service_areas a
          where a.organization_id = o.id
            and public.normalize_locality(a.province) = public.normalize_locality(p_province)
            and (a.city_municipality is null or a.city_municipality = '' or public.normalize_locality(p_city) is null
                 or public.normalize_locality(a.city_municipality) = public.normalize_locality(p_city))
          order by (a.barangay is not null and a.barangay <> '') desc, (a.city_municipality is not null and a.city_municipality <> '') desc
          limit 1)
  from public.organizations o
  join public.provider_profiles pp on pp.organization_id = o.id
  join public.provider_services s on s.organization_id = o.id and s.is_active
  join public.service_categories c on c.id = s.category_id
  where private.is_listed_provider(o.id)
    and pp.accepts_urgent
    and c.urgent_eligible and c.slug = p_category
    and public.provider_serves(o.id, p_province, p_city, p_barangay)
  group by o.id, o.name, o.slug, pp.tagline, pp.availability_status, pp.availability_updated_at, pp.accepts_contact, pp.phone, pp.messenger_url
  order by case pp.availability_status when 'available' then 0 when 'limited' then 1 else 2 end,
           (pp.availability_updated_at is null or pp.availability_updated_at < now() - make_interval(hours => p_stale_hours)),
           pp.availability_updated_at desc nulls last, o.name
  limit 30;
$$;

-- -----------------------------------------------------------------------------
-- RLS and grants
-- -----------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.reminders enable row level security;
alter table public.calendar_assignments enable row level security;

create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_deliveries_own on public.notification_deliveries for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy reminders_select on public.reminders for select to authenticated
  using ((select private.has_household_permission(household_id, audience_permission)));
create policy calendar_assignments_select on public.calendar_assignments for select to authenticated
  using ((select private.is_household_member(household_id)));

revoke insert, update, delete on public.notification_deliveries, public.reminders, public.calendar_assignments from authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

revoke all on function public.assign_calendar_item(uuid, text, uuid) from public, anon;
revoke all on function public.household_calendar(uuid[], date, date) from public, anon;
revoke all on function public.search_urgent_providers(text, text, text, text, integer) from public, anon;
grant execute on function public.assign_calendar_item(uuid, text, uuid) to authenticated;
grant execute on function public.household_calendar(uuid[], date, date) to authenticated;
grant execute on function public.search_urgent_providers(text, text, text, text, integer) to authenticated;

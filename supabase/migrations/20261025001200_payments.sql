-- =============================================================================
-- Phase 10: marketplace payment architecture (no stored value, no custody).
--
-- Bahay+ never holds funds: a licensed payment provider collects from the customer and pays out to the
-- provider business. This schema records intents, verified provider events, refunds, commission,
-- settlements and reconciliation. Rules that matter for money:
--   * amounts are integer centavos, PHP only, computed server-side (never trusted from the client);
--   * an intent reaches `succeeded` only through apply_payment_event(), callable by the service role
--     after the webhook signature was verified — never from a browser;
--   * provider event ids are unique per provider (replay/duplicate protection);
--   * external payment references are unique per provider;
--   * every money movement is an append-only payment_events row; refunds are capped under a row lock.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('organization', 'payments.refund', 'Issue refunds for payments received'),
  ('platform', 'platform.finance.manage', 'Settlements, reconciliation and commission rates');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('organization', 'owner', 'payments.refund'), ('organization', 'manager', 'payments.refund'),
  ('platform', 'super_admin', 'platform.finance.manage'), ('platform', 'operations', 'platform.finance.manage')
);

-- -----------------------------------------------------------------------------
-- Commission rates (basis points; organization-specific overrides the platform default)
-- -----------------------------------------------------------------------------
create table public.commission_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  rate_bps integer not null check (rate_bps between 0 and 5000),
  effective_from date not null default private.manila_today(),
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, effective_from)
);
create unique index commission_rates_default_day on public.commission_rates (effective_from) where organization_id is null;
insert into public.commission_rates (organization_id, rate_bps, effective_from, note) values (null, 1000, '2026-01-01', 'Launch default: 10%');

create or replace function private.commission_rate_bps(p_org uuid, p_on date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select rate_bps from public.commission_rates where organization_id = p_org and effective_from <= p_on order by effective_from desc limit 1),
    (select rate_bps from public.commission_rates where organization_id is null and effective_from <= p_on order by effective_from desc limit 1),
    0);
$$;

-- Exact integer commission: round half up of amount × bps / 10 000.
create or replace function private.commission_of(p_amount bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ((p_amount * p_bps + 5000) / 10000)::bigint;
$$;

-- -----------------------------------------------------------------------------
-- Payment intents
-- -----------------------------------------------------------------------------
create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  description text not null check (char_length(description) between 1 and 200),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'requires_payment'
    check (status in ('requires_payment', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  provider text not null check (provider ~ '^[a-z_]{3,30}$'),
  external_reference text,
  checkout_url text,
  amount_refunded_centavos bigint not null default 0 check (amount_refunded_centavos >= 0),
  commission_bps integer,
  commission_centavos bigint,
  failure_code text,
  failure_message text,
  succeeded_at timestamptz,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, idempotency_key),
  unique (provider, external_reference),
  check (amount_refunded_centavos <= amount_centavos),
  check ((status in ('succeeded', 'partially_refunded', 'refunded')) = (succeeded_at is not null))
);
create index payment_intents_org_idx on public.payment_intents (organization_id, created_at desc);
create index payment_intents_household_idx on public.payment_intents (household_id, created_at desc);
-- At most one live (unpaid or paid) intent per booking.
create unique index payment_intents_one_live_per_booking on public.payment_intents (booking_id)
  where booking_id is not null and status in ('requires_payment', 'processing', 'succeeded', 'partially_refunded', 'refunded');
create trigger payment_intents_updated_at before update on public.payment_intents for each row execute function private.set_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete restrict,
  amount_centavos bigint not null check (amount_centavos > 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  provider text not null,
  external_reference text,
  failure_message text,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_intent_id, idempotency_key),
  unique (provider, external_reference)
);
create trigger refunds_updated_at before update on public.refunds for each row execute function private.set_updated_at();

-- Immutable financial event history.
create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_intent_id uuid not null references public.payment_intents (id) on delete restrict,
  refund_id uuid references public.refunds (id) on delete restrict,
  event_type text not null check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  amount_centavos bigint,
  from_status text,
  to_status text,
  source text not null check (source in ('user', 'webhook', 'system', 'admin')),
  provider_event_id text,
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index payment_events_intent_idx on public.payment_events (payment_intent_id, id);
create trigger payment_events_immutable before update or delete on public.payment_events
  for each row execute function private.prevent_audit_mutation();

-- Verified provider webhooks: one row per provider event id (duplicates and replays are no-ops).
create table private.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signed_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (outcome in ('applied', 'ignored', 'rejected')),
  outcome_detail text,
  unique (provider, provider_event_id)
);

create or replace function private.log_payment_event(
  p_intent uuid, p_type text, p_amount bigint, p_from text, p_to text, p_source text,
  p_provider_event text default null, p_detail jsonb default '{}'::jsonb, p_refund uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payment_events (payment_intent_id, refund_id, event_type, amount_centavos, from_status, to_status, source, provider_event_id, detail, actor_id)
  values (p_intent, p_refund, p_type, p_amount, p_from, p_to, p_source, p_provider_event, coalesce(p_detail, '{}'::jsonb), auth.uid());
$$;

-- --- Customer: create an intent for a booking (amount comes from the agreed price) ---------------
create or replace function public.create_payment_intent(p_booking uuid, p_provider text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings%rowtype;
  v_id uuid;
begin
  select * into v_b from public.bookings where id = p_booking for update;
  if not found or not private.has_household_permission(v_b.household_id, 'services.book') then
    perform private.raise_app_error('not_found', 'Booking not found.');
  end if;
  select id into v_id from public.payment_intents where household_id = v_b.household_id and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;
  if v_b.status not in ('confirmed', 'in_progress', 'completed') then
    perform private.raise_app_error('invalid_transition', 'Only confirmed or completed bookings can be paid online.');
  end if;
  if coalesce(v_b.agreed_amount_centavos, 0) <= 0 then
    perform private.raise_app_error('invalid_input', 'This booking has no agreed price to pay online.');
  end if;
  -- Reuse an unpaid intent instead of creating parallel ones.
  select id into v_id from public.payment_intents where booking_id = p_booking and status in ('requires_payment', 'processing');
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from public.payment_intents where booking_id = p_booking and status in ('succeeded', 'partially_refunded', 'refunded')) then
    perform private.raise_app_error('already_paid', 'This booking is already paid.');
  end if;
  insert into public.payment_intents (household_id, organization_id, booking_id, description, amount_centavos, provider, idempotency_key)
  values (v_b.household_id, v_b.organization_id, p_booking, left(coalesce(nullif(v_b.title, ''), 'Service booking'), 200),
          v_b.agreed_amount_centavos, p_provider, p_idempotency_key)
  returning id into v_id;
  perform private.log_payment_event(v_id, 'intent.created', v_b.agreed_amount_centavos, null, 'requires_payment', 'user');
  return v_id;
end;
$$;

create or replace function public.cancel_payment_intent(p_intent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pi public.payment_intents%rowtype;
begin
  select * into v_pi from public.payment_intents where id = p_intent for update;
  if not found or not private.has_household_permission(v_pi.household_id, 'services.book') then
    perform private.raise_app_error('not_found', 'Payment not found.');
  end if;
  if v_pi.status <> 'requires_payment' then
    perform private.raise_app_error('invalid_transition', 'A payment that is processing or finished can''t be cancelled.');
  end if;
  update public.payment_intents set status = 'cancelled' where id = p_intent;
  perform private.log_payment_event(p_intent, 'intent.cancelled', null, 'requires_payment', 'cancelled', 'user');
end;
$$;

-- --- Server (service role): attach the provider's checkout reference -----------------------------
create or replace function public.attach_payment_reference(p_intent uuid, p_external_reference text, p_checkout_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pi public.payment_intents%rowtype;
begin
  select * into v_pi from public.payment_intents where id = p_intent for update;
  if not found then
    perform private.raise_app_error('not_found', 'Payment not found.');
  end if;
  if v_pi.external_reference is not null then
    if v_pi.external_reference = p_external_reference then
      return; -- idempotent
    end if;
    perform private.raise_app_error('conflict', 'This payment already has a provider reference.');
  end if;
  if v_pi.status <> 'requires_payment' then
    perform private.raise_app_error('invalid_transition', 'This payment can no longer start checkout.');
  end if;
  update public.payment_intents set external_reference = p_external_reference, checkout_url = p_checkout_url, status = 'processing'
  where id = p_intent;
  perform private.log_payment_event(p_intent, 'intent.processing', null, 'requires_payment', 'processing', 'system',
    null, jsonb_build_object('external_reference', p_external_reference));
end;
$$;

-- --- Server (service role): apply a VERIFIED provider event --------------------------------------
-- Returns 'applied', 'duplicate' or 'ignored:<reason>'. Rejections are recorded, never thrown, so the
-- provider gets a 2xx for events we have permanently decided about.
create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_event_type text, p_external_reference text, p_amount_centavos bigint,
  p_currency text, p_signed_at timestamptz, p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pi public.payment_intents%rowtype;
  v_r public.refunds%rowtype;
  v_outcome text;
  v_bps integer;
  v_new_status text;
begin
  insert into private.webhook_events (provider, provider_event_id, event_type, payload, signed_at)
  values (p_provider, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_signed_at)
  on conflict (provider, provider_event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_event_type in ('payment.succeeded', 'payment.failed') then
    select * into v_pi from public.payment_intents where provider = p_provider and external_reference = p_external_reference for update;
    if not found then
      v_outcome := 'ignored:unknown_reference';
    elsif p_currency <> 'PHP' then
      v_outcome := 'ignored:currency_mismatch';
    elsif p_event_type = 'payment.succeeded' and p_amount_centavos <> v_pi.amount_centavos then
      v_outcome := 'ignored:amount_mismatch';
      perform private.log_payment_event(v_pi.id, 'payment.amount_mismatch', p_amount_centavos, v_pi.status, v_pi.status, 'webhook', p_event_id,
        jsonb_build_object('expected', v_pi.amount_centavos));
    elsif v_pi.status in ('succeeded', 'partially_refunded', 'refunded') then
      -- Terminal success: a late "failed" (or a second success) never downgrades it.
      v_outcome := 'ignored:already_succeeded';
    elsif v_pi.status = 'cancelled' and p_event_type = 'payment.failed' then
      v_outcome := 'ignored:cancelled';
    elsif p_event_type = 'payment.succeeded' then
      v_bps := private.commission_rate_bps(v_pi.organization_id, private.manila_today());
      update public.payment_intents set status = 'succeeded', succeeded_at = coalesce(p_signed_at, now()), failure_code = null, failure_message = null,
        commission_bps = v_bps, commission_centavos = private.commission_of(v_pi.amount_centavos, v_bps)
      where id = v_pi.id;
      perform private.log_payment_event(v_pi.id, 'payment.succeeded', v_pi.amount_centavos, v_pi.status, 'succeeded', 'webhook', p_event_id,
        jsonb_build_object('commission_bps', v_bps));
      perform private.notify_organization(v_pi.organization_id, 'finance.view', 'booking.payment_received', 'Payment received: ' || v_pi.description, '',
        '/provider/o/' || v_pi.organization_id || '/payments', 'payment_succeeded:' || v_pi.id);
      v_outcome := 'applied';
    else
      update public.payment_intents set status = 'failed', failure_code = left(coalesce(p_payload ->> 'failure_code', 'declined'), 60),
        failure_message = left(coalesce(p_payload ->> 'failure_message', 'The payment was not completed.'), 300)
      where id = v_pi.id;
      perform private.log_payment_event(v_pi.id, 'payment.failed', v_pi.amount_centavos, v_pi.status, 'failed', 'webhook', p_event_id,
        jsonb_build_object('failure_code', p_payload ->> 'failure_code'));
      v_outcome := 'applied';
    end if;
  elsif p_event_type in ('refund.succeeded', 'refund.failed') then
    select * into v_r from public.refunds where provider = p_provider and external_reference = p_external_reference for update;
    if not found then
      v_outcome := 'ignored:unknown_reference';
    elsif v_r.status <> 'pending' then
      v_outcome := 'ignored:already_final';
    elsif p_event_type = 'refund.succeeded' and p_amount_centavos <> v_r.amount_centavos then
      v_outcome := 'ignored:amount_mismatch';
    else
      select * into v_pi from public.payment_intents where id = v_r.payment_intent_id for update;
      if p_event_type = 'refund.succeeded' then
        update public.refunds set status = 'succeeded' where id = v_r.id;
        v_new_status := case when v_pi.amount_refunded_centavos + v_r.amount_centavos >= v_pi.amount_centavos then 'refunded' else 'partially_refunded' end;
        update public.payment_intents set amount_refunded_centavos = amount_refunded_centavos + v_r.amount_centavos, status = v_new_status
        where id = v_pi.id;
        perform private.log_payment_event(v_pi.id, 'refund.succeeded', v_r.amount_centavos, v_pi.status, v_new_status, 'webhook', p_event_id, '{}', v_r.id);
        perform private.notify_household(v_pi.household_id, 'services.view', 'booking.refunded', 'Refund processed: ' || v_pi.description, '',
          '/app/h/' || v_pi.household_id || '/bookings/' || v_pi.booking_id, 'refund_succeeded:' || v_r.id);
      else
        update public.refunds set status = 'failed', failure_message = left(coalesce(p_payload ->> 'failure_message', 'Refund failed at the provider.'), 300)
        where id = v_r.id;
        perform private.log_payment_event(v_pi.id, 'refund.failed', v_r.amount_centavos, v_pi.status, v_pi.status, 'webhook', p_event_id, '{}', v_r.id);
      end if;
      v_outcome := 'applied';
    end if;
  else
    v_outcome := 'ignored:unsupported_event';
  end if;

  update private.webhook_events set processed_at = now(), outcome = case when v_outcome = 'applied' then 'applied' else 'ignored' end, outcome_detail = v_outcome
  where provider = p_provider and provider_event_id = p_event_id;
  return v_outcome;
end;
$$;

-- --- Refunds -------------------------------------------------------------------------------------
-- Pending + succeeded refunds can never exceed the captured amount (checked under the intent row lock).
create or replace function public.request_refund(p_intent uuid, p_amount bigint, p_reason text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pi public.payment_intents%rowtype;
  v_id uuid;
  v_committed bigint;
begin
  select * into v_pi from public.payment_intents where id = p_intent for update;
  if not found or not (private.has_organization_permission(v_pi.organization_id, 'payments.refund') or private.has_platform_permission('platform.finance.manage')) then
    perform private.raise_app_error('not_found', 'Payment not found.');
  end if;
  select id into v_id from public.refunds where payment_intent_id = p_intent and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;
  if v_pi.status not in ('succeeded', 'partially_refunded') then
    perform private.raise_app_error('invalid_transition', 'Only successful payments can be refunded.');
  end if;
  if p_amount is null or p_amount <= 0 then
    perform private.raise_app_error('invalid_input', 'Enter a refund amount.');
  end if;
  select coalesce(sum(amount_centavos), 0) into v_committed from public.refunds where payment_intent_id = p_intent and status in ('pending', 'succeeded');
  if v_committed + p_amount > v_pi.amount_centavos then
    perform private.raise_app_error('overrefund', 'Refunds can''t exceed the amount paid.');
  end if;
  insert into public.refunds (payment_intent_id, organization_id, household_id, amount_centavos, reason, provider, idempotency_key)
  values (p_intent, v_pi.organization_id, v_pi.household_id, p_amount, p_reason, v_pi.provider, p_idempotency_key)
  returning id into v_id;
  perform private.log_payment_event(p_intent, 'refund.requested', p_amount, v_pi.status, v_pi.status,
    case when private.has_organization_permission(v_pi.organization_id, 'payments.refund') then 'user' else 'admin' end, null,
    jsonb_build_object('reason', p_reason), v_id);
  perform private.write_audit('payment.refund_requested', 'refund', v_id, v_pi.household_id, v_pi.organization_id,
    jsonb_build_object('amount_centavos', p_amount, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.attach_refund_reference(p_refund uuid, p_external_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.refunds set external_reference = p_external_reference
  where id = p_refund and (external_reference is null or external_reference = p_external_reference);
  if not found then
    perform private.raise_app_error('conflict', 'This refund already has a different provider reference.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Settlements (what the provider business is owed; the payout itself is made by the licensed partner)
-- -----------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  period_end date not null,
  gross_centavos bigint not null,
  refunds_centavos bigint not null,
  commission_centavos bigint not null,
  net_centavos bigint not null,
  item_count integer not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid_out')),
  payout_reference text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_centavos = gross_centavos - refunds_centavos - commission_centavos)
);
create index settlements_org_idx on public.settlements (organization_id, period_end desc);
create trigger settlements_updated_at before update on public.settlements for each row execute function private.set_updated_at();

create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  kind text not null check (kind in ('payment', 'refund_adjustment')),
  payment_intent_id uuid not null references public.payment_intents (id) on delete restrict,
  refund_id uuid references public.refunds (id) on delete restrict,
  gross_centavos bigint not null,
  refunds_centavos bigint not null,
  commission_centavos bigint not null,
  net_centavos bigint not null,
  check (net_centavos = gross_centavos - refunds_centavos - commission_centavos),
  check ((kind = 'payment') = (refund_id is null))
);
-- A payment is settled once; each refund is accounted for once (either inside its payment's item or as an adjustment).
create unique index settlement_items_payment_once on public.settlement_items (payment_intent_id) where kind = 'payment';
create unique index settlement_items_refund_once on public.settlement_items (refund_id) where refund_id is not null;
create table private.settled_refunds (
  refund_id uuid primary key references public.refunds (id) on delete restrict,
  settlement_id uuid not null references public.settlements (id) on delete cascade
);

-- Commission is charged on the net (paid − refunded); a refund after settlement claws back its share of commission.
create or replace function public.create_settlement(p_org uuid, p_period_end date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pi record;
  v_r record;
  v_refunded bigint;
  v_comm bigint;
  v_count integer := 0;
begin
  if not private.has_platform_permission('platform.finance.manage') then
    perform private.raise_app_error('forbidden', 'You cannot create settlements.');
  end if;
  if p_period_end > private.manila_today() then
    perform private.raise_app_error('invalid_input', 'The settlement period can''t end in the future.');
  end if;
  perform 1 from public.organizations where id = p_org for update;
  insert into public.settlements (organization_id, period_end, gross_centavos, refunds_centavos, commission_centavos, net_centavos, item_count)
  values (p_org, p_period_end, 0, 0, 0, 0, 0) returning id into v_id;

  -- New payments captured in the period.
  for v_pi in
    select * from public.payment_intents pi
    where pi.organization_id = p_org and pi.status in ('succeeded', 'partially_refunded', 'refunded')
      and (pi.succeeded_at at time zone 'Asia/Manila')::date <= p_period_end
      and not exists (select 1 from public.settlement_items si where si.payment_intent_id = pi.id and si.kind = 'payment')
    for update of pi
  loop
    select coalesce(sum(amount_centavos), 0) into v_refunded from public.refunds where payment_intent_id = v_pi.id and status = 'succeeded';
    v_comm := private.commission_of(v_pi.amount_centavos - v_refunded, v_pi.commission_bps);
    insert into public.settlement_items (settlement_id, kind, payment_intent_id, gross_centavos, refunds_centavos, commission_centavos, net_centavos)
    values (v_id, 'payment', v_pi.id, v_pi.amount_centavos, v_refunded, v_comm, v_pi.amount_centavos - v_refunded - v_comm);
    insert into private.settled_refunds (refund_id, settlement_id)
    select r.id, v_id from public.refunds r where r.payment_intent_id = v_pi.id and r.status = 'succeeded';
    v_count := v_count + 1;
  end loop;

  -- Refunds that succeeded after their payment was already settled: negative adjustments.
  for v_r in
    select r.*, pi.commission_bps from public.refunds r join public.payment_intents pi on pi.id = r.payment_intent_id
    where r.organization_id = p_org and r.status = 'succeeded'
      and exists (select 1 from public.settlement_items si where si.payment_intent_id = r.payment_intent_id and si.kind = 'payment')
      and not exists (select 1 from private.settled_refunds sr where sr.refund_id = r.id)
  loop
    -- Commission previously charged on this refunded amount is returned.
    v_comm := -private.commission_of(v_r.amount_centavos, v_r.commission_bps);
    insert into public.settlement_items (settlement_id, kind, payment_intent_id, refund_id, gross_centavos, refunds_centavos, commission_centavos, net_centavos)
    values (v_id, 'refund_adjustment', v_r.payment_intent_id, v_r.id, 0, v_r.amount_centavos, v_comm, -v_r.amount_centavos - v_comm);
    insert into private.settled_refunds (refund_id, settlement_id) values (v_r.id, v_id);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    perform private.raise_app_error('invalid_input', 'Nothing to settle for this period.');
  end if;
  update public.settlements s set
    gross_centavos = t.g, refunds_centavos = t.r, commission_centavos = t.c, net_centavos = t.n, item_count = t.k
  from (select coalesce(sum(gross_centavos), 0) g, coalesce(sum(refunds_centavos), 0) r, coalesce(sum(commission_centavos), 0) c,
               coalesce(sum(net_centavos), 0) n, count(*)::integer k
        from public.settlement_items where settlement_id = v_id) t
  where s.id = v_id;
  perform private.write_audit('payment.settlement_created', 'settlement', v_id, null, p_org, jsonb_build_object('period_end', p_period_end));
  return v_id;
end;
$$;

create or replace function public.update_settlement_status(p_settlement uuid, p_status text, p_payout_reference text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.settlements%rowtype;
begin
  if not private.has_platform_permission('platform.finance.manage') then
    perform private.raise_app_error('forbidden', 'You cannot update settlements.');
  end if;
  select * into v_s from public.settlements where id = p_settlement for update;
  if not found then
    perform private.raise_app_error('not_found', 'Settlement not found.');
  end if;
  if (v_s.status, p_status) = ('draft', 'approved') then
    update public.settlements set status = 'approved', approved_by = auth.uid() where id = p_settlement;
  elsif (v_s.status, p_status) = ('approved', 'paid_out') then
    if coalesce(btrim(p_payout_reference), '') = '' then
      perform private.raise_app_error('invalid_input', 'Enter the partner''s payout reference.');
    end if;
    update public.settlements set status = 'paid_out', payout_reference = p_payout_reference where id = p_settlement;
  else
    perform private.raise_app_error('invalid_transition', 'That settlement change is not allowed.');
  end if;
  perform private.write_audit('payment.settlement_' || p_status, 'settlement', p_settlement, null, v_s.organization_id,
    jsonb_build_object('payout_reference', p_payout_reference));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reconciliation (provider report vs. our ledger)
-- -----------------------------------------------------------------------------
create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  period_from date not null,
  period_to date not null,
  matched integer not null default 0,
  mismatched integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_to >= period_from)
);
create table public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs (id) on delete cascade,
  external_reference text not null,
  payment_intent_id uuid references public.payment_intents (id) on delete restrict,
  provider_amount_centavos bigint,
  provider_status text,
  ledger_amount_centavos bigint,
  ledger_status text,
  result text not null check (result in ('matched', 'amount_mismatch', 'status_mismatch', 'missing_in_ledger', 'missing_at_provider')),
  unique (run_id, external_reference)
);

-- p_report: [{ "external_reference": "...", "amount_centavos": 123, "status": "succeeded|failed|refunded|partially_refunded" }]
create or replace function public.run_reconciliation(p_provider text, p_from date, p_to date, p_report jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_row jsonb;
  v_pi public.payment_intents%rowtype;
  v_result text;
  v_ledger_status text;
begin
  if not private.has_platform_permission('platform.finance.manage') then
    perform private.raise_app_error('forbidden', 'You cannot run reconciliation.');
  end if;
  if jsonb_typeof(p_report) <> 'array' then
    perform private.raise_app_error('invalid_input', 'The provider report must be a list of transactions.');
  end if;
  insert into public.reconciliation_runs (provider, period_from, period_to) values (p_provider, p_from, p_to) returning id into v_run;
  for v_row in select * from jsonb_array_elements(p_report) loop
    select * into v_pi from public.payment_intents where provider = p_provider and external_reference = v_row ->> 'external_reference';
    if not found then
      v_result := 'missing_in_ledger';
      v_ledger_status := null;
    else
      -- Compare like with like: anything captured counts as "succeeded" unless the report says refunded.
      v_ledger_status := v_pi.status;
      v_result := case
        when (v_row ->> 'amount_centavos')::bigint <> v_pi.amount_centavos then 'amount_mismatch'
        when (v_row ->> 'status') <> v_pi.status
             and not ((v_row ->> 'status') = 'succeeded' and v_pi.status in ('succeeded', 'partially_refunded')) then 'status_mismatch'
        else 'matched' end;
    end if;
    insert into public.reconciliation_items (run_id, external_reference, payment_intent_id, provider_amount_centavos, provider_status,
                                             ledger_amount_centavos, ledger_status, result)
    values (v_run, v_row ->> 'external_reference', v_pi.id, (v_row ->> 'amount_centavos')::bigint, v_row ->> 'status',
            case when v_pi.id is not null then v_pi.amount_centavos end, v_ledger_status, v_result)
    on conflict (run_id, external_reference) do nothing;
    v_pi := null;
  end loop;
  -- Payments we believe were captured in the period but the provider didn't report.
  insert into public.reconciliation_items (run_id, external_reference, payment_intent_id, ledger_amount_centavos, ledger_status, result)
  select v_run, pi.external_reference, pi.id, pi.amount_centavos, pi.status, 'missing_at_provider'
  from public.payment_intents pi
  where pi.provider = p_provider and pi.external_reference is not null
    and pi.status in ('succeeded', 'partially_refunded', 'refunded')
    and (pi.succeeded_at at time zone 'Asia/Manila')::date between p_from and p_to
    and not exists (select 1 from public.reconciliation_items ri where ri.run_id = v_run and ri.external_reference = pi.external_reference);
  update public.reconciliation_runs set
    matched = (select count(*) from public.reconciliation_items where run_id = v_run and result = 'matched'),
    mismatched = (select count(*) from public.reconciliation_items where run_id = v_run and result <> 'matched')
  where id = v_run;
  perform private.write_audit('payment.reconciliation_run', 'reconciliation_run', v_run, null, null,
    jsonb_build_object('provider', p_provider, 'from', p_from, 'to', p_to));
  return v_run;
end;
$$;

create or replace function public.set_commission_rate(p_org uuid, p_rate_bps integer, p_effective_from date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.finance.manage') then
    perform private.raise_app_error('forbidden', 'You cannot change commission rates.');
  end if;
  if p_effective_from < private.manila_today() then
    perform private.raise_app_error('invalid_input', 'Commission changes can''t be backdated.');
  end if;
  -- NULL organization = platform default (its uniqueness is a partial index, so upsert by hand).
  update public.commission_rates set rate_bps = p_rate_bps, note = coalesce(p_note, '')
  where organization_id is not distinct from p_org and effective_from = p_effective_from;
  if not found then
    insert into public.commission_rates (organization_id, rate_bps, effective_from, note) values (p_org, p_rate_bps, p_effective_from, coalesce(p_note, ''));
  end if;
  perform private.write_audit('payment.commission_rate_set', 'organization', p_org, null, p_org,
    jsonb_build_object('rate_bps', p_rate_bps, 'effective_from', p_effective_from));
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.commission_rates enable row level security;
alter table public.payment_intents enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_events enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_items enable row level security;
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_items enable row level security;

create policy commission_rates_select on public.commission_rates for select to authenticated
  using ((select private.has_platform_permission('platform.finance.manage'))
         or (organization_id is not null and (select private.has_organization_permission(organization_id, 'finance.view'))));
create policy payment_intents_select on public.payment_intents for select to authenticated
  using ((select private.has_household_permission(household_id, 'services.view'))
         or (select private.has_organization_permission(organization_id, 'finance.view'))
         or (select private.has_platform_permission('platform.finance.manage')));
create policy refunds_select on public.refunds for select to authenticated
  using ((select private.has_household_permission(household_id, 'services.view'))
         or (select private.has_organization_permission(organization_id, 'finance.view'))
         or (select private.has_platform_permission('platform.finance.manage')));
create policy payment_events_select on public.payment_events for select to authenticated
  using (exists (select 1 from public.payment_intents pi where pi.id = payment_intent_id));
create policy settlements_select on public.settlements for select to authenticated
  using ((select private.has_organization_permission(organization_id, 'finance.view'))
         or (select private.has_platform_permission('platform.finance.manage')));
create policy settlement_items_select on public.settlement_items for select to authenticated
  using (exists (select 1 from public.settlements s where s.id = settlement_id));
create policy reconciliation_runs_select on public.reconciliation_runs for select to authenticated
  using ((select private.has_platform_permission('platform.finance.manage')));
create policy reconciliation_items_select on public.reconciliation_items for select to authenticated
  using ((select private.has_platform_permission('platform.finance.manage')));

revoke insert, update, delete on public.commission_rates, public.payment_intents, public.refunds, public.payment_events,
  public.settlements, public.settlement_items, public.reconciliation_runs, public.reconciliation_items from authenticated;

do $$
declare
  f text;
begin
  -- Callable by signed-in users (each checks permissions itself).
  foreach f in array array[
    'public.create_payment_intent(uuid, text, text)',
    'public.cancel_payment_intent(uuid)',
    'public.request_refund(uuid, bigint, text, text)',
    'public.create_settlement(uuid, date)',
    'public.update_settlement_status(uuid, text, text)',
    'public.run_reconciliation(text, date, date, jsonb)',
    'public.set_commission_rate(uuid, integer, date, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Server only: provider references and verified provider events.
  foreach f in array array[
    'public.attach_payment_reference(uuid, text, text)',
    'public.attach_refund_reference(uuid, text)',
    'public.apply_payment_event(text, text, text, text, bigint, text, timestamptz, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

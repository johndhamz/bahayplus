-- =============================================================================
-- Phase 5 · Bills & utilities, household budgeting
--
-- Money: bigint centavos, PHP only. Dates: calendar dates in Asia/Manila.
-- Payments are RECORDED (made outside Bahay+). No direct bill payment, wallet or bank reconciliation.
--
-- Integrity rules
--  - record_bill_payment() is the only write path for payments: row-locks the bill, enforces
--    idempotency keys, rejects overpayment, creates exactly ONE linked expense, and cancels
--    outstanding reminders when the bill is fully paid — all in one transaction.
--  - Expenses created from bill payments are unique per payment (no double counting);
--    voiding a payment voids its expense.
--  - Bill generation is idempotent (unique account + period) and catches up missed runs.
-- =============================================================================

create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('household', 'bills.view', 'View bills, utility accounts and payments'),
  ('household', 'bills.manage', 'Manage utility accounts, bills and record payments'),
  ('household', 'budget.view', 'View budgets and expenses'),
  ('household', 'budget.manage', 'Manage budgets and record expenses');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('household', 'owner', 'bills.view'), ('household', 'owner', 'bills.manage'),
  ('household', 'owner', 'budget.view'), ('household', 'owner', 'budget.manage'),
  ('household', 'manager', 'bills.view'), ('household', 'manager', 'bills.manage'),
  ('household', 'manager', 'budget.view'), ('household', 'manager', 'budget.manage'),
  ('household', 'member', 'bills.view'), ('household', 'member', 'budget.view')
);

create or replace function private.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

-- Day `p_day` of the month containing `p_month`, clamped to the month's last day (31 → Feb 28/29).
create or replace function private.clamped_day(p_month date, p_day int)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_month)::date
          + (least(p_day, extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::int) - 1));
$$;

-- -----------------------------------------------------------------------------
-- Expense categories (system defaults + household custom)
-- -----------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  key text check (key is null or key ~ '^[a-z_]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order smallint not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- System categories have a key and no household; custom ones belong to one household.
  check ((household_id is null) = (key is not null))
);
create unique index expense_categories_system_key on public.expense_categories (key) where household_id is null;
create unique index expense_categories_household_name on public.expense_categories (household_id, lower(name)) where household_id is not null;
create trigger expense_categories_updated_at before update on public.expense_categories for each row execute function private.set_updated_at();

insert into public.expense_categories (key, name, sort_order) values
  ('utilities', 'Utilities', 10),
  ('rent_dues', 'Rent & association dues', 20),
  ('groceries', 'Groceries & market', 30),
  ('household_help', 'Household help', 40),
  ('repairs', 'Repairs & home services', 50),
  ('transportation', 'Transportation & fuel', 60),
  ('vehicle', 'Vehicle care', 70),
  ('pets', 'Pets', 80),
  ('health', 'Health & medicine', 90),
  ('education', 'Education', 100),
  ('insurance', 'Insurance', 110),
  ('dining', 'Dining out', 120),
  ('other', 'Other', 900);

-- -----------------------------------------------------------------------------
-- Utility accounts (recurring billing rules live on the account)
-- -----------------------------------------------------------------------------
create table public.bill_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id uuid,
  bill_type text not null check (bill_type in ('electricity', 'water', 'internet', 'telecom', 'association_dues', 'rent', 'insurance', 'custom')),
  provider_name text not null check (char_length(btrim(provider_name)) between 1 and 80),
  nickname text not null default '' check (char_length(nickname) <= 80),
  -- Privacy by design: only the last 4 characters of the account number are stored.
  account_number_last4 text not null default '' check (account_number_last4 ~ '^[A-Za-z0-9]{0,4}$'),
  category_id uuid not null references public.expense_categories (id),
  amount_type text not null check (amount_type in ('fixed', 'variable')),
  fixed_amount_centavos bigint check (fixed_amount_centavos is null or fixed_amount_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  is_recurring boolean not null default true,
  due_day smallint check (due_day between 1 and 31),
  starts_on date not null default private.manila_today(),
  ends_on date,
  -- Days before the due date to remind (0 = due date, negative = overdue follow-up after the due date).
  reminder_offsets smallint[] not null default '{7,3,1,0,-3}',
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (property_id, household_id) references public.properties (id, household_id),
  check (amount_type = 'variable' or fixed_amount_centavos is not null),
  check (not is_recurring or due_day is not null),
  check (ends_on is null or ends_on >= starts_on),
  check (array_length(reminder_offsets, 1) is null or array_length(reminder_offsets, 1) <= 8),
  check (-30 <= all (reminder_offsets) and 60 >= all (reminder_offsets))
);
create index bill_accounts_household_idx on public.bill_accounts (household_id) where archived_at is null;
create trigger bill_accounts_updated_at before update on public.bill_accounts for each row execute function private.set_updated_at();

create or replace function private.check_bill_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.expense_categories c
                 where c.id = new.category_id and (c.household_id is null or c.household_id = new.household_id)) then
    perform private.raise_app_error('invalid_input', 'Choose a category from this household.');
  end if;
  if new.property_id is not null and (tg_op = 'INSERT' or new.property_id is distinct from old.property_id)
     and exists (select 1 from public.properties where id = new.property_id and archived_at is not null) then
    perform private.raise_app_error('property_archived', 'Choose an active property.');
  end if;
  return new;
end;
$$;
create trigger bill_accounts_check before insert or update on public.bill_accounts for each row execute function private.check_bill_account();

-- -----------------------------------------------------------------------------
-- Bills (one per account per billing period)
-- -----------------------------------------------------------------------------
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  bill_account_id uuid not null,
  period_key text not null check (period_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  period_start date not null,
  period_end date not null,
  due_on date not null,
  amount_due_centavos bigint check (amount_due_centavos is null or amount_due_centavos >= 0),
  amount_paid_centavos bigint not null default 0 check (amount_paid_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'unpaid' check (status in ('awaiting_amount', 'unpaid', 'partially_paid', 'paid')),
  paid_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_account_id, period_key),
  unique (id, household_id),
  foreign key (bill_account_id, household_id) references public.bill_accounts (id, household_id) on delete cascade,
  check (period_end >= period_start)
);
create index bills_household_due_idx on public.bills (household_id, due_on);
create trigger bills_updated_at before update on public.bills for each row execute function private.set_updated_at();

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  bill_id uuid not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  paid_on date not null,
  method text not null check (method in ('gcash', 'maya', 'bank_transfer', 'over_the_counter', 'credit_card', 'debit_card', 'cash', 'auto_debit', 'other')),
  reference text not null default '' check (char_length(reference) <= 80),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  request_hash text not null,
  voided_at timestamptz,
  void_reason text,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, idempotency_key),
  foreign key (bill_id, household_id) references public.bills (id, household_id) on delete cascade,
  check ((voided_at is null) = (void_reason is null))
);
create index bill_payments_bill_idx on public.bill_payments (bill_id) where voided_at is null;
create trigger bill_payments_updated_at before update on public.bill_payments for each row execute function private.set_updated_at();

create table public.bill_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  bill_id uuid not null,
  offset_days smallint not null,
  remind_on date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  -- Why a reminder was cancelled: 'paid' (system, reversible if a payment is voided) or 'user'.
  cancel_reason text check (cancel_reason in ('paid', 'user')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_id, offset_days),
  foreign key (bill_id, household_id) references public.bills (id, household_id) on delete cascade,
  check ((status = 'cancelled') = (cancel_reason is not null))
);
create index bill_reminders_due_idx on public.bill_reminders (remind_on) where status = 'scheduled';
create trigger bill_reminders_updated_at before update on public.bill_reminders for each row execute function private.set_updated_at();

-- Minimal in-app notification inbox (Phase 8 adds channels, preferences and delivery records).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  title text not null,
  body text not null default '',
  link text check (link is null or link ~ '^/'),
  -- Exactly-once creation per logical event and recipient.
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create trigger notifications_updated_at before update on public.notifications for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Budgets & expenses
-- -----------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month),
  unique (id, household_id)
);
create trigger budgets_updated_at before update on public.budgets for each row execute function private.set_updated_at();

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  budget_id uuid not null,
  category_id uuid not null references public.expense_categories (id),
  limit_centavos bigint not null check (limit_centavos >= 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id),
  foreign key (budget_id, household_id) references public.budgets (id, household_id) on delete cascade
);
create trigger budget_lines_updated_at before update on public.budget_lines for each row execute function private.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  property_id uuid,
  category_id uuid not null references public.expense_categories (id),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency char(3) not null default 'PHP' check (currency = 'PHP'),
  spent_on date not null,
  description text not null default '' check (char_length(description) <= 200),
  payment_method text not null default 'other' check (payment_method in ('gcash', 'maya', 'bank_transfer', 'over_the_counter', 'credit_card', 'debit_card', 'cash', 'auto_debit', 'other')),
  source_type text not null default 'manual' check (source_type in ('manual', 'bill_payment')),
  source_id uuid,
  voided_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, household_id) references public.properties (id, household_id),
  check ((source_type = 'manual') = (source_id is null))
);
-- One expense per bill payment: the guard against double counting.
create unique index expenses_one_per_bill_payment on public.expenses (source_id) where source_type = 'bill_payment';
create index expenses_household_month_idx on public.expenses (household_id, spent_on) where voided_at is null;
create trigger expenses_updated_at before update on public.expenses for each row execute function private.set_updated_at();

create or replace function private.check_category_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.expense_categories c
                 where c.id = new.category_id and (c.household_id is null or c.household_id = new.household_id)) then
    perform private.raise_app_error('invalid_input', 'Choose a category from this household.');
  end if;
  return new;
end;
$$;
create trigger expenses_category_check before insert or update of category_id on public.expenses for each row execute function private.check_category_scope();
create trigger budget_lines_category_check before insert or update of category_id on public.budget_lines for each row execute function private.check_category_scope();

-- -----------------------------------------------------------------------------
-- Bill status maintenance and reminder suppression
-- -----------------------------------------------------------------------------
create or replace function private.recompute_bill(p_bill uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid bigint;
  v_due bigint;
  v_status text;
begin
  select coalesce(sum(amount_centavos), 0) into v_paid from public.bill_payments where bill_id = p_bill and voided_at is null;
  select amount_due_centavos into v_due from public.bills where id = p_bill;
  v_status := case
    when v_due is null then case when v_paid > 0 then 'partially_paid' else 'awaiting_amount' end
    when v_paid >= v_due then 'paid'
    when v_paid > 0 then 'partially_paid'
    else 'unpaid'
  end;
  update public.bills set amount_paid_centavos = v_paid, status = v_status,
    paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end
  where id = p_bill;
  -- Stop outstanding reminders once fully paid; reinstate future ones if a payment is voided.
  if v_status = 'paid' then
    update public.bill_reminders set status = 'cancelled', cancel_reason = 'paid', processed_at = now()
    where bill_id = p_bill and status = 'scheduled';
  else
    update public.bill_reminders set status = 'scheduled', cancel_reason = null, processed_at = null
    where bill_id = p_bill and status = 'cancelled' and cancel_reason = 'paid' and remind_on >= private.manila_today();
  end if;
end;
$$;

create or replace function private.on_bill_amount_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recompute_bill(new.id);
  return new;
end;
$$;
create trigger bills_amount_change after update of amount_due_centavos on public.bills
  for each row when (old.amount_due_centavos is distinct from new.amount_due_centavos)
  execute function private.on_bill_amount_change();

create or replace function private.schedule_bill_reminders(p_bill uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.bills%rowtype;
  v_offsets smallint[];
begin
  select * into v_bill from public.bills where id = p_bill;
  select reminder_offsets into v_offsets from public.bill_accounts where id = v_bill.bill_account_id;
  insert into public.bill_reminders (household_id, bill_id, offset_days, remind_on, status, cancel_reason)
  select v_bill.household_id, v_bill.id, o, v_bill.due_on - o,
         case when v_bill.status = 'paid' then 'cancelled' else 'scheduled' end,
         case when v_bill.status = 'paid' then 'paid' end
  from unnest(coalesce(v_offsets, '{}')) as o
  on conflict (bill_id, offset_days) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bill generation (idempotent, catches up missed runs, month-end clamping)
-- -----------------------------------------------------------------------------
create or replace function private.generate_bills_for_account(p_account uuid, p_through date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.bill_accounts%rowtype;
  v_month date;
  v_last date;
  v_created integer := 0;
  v_id uuid;
begin
  select * into v_acc from public.bill_accounts where id = p_account;
  if not found or not v_acc.is_recurring or v_acc.archived_at is not null then
    return 0;
  end if;
  -- Generate through the month after p_through (next bill is visible ahead of time), bounded to 24 months of catch-up.
  v_last := date_trunc('month', least(coalesce(v_acc.ends_on, p_through + interval '1 month'), p_through + interval '1 month'))::date;
  v_month := greatest(date_trunc('month', v_acc.starts_on)::date, (date_trunc('month', p_through) - interval '24 months')::date);
  while v_month <= v_last loop
    insert into public.bills (household_id, bill_account_id, period_key, period_start, period_end, due_on, amount_due_centavos, status)
    values (v_acc.household_id, v_acc.id, to_char(v_month, 'YYYY-MM'), v_month,
            (v_month + interval '1 month - 1 day')::date, private.clamped_day(v_month, v_acc.due_day),
            case when v_acc.amount_type = 'fixed' then v_acc.fixed_amount_centavos end,
            case when v_acc.amount_type = 'fixed' then case when v_acc.fixed_amount_centavos = 0 then 'paid' else 'unpaid' end else 'awaiting_amount' end)
    on conflict (bill_account_id, period_key) do nothing
    returning id into v_id;
    if v_id is not null then
      v_created := v_created + 1;
      perform private.schedule_bill_reminders(v_id);
      v_id := null;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
  return v_created;
end;
$$;

create or replace function private.generate_due_bills(p_through date default private.manila_today())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_acc uuid;
begin
  for v_acc in select id from public.bill_accounts where is_recurring and archived_at is null loop
    v_total := v_total + private.generate_bills_for_account(v_acc, p_through);
  end loop;
  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reminder processing (exactly-once per reminder; skips paid bills)
-- -----------------------------------------------------------------------------
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
    select r.id, r.bill_id, r.offset_days, b.household_id, b.due_on, b.status, b.amount_due_centavos, b.amount_paid_centavos,
           a.provider_name, a.nickname
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
    insert into public.notifications (recipient_id, household_id, kind, title, body, link, dedupe_key)
    select m.user_id, v_rem.household_id, 'bill.reminder', v_title,
           'Due ' || to_char(v_rem.due_on, 'Mon DD, YYYY'),
           '/app/h/' || v_rem.household_id || '/bills/' || v_rem.bill_id,
           'bill_reminder:' || v_rem.id
    from public.household_members m
    where m.household_id = v_rem.household_id and m.status = 'active'
      and private.role_has_permission(m.role_id, 'bills.view')
    on conflict (recipient_id, dedupe_key) do nothing;
    update public.bill_reminders set status = 'sent', processed_at = now() where id = v_rem.id;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;

-- -----------------------------------------------------------------------------
-- Job runs: durable record of scheduled jobs; one successful run per job + key.
-- -----------------------------------------------------------------------------
create table private.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  run_key text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (job_name, run_key)
);

create or replace function private.run_daily_bill_jobs(p_today date default private.manila_today())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer;
  v_sent integer;
  v_stats jsonb;
begin
  insert into private.job_runs (job_name, run_key, status) values ('daily_bills', p_today::text, 'running')
  on conflict (job_name, run_key) do update set attempts = private.job_runs.attempts + 1, status = 'running', started_at = now(), error = null
    where private.job_runs.status <> 'succeeded';
  if not found then
    return jsonb_build_object('skipped', true, 'reason', 'already succeeded for ' || p_today);
  end if;
  begin
    v_created := private.generate_due_bills(p_today);
    v_sent := private.process_bill_reminders(p_today);
    v_stats := jsonb_build_object('bills_created', v_created, 'reminders_sent', v_sent);
    update private.job_runs set status = 'succeeded', stats = v_stats, finished_at = now()
    where job_name = 'daily_bills' and run_key = p_today::text;
    return v_stats;
  exception when others then
    update private.job_runs set status = 'failed', error = sqlerrm, finished_at = now()
    where job_name = 'daily_bills' and run_key = p_today::text;
    return jsonb_build_object('failed', true, 'error', sqlerrm);
  end;
end;
$$;

-- Service-role entry point for the internal job endpoint (fallback/manual trigger).
create or replace function public.run_daily_bill_jobs(p_today date default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.run_daily_bill_jobs(coalesce(p_today, private.manila_today()));
$$;
revoke all on function public.run_daily_bill_jobs(date) from public, anon, authenticated;
grant execute on function public.run_daily_bill_jobs(date) to service_role;

-- 00:05 Asia/Manila daily (16:05 UTC). Idempotent and self-healing: missed days are caught up next run.
select cron.schedule('bahayplus-daily-bills', '5 16 * * *', $$select private.run_daily_bill_jobs()$$);

-- -----------------------------------------------------------------------------
-- Commands
-- -----------------------------------------------------------------------------
create or replace function public.record_bill_payment(
  p_bill uuid, p_amount_centavos bigint, p_paid_on date, p_method text, p_reference text, p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.bills%rowtype;
  v_acc public.bill_accounts%rowtype;
  v_hash text := md5(concat_ws('|', p_bill, p_amount_centavos, p_paid_on, p_method, coalesce(p_reference, '')));
  v_existing public.bill_payments%rowtype;
  v_payment uuid;
  v_remaining bigint;
begin
  if auth.uid() is null then
    perform private.raise_app_error('unauthenticated', 'Sign in to record payments.');
  end if;
  -- Lock the bill: concurrent payments for the same bill are serialized.
  select * into v_bill from public.bills where id = p_bill for update;
  if not found or not private.has_household_permission(v_bill.household_id, 'bills.view') then
    perform private.raise_app_error('not_found', 'Bill not found.');
  end if;
  if not private.has_household_permission(v_bill.household_id, 'bills.manage') then
    perform private.raise_app_error('forbidden', 'You cannot record payments for this household.');
  end if;
  -- Idempotency: the same key returns the original payment; a different request with the same key is refused.
  select * into v_existing from public.bill_payments where household_id = v_bill.household_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash = v_hash then
      return v_existing.id;
    end if;
    perform private.raise_app_error('idempotency_mismatch', 'This payment was already submitted with different details.');
  end if;
  if p_amount_centavos is null or p_amount_centavos <= 0 then
    perform private.raise_app_error('invalid_input', 'Enter an amount greater than zero.');
  end if;
  if p_paid_on is null or p_paid_on > private.manila_today() then
    perform private.raise_app_error('invalid_input', 'The payment date cannot be in the future.');
  end if;
  if v_bill.amount_due_centavos is null then
    perform private.raise_app_error('amount_required', 'Enter the bill amount from your statement before recording a payment.');
  end if;
  v_remaining := v_bill.amount_due_centavos - v_bill.amount_paid_centavos;
  if v_remaining <= 0 then
    perform private.raise_app_error('already_paid', 'This bill is already fully paid.');
  end if;
  if p_amount_centavos > v_remaining then
    perform private.raise_app_error('overpayment', 'That is more than the remaining balance of ₱' ||
      to_char(v_remaining / 100.0, 'FM999,999,999,990.00') || '.');
  end if;

  insert into public.bill_payments (household_id, bill_id, amount_centavos, paid_on, method, reference, idempotency_key, request_hash)
  values (v_bill.household_id, p_bill, p_amount_centavos, p_paid_on, p_method, coalesce(p_reference, ''), p_idempotency_key, v_hash)
  returning id into v_payment;

  select * into v_acc from public.bill_accounts where id = v_bill.bill_account_id;
  insert into public.expenses (household_id, property_id, category_id, amount_centavos, spent_on, description, payment_method, source_type, source_id)
  values (v_bill.household_id, v_acc.property_id, v_acc.category_id, p_amount_centavos, p_paid_on,
          coalesce(nullif(v_acc.nickname, ''), v_acc.provider_name) || ' — ' || v_bill.period_key, p_method, 'bill_payment', v_payment);

  perform private.recompute_bill(p_bill);
  perform private.write_audit('bill.payment_recorded', 'bill_payment', v_payment, v_bill.household_id, null,
    jsonb_build_object('bill_id', p_bill, 'amount_centavos', p_amount_centavos, 'method', p_method));
  return v_payment;
end;
$$;

create or replace function public.void_bill_payment(p_payment uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.bill_payments%rowtype;
begin
  select * into v_payment from public.bill_payments where id = p_payment;
  if not found or not private.has_household_permission(v_payment.household_id, 'bills.view') then
    perform private.raise_app_error('not_found', 'Payment not found.');
  end if;
  if not private.has_household_permission(v_payment.household_id, 'bills.manage') then
    perform private.raise_app_error('forbidden', 'You cannot change payments for this household.');
  end if;
  perform 1 from public.bills where id = v_payment.bill_id for update;
  if v_payment.voided_at is not null then
    return;
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    perform private.raise_app_error('invalid_input', 'Give a short reason for voiding this payment.');
  end if;
  update public.bill_payments set voided_at = now(), void_reason = left(btrim(p_reason), 200) where id = p_payment;
  update public.expenses set voided_at = now() where source_type = 'bill_payment' and source_id = p_payment;
  perform private.recompute_bill(v_payment.bill_id);
  perform private.write_audit('bill.payment_voided', 'bill_payment', p_payment, v_payment.household_id, null,
    jsonb_build_object('reason', left(btrim(p_reason), 200)));
end;
$$;

-- Creating an account generates its current bills immediately (no need to wait for the scheduler).
create or replace function public.create_bill_account(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_payload ->> 'household_id')::uuid;
  v_id uuid;
begin
  if not private.has_household_permission(v_household, 'bills.manage') then
    perform private.raise_app_error('forbidden', 'You cannot add bills to this household.');
  end if;
  insert into public.bill_accounts (household_id, property_id, bill_type, provider_name, nickname, account_number_last4, category_id,
    amount_type, fixed_amount_centavos, is_recurring, due_day, starts_on, ends_on, reminder_offsets)
  values (v_household, (p_payload ->> 'property_id')::uuid, p_payload ->> 'bill_type', p_payload ->> 'provider_name',
    coalesce(p_payload ->> 'nickname', ''), coalesce(p_payload ->> 'account_number_last4', ''), (p_payload ->> 'category_id')::uuid,
    p_payload ->> 'amount_type', (p_payload ->> 'fixed_amount_centavos')::bigint, coalesce((p_payload ->> 'is_recurring')::boolean, true),
    (p_payload ->> 'due_day')::smallint, coalesce((p_payload ->> 'starts_on')::date, private.manila_today()), (p_payload ->> 'ends_on')::date,
    coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_payload -> 'reminder_offsets') x), '{7,3,1,0,-3}'))
  returning id into v_id;
  perform private.generate_bills_for_account(v_id, private.manila_today());
  return v_id;
end;
$$;

-- One-off bill (non-recurring accounts, or an extra statement).
create or replace function public.create_bill(p_account uuid, p_due_on date, p_amount_centavos bigint, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.bill_accounts%rowtype;
  v_key text := to_char(p_due_on, 'YYYY-MM');
  v_id uuid;
begin
  select * into v_acc from public.bill_accounts where id = p_account;
  if not found or not private.has_household_permission(v_acc.household_id, 'bills.manage') then
    perform private.raise_app_error('not_found', 'Account not found.');
  end if;
  if p_amount_centavos is not null and p_amount_centavos < 0 then
    perform private.raise_app_error('invalid_input', 'The amount cannot be negative.');
  end if;
  insert into public.bills (household_id, bill_account_id, period_key, period_start, period_end, due_on, amount_due_centavos, status, notes)
  values (v_acc.household_id, p_account, v_key, date_trunc('month', p_due_on)::date, (date_trunc('month', p_due_on) + interval '1 month - 1 day')::date,
          p_due_on, p_amount_centavos, case when p_amount_centavos is null then 'awaiting_amount' when p_amount_centavos = 0 then 'paid' else 'unpaid' end,
          coalesce(p_notes, ''))
  on conflict (bill_account_id, period_key) do nothing
  returning id into v_id;
  if v_id is null then
    perform private.raise_app_error('duplicate_bill', 'There is already a bill for this account in that month.');
  end if;
  perform private.schedule_bill_reminders(v_id);
  return v_id;
end;
$$;

revoke all on function public.record_bill_payment(uuid, bigint, date, text, text, text) from public, anon;
revoke all on function public.void_bill_payment(uuid, text) from public, anon;
revoke all on function public.create_bill_account(jsonb) from public, anon;
revoke all on function public.create_bill(uuid, date, bigint, text) from public, anon;
grant execute on function public.record_bill_payment(uuid, bigint, date, text, text, text) to authenticated;
grant execute on function public.void_bill_payment(uuid, text) to authenticated;
grant execute on function public.create_bill_account(jsonb) to authenticated;
grant execute on function public.create_bill(uuid, date, bigint, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Reporting (security invoker → caller's RLS applies)
-- -----------------------------------------------------------------------------
create or replace function public.budget_vs_actual(p_household uuid, p_month date, p_property uuid default null)
returns table (category_id uuid, category_name text, sort_order smallint, limit_centavos bigint, spent_centavos bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with month_bounds as (
    select date_trunc('month', p_month)::date as m_start, (date_trunc('month', p_month) + interval '1 month - 1 day')::date as m_end
  ),
  spent as (
    select e.category_id, sum(e.amount_centavos)::bigint as total
    from public.expenses e, month_bounds mb
    where e.household_id = p_household and e.voided_at is null and e.spent_on between mb.m_start and mb.m_end
      and (p_property is null or e.property_id = p_property)
    group by e.category_id
  ),
  limits as (
    select l.category_id, l.limit_centavos
    from public.budget_lines l join public.budgets b on b.id = l.budget_id, month_bounds mb
    where b.household_id = p_household and b.month = mb.m_start
  )
  select c.id, c.name, c.sort_order, l.limit_centavos, coalesce(s.total, 0)::bigint
  from public.expense_categories c
  left join limits l on l.category_id = c.id
  left join spent s on s.category_id = c.id
  where (c.household_id is null or c.household_id = p_household) and (l.category_id is not null or s.category_id is not null)
  order by c.sort_order, c.name;
$$;

create or replace function public.monthly_spending(p_household uuid, p_months integer default 6, p_property uuid default null)
returns table (month date, spent_centavos bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', private.manila_today()) - make_interval(months => greatest(1, least(p_months, 24)) - 1),
      date_trunc('month', private.manila_today()), interval '1 month')::date as m
  )
  select months.m, coalesce(sum(e.amount_centavos), 0)::bigint
  from months
  left join public.expenses e
    on e.household_id = p_household and e.voided_at is null
   and e.spent_on >= months.m and e.spent_on < (months.m + interval '1 month')
   and (p_property is null or e.property_id = p_property)
  group by months.m
  order by months.m;
$$;
grant execute on function public.budget_vs_actual(uuid, date, uuid) to authenticated;
grant execute on function public.monthly_spending(uuid, integer, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.expense_categories enable row level security;
alter table public.bill_accounts enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;
alter table public.bill_reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;
alter table public.expenses enable row level security;

create policy expense_categories_select on public.expense_categories for select to authenticated
  using (household_id is null or (select private.has_household_permission(household_id, 'budget.view'))
         or (select private.has_household_permission(household_id, 'bills.view')));
create policy expense_categories_insert on public.expense_categories for insert to authenticated
  with check (household_id is not null and (select private.has_household_permission(household_id, 'budget.manage')));
create policy expense_categories_update on public.expense_categories for update to authenticated
  using (household_id is not null and (select private.has_household_permission(household_id, 'budget.manage')))
  with check (household_id is not null and (select private.has_household_permission(household_id, 'budget.manage')));

create policy bill_accounts_select on public.bill_accounts for select to authenticated
  using ((select private.has_household_permission(household_id, 'bills.view')));
create policy bill_accounts_update on public.bill_accounts for update to authenticated
  using ((select private.has_household_permission(household_id, 'bills.manage')))
  with check ((select private.has_household_permission(household_id, 'bills.manage')));

create policy bills_select on public.bills for select to authenticated
  using ((select private.has_household_permission(household_id, 'bills.view')));
create policy bills_update on public.bills for update to authenticated
  using ((select private.has_household_permission(household_id, 'bills.manage')))
  with check ((select private.has_household_permission(household_id, 'bills.manage')));

create policy bill_payments_select on public.bill_payments for select to authenticated
  using ((select private.has_household_permission(household_id, 'bills.view')));
create policy bill_reminders_select on public.bill_reminders for select to authenticated
  using ((select private.has_household_permission(household_id, 'bills.view')));
create policy bill_reminders_update on public.bill_reminders for update to authenticated
  using ((select private.has_household_permission(household_id, 'bills.manage')))
  with check ((select private.has_household_permission(household_id, 'bills.manage')));

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create policy budgets_select on public.budgets for select to authenticated
  using ((select private.has_household_permission(household_id, 'budget.view')));
create policy budgets_insert on public.budgets for insert to authenticated
  with check ((select private.has_household_permission(household_id, 'budget.manage')));
create policy budgets_update on public.budgets for update to authenticated
  using ((select private.has_household_permission(household_id, 'budget.manage')))
  with check ((select private.has_household_permission(household_id, 'budget.manage')));

create policy budget_lines_select on public.budget_lines for select to authenticated
  using ((select private.has_household_permission(household_id, 'budget.view')));
create policy budget_lines_insert on public.budget_lines for insert to authenticated
  with check ((select private.has_household_permission(household_id, 'budget.manage')));
create policy budget_lines_update on public.budget_lines for update to authenticated
  using ((select private.has_household_permission(household_id, 'budget.manage')))
  with check ((select private.has_household_permission(household_id, 'budget.manage')));
create policy budget_lines_delete on public.budget_lines for delete to authenticated
  using ((select private.has_household_permission(household_id, 'budget.manage')));

create policy expenses_select on public.expenses for select to authenticated
  using ((select private.has_household_permission(household_id, 'budget.view')));
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select private.has_household_permission(household_id, 'budget.manage')) and source_type = 'manual');
create policy expenses_update on public.expenses for update to authenticated
  using ((select private.has_household_permission(household_id, 'budget.manage')) and source_type = 'manual')
  with check ((select private.has_household_permission(household_id, 'budget.manage')) and source_type = 'manual');

-- Column privileges: financial totals and links are system-maintained.
revoke update on public.expense_categories, public.bill_accounts, public.bills, public.bill_payments, public.bill_reminders,
  public.notifications, public.budgets, public.budget_lines, public.expenses from authenticated;
revoke insert on public.bill_accounts, public.bills, public.bill_payments, public.bill_reminders, public.notifications from authenticated;
grant update (name, archived_at) on public.expense_categories to authenticated;
grant update (property_id, provider_name, nickname, account_number_last4, category_id, amount_type, fixed_amount_centavos,
  is_recurring, due_day, ends_on, reminder_offsets, archived_at) on public.bill_accounts to authenticated;
grant update (amount_due_centavos, notes) on public.bills to authenticated;
grant update (status) on public.bill_reminders to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant update (notes) on public.budgets to authenticated;
grant update (limit_centavos) on public.budget_lines to authenticated;
grant update (property_id, category_id, amount_centavos, spent_on, description, payment_method, voided_at) on public.expenses to authenticated;

-- Users may only cancel reminders by hand (never mark them sent).
create or replace function private.check_reminder_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if not (old.status = 'scheduled' and new.status = 'cancelled') then
      raise exception 'Only scheduled reminders can be cancelled' using errcode = 'insufficient_privilege';
    end if;
    new.cancel_reason := 'user';
    new.processed_at := now();
  end if;
  return new;
end;
$$;
create trigger bill_reminders_user_update before update on public.bill_reminders for each row execute function private.check_reminder_update();

-- Statement corrections may lower amount_due below what was already paid: the bill becomes 'paid' and the
-- excess is shown as a credit. A bill's account, period and due date are immutable for API users.

-- -----------------------------------------------------------------------------
-- Files: statements and receipts attach to bills and payments.
-- -----------------------------------------------------------------------------
alter table public.files drop constraint files_entity_type_check;
alter table public.files add constraint files_entity_type_check check (entity_type in ('asset', 'pet', 'pet_health', 'vehicle', 'bill', 'bill_payment'));
alter table public.files drop constraint files_purpose_check;
alter table public.files add constraint files_purpose_check check (purpose in ('photo', 'receipt', 'manual', 'warranty', 'vet_record', 'document', 'statement', 'other'));

create or replace function private.file_permission(p_entity_type text, p_mode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity_type = 'pet_health' then 'pet.health.' || p_mode
    when p_entity_type in ('bill', 'bill_payment') then 'bills.' || p_mode
    else 'registry.' || p_mode
  end;
$$;

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
     or v_parts[2] not in ('asset', 'pet', 'pet_health', 'vehicle', 'bill', 'bill_payment')
     or v_parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_household_permission(v_parts[1]::uuid, private.file_permission(v_parts[2], p_mode));
end;
$$;

-- -----------------------------------------------------------------------------
-- Bills in the shared due-items view (unpaid bills show up with other reminders).
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
  from public.vehicles v where v.archived_at is null and v.maintenance_interval_months is not null
union all
  select b.household_id, 'bill', b.id, coalesce(nullif(a.nickname, ''), a.provider_name) || ' (' || b.period_key || ')',
         'bill_due', b.due_on
  from public.bills b join public.bill_accounts a on a.id = b.bill_account_id
  where b.status <> 'paid' and a.archived_at is null;

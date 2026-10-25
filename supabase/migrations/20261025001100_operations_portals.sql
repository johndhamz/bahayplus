-- =============================================================================
-- Phase 9: operational portals — supplier catalog, inventory ledger, purchase orders and deliveries;
-- worker job access and completion evidence; provider/supplier reporting; disputes, platform
-- settings and audited admin commands. Reuses organizations, memberships and roles (no new identity).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (scope, key, description) values
  ('organization', 'catalog.manage', 'Manage supplier products, stock and profile'),
  ('organization', 'orders.view', 'See purchase orders received from buyers'),
  ('organization', 'orders.manage', 'Accept, fulfil and ship purchase orders'),
  ('organization', 'purchasing.manage', 'Place and manage purchase orders with suppliers'),
  ('organization', 'finance.view', 'See financial summaries and reports'),
  ('platform', 'platform.users.manage', 'Suspend and reinstate user accounts'),
  ('platform', 'platform.categories.manage', 'Manage the service category catalog'),
  ('platform', 'platform.disputes.manage', 'Review and resolve disputes');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.scope = r.scope
where (r.scope, r.key, p.key) in (
  ('organization', 'owner', 'catalog.manage'), ('organization', 'owner', 'orders.view'), ('organization', 'owner', 'orders.manage'),
  ('organization', 'owner', 'purchasing.manage'), ('organization', 'owner', 'finance.view'),
  ('organization', 'manager', 'catalog.manage'), ('organization', 'manager', 'orders.view'), ('organization', 'manager', 'orders.manage'),
  ('organization', 'manager', 'purchasing.manage'), ('organization', 'manager', 'finance.view'),
  ('organization', 'staff', 'orders.view'), ('organization', 'staff', 'orders.manage'), ('organization', 'staff', 'purchasing.manage'),
  ('platform', 'super_admin', 'platform.users.manage'), ('platform', 'super_admin', 'platform.categories.manage'),
  ('platform', 'super_admin', 'platform.disputes.manage'),
  ('platform', 'operations', 'platform.categories.manage'), ('platform', 'operations', 'platform.disputes.manage')
);

-- Organization-kind guard used by supplier/purchasing commands.
create or replace function private.organization_kind(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select kind from public.organizations where id = p_org and status = 'active';
$$;

-- -----------------------------------------------------------------------------
-- Supplier profile and catalog
-- -----------------------------------------------------------------------------
create table public.supplier_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  description text not null default '' check (char_length(description) <= 2000),
  phone text not null default '' check (phone = '' or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address text not null default '' check (char_length(address) <= 300),
  delivery_areas text not null default '' check (char_length(delivery_areas) <= 500),
  min_order_centavos bigint not null default 0 check (min_order_centavos >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger supplier_profiles_updated_at before update on public.supplier_profiles for each row execute function private.set_updated_at();

create or replace function private.create_supplier_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'supplier' then
    insert into public.supplier_profiles (organization_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger organizations_supplier_profile after insert on public.organizations for each row execute function private.create_supplier_profile();
insert into public.supplier_profiles (organization_id) select id from public.organizations where kind = 'supplier' on conflict do nothing;

create or replace function private.is_listed_supplier(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.supplier_profiles sp join public.organizations o on o.id = sp.organization_id
                 where sp.organization_id = p_org and sp.is_published and o.status = 'active' and o.kind = 'supplier');
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null default '' check (char_length(category) <= 60),
  unit text not null default 'pc' check (char_length(unit) between 1 and 20),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  reorder_level numeric(12, 3) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  unique (id, organization_id)
);
create trigger products_updated_at before update on public.products for each row execute function private.set_updated_at();

create or replace function private.check_supplier_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.organization_kind(new.organization_id) is distinct from 'supplier' then
    perform private.raise_app_error('invalid_input', 'Only supplier organizations have a product catalog.');
  end if;
  return new;
end;
$$;
create trigger products_check before insert or update of organization_id on public.products for each row execute function private.check_supplier_product();

-- Stock is an append-only ledger; on-hand quantity is the sum of movements.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null,
  quantity numeric(12, 3) not null check (quantity <> 0),
  reason text not null check (reason in ('receipt', 'adjustment', 'fulfillment', 'return')),
  note text not null default '' check (char_length(note) <= 300),
  purchase_order_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (product_id, organization_id) references public.products (id, organization_id) on delete cascade,
  unique (organization_id, idempotency_key)
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create trigger stock_movements_immutable before update or delete on public.stock_movements
  for each row when (current_user <> 'postgres') execute function private.prevent_audit_mutation();

-- -----------------------------------------------------------------------------
-- Purchase orders (service provider buys from supplier) and deliveries
-- -----------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  supplier_org_id uuid not null references public.organizations (id) on delete restrict,
  buyer_org_id uuid not null references public.organizations (id) on delete restrict,
  -- Names are snapshotted so neither side needs read access to the other's organization record.
  supplier_name text not null,
  buyer_name text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'rejected', 'shipped', 'delivered', 'cancelled')),
  total_centavos bigint not null default 0 check (total_centavos >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  delivery_address text not null check (char_length(btrim(delivery_address)) between 5 and 300),
  delivery_contact text not null default '' check (char_length(delivery_contact) <= 120),
  requested_delivery_on date,
  buyer_notes text not null default '' check (char_length(buyer_notes) <= 1000),
  supplier_notes text not null default '' check (char_length(supplier_notes) <= 1000),
  decision_reason text,
  cancelled_by text check (cancelled_by in ('buyer', 'supplier')),
  submitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_org_id, idempotency_key),
  check (supplier_org_id <> buyer_org_id)
);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_org_id, status, created_at desc);
create index purchase_orders_buyer_idx on public.purchase_orders (buyer_org_id, created_at desc);
create trigger purchase_orders_updated_at before update on public.purchase_orders for each row execute function private.set_updated_at();
alter table public.stock_movements add constraint stock_movements_po_fk foreign key (purchase_order_id) references public.purchase_orders (id) on delete restrict;

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  supplier_org_id uuid not null,
  product_id uuid not null,
  sku text not null,
  product_name text not null,
  unit text not null,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  line_total_centavos bigint generated always as (round(quantity * unit_price_centavos)::bigint) stored,
  foreign key (product_id, supplier_org_id) references public.products (id, organization_id) on delete restrict,
  unique (purchase_order_id, product_id)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null unique references public.purchase_orders (id) on delete cascade,
  supplier_org_id uuid not null,
  buyer_org_id uuid not null,
  status text not null default 'out_for_delivery' check (status in ('out_for_delivery', 'delivered', 'failed')),
  courier text not null default '' check (char_length(courier) <= 80),
  tracking_ref text not null default '' check (char_length(tracking_ref) <= 80),
  scheduled_for date,
  attempts integer not null default 1,
  failure_reason text,
  received_by text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger deliveries_updated_at before update on public.deliveries for each row execute function private.set_updated_at();

-- Reserved = quantity on accepted, not-yet-shipped orders. Available = on hand − reserved.
create or replace view public.product_inventory
with (security_invoker = true) as
  select p.id as product_id, p.organization_id, p.sku, p.name, p.unit, p.reorder_level, p.is_active,
         coalesce((select sum(m.quantity) from public.stock_movements m where m.product_id = p.id), 0)::numeric(12, 3) as on_hand,
         coalesce((select sum(l.quantity) from public.purchase_order_lines l join public.purchase_orders o on o.id = l.purchase_order_id
                   where l.product_id = p.id and o.status = 'accepted'), 0)::numeric(12, 3) as reserved
  from public.products p
  -- Stock levels are the supplier's business: only its catalog/order staff get rows at all.
  where private.has_organization_permission(p.organization_id, 'catalog.manage')
     or private.has_organization_permission(p.organization_id, 'orders.view');

create or replace function private.product_available(p_product uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(quantity) from public.stock_movements where product_id = p_product), 0)
       - coalesce((select sum(l.quantity) from public.purchase_order_lines l join public.purchase_orders o on o.id = l.purchase_order_id
                   where l.product_id = p_product and o.status = 'accepted'), 0);
$$;

-- --- Stock commands -----------------------------------------------------------
create or replace function public.record_stock_movement(p_product uuid, p_quantity numeric, p_reason text, p_note text, p_idempotency_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.products%rowtype;
  v_id uuid;
begin
  select * into v_p from public.products where id = p_product for update;
  if not found or not private.has_organization_permission(v_p.organization_id, 'catalog.manage') then
    perform private.raise_app_error('not_found', 'Product not found.');
  end if;
  if p_reason not in ('receipt', 'adjustment', 'return') then
    perform private.raise_app_error('invalid_input', 'Choose receipt, adjustment or return.');
  end if;
  if p_quantity = 0 or (p_reason in ('receipt', 'return') and p_quantity < 0) then
    perform private.raise_app_error('invalid_input', 'Enter a quantity (receipts and returns add stock).');
  end if;
  select id into v_id from public.stock_movements where organization_id = v_p.organization_id and idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;
  if private.product_available(p_product) + p_quantity < 0 then
    perform private.raise_app_error('insufficient_stock', 'Stock can''t go below what is already reserved for accepted orders.');
  end if;
  insert into public.stock_movements (organization_id, product_id, quantity, reason, note, idempotency_key)
  values (v_p.organization_id, p_product, p_quantity, p_reason, left(coalesce(p_note, ''), 300), p_idempotency_key)
  returning id into v_id;
  if p_reason = 'adjustment' then
    perform private.write_audit('inventory.adjusted', 'product', p_product, null, v_p.organization_id,
      jsonb_build_object('quantity', p_quantity, 'note', p_note));
  end if;
  return v_id;
end;
$$;

-- --- Purchase order commands --------------------------------------------------
create or replace function private.po_notify(p_po public.purchase_orders, p_to text, p_kind text, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_to = 'supplier' then
    perform private.notify_organization(p_po.supplier_org_id, 'orders.view', p_kind, p_title, p_po.buyer_name,
      '/supplier/o/' || p_po.supplier_org_id || '/purchase-orders/' || p_po.id, p_kind || ':' || p_po.id, auth.uid());
  else
    perform private.notify_organization(p_po.buyer_org_id, 'purchasing.manage', p_kind, p_title, p_po.supplier_name,
      '/provider/o/' || p_po.buyer_org_id || '/purchasing/orders/' || p_po.id, p_kind || ':' || p_po.id, auth.uid());
  end if;
end;
$$;

create or replace function public.create_purchase_order(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid := (p_payload ->> 'buyer_org_id')::uuid;
  v_supplier uuid := (p_payload ->> 'supplier_org_id')::uuid;
  v_key text := p_payload ->> 'idempotency_key';
  v_id uuid;
  v_line jsonb;
  v_p public.products%rowtype;
  v_po public.purchase_orders%rowtype;
  v_min bigint;
begin
  if not private.has_organization_permission(v_buyer, 'purchasing.manage') or private.organization_kind(v_buyer) <> 'service_provider' then
    perform private.raise_app_error('forbidden', 'You cannot place orders for this business.');
  end if;
  select id into v_id from public.purchase_orders where buyer_org_id = v_buyer and idempotency_key = v_key;
  if v_id is not null then
    return v_id;
  end if;
  if not private.is_listed_supplier(v_supplier) then
    perform private.raise_app_error('not_found', 'This supplier is not available.');
  end if;
  if jsonb_typeof(p_payload -> 'lines') <> 'array' or jsonb_array_length(p_payload -> 'lines') = 0 then
    perform private.raise_app_error('invalid_input', 'Add at least one product.');
  end if;
  insert into public.purchase_orders (supplier_org_id, buyer_org_id, supplier_name, buyer_name, delivery_address, delivery_contact,
                                      requested_delivery_on, buyer_notes, idempotency_key)
  values (v_supplier, v_buyer, (select name from public.organizations where id = v_supplier), (select name from public.organizations where id = v_buyer),
          p_payload ->> 'delivery_address', coalesce(p_payload ->> 'delivery_contact', ''),
          nullif(p_payload ->> 'requested_delivery_on', '')::date, coalesce(p_payload ->> 'buyer_notes', ''), v_key)
  returning id into v_id;
  for v_line in select * from jsonb_array_elements(p_payload -> 'lines') loop
    select * into v_p from public.products where id = (v_line ->> 'product_id')::uuid and organization_id = v_supplier and is_active;
    if not found then
      perform private.raise_app_error('invalid_input', 'One of the products is no longer available.');
    end if;
    insert into public.purchase_order_lines (purchase_order_id, supplier_org_id, product_id, sku, product_name, unit, quantity, unit_price_centavos)
    values (v_id, v_supplier, v_p.id, v_p.sku, v_p.name, v_p.unit, (v_line ->> 'quantity')::numeric, v_p.unit_price_centavos);
  end loop;
  update public.purchase_orders set total_centavos = (select coalesce(sum(line_total_centavos), 0) from public.purchase_order_lines where purchase_order_id = v_id)
  where id = v_id returning * into v_po;
  select min_order_centavos into v_min from public.supplier_profiles where organization_id = v_supplier;
  if v_po.total_centavos < coalesce(v_min, 0) then
    perform private.raise_app_error('invalid_input', 'This order is below the supplier''s minimum order amount.');
  end if;
  perform private.po_notify(v_po, 'supplier', 'purchase_order.submitted', 'New purchase order PO-' || v_po.number);
  return v_id;
end;
$$;

create or replace function public.decide_purchase_order(p_po uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_line record;
begin
  select * into v_po from public.purchase_orders where id = p_po for update;
  if not found or not private.has_organization_permission(v_po.supplier_org_id, 'orders.manage') then
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  if v_po.status <> 'submitted' then
    perform private.raise_app_error('invalid_transition', 'Only new orders can be accepted or rejected.');
  end if;
  if p_decision = 'accepted' then
    -- Lock the products so concurrent acceptances can't oversell.
    for v_line in select l.product_id, l.quantity, l.product_name from public.purchase_order_lines l where l.purchase_order_id = p_po
                  order by l.product_id loop
      perform 1 from public.products where id = v_line.product_id for update;
      if private.product_available(v_line.product_id) < v_line.quantity then
        perform private.raise_app_error('insufficient_stock', 'Not enough stock for ' || v_line.product_name || '.');
      end if;
    end loop;
    update public.purchase_orders set status = 'accepted', accepted_at = now(), supplier_notes = coalesce(p_note, supplier_notes) where id = p_po
    returning * into v_po;
    perform private.po_notify(v_po, 'buyer', 'purchase_order.accepted', 'PO-' || v_po.number || ' accepted');
  elsif p_decision = 'rejected' then
    if coalesce(btrim(p_note), '') = '' then
      perform private.raise_app_error('invalid_input', 'Give the buyer a reason.');
    end if;
    update public.purchase_orders set status = 'rejected', decision_reason = p_note, closed_at = now() where id = p_po
    returning * into v_po;
    perform private.po_notify(v_po, 'buyer', 'purchase_order.rejected', 'PO-' || v_po.number || ' rejected');
  else
    perform private.raise_app_error('invalid_input', 'Unknown decision.');
  end if;
end;
$$;

create or replace function public.ship_purchase_order(p_po uuid, p_courier text, p_tracking text, p_scheduled_for date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_line record;
begin
  select * into v_po from public.purchase_orders where id = p_po for update;
  if not found or not private.has_organization_permission(v_po.supplier_org_id, 'orders.manage') then
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  if v_po.status <> 'accepted' then
    perform private.raise_app_error('invalid_transition', 'Only accepted orders can be shipped.');
  end if;
  for v_line in select * from public.purchase_order_lines where purchase_order_id = p_po loop
    insert into public.stock_movements (organization_id, product_id, quantity, reason, note, purchase_order_id, idempotency_key)
    values (v_po.supplier_org_id, v_line.product_id, -v_line.quantity, 'fulfillment', 'PO-' || v_po.number, p_po, 'po:' || p_po || ':' || v_line.id)
    on conflict (organization_id, idempotency_key) do nothing;
  end loop;
  update public.purchase_orders set status = 'shipped', shipped_at = now() where id = p_po returning * into v_po;
  insert into public.deliveries (purchase_order_id, supplier_org_id, buyer_org_id, courier, tracking_ref, scheduled_for)
  values (p_po, v_po.supplier_org_id, v_po.buyer_org_id, coalesce(p_courier, ''), coalesce(p_tracking, ''), p_scheduled_for);
  perform private.po_notify(v_po, 'buyer', 'purchase_order.shipped', 'PO-' || v_po.number || ' is on the way');
end;
$$;

-- Delivery updates: the supplier records delivered/failed/re-attempt; the buyer may confirm receipt.
create or replace function public.update_delivery(p_po uuid, p_status text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_d public.deliveries%rowtype;
  v_side text;
begin
  select * into v_po from public.purchase_orders where id = p_po for update;
  if not found then
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  if private.has_organization_permission(v_po.supplier_org_id, 'orders.manage') then
    v_side := 'supplier';
  elsif private.has_organization_permission(v_po.buyer_org_id, 'purchasing.manage') then
    v_side := 'buyer';
  else
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  select * into v_d from public.deliveries where purchase_order_id = p_po for update;
  if v_po.status <> 'shipped' or not found then
    perform private.raise_app_error('invalid_transition', 'This order is not out for delivery.');
  end if;
  if p_status = 'delivered' and (v_d.status = 'out_for_delivery' or v_side = 'buyer') then
    update public.deliveries set status = 'delivered', delivered_at = now(), received_by = nullif(btrim(coalesce(p_detail, '')), '') where id = v_d.id;
    update public.purchase_orders set status = 'delivered', delivered_at = now(), closed_at = now() where id = p_po returning * into v_po;
    perform private.po_notify(v_po, case when v_side = 'buyer' then 'supplier' else 'buyer' end, 'purchase_order.delivered', 'PO-' || v_po.number || ' delivered');
  elsif v_side = 'supplier' and p_status = 'failed' and v_d.status = 'out_for_delivery' then
    if coalesce(btrim(p_detail), '') = '' then
      perform private.raise_app_error('invalid_input', 'Say why the delivery failed.');
    end if;
    update public.deliveries set status = 'failed', failure_reason = p_detail where id = v_d.id;
    perform private.po_notify(v_po, 'buyer', 'purchase_order.delivery_failed', 'Delivery of PO-' || v_po.number || ' failed');
  elsif v_side = 'supplier' and p_status = 'out_for_delivery' and v_d.status = 'failed' then
    update public.deliveries set status = 'out_for_delivery', attempts = attempts + 1, failure_reason = null where id = v_d.id;
  else
    perform private.raise_app_error('invalid_transition', 'That delivery update is not allowed.');
  end if;
end;
$$;

create or replace function public.cancel_purchase_order(p_po uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_side text;
begin
  select * into v_po from public.purchase_orders where id = p_po for update;
  if not found then
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  if private.has_organization_permission(v_po.buyer_org_id, 'purchasing.manage') then
    v_side := 'buyer';
  elsif private.has_organization_permission(v_po.supplier_org_id, 'orders.manage') then
    v_side := 'supplier';
  else
    perform private.raise_app_error('not_found', 'Purchase order not found.');
  end if;
  if v_po.status not in ('submitted', 'accepted') then
    perform private.raise_app_error('invalid_transition', 'Shipped or closed orders can''t be cancelled.');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    perform private.raise_app_error('invalid_input', 'Give a reason for cancelling.');
  end if;
  -- Cancelling releases any reservation automatically (reserved counts accepted orders only).
  update public.purchase_orders set status = 'cancelled', cancelled_by = v_side, decision_reason = p_reason, closed_at = now()
  where id = p_po returning * into v_po;
  perform private.po_notify(v_po, case when v_side = 'buyer' then 'supplier' else 'buyer' end, 'purchase_order.cancelled', 'PO-' || v_po.number || ' cancelled');
end;
$$;

-- Notification category for supply orders.
alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('bills', 'assets', 'pets', 'vehicles', 'bookings', 'projects', 'orders', 'account'));
alter table public.notification_preferences drop constraint notification_preferences_category_check;
alter table public.notification_preferences add constraint notification_preferences_category_check
  check (category in ('bills', 'assets', 'pets', 'vehicles', 'bookings', 'projects', 'orders', 'account'));
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
    when 'dispute' then 'bookings'
    when 'project' then 'projects'
    when 'change_order' then 'projects'
    when 'purchase_order' then 'orders'
    else 'account' end;
$$;

-- -----------------------------------------------------------------------------
-- Workers: job location and completion evidence
-- -----------------------------------------------------------------------------
-- Job address for the assigned worker or the dispatcher (booking or project property).
create or replace function public.work_order_location(p_work_order uuid)
returns table (property_name text, address_line text, barangay text, city_municipality text, province text, postal_code text, notes text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.address_line, p.barangay, p.city_municipality, p.province, p.postal_code, p.notes
  from public.work_orders w
  left join public.bookings b on b.id = w.booking_id
  left join public.projects pr on pr.id = w.project_id
  join public.properties p on p.id = coalesce(b.property_id, pr.property_id)
  where w.id = p_work_order
    and (private.has_organization_permission(w.organization_id, 'work_orders.manage') or private.is_assigned_worker(w.id));
$$;

-- Completing a job needs evidence (completion notes or an after/evidence photo). The assignment stays
-- active after completion so the worker keeps access to their job history; cancellation releases it.
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
  if p_status = 'completed' and coalesce(btrim(p_notes), '') = ''
     and not exists (select 1 from public.files where entity_type = 'work_order' and entity_id = p_work_order and purpose in ('after_photo', 'evidence')) then
    perform private.raise_app_error('evidence_required', 'Add completion notes or an "after" photo before completing the job.');
  end if;
  update public.work_orders set status = p_status, completion_notes = coalesce(p_notes, completion_notes),
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_work_order;
  if p_status = 'cancelled' then
    update public.work_order_assignments set active = false, unassigned_at = now() where work_order_id = p_work_order and active;
  end if;
  if v_wo.booking_id is not null and p_status = 'in_progress' then
    update public.bookings set status = 'in_progress' where id = v_wo.booking_id and status = 'confirmed';
  elsif v_wo.booking_id is not null and p_status = 'completed' then
    update public.bookings set status = 'completed', completed_at = now() where id = v_wo.booking_id and status in ('confirmed', 'in_progress');
    perform private.log_booking_event(v_wo.booking_id, 'provider', 'complete', 'in_progress', 'completed', jsonb_build_object('work_order_id', p_work_order));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reporting
-- -----------------------------------------------------------------------------
create or replace function public.provider_financial_summary(p_org uuid, p_months integer default 6)
returns table (month date, completed_jobs integer, job_value_centavos bigint, projects_completed integer, project_value_centavos bigint,
               purchases_centavos bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_organization_permission(p_org, 'finance.view') then
    perform private.raise_app_error('forbidden', 'You cannot view this business''s finances.');
  end if;
  return query
  with months as (
    select (date_trunc('month', (now() at time zone 'Asia/Manila'))::date - make_interval(months => g))::date as m
    from generate_series(0, least(greatest(p_months, 1), 24) - 1) g
  )
  select mo.m,
    (select count(*)::integer from public.bookings b where b.organization_id = p_org and b.status = 'completed'
       and date_trunc('month', b.completed_at at time zone 'Asia/Manila')::date = mo.m),
    (select coalesce(sum(b.agreed_amount_centavos), 0)::bigint from public.bookings b where b.organization_id = p_org and b.status = 'completed'
       and date_trunc('month', b.completed_at at time zone 'Asia/Manila')::date = mo.m),
    (select count(*)::integer from public.projects p where p.organization_id = p_org and p.status = 'completed'
       and date_trunc('month', p.completed_at at time zone 'Asia/Manila')::date = mo.m),
    (select coalesce(sum(p.contract_amount_centavos + p.approved_changes_centavos), 0)::bigint from public.projects p
       where p.organization_id = p_org and p.status = 'completed' and date_trunc('month', p.completed_at at time zone 'Asia/Manila')::date = mo.m),
    (select coalesce(sum(o.total_centavos), 0)::bigint from public.purchase_orders o where o.buyer_org_id = p_org and o.status = 'delivered'
       and date_trunc('month', o.delivered_at at time zone 'Asia/Manila')::date = mo.m)
  from months mo
  order by mo.m;
end;
$$;

create or replace function public.supplier_report(p_org uuid, p_months integer default 6)
returns table (month date, orders_received integer, orders_delivered integer, orders_cancelled integer, revenue_centavos bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_organization_permission(p_org, 'finance.view') or private.organization_kind(p_org) <> 'supplier' then
    perform private.raise_app_error('forbidden', 'You cannot view this supplier''s reports.');
  end if;
  return query
  with months as (
    select (date_trunc('month', (now() at time zone 'Asia/Manila'))::date - make_interval(months => g))::date as m
    from generate_series(0, least(greatest(p_months, 1), 24) - 1) g
  )
  select mo.m,
    (select count(*)::integer from public.purchase_orders o where o.supplier_org_id = p_org and date_trunc('month', o.submitted_at at time zone 'Asia/Manila')::date = mo.m),
    (select count(*)::integer from public.purchase_orders o where o.supplier_org_id = p_org and o.status = 'delivered'
       and date_trunc('month', o.delivered_at at time zone 'Asia/Manila')::date = mo.m),
    (select count(*)::integer from public.purchase_orders o where o.supplier_org_id = p_org and o.status in ('cancelled', 'rejected')
       and date_trunc('month', o.closed_at at time zone 'Asia/Manila')::date = mo.m),
    (select coalesce(sum(o.total_centavos), 0)::bigint from public.purchase_orders o where o.supplier_org_id = p_org and o.status = 'delivered'
       and date_trunc('month', o.delivered_at at time zone 'Asia/Manila')::date = mo.m)
  from months mo
  order by mo.m;
end;
$$;

create or replace function public.supplier_top_products(p_org uuid, p_limit integer default 5)
returns table (product_id uuid, product_name text, quantity numeric, revenue_centavos bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_organization_permission(p_org, 'finance.view') then
    perform private.raise_app_error('forbidden', 'You cannot view this supplier''s reports.');
  end if;
  return query
  select l.product_id, max(l.product_name), sum(l.quantity), sum(l.line_total_centavos)::bigint
  from public.purchase_order_lines l join public.purchase_orders o on o.id = l.purchase_order_id
  where o.supplier_org_id = p_org and o.status = 'delivered'
  group by l.product_id
  order by 4 desc
  limit least(greatest(p_limit, 1), 20);
end;
$$;

-- -----------------------------------------------------------------------------
-- Disputes
-- -----------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  raised_by uuid references auth.users (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 2000),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  assigned_to uuid references auth.users (id) on delete set null,
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index disputes_one_open_per_booking on public.disputes (booking_id) where status in ('open', 'under_review');
create trigger disputes_updated_at before update on public.disputes for each row execute function private.set_updated_at();

-- A customer reporting a problem with a completed job opens a dispute automatically.
create or replace function private.open_dispute_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'completion_disputed' then
    insert into public.disputes (booking_id, household_id, organization_id, raised_by, reason)
    values (new.booking_id, new.household_id, new.organization_id, new.actor_id, coalesce(new.payload ->> 'note', ''))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger booking_events_dispute after insert on public.booking_events for each row execute function private.open_dispute_from_event();

create or replace function public.admin_update_dispute(p_dispute uuid, p_action text, p_resolution text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.disputes%rowtype;
begin
  if not private.has_platform_permission('platform.disputes.manage') then
    perform private.raise_app_error('forbidden', 'You cannot manage disputes.');
  end if;
  select * into v_d from public.disputes where id = p_dispute for update;
  if not found then
    perform private.raise_app_error('not_found', 'Dispute not found.');
  end if;
  if p_action = 'take' and v_d.status in ('open', 'under_review') then
    update public.disputes set status = 'under_review', assigned_to = auth.uid() where id = p_dispute;
  elsif p_action in ('resolved', 'dismissed') and v_d.status in ('open', 'under_review') then
    if coalesce(btrim(p_resolution), '') = '' then
      perform private.raise_app_error('invalid_input', 'Write the outcome for both parties.');
    end if;
    update public.disputes set status = p_action, resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now() where id = p_dispute;
    perform private.notify_household(v_d.household_id, 'services.view', 'dispute.' || p_action, 'Your reported problem was ' || p_action,
      p_resolution, '/app/h/' || v_d.household_id || '/bookings/' || v_d.booking_id, 'dispute:' || p_dispute || ':' || p_action);
    perform private.notify_organization(v_d.organization_id, 'bookings.view', 'dispute.' || p_action, 'A customer dispute was ' || p_action,
      p_resolution, '/provider/o/' || v_d.organization_id || '/bookings/' || v_d.booking_id, 'dispute:' || p_dispute || ':' || p_action);
  else
    perform private.raise_app_error('invalid_transition', 'That dispute action is not allowed.');
  end if;
  perform private.write_audit('platform.dispute_' || p_action, 'dispute', p_dispute, v_d.household_id, v_d.organization_id,
    jsonb_build_object('resolution', p_resolution));
end;
$$;

-- -----------------------------------------------------------------------------
-- Platform settings
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key in ('maintenance_banner', 'urgent_stale_hours', 'support_email')),
  value jsonb not null,
  description text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value, description) values
  ('maintenance_banner', '""', 'Message shown at the top of every portal (empty = hidden)'),
  ('urgent_stale_hours', '24', 'Hours after which provider availability is flagged as possibly out of date'),
  ('support_email', '"support@bahayplus.ph"', 'Support address shown to users');

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  if not private.has_platform_permission('platform.settings.manage') then
    perform private.raise_app_error('forbidden', 'You cannot change platform settings.');
  end if;
  select value into v_old from public.platform_settings where key = p_key for update;
  if not found then
    perform private.raise_app_error('not_found', 'Unknown setting.');
  end if;
  if (p_key = 'urgent_stale_hours' and (jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 1 and 168))
     or (p_key = 'maintenance_banner' and (jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 300))
     or (p_key = 'support_email' and (jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')) then
    perform private.raise_app_error('invalid_input', 'That value isn''t valid for this setting.');
  end if;
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  perform private.write_audit('platform.setting_changed', 'platform_setting', null, null, null,
    jsonb_build_object('key', p_key, 'from', v_old, 'to', p_value));
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: organizations, users, categories, audit (all audited, all permission-checked)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_organizations(p_search text default null, p_kind text default null, p_status text default null,
                                                           p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, slug text, kind text, status text, created_at timestamptz, member_count integer,
               verification_status text, verified_until date, listed boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.access') then
    perform private.raise_app_error('forbidden', 'Platform access required.');
  end if;
  return query
  select o.id, o.name, o.slug, o.kind, o.status, o.created_at,
         (select count(*)::integer from public.organization_members m where m.organization_id = o.id and m.status = 'active'),
         (select v.status from public.verification_requests v where v.organization_id = o.id order by v.created_at desc limit 1),
         (select v.expires_on from public.verification_requests v where v.organization_id = o.id and v.status = 'approved' order by v.created_at desc limit 1),
         case when o.kind = 'service_provider' then private.is_listed_provider(o.id) else private.is_listed_supplier(o.id) end
  from public.organizations o
  where (nullif(btrim(p_search), '') is null or o.name ilike '%' || btrim(p_search) || '%' or o.slug ilike '%' || btrim(p_search) || '%')
    and (p_kind is null or o.kind = p_kind) and (p_status is null or o.status = p_status)
  order by o.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_set_organization_status(p_org uuid, p_status text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.organizations.manage') then
    perform private.raise_app_error('forbidden', 'You cannot change organization status.');
  end if;
  if p_status not in ('active', 'suspended') then
    perform private.raise_app_error('invalid_input', 'Choose active or suspended.');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    perform private.raise_app_error('invalid_input', 'A reason is required.');
  end if;
  update public.organizations set status = p_status where id = p_org;
  if not found then
    perform private.raise_app_error('not_found', 'Organization not found.');
  end if;
  perform private.write_audit('platform.organization_' || case when p_status = 'active' then 'reinstated' else 'suspended' end,
    'organization', p_org, null, p_org, jsonb_build_object('reason', p_reason));
end;
$$;

-- User directory for support. Restricted: no household or business content, and support staff see
-- masked email addresses (only holders of platform.users.manage see them in full).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, full_name text, email text, created_at timestamptz, last_sign_in_at timestamptz, suspended boolean,
               household_count integer, organization_count integer, platform_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full boolean := private.has_platform_permission('platform.users.manage');
begin
  if not private.has_platform_permission('platform.users.view') then
    perform private.raise_app_error('forbidden', 'You cannot view users.');
  end if;
  return query
  select u.id, coalesce(p.full_name, ''),
         case when v_full then u.email::text else regexp_replace(u.email::text, '^(.).*(@.*)$', '\1•••\2') end,
         u.created_at, u.last_sign_in_at, coalesce(u.banned_until > now(), false),
         (select count(*)::integer from public.household_members m where m.user_id = u.id and m.status = 'active'),
         (select count(*)::integer from public.organization_members m where m.user_id = u.id and m.status = 'active'),
         (select r.key from public.platform_admins a join public.roles r on r.id = a.role_id where a.user_id = u.id)
  from auth.users u left join public.profiles p on p.id = u.id
  where nullif(btrim(p_search), '') is null
     or (v_full and u.email ilike '%' || btrim(p_search) || '%') or p.full_name ilike '%' || btrim(p_search) || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_set_user_suspension(p_user uuid, p_suspend boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.users.manage') then
    perform private.raise_app_error('forbidden', 'You cannot suspend users.');
  end if;
  if p_user = auth.uid() then
    perform private.raise_app_error('invalid_input', 'You cannot suspend your own account.');
  end if;
  if exists (select 1 from public.platform_admins where user_id = p_user) and not private.has_platform_permission('platform.admins.manage') then
    perform private.raise_app_error('forbidden', 'Platform admin accounts can only be changed by an admin manager.');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    perform private.raise_app_error('invalid_input', 'A reason is required.');
  end if;
  update auth.users set banned_until = case when p_suspend then 'infinity'::timestamptz else null end where id = p_user;
  if not found then
    perform private.raise_app_error('not_found', 'User not found.');
  end if;
  if p_suspend then
    -- End existing sessions so the suspension takes effect immediately.
    delete from auth.sessions where user_id = p_user;
  end if;
  perform private.write_audit(case when p_suspend then 'platform.user_suspended' else 'platform.user_reinstated' end, 'user', p_user, null, null,
    jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_save_service_category(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
begin
  if not private.has_platform_permission('platform.categories.manage') then
    perform private.raise_app_error('forbidden', 'You cannot manage service categories.');
  end if;
  if v_id is null then
    insert into public.service_categories (division, slug, name, description, urgent_eligible, sort_order, is_active)
    values (p_payload ->> 'division', p_payload ->> 'slug', p_payload ->> 'name', coalesce(p_payload ->> 'description', ''),
            coalesce((p_payload ->> 'urgent_eligible')::boolean, false), coalesce((p_payload ->> 'sort_order')::smallint, 100),
            coalesce((p_payload ->> 'is_active')::boolean, true))
    returning id into v_id;
    perform private.write_audit('platform.category_created', 'service_category', v_id, null, null, p_payload);
  else
    update public.service_categories set
      name = coalesce(p_payload ->> 'name', name),
      description = coalesce(p_payload ->> 'description', description),
      urgent_eligible = coalesce((p_payload ->> 'urgent_eligible')::boolean, urgent_eligible),
      sort_order = coalesce((p_payload ->> 'sort_order')::smallint, sort_order),
      is_active = coalesce((p_payload ->> 'is_active')::boolean, is_active)
    where id = v_id;
    if not found then
      perform private.raise_app_error('not_found', 'Category not found.');
    end if;
    perform private.write_audit('platform.category_updated', 'service_category', v_id, null, null, p_payload);
  end if;
  return v_id;
exception when unique_violation then
  perform private.raise_app_error('conflict', 'A category with this slug already exists.');
  return null;
end;
$$;

create or replace function public.admin_audit_log(p_action text default null, p_from date default null, p_to date default null,
                                                  p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, occurred_at timestamptz, actor_id uuid, actor_name text, actor_type text, action text, target_type text,
               target_id uuid, household_id uuid, organization_id uuid, metadata jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.audit.view') then
    perform private.raise_app_error('forbidden', 'You cannot view the audit log.');
  end if;
  return query
  select a.id, a.occurred_at, a.actor_id, coalesce(p.full_name, ''), a.actor_type, a.action, a.target_type, a.target_id,
         a.household_id, a.organization_id, a.metadata
  from public.audit_logs a left join public.profiles p on p.id = a.actor_id
  where (nullif(btrim(p_action), '') is null or a.action like btrim(p_action) || '%')
    and (p_from is null or a.occurred_at >= private.manila_at(p_from, 0))
    and (p_to is null or a.occurred_at < private.manila_at(p_to + 1, 0))
  order by a.occurred_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_platform_permission('platform.access') then
    perform private.raise_app_error('forbidden', 'Platform access required.');
  end if;
  return jsonb_build_object(
    'pending_verifications', (select count(*) from public.verification_requests where status in ('submitted', 'under_review')),
    'open_disputes', (select count(*) from public.disputes where status in ('open', 'under_review')),
    'organizations', (select count(*) from public.organizations),
    'suspended_organizations', (select count(*) from public.organizations where status = 'suspended'),
    'users', (select count(*) from auth.users),
    'failed_deliveries_7d', (select count(*) from public.notification_deliveries where status = 'failed' and updated_at > now() - interval '7 days'));
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.supplier_profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.deliveries enable row level security;
alter table public.disputes enable row level security;
alter table public.platform_settings enable row level security;

-- Published suppliers are visible to signed-in users (directory); members see their own.
create policy supplier_profiles_select on public.supplier_profiles for select to authenticated
  using ((select private.is_organization_member(organization_id)) or is_published);
create policy supplier_profiles_update on public.supplier_profiles for update to authenticated
  using ((select private.has_organization_permission(organization_id, 'catalog.manage')))
  with check ((select private.has_organization_permission(organization_id, 'catalog.manage')));
create policy organizations_supplier_select on public.organizations for select to authenticated
  using (kind = 'supplier' and (select private.is_listed_supplier(id)));

-- Buyers see a listed supplier's active products and prices; stock levels stay private to the supplier.
create policy products_select on public.products for select to authenticated
  using ((select private.is_organization_member(organization_id)) or (is_active and (select private.is_listed_supplier(organization_id))));
create policy products_insert on public.products for insert to authenticated
  with check ((select private.has_organization_permission(organization_id, 'catalog.manage')));
create policy products_update on public.products for update to authenticated
  using ((select private.has_organization_permission(organization_id, 'catalog.manage')))
  with check ((select private.has_organization_permission(organization_id, 'catalog.manage')));
create policy products_delete on public.products for delete to authenticated
  using ((select private.has_organization_permission(organization_id, 'catalog.manage')));

create policy stock_movements_select on public.stock_movements for select to authenticated
  using ((select private.has_organization_permission(organization_id, 'catalog.manage'))
         or (select private.has_organization_permission(organization_id, 'orders.view')));

create policy purchase_orders_select on public.purchase_orders for select to authenticated
  using ((select private.has_organization_permission(supplier_org_id, 'orders.view'))
         or (select private.has_organization_permission(buyer_org_id, 'purchasing.manage')));
create policy purchase_order_lines_select on public.purchase_order_lines for select to authenticated
  using (exists (select 1 from public.purchase_orders o where o.id = purchase_order_id));
create policy deliveries_select on public.deliveries for select to authenticated
  using ((select private.has_organization_permission(supplier_org_id, 'orders.view'))
         or (select private.has_organization_permission(buyer_org_id, 'purchasing.manage')));

create policy disputes_select on public.disputes for select to authenticated
  using ((select private.has_household_permission(household_id, 'services.view'))
         or (select private.has_organization_permission(organization_id, 'bookings.view'))
         or (select private.has_platform_permission('platform.access')));

create policy platform_settings_select on public.platform_settings for select to authenticated using (true);
-- Platform staff may read a booking (and its timeline) only when it is under dispute.
create policy bookings_disputed_platform_select on public.bookings for select to authenticated
  using ((select private.has_platform_permission('platform.access'))
         and exists (select 1 from public.disputes d where d.booking_id = bookings.id));
create policy booking_events_disputed_platform_select on public.booking_events for select to authenticated
  using ((select private.has_platform_permission('platform.access'))
         and exists (select 1 from public.disputes d where d.booking_id = booking_events.booking_id));

revoke insert, update, delete on public.stock_movements, public.purchase_orders, public.purchase_order_lines, public.deliveries,
  public.disputes, public.platform_settings from authenticated;
revoke insert, delete on public.supplier_profiles from authenticated;
revoke update on public.supplier_profiles from authenticated;
grant update (description, phone, email, address, delivery_areas, min_order_centavos, is_published) on public.supplier_profiles to authenticated;
revoke update on public.products from authenticated;
grant update (sku, name, description, category, unit, unit_price_centavos, reorder_level, is_active) on public.products to authenticated;

-- Admins can read verification requests already (Phase 6). Grants for commands:
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.record_stock_movement(uuid, numeric, text, text, text)',
    'public.create_purchase_order(jsonb)',
    'public.decide_purchase_order(uuid, text, text)',
    'public.ship_purchase_order(uuid, text, text, date)',
    'public.update_delivery(uuid, text, text)',
    'public.cancel_purchase_order(uuid, text)',
    'public.work_order_location(uuid)',
    'public.provider_financial_summary(uuid, integer)',
    'public.supplier_report(uuid, integer)',
    'public.supplier_top_products(uuid, integer)',
    'public.admin_update_dispute(uuid, text, text)',
    'public.admin_update_setting(text, jsonb)',
    'public.admin_list_organizations(text, text, text, integer, integer)',
    'public.admin_set_organization_status(uuid, text, text)',
    'public.admin_list_users(text, integer, integer)',
    'public.admin_set_user_suspension(uuid, boolean, text)',
    'public.admin_save_service_category(jsonb)',
    'public.admin_audit_log(text, date, date, integer, integer)',
    'public.admin_overview()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

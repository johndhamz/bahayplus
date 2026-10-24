# 04 · Data Model

This is the **target** entity model across all phases. Each phase creates only the tables it needs, via migrations. Columns shown are the structurally important ones, not exhaustive.

## Conventions

| Topic          | Rule                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys           | `id uuid primary key default gen_random_uuid()`                                                                                                                                 |
| Tenancy        | Tenant-owned rows carry `household_id` **or** `organization_id` (`not null`), indexed, used by RLS                                                                              |
| Timestamps     | `created_at timestamptz not null default now()`, `updated_at` via trigger; `created_by uuid references profiles` where useful                                                   |
| Soft delete    | `archived_at timestamptz` for user-facing records (pets, assets, vehicles); hard delete only for drafts                                                                         |
| Money          | `<name>_centavos bigint not null check (>= 0)` + `currency char(3) not null default 'PHP' check (currency = 'PHP')`. Never `numeric` floats in TS; never `real`/`double` in SQL |
| Dates          | Calendar facts (`due_on`, `birth_date`, `expires_on`) are `date`, interpreted in `Asia/Manila`. Instants are `timestamptz` (UTC)                                                |
| Enums          | Postgres `text` + `check` constraint (easier migrations than native enums), mirrored as Zod enums in contracts                                                                  |
| Addresses      | PSGC-based: `region_code`, `province_code`, `city_municipality_code`, `barangay_code` + `street_line`, `postal_code`, optional `location geography(Point)` (PostGIS)            |
| Schemas        | `public` = API-exposed tables with RLS. `private` = audit log, outbox, jobs, idempotency, helper functions — not exposed via PostgREST                                          |
| Sensitive data | Government ID numbers, account numbers stored masked + encrypted where retained (pgsodium/Vault or app-level), with retention policy                                            |

## Identity & tenancy

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1"
  PROFILES ||--o{ HOUSEHOLD_MEMBERS : has
  PROFILES ||--o{ ORGANIZATION_MEMBERS : has
  PROFILES ||--o| PLATFORM_ADMINS : "may be"
  HOUSEHOLDS ||--o{ HOUSEHOLD_MEMBERS : grants
  HOUSEHOLDS ||--o{ HOUSEHOLD_INVITATIONS : issues
  HOUSEHOLDS ||--o{ HOUSEHOLD_PEOPLE : includes
  HOUSEHOLDS ||--o{ PROPERTIES : owns
  HOUSEHOLD_PEOPLE |o--o| PROFILES : "optionally linked"
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : employs
  ORGANIZATIONS ||--o{ ORGANIZATION_LOCATIONS : operates

  PROFILES {
      uuid id PK "= auth.users.id"
      text display_name
      text phone
      text locale
  }
  HOUSEHOLDS {
      uuid id PK
      text name
      uuid created_by
  }
  HOUSEHOLD_MEMBERS {
      uuid household_id FK
      uuid user_id FK
      text role FK
  }
  HOUSEHOLD_PEOPLE {
      uuid id PK
      uuid household_id FK
      text full_name
      text relationship
      date birth_date
      uuid user_id FK "nullable"
  }
  PROPERTIES {
      uuid id PK
      uuid household_id FK
      text kind
      text label
      psgc address
      geography location
  }
  ORGANIZATIONS {
      uuid id PK
      text kind "service_provider|supplier"
      text slug
      text status
  }
  ORGANIZATION_MEMBERS {
      uuid organization_id FK
      uuid user_id FK
      text role
  }
  PLATFORM_ADMINS {
      uuid user_id PK
      text level
  }
```

Role definitions: `roles`, `permissions`, `role_permissions` (seeded reference data, read-only to users).

**Key distinction:** `household_people` are the _people in the home_ (kids, elderly parents, kasambahay, driver) who may never log in; `household_members` are _user accounts with access_. A person can be linked to a profile when they get an account.

## Household registry (assets, pets, vehicles)

```mermaid
erDiagram
  HOUSEHOLDS ||--o{ ASSETS : registers
  PROPERTIES ||--o{ ASSETS : "located at"
  ASSETS ||--o{ ASSET_SERVICE_RECORDS : has
  HOUSEHOLDS ||--o{ PETS : has
  PETS ||--o{ PET_HEALTH_RECORDS : has
  HOUSEHOLDS ||--o{ VEHICLES : has
  VEHICLES ||--o{ VEHICLE_SERVICE_RECORDS : has
  FILES }o--|| HOUSEHOLDS : "scoped to"

  ASSETS {
      uuid id PK
      uuid household_id FK
      uuid property_id FK
      text category
      text brand
      text model
      text serial_number
      date purchased_on
      date warranty_expires_on
      bigint purchase_price_centavos
  }
  PETS {
      uuid id PK
      uuid household_id FK
      text name
      text species
      text breed
      date birth_date
  }
  PET_HEALTH_RECORDS {
      uuid id PK
      uuid pet_id FK
      text kind "vaccination|vet_visit|deworming|grooming"
      date occurred_on
      date next_due_on
  }
  VEHICLES {
      uuid id PK
      uuid household_id FK
      text plate_number
      text make
      text model
      date registration_expires_on
      date insurance_expires_on
  }
  FILES {
      uuid id PK
      text bucket
      text object_path
      uuid household_id FK
      uuid organization_id FK
      text purpose
  }
```

Attachments use a single `files` table (metadata for Storage objects) plus per-module link tables (e.g. `asset_files`). This is **not** a standalone Digital Home Vault — files exist only attached to approved records.

## Bills, budgeting, calendar

```mermaid
erDiagram
  BILLERS ||--o{ BILL_ACCOUNTS : "billed by"
  HOUSEHOLDS ||--o{ BILL_ACCOUNTS : holds
  PROPERTIES |o--o{ BILL_ACCOUNTS : "service address"
  BILL_ACCOUNTS ||--o{ BILLS : receives
  BILLS ||--o{ BILL_PAYMENT_RECORDS : "paid via (recorded)"
  HOUSEHOLDS ||--o{ BUDGETS : plans
  BUDGETS ||--o{ BUDGET_LINES : contains
  EXPENSE_CATEGORIES ||--o{ BUDGET_LINES : targets
  HOUSEHOLDS ||--o{ EXPENSES : records
  EXPENSE_CATEGORIES ||--o{ EXPENSES : classifies
  HOUSEHOLDS ||--o{ CALENDAR_ITEMS : shows
  HOUSEHOLDS ||--o{ REMINDERS : schedules
  REMINDERS ||--o{ REMINDER_OCCURRENCES : materializes

  BILLERS {
      uuid id PK
      text name
      text category "electricity|water|internet|..."
  }
  BILL_ACCOUNTS {
      uuid id PK
      uuid household_id FK
      uuid biller_id FK
      text account_number_masked
      text nickname
  }
  BILLS {
      uuid id PK
      uuid bill_account_id FK
      uuid household_id FK
      bigint amount_due_centavos
      date due_on
      text status
  }
  BILL_PAYMENT_RECORDS {
      uuid id PK
      uuid bill_id FK
      bigint amount_centavos
      date paid_on
      text method
      text reference
  }
  BUDGETS {
      uuid id PK
      uuid household_id FK
      date period_start
      text period "monthly"
  }
  BUDGET_LINES {
      uuid budget_id FK
      uuid category_id FK
      bigint limit_centavos
  }
  EXPENSES {
      uuid id PK
      uuid household_id FK
      bigint amount_centavos
      date spent_on
      uuid category_id FK
      text source_type
      uuid source_id
      text idempotency_key
  }
  CALENDAR_ITEMS {
      uuid id PK
      uuid household_id FK
      text source_type
      uuid source_id
      timestamptz starts_at
      date all_day_on
      text title
  }
  REMINDERS {
      uuid id PK
      uuid household_id FK
      text rrule
      text timezone "Asia/Manila"
      text source_type
      uuid source_id
  }
  REMINDER_OCCURRENCES {
      uuid reminder_id FK
      timestamptz due_at
      text status "unique(reminder_id,due_at)"
  }
```

- `bill_payment_records` **record** payments made elsewhere (e.g. via GCash or at a payment centre). Direct utility payment is not approved.
- `expenses.source_type/source_id` trace derived expenses back to bills or work orders; `unique(household_id, idempotency_key)` prevents duplicate derivation.
- `reminder_occurrences` unique key makes reminder delivery idempotent.

## Marketplace, trust, service orders, dispatch, projects

```mermaid
erDiagram
  SERVICE_CATEGORIES ||--o{ SERVICE_CATEGORIES : "parent of"
  ORGANIZATIONS ||--o{ PROVIDER_SERVICES : offers
  SERVICE_CATEGORIES ||--o{ PROVIDER_SERVICES : classifies
  ORGANIZATIONS ||--o{ SERVICE_AREAS : covers
  ORGANIZATIONS ||--o{ VERIFICATION_REQUESTS : submits
  VERIFICATION_REQUESTS ||--o{ VERIFICATION_DOCUMENTS : includes
  HOUSEHOLDS ||--o{ SERVICE_REQUESTS : raises
  PROPERTIES ||--o{ SERVICE_REQUESTS : "at"
  SERVICE_REQUESTS ||--o{ QUOTATIONS : receives
  ORGANIZATIONS ||--o{ QUOTATIONS : issues
  QUOTATIONS ||--o{ QUOTATION_LINES : itemizes
  QUOTATIONS ||--o| BOOKINGS : "accepted as"
  BOOKINGS ||--o{ APPOINTMENTS : schedules
  BOOKINGS ||--o{ WORK_ORDERS : executes
  WORK_ORDERS ||--o{ WORK_ORDER_ASSIGNMENTS : "assigned to"
  ORGANIZATION_MEMBERS ||--o{ WORK_ORDER_ASSIGNMENTS : performs
  WORK_ORDERS ||--o{ WORK_ORDER_EVENTS : logs
  BOOKINGS ||--o| REVIEWS : "reviewed by"
  HOUSEHOLDS ||--o{ URGENT_REQUESTS : broadcasts
  URGENT_REQUESTS ||--o{ URGENT_OFFERS : receives
  URGENT_OFFERS |o--o| BOOKINGS : "converts to"
  HOUSEHOLDS ||--o{ PROJECTS : commissions
  PROJECTS ||--o{ PROJECT_MILESTONES : phases
  PROJECTS ||--o{ CHANGE_ORDERS : amends
  PROJECTS ||--o{ BOOKINGS : "contracted via"

  PROVIDER_SERVICES {
      uuid organization_id FK
      uuid category_id FK
      text pricing_basis "fixed|hourly|inspection|quote"
      bigint base_price_centavos
  }
  SERVICE_AREAS {
      uuid organization_id FK
      text city_municipality_code
      geography coverage
  }
  VERIFICATION_REQUESTS {
      uuid id PK
      uuid organization_id FK
      text status
      text level
  }
  SERVICE_REQUESTS {
      uuid id PK
      uuid household_id FK
      uuid property_id FK
      uuid category_id FK
      text status
      text description
  }
  QUOTATIONS {
      uuid id PK
      uuid service_request_id FK
      uuid organization_id FK
      int version
      bigint total_centavos
      timestamptz valid_until
      text status
  }
  BOOKINGS {
      uuid id PK
      uuid household_id FK
      uuid organization_id FK
      uuid quotation_id FK
      text status
      bigint agreed_total_centavos
  }
  WORK_ORDERS {
      uuid id PK
      uuid booking_id FK
      uuid organization_id FK
      text status
  }
  WORK_ORDER_EVENTS {
      uuid work_order_id FK
      text kind
      timestamptz occurred_at
      geography location
  }
  URGENT_REQUESTS {
      uuid id PK
      uuid household_id FK
      uuid category_id FK
      geography location
      timestamptz expires_at
      text status
  }
  REVIEWS {
      uuid booking_id PK
      uuid household_id FK
      uuid organization_id FK
      smallint rating
  }
```

**Cross-tenant records.** Bookings, quotations and work orders are shared between a household and an organization. Both IDs are on the row; RLS grants each side access according to its own role. Customer contact details and exact address are disclosed to the provider **only after** a booking is confirmed (privacy by design).

**State machines** live in the domain layer, are mirrored by `check` constraints, and transitions are validated in application services (not by arbitrary `update`). For example `bookings.status`: `pending_confirmation → confirmed → in_progress → completed | cancelled | disputed`.

## Supply & logistics

```mermaid
erDiagram
  ORGANIZATIONS ||--o{ PRODUCTS : sells
  ORGANIZATIONS ||--o{ STOCK_LOCATIONS : stores
  PRODUCTS ||--o{ STOCK_MOVEMENTS : moves
  STOCK_LOCATIONS ||--o{ STOCK_MOVEMENTS : "in/out"
  ORGANIZATIONS ||--o{ PURCHASE_ORDERS : "buyer org"
  PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_LINES : contains
  PRODUCTS ||--o{ PURCHASE_ORDER_LINES : ordered
  PURCHASE_ORDERS ||--o{ DELIVERIES : fulfilled_by

  PRODUCTS {
      uuid id PK
      uuid organization_id FK
      text sku
      text name
      text unit
      bigint unit_price_centavos
  }
  STOCK_MOVEMENTS {
      uuid id PK
      uuid product_id FK
      uuid location_id FK
      numeric quantity
      text reason
      text idempotency_key
  }
  PURCHASE_ORDERS {
      uuid id PK
      uuid supplier_org_id FK
      uuid buyer_org_id FK
      text status
      bigint total_centavos
  }
  DELIVERIES {
      uuid id PK
      uuid purchase_order_id FK
      text status
      timestamptz scheduled_at
  }
```

Stock is a **ledger** (`stock_movements`); on-hand quantity is a derived view/materialized summary, never an editable number.

## Platform tables (`private` schema)

| Table                                                                | Purpose                                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_logs` (public, admin-read only; inserts via definer function) | Append-only: `actor_id`, `action`, `target_type/id`, `household_id/organization_id`, `diff jsonb`, `request_id`, `ip_hash`, `occurred_at` |
| `outbox`                                                             | Domain events: `id`, `type`, `payload`, `occurred_at`, `dispatched_at`, `attempts`                                                        |
| `idempotency_keys`                                                   | `key`, `actor_id`, `scope`, `request_hash`, `response jsonb`, `expires_at`; unique `(actor_id, scope, key)`                               |
| `job_runs` / pgmq queues                                             | Durable jobs, attempts, dead letters                                                                                                      |
| `notifications` (public, RLS by recipient)                           | In-app notification inbox                                                                                                                 |

## Payments and the future wallet

```mermaid
erDiagram
  PAYMENT_INTENTS ||--o{ PAYMENT_EVENTS : "state history"
  BOOKINGS |o--o{ PAYMENT_INTENTS : "paid by"
  PAYMENT_INTENTS {
      uuid id PK
      text provider "manual|<psp>|<wallet-partner>"
      text status
      bigint amount_centavos
      char currency "PHP"
      text external_ref
      text idempotency_key
  }
  PAYMENT_EVENTS {
      uuid id PK
      uuid payment_intent_id FK
      text kind
      jsonb provider_payload
      timestamptz occurred_at
  }
```

```ts
// src/platform/payments/ports.ts (shape, not final)
export interface PaymentGateway {
  readonly provider: string;
  createIntent(input: {
    amount: Money;
    reference: string;
    idempotencyKey: string;
  }): Promise<Result<IntentRef, PaymentError>>;
  getStatus(ref: IntentRef): Promise<Result<PaymentStatus, PaymentError>>;
  refund(input: { ref: IntentRef; amount: Money; idempotencyKey: string }): Promise<Result<RefundRef, PaymentError>>;
  verifyWebhook(req: Request): Promise<Result<PaymentEvent, PaymentError>>;
}
```

The wallet, when approved, is implemented **by the licensed partner**; Bahay+ stores only references and statuses, never balances of record. No wallet tables exist until approval.

# 05 · Authentication & Authorization

## Authentication

| Item                | Decision                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider            | Supabase Auth via `@supabase/ssr` (cookie sessions for web)                                                                                          |
| Methods (Phase 1–2) | Email + password, email OTP / magic link. **Phone OTP** and Google sign-in planned — needs SMS provider decision ([09](./09-risks-and-decisions.md)) |
| Session refresh     | `src/proxy.ts` (Next.js proxy, formerly middleware) refreshes the session cookie and gates portal routes                                             |
| Server identity     | Always `supabase.auth.getUser()` / `getClaims()` (verified), never `getSession()` alone on the server                                                |
| Mobile (future)     | Supabase Auth in the app; calls `/api/v1/*` with `Authorization: Bearer <access_token>`                                                              |
| Profile             | `profiles` row created by an `after insert on auth.users` trigger                                                                                    |
| Hardening           | Rate-limit auth endpoints, leaked-password protection, email confirmation required, MFA (TOTP) required for platform admins                          |

## Authorization model

Authorization is **contextual**: a permission is evaluated against a _context_ (one household or one organization), never globally — except for platform admins.

```
User ──< household_members (role)      >── Household
User ──< organization_members (role)   >── Organization (service_provider | supplier)
User ──  platform_admins (level)                    Platform
```

### Roles and permissions are data

Roles and permissions live in tables — `roles(scope, key)`, `permissions(key, scope)`, `role_permissions(role_id, permission_id)` — seeded by migration. There is **no global role column** on profiles; authority always comes from a membership row in a specific household or organization.

### Household roles

| Role key  | Intent                                                                    | Default permissions (summary)                                                       |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `owner`   | Household head(s); at least one must always exist                         | everything, incl. delete household, manage owners                                   |
| `manager` | Spouse / trusted adult                                                    | manage non-owner members & invitations, properties, all household data              |
| `member`  | Family member                                                             | view household, edit household records                                              |
| `limited` | Tenant, kasambahay, driver, caregiver — "limited member where applicable" | view household basics and items shared with them; no finances, no member management |
| `guest`   | Temporary / read-only (e.g. relative abroad)                              | view household basics only                                                          |

### Organization roles

| Role key  | Provider / supplier portal                 | Worker portal             |
| --------- | ------------------------------------------ | ------------------------- |
| `owner`   | full, incl. ownership transfer, delete org | —                         |
| `manager` | manage members (non-owner), operations     | —                         |
| `staff`   | view, day-to-day edits                     | —                         |
| `worker`  | —                                          | only assigned work orders |

A field worker is an `organization_member` with role `worker`; the `/worker` portal lists work across every org where they hold that role.

### Privilege rules (enforced in SQL _and_ services)

- Nobody can grant a role higher than their own; only owners grant/revoke `owner`.
- Members cannot update their own `role` (only `manage_members` holders can, subject to the rule above).
- The last `owner` of a household/organization cannot be removed, demoted or leave.
- Revocation deletes the membership row; RLS reads membership on every query, so access ends immediately.
- Invitations are single-use, expiring, bound to an email address, stored as a **SHA-256 hash** of the token, and accepted via a `security definer` function that checks expiry, status and email match atomically.

### Platform admins

`platform_admins` table (not JWT `user_metadata`, which users can edit). Levels: `support` (read + limited actions), `operations` (verification decisions, catalog), `super_admin`. All admin actions are audited; MFA required.

## Enforcement layers (defence in depth)

| Layer                     | Responsibility                                                                                      | Fails how                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1. `proxy.ts`             | Is there a session? Coarse portal gate (redirect to `/login?next=…`)                                | Redirect                       |
| 2. Portal layout (server) | Resolve user's memberships; 404 if the URL context isn't theirs; 403 page if no role for the portal | `notFound()` / forbidden page  |
| 3. Application service    | `authorize(ctx, 'bills.write')` before every command; business rules (e.g. last owner can't leave)  | `Result.err(Forbidden)`        |
| 4. Postgres RLS           | Tenant isolation backstop on every `public` table, **including** reads                              | Row invisible / write rejected |
| 5. Storage RLS            | Bucket path prefix must match a context the user can access                                         | 403                            |

Layer 3 gives good error messages; layer 4 guarantees that a bug in layer 3 cannot leak another tenant's data. Neither replaces the other.

## RLS strategy

- RLS **enabled on every `public` table** — a CI check fails the build if any table lacks it.
- Policies call `security definer` helper functions in the `private` schema, with `set search_path = ''`:

```sql
create function private.has_household_permission(p_household uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household
      and m.user_id = (select auth.uid())
      and private.role_has_permission('household', m.role, p_permission)
  );
$$;

create policy bills_select on public.bills for select to authenticated
  using ( (select private.has_household_permission(household_id, 'household.read')) );
```

- Wrap `auth.uid()` in `(select …)` so Postgres evaluates it once per statement; index `(user_id, household_id)` on membership tables.
- Cross-tenant tables (bookings, quotations, work orders) have **separate** policies for the household side and the organization side.
- Field workers see `work_orders` only via `work_order_assignments.user_id = auth.uid()`.
- **Service role** is used only by: job runner, admin-console operations that must cross tenants, and migrations. The admin client module begins with `import 'server-only'`, and the key is never prefixed `NEXT_PUBLIC_`.

## Context resolution

```ts
type RequestContext = {
  requestId: string;
  actor: { userId: string; isPlatformAdmin: boolean };
  tenant:
    | { kind: "household"; householdId: string; permissions: ReadonlySet<Permission> }
    | { kind: "organization"; organizationId: string; orgKind: "service_provider" | "supplier"; role: OrgRole }
    | { kind: "platform" }
    | { kind: "none" };
  db: SupabaseClient<Database>; // user-scoped (RLS applies)
};
```

Built once per request by `platform/auth` from the URL segment, cached with React `cache()` in server components.

## Sensitive-action audit list

Always audited: sign-in anomalies, role changes, member invite/remove, ownership transfer, verification decisions, payment record create/void, booking cancellation, admin impersonation/support access, data export, account deletion.

## Privacy (RA 10173 — Data Privacy Act)

- Collect minimum data; explicit consent screens for sensitive personal information (government IDs for verification).
- Data subject rights: export and deletion flows (Phase "business ops").
- Supabase project in `ap-southeast-1` (Singapore) — cross-border transfer disclosed in privacy notice; confirm with counsel ([09](./09-risks-and-decisions.md)).

## Implementation notes (Phase 2)

| Concern            | Where                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema & RLS       | `supabase/migrations/20261025000100…000400_*.sql`                                                                                                                                                                                                                                                                                   |
| Membership writes  | Only through `SECURITY DEFINER` functions (`create_household`, `invite_household_member`, `accept_household_invitation`, `change_household_member_role`, `set_household_member_status`, `remove_household_member`, and the `*_organization_*` equivalents). Membership/invitation tables have **no** INSERT/UPDATE/DELETE policies. |
| Direct updates     | Column-level grants: users may update only `households.name`, `organizations.name`, display fields on `profiles`, and property fields. Status, ownership and audit columns are not writable.                                                                                                                                        |
| Escalation rules   | `private.assert_*_role_change`, mirrored for UI in `modules/authorization/domain/policy.ts`                                                                                                                                                                                                                                         |
| Last owner         | `BEFORE UPDATE OR DELETE` triggers — enforced for every writer, including the service role                                                                                                                                                                                                                                          |
| Invitations        | 32-byte random token returned once; only its SHA-256 hash is stored (and not selectable via the API); single use; 7-day expiry; bound to the invited email and requires a verified email                                                                                                                                            |
| Platform admins    | `platform_admins` rows are inserted server-side only (SQL / service role); no API write path exists; grants and revocations are audited                                                                                                                                                                                             |
| Audit              | `public.audit_logs` is append-only (triggers block UPDATE/DELETE/TRUNCATE, including for the service role); readable only with `platform.audit.view`                                                                                                                                                                                |
| Context resolution | `apps/web/lib/auth/context.ts` → `requireHouseholdAccess` / `requireOrganizationAccess` / `requirePlatformAccess`; failures render 404                                                                                                                                                                                              |
| Email links        | Token-hash templates in `supabase/templates/*` → `/auth/confirm` (works across devices). Hosted projects must use the same templates.                                                                                                                                                                                               |

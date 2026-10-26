# Admin two-step verification (MFA)

Platform admins (`public.platform_admins`) must verify an authenticator app (TOTP) every time they sign in before the admin portal opens. This closes security finding S-02.

## How it works

- **App:** `/admin` checks the session's assurance level. A password-only (`aal1`) session is redirected to `/mfa`. First-time admins scan a QR code (or type the setup key) into an authenticator app and confirm with a code; later sign-ins only ask for a code. Non-admins get a 404 at `/mfa` as well as at `/admin`.
- **Database (the actual boundary):** `private.platform_role_id()` returns a role only when the JWT has `aal = 'aal2'` (migration `20261025001500_admin_mfa.sql`). Every platform permission check goes through it, so RLS policies and `admin_*` functions refuse an `aal1` session even when someone calls the Data API directly with a stolen password.
- **Supabase Auth:** TOTP enroll and verify must be enabled (`[auth.mfa.totp]` in `supabase/config.toml` locally; on by default on hosted projects. Check with the Management API at `config/auth`, `mfa_totp_*`).
- **Throttling:** the app limits code attempts to 10 per 15 minutes per admin (`mfaVerifyByUser`), on top of Supabase Auth's own limits.

## First sign-in for a new admin

1. Grant the role in SQL (as today).
2. The admin signs in and opens `/admin`. They're sent to **Two-step verification** → **Set up authenticator app**.
3. They scan the QR code with Google Authenticator, Microsoft Authenticator, 1Password or similar, then enter the 6-digit code.

## An admin lost their phone

There are no recovery codes. Another person with database access removes the factor; the admin then enrolls a new one on their next sign-in.

```sql
-- Supabase SQL editor (production/staging). Confirm the person's identity out of band first.
delete from auth.mfa_factors
where user_id = (select id from auth.users where email = 'admin@example.com') and factor_type = 'totp';
```

Record why in the incident log. Removing the factor does not end existing sessions; to force a sign-out as well, use **Authentication → Users → … → Sign out user** in the dashboard.

## Local development and tests

- The seeded demo admin (`admin@bahayplus.test`) has a verified authenticator with the **public, local-only** setup key `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`. Add it to an authenticator app to sign in locally. It is never seeded outside local and CI databases.
- E2E tests compute codes with `tests/support/totp.ts` (`loginAsAdmin`, `passMfa`); integration and security tests upgrade admin sessions with `verifySecondFactor()`.

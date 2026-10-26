-- Admin MFA (security finding S-02): platform admin powers require a session verified with a
-- second factor (Supabase Auth TOTP, JWT claim aal = 'aal2'). A password-only session keeps its
-- platform_admins row (so the app can send the admin to the MFA step) but holds no permissions,
-- whether the request comes from the app or straight from the Data API.

create or replace function private.session_is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- Every platform permission check (has_platform_permission → role_has_permission) resolves the
-- role through this function, so gating it here gates RLS policies and admin functions alike.
create or replace function private.platform_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select role_id from public.platform_admins
  where user_id = (select auth.uid()) and (select private.session_is_aal2());
$$;

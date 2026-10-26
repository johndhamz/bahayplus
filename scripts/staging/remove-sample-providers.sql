-- Removes the staging sample providers created by sample-providers.sql (cascades to their profiles,
-- services, areas and verifications). Run before a real beta.
--
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/staging/remove-sample-providers.sql
delete from public.organizations where id::text like '70000000-0000-4000-8000-%';

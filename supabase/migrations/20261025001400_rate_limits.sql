-- =============================================================================
-- Phase 11 (security finding S-01): application rate limiting.
-- Auth runs in server actions, so Supabase Auth sees the server's IP; per-client limits are applied
-- here instead (keyed by client IP and by account), before calling Auth. Fixed windows, server-only.
-- =============================================================================

create table private.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);

-- Returns true while the caller is within `p_limit` hits for the current window.
create or replace function public.consume_rate_limit(p_bucket text, p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  v_hits integer;
begin
  insert into private.rate_limits (bucket, key, window_start, hits)
  values (left(p_bucket, 60), left(p_key, 200), v_window, 1)
  on conflict (bucket, key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;
-- Server only: exposing it would let anyone exhaust another client's quota.
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

select cron.schedule('bahayplus-rate-limit-cleanup', '17 * * * *', $$delete from private.rate_limits where window_start < now() - interval '1 day'$$);

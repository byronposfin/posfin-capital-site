-- DO NOT APPLY.
-- The login calls pipeline.staff_caller() with the user's own session.
-- Apply this only if PostgREST does not expose the pipeline schema and the
-- call returns schema_pending. It does not grant SELECT on the allowlist
-- and it does not load cases.

create or replace function public.staff_caller()
returns table (email text, seat_code text, role text)
language sql
stable
security definer
set search_path = pipeline, auth
as $$
  select email, seat_code, role from pipeline.staff_caller();
$$;

revoke all on function public.staff_caller() from public, anon;
grant execute on function public.staff_caller() to authenticated;

comment on function public.staff_caller() is
  'Wrapper so authenticated staff can call pipeline.staff_caller() without exposing the pipeline schema. DO NOT APPLY unless the direct RPC is unavailable.';

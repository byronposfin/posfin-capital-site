-- DO NOT APPLY.
-- Byron's go is required before this is run on any Supabase project,
-- including the main project vgflcrfaudrvrdmxjdtl and the SmartLink project.
-- Additive only. No deletes, no updates of case rows, no data load.
--
-- What Byron does after approving this file:
-- 1. Apply it on the main project.
-- 2. In Supabase Auth, invite each verified seat by email. Each person sets their own password.
--    Do not share one password. Do not invite an address that is not in pipeline.staff_allowlist.
-- 3. Set the Production env vars named in the pull request. Leave EL_LOR_LIVE_SENDS unset or off.
-- 4. Set STAFF_AUTH_MODE=supabase. That switch refuses the shared preview password on Production.

create table if not exists pipeline.staff_allowlist (
  email text primary key,
  seat_code text not null,
  role text not null,
  active boolean not null default true,
  invited_at timestamptz,
  constraint staff_allowlist_email_check check (email = lower(email) and email ~* '^[^@[:space:]]+@posfincapital\.com$'),
  constraint staff_allowlist_role_check check (role in ('principal', 'case_owner')),
  constraint staff_allowlist_seat_check check (seat_code in ('byron', 'chris', 'jess', 'aadi', 'cai'))
);

alter table pipeline.staff_allowlist enable row level security;
alter table pipeline.staff_allowlist force row level security;
revoke all on table pipeline.staff_allowlist from public, anon, authenticated;

-- Cai is not inserted. sql/20261120_lead_ops_v1.sql left that mailbox null.
insert into pipeline.staff_allowlist (email, seat_code, role)
values
  ('byron.hill@posfincapital.com', 'byron', 'principal'),
  ('chris.shipton@posfincapital.com', 'chris', 'case_owner'),
  ('jessica@posfincapital.com', 'jess', 'case_owner'),
  ('aadi@posfincapital.com', 'aadi', 'case_owner')
on conflict (email) do nothing;

-- The email claim comes from auth.users, not from editable user_metadata.
create or replace function pipeline.staff_caller()
returns table (email text, seat_code text, role text)
language sql
stable
security definer
set search_path = pipeline, auth
as $$
  select a.email, a.seat_code, a.role
    from pipeline.staff_allowlist a
   where a.active
     and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

revoke all on function pipeline.staff_caller() from public, anon;
grant execute on function pipeline.staff_caller() to authenticated;

create or replace function pipeline.staff_case_register()
returns setof pipeline.case_register
language plpgsql
stable
security definer
set search_path = pipeline, auth
as $$
begin
  if not exists (select 1 from pipeline.staff_caller()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from pipeline.case_register;
end
$$;

revoke all on function pipeline.staff_case_register() from public, anon;
grant execute on function pipeline.staff_case_register() to authenticated;

comment on table pipeline.staff_allowlist is
  'One row per staff seat. Invite that email in Supabase Auth and let them set a unique password. DO NOT APPLY until Byron says so.';

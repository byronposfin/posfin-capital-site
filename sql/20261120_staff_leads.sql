-- Staff leads desk. Additive only: a nullable stage, an append-only activity log,
-- and a staff check that tightens existing authenticated access. No deletes,
-- no dropped or renamed columns, and no rewrite of existing lead rows.
-- Authorised by Byron Hill for the live project vgflcrfaudrvrdmxjdtl.

create schema if not exists staff_private;
revoke all on schema staff_private from public, anon, authenticated;
grant usage on schema staff_private to authenticated, service_role;

create or replace function staff_private.is_posfin_staff(p_email text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crm_users u
    where lower(u.email) = lower(btrim(coalesce(p_email, '')))
      and lower(u.email) ~ '^[^@[:space:]]+@posfincapital\.com$'
  );
$$;

revoke all on function staff_private.is_posfin_staff(text) from public, anon, authenticated, service_role;
grant execute on function staff_private.is_posfin_staff(text) to authenticated, service_role;

alter table public.leads add column if not exists stage text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_stage_check' and conrelid = 'public.leads'::regclass) then
    alter table public.leads
      add constraint leads_stage_check
      check (stage is null or stage in ('Pre-LOR', 'LOR', 'EL Offered', 'EL Signed', 'Completed', 'Dead'));
  end if;
end $$;

comment on column public.leads.stage is
  'Staff deal stage. Null until a member of staff sets it. Existing rows are not backfilled.';

create index if not exists leads_live_book_created_idx
  on public.leads (created_at desc)
  where source is distinct from 'facebook_archived';

create table if not exists public.lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  created_at timestamptz not null default now(),
  actor_email text not null,
  kind text not null check (kind in ('note', 'status', 'assigned_to', 'stage')),
  body text,
  field text,
  old_value text,
  new_value text,
  check (kind <> 'note' or (body is not null and length(btrim(body)) > 0)),
  check (actor_email ~ '^[^@[:space:]]+@posfincapital\.com$')
);

create index if not exists lead_activity_lead_created_idx
  on public.lead_activity (lead_id, created_at desc);

comment on table public.lead_activity is
  'Append-only staff notes and field changes for a lead. Rows are never updated or deleted.';

alter table public.lead_activity enable row level security;
alter table public.lead_activity force row level security;

revoke all on table public.lead_activity from public, anon, authenticated, service_role;
grant select, insert on table public.lead_activity to authenticated, service_role;

drop policy if exists lead_activity_staff_read on public.lead_activity;
create policy lead_activity_staff_read
  on public.lead_activity
  for select
  to authenticated
  using (staff_private.is_posfin_staff((select auth.email())));

drop policy if exists lead_activity_staff_insert on public.lead_activity;
create policy lead_activity_staff_insert
  on public.lead_activity
  for insert
  to authenticated
  with check (
    staff_private.is_posfin_staff((select auth.email()))
    and lower(actor_email) = lower((select auth.email()))
  );

create or replace function staff_private.reject_lead_activity_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'lead_activity is append-only';
end;
$$;

revoke all on function staff_private.reject_lead_activity_mutation() from public, anon, authenticated, service_role;
grant execute on function staff_private.reject_lead_activity_mutation() to authenticated, service_role;

drop trigger if exists lead_activity_append_only on public.lead_activity;
create trigger lead_activity_append_only
  before update or delete on public.lead_activity
  for each row execute function staff_private.reject_lead_activity_mutation();

-- Existing permissive policies grant every authenticated user full access.
-- These restrictive policies keep anon denied and require a Posfin staff email
-- that is already on crm_users. Service role bypasses RLS, as before.
drop policy if exists leads_require_posfin_staff on public.leads;
create policy leads_require_posfin_staff
  on public.leads
  as restrictive
  for all
  to authenticated
  using (staff_private.is_posfin_staff((select auth.email())))
  with check (staff_private.is_posfin_staff((select auth.email())));

drop policy if exists lead_status_history_require_posfin_staff on public.lead_status_history;
create policy lead_status_history_require_posfin_staff
  on public.lead_status_history
  as restrictive
  for all
  to authenticated
  using (staff_private.is_posfin_staff((select auth.email())))
  with check (staff_private.is_posfin_staff((select auth.email())));

create or replace function public.staff_list_live_leads()
returns table (
  id uuid,
  created_at timestamptz,
  full_name text,
  email text,
  phone text,
  status text,
  assigned_to text,
  source text,
  stage text,
  factfind_reference text,
  postcode text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    l.id,
    l.created_at,
    l.full_name,
    l.email,
    l.phone,
    l.status,
    l.assigned_to,
    l.source,
    l.stage,
    nullif(l.raw_answers->>'_factfind_reference', ''),
    nullif(btrim(coalesce(
      nullif(l.raw_answers->>'security_postcode', ''),
      substring(l.raw_answers->>'security_address' from '([A-Za-z]{1,2}[0-9][A-Za-z0-9]?[[:space:]]*[0-9][A-Za-z]{2})'),
      substring(l.registered_office_address from '([A-Za-z]{1,2}[0-9][A-Za-z0-9]?[[:space:]]*[0-9][A-Za-z]{2})')
    )), '')
  from public.leads l
  where l.source is distinct from 'facebook_archived'
  order by l.created_at desc
  limit 2000;
$$;

revoke all on function public.staff_list_live_leads() from public, anon, authenticated, service_role;
grant execute on function public.staff_list_live_leads() to authenticated, service_role;

create or replace function public.staff_apply_lead_change(
  p_lead_id uuid,
  p_actor text,
  p_status text default null,
  p_assigned_to text default null,
  p_stage text default null,
  p_note text default null,
  p_set_status boolean default false,
  p_set_assigned boolean default false,
  p_set_stage boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_actor text;
  v_status text;
  v_assigned text;
  v_stage text;
  v_note text;
  v_changed boolean := false;
begin
  if auth.role() = 'service_role' then
    v_actor := lower(btrim(coalesce(p_actor, '')));
  else
    v_actor := lower(btrim(coalesce(auth.email(), '')));
  end if;

  if not staff_private.is_posfin_staff(v_actor) then
    raise exception 'staff_actor_required';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'lead_not_found';
  end if;
  if v_lead.source = 'facebook_archived' then
    raise exception 'lead_archived';
  end if;

  if p_set_status then
    v_status := nullif(btrim(coalesce(p_status, '')), '');
    if v_status is distinct from v_lead.status then
      if v_status is null
        or length(v_status) > 80
        or v_status not in (
          'new', 'contacted', 'call_slot_selected',
          'statements_received', 'statements_reviewed', 'declined'
        )
      then
        raise exception 'bad_status';
      end if;
      insert into public.lead_activity (lead_id, actor_email, kind, field, old_value, new_value)
      values (v_lead.id, v_actor, 'status', 'status', v_lead.status, v_status);
      insert into public.lead_status_history (lead_id, old_status, new_status, changed_by)
      values (v_lead.id, v_lead.status, v_status, v_actor);
      update public.leads
      set status = v_status, updated_at = now()
      where id = v_lead.id;
      v_lead.status := v_status;
      v_changed := true;
    end if;
  end if;

  if p_set_assigned then
    v_assigned := nullif(btrim(coalesce(p_assigned_to, '')), '');
    if v_assigned is distinct from v_lead.assigned_to then
      if v_assigned is not null and (length(v_assigned) > 120 or v_assigned ~ '[[:cntrl:]]') then
        raise exception 'bad_assigned';
      end if;
      insert into public.lead_activity (lead_id, actor_email, kind, field, old_value, new_value)
      values (v_lead.id, v_actor, 'assigned_to', 'assigned_to', v_lead.assigned_to, v_assigned);
      update public.leads
      set assigned_to = v_assigned, updated_at = now()
      where id = v_lead.id;
      v_lead.assigned_to := v_assigned;
      v_changed := true;
    end if;
  end if;

  if p_set_stage then
    v_stage := nullif(btrim(coalesce(p_stage, '')), '');
    if v_stage is distinct from v_lead.stage then
      if v_stage is not null and v_stage not in ('Pre-LOR', 'LOR', 'EL Offered', 'EL Signed', 'Completed', 'Dead') then
        raise exception 'bad_stage';
      end if;
      insert into public.lead_activity (lead_id, actor_email, kind, field, old_value, new_value)
      values (v_lead.id, v_actor, 'stage', 'stage', v_lead.stage, v_stage);
      update public.leads
      set stage = v_stage, updated_at = now()
      where id = v_lead.id;
      v_changed := true;
    end if;
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null then
    if length(v_note) > 4000 then
      raise exception 'bad_note';
    end if;
    insert into public.lead_activity (lead_id, actor_email, kind, body)
    values (v_lead.id, v_actor, 'note', v_note);
    v_changed := true;
  end if;

  return jsonb_build_object('ok', true, 'changed', v_changed, 'id', v_lead.id);
end;
$$;

revoke all on function public.staff_apply_lead_change(uuid, text, text, text, text, text, boolean, boolean, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_apply_lead_change(uuid, text, text, text, text, text, boolean, boolean, boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';

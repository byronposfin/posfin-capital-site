-- Phase 1 BROKA bridge. Additive only.
-- Do not apply to production project vgflcrfaudrvrdmxjdtl.
-- Byron approves each apply. This script does not contact BROKA, a lender, or a borrower.
-- Existing pipeline.case_register audit trigger records the new broka_case_id column.
-- Row removal is not used. lender_responses.status is the record of a withdrawn approach.
-- A quick decline (response within 24 hours) is left out of the speed weight.
-- The remaining weights are scaled back onto 0-100: (0.40 * terms + 0.10 * completeness) / 0.50.

create schema if not exists pipeline;
create schema if not exists spine;

create table if not exists pipeline.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  action text not null,
  actor_uid uuid,
  actor_role text,
  db_role text not null default current_user,
  at timestamptz not null default now(),
  changed_cols text[],
  old_row jsonb,
  new_row jsonb,
  constraint audit_log_action_check check (action = any (array['INSERT', 'UPDATE']))
);

create table if not exists pipeline.case_register (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null unique,
  case_label text not null default '',
  created_at timestamptz not null default now()
);

alter table pipeline.case_register add column if not exists broka_case_id text;

create unique index if not exists case_register_broka_case_id_uidx
  on pipeline.case_register (broka_case_id)
  where broka_case_id is not null;

comment on column pipeline.case_register.broka_case_id is
  'BROKA case id already held for this case. Phase 1 copies it and does not mint a second one.';

create table if not exists pipeline.staff_seats (
  seat_code text primary key,
  display_name text not null,
  role text not null,
  active boolean not null default true
);

create table if not exists spine.broka_field_map (
  map_id text primary key default ('map_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  spine_key text not null unique,
  broka_key text,
  pipeline_v2_key text,
  required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into spine.broka_field_map (spine_key, broka_key, pipeline_v2_key, required, notes)
values
  ('date_of_birth', 'applicant.dob', 'date_of_birth', true, 'Required. Aliases: dob, borrower_dob, dateOfBirth.'),
  ('experience', 'applicant.experience', 'experience', true, 'Required. Alias: developer_experience.'),
  ('bedrooms', 'security.bedrooms', 'bedrooms', true, 'Required. Absent from the current web fact find until captured.'),
  ('rental_income', 'security.rental_income', 'rental_income', true, 'Required. Alias: rent.'),
  ('epc_rating', 'security.epc', 'epc_rating', true, 'Required. Prefill from epc_lookup or epcLookup when the fact find has no EPC.'),
  ('regulated', 'case.regulated', 'is_regulated', true, 'Staff regulated toggle. Stored on the job. Not written into a lender template from this phase.')
on conflict (spine_key) do nothing;

create table if not exists pipeline.broka_search_control (
  id boolean primary key default true check (id),
  standing_approval boolean not null default true,
  paused boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into pipeline.broka_search_control (id, standing_approval, paused)
values (true, true, false)
on conflict (id) do nothing;

comment on table pipeline.broka_search_control is
  'Standing approval for eligibility searches, with a pause switch. Default is standing approval on and pause off. Byron changes the row.';

create table if not exists pipeline.broka_jobs (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null,
  case_id uuid,
  broka_case_id text,
  seat_code text not null,
  status text not null,
  standing_approval boolean not null,
  paused boolean not null,
  regulated boolean,
  factfind_submitted boolean not null,
  preflight jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text,
  constraint broka_jobs_status_chk check (status = any (array['approved', 'awaiting_approval'])),
  constraint broka_jobs_preflight_obj check (jsonb_typeof(preflight) = 'object')
);

create index if not exists broka_jobs_case_ref_idx
  on pipeline.broka_jobs (case_ref, created_at desc);

comment on table pipeline.broka_jobs is
  'Eligibility job recorded inside Posfin. Opening a job does not contact BROKA.';

create table if not exists pipeline.broka_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references pipeline.broka_jobs(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text,
  created_at timestamptz not null default now(),
  constraint broka_job_events_type_chk check (event_type = any (array[
    'opened', 'awaiting_approval', 'approved_standing'
  ]))
);

create index if not exists broka_job_events_job_idx
  on pipeline.broka_job_events (job_id, created_at desc);

create table if not exists pipeline.placed_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references pipeline.broka_jobs(id),
  case_ref text not null,
  broka_case_id text,
  seat_code text not null,
  status text not null,
  called boolean not null default false,
  note text not null default 'Recorded inside Posfin. BROKA was not contacted.',
  created_at timestamptz not null default now(),
  constraint placed_runs_status_chk check (status = any (array['approved', 'awaiting_approval'])),
  constraint placed_runs_not_called_chk check (called = false)
);

create index if not exists placed_runs_job_idx on pipeline.placed_runs (job_id);

comment on table pipeline.placed_runs is
  'Desk record that a run was queued. called stays false in phase 1 because BROKA is not contacted.';

create table if not exists pipeline.lender_responses (
  id uuid primary key default gen_random_uuid(),
  lender text not null,
  case_ref text not null,
  broka_case_id text,
  job_id uuid references pipeline.broka_jobs(id),
  contact text,
  sent_at timestamptz,
  first_response_at timestamptz,
  response_type text,
  terms jsonb,
  speed_score numeric,
  terms_score numeric,
  completeness_score numeric,
  overall_score numeric,
  shortlist_rank integer,
  status text not null default 'prepared',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lender_responses_status_chk check (status = any (array[
    'prepared', 'recorded_sent', 'responded', 'declined', 'withdrawn'
  ])),
  constraint lender_responses_type_chk check (
    response_type is null or response_type = any (array['terms', 'decline', 'question', 'no_response', 'other'])
  ),
  constraint lender_responses_score_chk check (
    (speed_score is null or (speed_score >= 0 and speed_score <= 100))
    and (terms_score is null or (terms_score >= 0 and terms_score <= 100))
    and (completeness_score is null or (completeness_score >= 0 and completeness_score <= 100))
    and (overall_score is null or (overall_score >= 0 and overall_score <= 100))
  ),
  constraint lender_responses_rank_chk check (shortlist_rank is null or (shortlist_rank >= 1 and shortlist_rank <= 5))
);

create index if not exists lender_responses_lender_idx
  on pipeline.lender_responses (lender, case_ref);

comment on table pipeline.lender_responses is
  'One row per lender approach. status replaces removing a row. contact null means UNKNOWN. sent_at is a Byron stamp and is not an email send.';
comment on column pipeline.lender_responses.case_ref is
  'The case this response belongs to.';

create or replace view pipeline.lender_scorecard
with (security_invoker = true) as
select
  scored.lender,
  count(*)::bigint as approached,
  count(*) filter (
    where scored.terms is not null and scored.terms <> '{}'::jsonb
  )::bigint as known,
  (count(*) filter (
    where scored.terms is not null and scored.terms <> '{}'::jsonb
  ))::text || ' of ' || count(*)::text || ' known' as known_label,
  round(avg(scored.score), 2) as score,
  count(*) filter (where scored.quick_decline)::bigint as quick_declines,
  round(avg(scored.speed_score), 2) as avg_speed_score,
  round(avg(scored.terms_score), 2) as avg_terms_score,
  round(avg(scored.completeness_score), 2) as avg_completeness_score
from (
  select
    lender,
    terms,
    speed_score,
    terms_score,
    completeness_score,
    (
      response_type = 'decline'
      and sent_at is not null
      and first_response_at is not null
      and first_response_at <= sent_at + interval '24 hours'
    ) as quick_decline,
    case
      when response_type = 'decline'
        and sent_at is not null
        and first_response_at is not null
        and first_response_at <= sent_at + interval '24 hours'
      then (0.40 * coalesce(terms_score, 0) + 0.10 * coalesce(completeness_score, 0)) / 0.50
      else 0.50 * coalesce(speed_score, 0)
        + 0.40 * coalesce(terms_score, 0)
        + 0.10 * coalesce(completeness_score, 0)
    end as score
  from pipeline.lender_responses
  where status is distinct from 'withdrawn'
) scored
group by scored.lender;

comment on view pipeline.lender_scorecard is
  'Lender score is 50% speed, 40% terms, 10% completeness. A decline inside 24 hours is not penalised on speed.';

do $$
begin
  if to_regprocedure('pipeline.audit_row()') is null then
    execute $fn$
      create function pipeline.audit_row()
      returns trigger
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        v_old jsonb;
        v_new jsonb;
        v_cols text[];
      begin
        if tg_op = 'INSERT' then
          v_new := to_jsonb(new);
        elsif tg_op = 'UPDATE' then
          v_old := to_jsonb(old);
          v_new := to_jsonb(new);
        else
          raise exception 'audit_row supports insert and update only';
        end if;
        select array_agg(k order by k) into v_cols
        from (select jsonb_object_keys(coalesce(v_new, v_old)) as k) keys
        where tg_op <> 'UPDATE' or (v_old -> k) is distinct from (v_new -> k);
        insert into pipeline.audit_log (table_name, row_id, action, changed_cols, old_row, new_row)
        values (
          tg_table_schema || '.' || tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id'),
          tg_op,
          v_cols,
          v_old,
          v_new
        );
        return coalesce(new, old);
      end;
      $body$;
    $fn$;
  end if;
end $$;

do $$
begin
  if to_regprocedure('pipeline.has_role(text[])') is null then
    execute $fn$
      create function pipeline.has_role(roles text[])
      returns boolean
      language sql
      stable
      as $body$ select false $body$;
    $fn$;
  end if;
end $$;

do $$
declare
  item text;
begin
  foreach item in array array['broka_jobs', 'broka_job_events', 'placed_runs', 'lender_responses', 'broka_search_control']
  loop
    if not exists (
      select 1 from pg_trigger
      where tgname = item || '_audit' and not tgisinternal
    ) then
      execute format(
        'create trigger %I after insert or update on pipeline.%I for each row execute function pipeline.audit_row()',
        item || '_audit',
        item
      );
    end if;
  end loop;
end $$;

do $$
declare
  item text;
begin
  foreach item in array array['broka_jobs', 'broka_job_events', 'placed_runs', 'lender_responses', 'broka_search_control']
  loop
    execute format('alter table pipeline.%I enable row level security', item);
    execute format('alter table pipeline.%I force row level security', item);
    execute format('revoke all on pipeline.%I from public', item);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on pipeline.%I from anon', item);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on pipeline.%I from authenticated', item);
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_jobs' and policyname = 'broka_jobs_select') then
    execute 'create policy broka_jobs_select on pipeline.broka_jobs for select using (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'',''analyst'',''read_only'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_jobs' and policyname = 'broka_jobs_insert') then
    execute 'create policy broka_jobs_insert on pipeline.broka_jobs for insert with check (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_job_events' and policyname = 'broka_job_events_select') then
    execute 'create policy broka_job_events_select on pipeline.broka_job_events for select using (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'',''analyst'',''read_only'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_job_events' and policyname = 'broka_job_events_insert') then
    execute 'create policy broka_job_events_insert on pipeline.broka_job_events for insert with check (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'placed_runs' and policyname = 'placed_runs_select') then
    execute 'create policy placed_runs_select on pipeline.placed_runs for select using (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'',''analyst'',''read_only'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'placed_runs' and policyname = 'placed_runs_insert') then
    execute 'create policy placed_runs_insert on pipeline.placed_runs for insert with check (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'lender_responses' and policyname = 'lender_responses_select') then
    execute 'create policy lender_responses_select on pipeline.lender_responses for select using (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'',''analyst'',''read_only'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'lender_responses' and policyname = 'lender_responses_insert') then
    execute 'create policy lender_responses_insert on pipeline.lender_responses for insert with check (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'lender_responses' and policyname = 'lender_responses_update') then
    execute 'create policy lender_responses_update on pipeline.lender_responses for update using (pipeline.has_role(array[''principal''])) with check (pipeline.has_role(array[''principal'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_search_control' and policyname = 'broka_search_control_select') then
    execute 'create policy broka_search_control_select on pipeline.broka_search_control for select using (pipeline.has_role(array[''principal'',''crm_operator'',''case_owner'',''analyst'',''read_only'']))';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'pipeline' and tablename = 'broka_search_control' and policyname = 'broka_search_control_update') then
    execute 'create policy broka_search_control_update on pipeline.broka_search_control for update using (pipeline.has_role(array[''principal''])) with check (pipeline.has_role(array[''principal'']))';
  end if;
end $$;

create or replace function pipeline.broka_open_job(
  p_seat text,
  p_case_ref text,
  p_submitted boolean,
  p_regulated boolean,
  p_preflight jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat pipeline.staff_seats%rowtype;
  v_case_id uuid;
  v_broka text;
  v_standing boolean;
  v_paused boolean;
  v_status text;
  v_job pipeline.broka_jobs%rowtype;
  v_run pipeline.placed_runs%rowtype;
  v_any boolean;
  v_ok boolean;
begin
  if auth.role() is distinct from 'service_role' and auth.uid() is not null then
    if not exists (
      select 1
      from pipeline.staff_seats s
      join pipeline.staff st on st.seat_code = s.seat_code
      where st.user_id = auth.uid()
        and s.active
        and s.seat_code = p_seat
    ) then
      return jsonb_build_object('ok', false, 'error', 'seat');
    end if;
  end if;

  select * into v_seat
  from pipeline.staff_seats s
  where s.seat_code = p_seat and s.active;
  if v_seat.seat_code is null then
    return jsonb_build_object('ok', false, 'error', 'seat');
  end if;

  if p_submitted is distinct from true then
    return jsonb_build_object('ok', false, 'error', 'factfind');
  end if;

  select c.id, c.broka_case_id
    into v_case_id, v_broka
  from pipeline.case_register c
  where c.case_ref = p_case_ref;

  if to_regclass('pipeline.factfind_sessions') is not null and v_case_id is not null then
    execute 'select exists(select 1 from pipeline.factfind_sessions where case_id = $1)'
      into v_any using v_case_id;
    execute 'select exists(select 1 from pipeline.factfind_sessions where case_id = $1 and submitted_at is not null)'
      into v_ok using v_case_id;
    if v_any and not v_ok then
      return jsonb_build_object('ok', false, 'error', 'factfind');
    end if;
  end if;

  select standing_approval, paused
    into v_standing, v_paused
  from pipeline.broka_search_control
  where id = true;
  v_standing := coalesce(v_standing, false);
  v_paused := coalesce(v_paused, false);
  v_status := case when v_standing and not v_paused then 'approved' else 'awaiting_approval' end;

  insert into pipeline.broka_jobs (
    case_ref, case_id, broka_case_id, seat_code, status,
    standing_approval, paused, regulated, factfind_submitted, preflight, created_by
  ) values (
    p_case_ref, v_case_id, v_broka, v_seat.seat_code, v_status,
    v_standing, v_paused, p_regulated, true, coalesce(p_preflight, '{}'::jsonb), v_seat.seat_code
  ) returning * into v_job;

  insert into pipeline.placed_runs (job_id, case_ref, broka_case_id, seat_code, status, called)
  values (v_job.id, p_case_ref, v_broka, v_seat.seat_code, v_status, false)
  returning * into v_run;

  insert into pipeline.broka_job_events (job_id, event_type, payload, actor)
  values (
    v_job.id,
    case when v_status = 'approved' then 'approved_standing' else 'awaiting_approval' end,
    jsonb_build_object('broka_case_id', v_broka, 'paused', v_paused),
    v_seat.seat_code
  );

  return jsonb_build_object(
    'ok', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'case_ref', v_job.case_ref,
      'broka_case_id', v_job.broka_case_id,
      'status', v_job.status,
      'seat_code', v_job.seat_code,
      'regulated', v_job.regulated
    ),
    'placed_run', jsonb_build_object(
      'id', v_run.id,
      'job_id', v_run.job_id,
      'called', v_run.called,
      'status', v_run.status,
      'broka_case_id', v_run.broka_case_id
    )
  );
end;
$$;

revoke all on function pipeline.broka_open_job(text, text, boolean, boolean, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function pipeline.broka_open_job(text, text, boolean, boolean, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function pipeline.broka_open_job(text, text, boolean, boolean, jsonb) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function pipeline.broka_open_job(text, text, boolean, boolean, jsonb) to service_role;
  end if;
end $$;

comment on function pipeline.broka_open_job(text, text, boolean, boolean, jsonb) is
  'Inserts broka_jobs and placed_runs in one transaction. Copies an existing broka_case_id. Does not contact BROKA.';

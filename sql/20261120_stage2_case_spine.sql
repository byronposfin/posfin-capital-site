-- Stage-2 case spine. DO NOT APPLY to the live smartlink project.
-- Review only. The pilot in the cockpit is a fixture and does not
-- insert these rows. Apply only after Tom approves the schema.
--
-- Depends on sql/case_portal.sql for public.case_portal_session_ok.
-- Does not update case_portal or case_completion.
-- Does not read or write borrower tokens. Does not insert notifications.
-- Does not send a pack, an LOR, or a borrower link.
-- PC-004 must not be stored as the pilot. The pilot ref is POSFIN-WEB-EYCTQ6.
--
-- case_models is the reusable case-type template.
-- case_spine is one case instance: the eight canonical fields.
-- Waiting conditions are stored on the instance. Evaluating them is gated in
-- the application by STAGE2_WAITING_CONDITIONS_ENABLED, which defaults off.
-- This script does not turn that flag on.

create table if not exists public.case_models (
  model_id text primary key,
  title text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  constraint case_models_id_chk check (model_id ~ '^[a-z0-9_]{8,80}$')
);

create table if not exists public.case_spine (
  case_ref text primary key,
  model_id text not null references public.case_models(model_id),
  header jsonb not null,
  current_stage_id text not null,
  stage_label text not null,
  owners jsonb not null,
  due_time jsonb not null,
  evidence jsonb not null,
  waiting_conditions jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint case_spine_ref_chk check (case_ref ~ '^POSFIN-[A-Z0-9-]{4,40}$'),
  constraint case_spine_not_pc004 check (case_ref <> 'PC-004')
);

create table if not exists public.case_spine_actions (
  id text primary key,
  case_ref text not null references public.case_spine(case_ref) on delete cascade,
  position integer not null,
  title text not null,
  detail text,
  owner text not null,
  due_on date,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint case_spine_actions_owner_chk check (
    owner in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy')
  )
);

create table if not exists public.case_spine_audit (
  id bigint generated always as identity primary key,
  case_ref text not null,
  subject_id text not null,
  actor text not null,
  field_name text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  constraint case_spine_audit_actor_chk check (
    actor in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy')
  )
);

create index if not exists case_spine_actions_case_idx
  on public.case_spine_actions (case_ref, position);

create index if not exists case_spine_audit_case_idx
  on public.case_spine_audit (case_ref, created_at desc);

alter table public.case_models enable row level security;
alter table public.case_spine enable row level security;
alter table public.case_spine_actions enable row level security;
alter table public.case_spine_audit enable row level security;

revoke all on public.case_models from public, anon, authenticated;
revoke all on public.case_spine from public, anon, authenticated;
revoke all on public.case_spine_actions from public, anon, authenticated;
revoke all on public.case_spine_audit from public, anon, authenticated;

comment on table public.case_models is
  'Reusable Stage-2 case-type template: ordered stages, exit criteria, evidence checklist, SLA. Not a case.';
comment on table public.case_spine is
  'One case instance of a model. Eight fields: header, model link, stage, owners, actions live in case_spine_actions, due_time, evidence, waiting_conditions. Waiting evaluation stays behind STAGE2_WAITING_CONDITIONS_ENABLED.';
comment on table public.case_spine_actions is
  'Ordered next actions. Marking one done is a desk note. It does not send email or release a link.';
comment on table public.case_spine_audit is
  'Append-only spine history: actor, time, old value, new value.';

create or replace function public.case_spine_board(p_session text, p_case_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  spine public.case_spine%rowtype;
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  if p_case_ref = 'PC-004' then
    return jsonb_build_object('ok', false, 'error', 'wrong_case');
  end if;
  select * into spine from public.case_spine where case_ref = p_case_ref;
  if spine.case_ref is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object(
    'ok', true,
    'model', (select to_jsonb(m) from public.case_models m where m.model_id = spine.model_id),
    'spine', to_jsonb(spine),
    'actions', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.position)
      from public.case_spine_actions a
      where a.case_ref = spine.case_ref
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'actor', h.actor,
        'field', h.field_name,
        'old_value', h.old_value,
        'new_value', h.new_value,
        'at', h.created_at,
        'subject_id', h.subject_id
      ) order by h.created_at desc)
      from (
        select * from public.case_spine_audit
        where case_ref = spine.case_ref
        order by created_at desc
        limit 100
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.case_spine_board(text, text) from public;
grant execute on function public.case_spine_board(text, text) to anon, authenticated, service_role;

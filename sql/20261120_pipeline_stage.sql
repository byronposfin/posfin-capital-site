-- Deal-flow stage history. DO NOT APPLY to the production project
-- vgflcrfaudrvrdmxjdtl. This file does not alter public.leads or public.deals.
-- Existing rows stay as they are. The cockpit selects from them. It does not
-- delete or update them. Apply only on a non-production database after Tom reviews.

create table if not exists public.pipeline_stage (
  case_ref text primary key,
  stage text not null,
  substatus text,
  reason text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint pipeline_stage_name_chk check (stage in (
    'raw_lead', 'opener_sent', 'new_triage', 'contacting', 'fact_find',
    'lor_requested', 'el_issued', 'el_sent', 'el_signed', 'parked', 'completed'
  ))
);

create table if not exists public.pipeline_stage_history (
  id bigint generated always as identity primary key,
  case_ref text not null,
  from_stage text,
  to_stage text not null,
  moved_by text not null,
  moved_at timestamptz not null default now(),
  note text
);

create index if not exists pipeline_stage_history_case_idx
  on public.pipeline_stage_history (case_ref, moved_at desc);

alter table public.pipeline_stage enable row level security;
alter table public.pipeline_stage_history enable row level security;
revoke all on public.pipeline_stage from public, anon, authenticated;
revoke all on public.pipeline_stage_history from public, anon, authenticated;

comment on table public.pipeline_stage_history is
  'One row per move: from_stage, to_stage, moved_by, moved_at, note. Not a change to leads or deals.';

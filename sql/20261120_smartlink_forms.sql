-- SmartLink borrower forms. Additive only: new tables, no changes to existing data.
-- Checked 20 Nov 2026: public.leads, public.deals and pipeline.case_register have no
-- smart-link token column. spine.cases is keyed by case_id and spine.case_tokens stores
-- token_hash, not the raw token, so case_token cannot be a foreign key without blocking
-- links that are not already in that register. lead_id is an optional link to
-- public.leads and stays null until a token-to-lead map exists.
-- Written by server routes with the service role only. RLS on, no anon/authenticated policies.

create table if not exists public.case_assets_liabilities (
  id            uuid primary key default gen_random_uuid(),
  case_token    text not null unique,
  lead_id       uuid references public.leads(id) on delete set null,
  status        text not null default 'draft' check (status in ('draft','submitted')),
  version       integer not null default 1,
  step          integer not null default 0,
  payload       jsonb not null default '{}'::jsonb,
  derived       jsonb,
  crm_export    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table if not exists public.case_remortgage_questionnaire (
  id            uuid primary key default gen_random_uuid(),
  case_token    text not null unique,
  lead_id       uuid references public.leads(id) on delete set null,
  brand         text,
  status        text not null default 'draft' check (status in ('draft','submitted')),
  version       integer not null default 1,
  step          integer not null default 0,
  payload       jsonb not null default '{}'::jsonb,
  derived       jsonb,
  crm_export    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table if not exists public.case_schedule_of_works (
  id            uuid primary key default gen_random_uuid(),
  case_token    text not null unique,
  lead_id       uuid references public.leads(id) on delete set null,
  status        text not null default 'draft' check (status in ('draft','submitted')),
  version       integer not null default 1,
  step          integer not null default 0,
  payload       jsonb not null default '{}'::jsonb,
  derived       jsonb,
  crm_export    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

alter table public.case_assets_liabilities enable row level security;
alter table public.case_remortgage_questionnaire enable row level security;
alter table public.case_schedule_of_works enable row level security;

revoke all on table public.case_assets_liabilities from public, anon, authenticated;
revoke all on table public.case_remortgage_questionnaire from public, anon, authenticated;
revoke all on table public.case_schedule_of_works from public, anon, authenticated;

grant all on table public.case_assets_liabilities to service_role;
grant all on table public.case_remortgage_questionnaire to service_role;
grant all on table public.case_schedule_of_works to service_role;

create index if not exists case_al_status_idx on public.case_assets_liabilities (status, updated_at desc);
create index if not exists case_rq_status_idx on public.case_remortgage_questionnaire (status, updated_at desc);
create index if not exists case_sow_status_idx on public.case_schedule_of_works (status, updated_at desc);

comment on table public.case_schedule_of_works is 'SmartLink Schedule of Works. One row per link token. Service role only.';
comment on column public.case_remortgage_questionnaire.payload is 'Contains the nominated bank account. Sensitive. Service role only.';

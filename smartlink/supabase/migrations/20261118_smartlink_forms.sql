-- SUPERSEDED. Do not run. The applied migration is sql/20261120_smartlink_forms.sql (adds optional lead_id, revokes anon).
-- Posfin SmartLink borrower forms — v001 (18 Nov 2026)
-- One row per case token per form. payload = engine answers (jsonb); derived = server-computed totals;
-- crm_export = flat key/value answers for the CRM. Written by server routes with the service role only.
-- Assumes an existing cases table keyed by smart-link token; adjust the FK to Tom's schema
-- (e.g. smart_links.token or cases.case_token).

create table if not exists public.case_assets_liabilities (
  id            uuid primary key default gen_random_uuid(),
  case_token    text not null unique,            -- references public.cases(case_token)
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
  brand         text,                             -- general | ackroyds | <future firm>
  status        text not null default 'draft' check (status in ('draft','submitted')),
  version       integer not null default 1,
  step          integer not null default 0,
  payload       jsonb not null default '{}'::jsonb, -- contains nominated bank account (addition C): sensitive
  derived       jsonb,
  crm_export    jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz
);

create table if not exists public.case_schedule_of_works (
  id            uuid primary key default gen_random_uuid(),
  case_token    text not null unique,
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

-- Optional FKs once the cases table name is confirmed:
-- alter table public.case_assets_liabilities add constraint al_case_fk foreign key (case_token) references public.cases(case_token) on delete cascade;
-- alter table public.case_remortgage_questionnaire add constraint rq_case_fk foreign key (case_token) references public.cases(case_token) on delete cascade;
-- alter table public.case_schedule_of_works add constraint sow_case_fk foreign key (case_token) references public.cases(case_token) on delete cascade;

-- RLS on, no anon/authenticated policies: only the service role (server routes) reads/writes.
alter table public.case_assets_liabilities enable row level security;
alter table public.case_remortgage_questionnaire enable row level security;
alter table public.case_schedule_of_works enable row level security;

create index if not exists case_al_status_idx on public.case_assets_liabilities (status, updated_at desc);
create index if not exists case_rq_status_idx on public.case_remortgage_questionnaire (status, updated_at desc);
create index if not exists case_sow_status_idx on public.case_schedule_of_works (status, updated_at desc);

-- Posfin SmartLink: lender criteria intake, v001 (19 Nov 2026). NOT RUN. Review with Tom before applying.
-- Everything a lender submits is lender-declared and UNVERIFIED. Nothing here feeds PLACED matching until a
-- human reviewer (and, by policy, a second approver) has checked it against written criteria or a confirmed BDM response.
-- Written by server routes with the service role only. RLS on, no anon/authenticated policies.

-- 1. One row per lender intake link (the form engine's record; same shape as the borrower forms).
create table if not exists public.lender_criteria (
  id                   uuid primary key default gen_random_uuid(),
  link_token           text not null unique,
  lender_id            text,                       -- PLACED research_lender_id / canonical id once matched
  brand                text,                       -- posfin | unbranded | <future firm>
  status               text not null default 'draft' check (status in ('draft','submitted')),
  version              integer not null default 1,
  step                 integer not null default 0,
  payload              jsonb not null default '{}'::jsonb, -- engine answers incl. sheet_extraction
  derived              jsonb,                      -- totals / gap counts
  crm_export           jsonb,                      -- flat answers + placed block
  verification_status  text not null default 'lender_declared_unverified'
                       check (verification_status in ('lender_declared_unverified','under_review','verified','superseded')),
  guide_file_path      text,                       -- private storage bucket path only, never a public URL
  guide_file_sha256    text,
  extraction_status    text not null default 'none' check (extraction_status in ('none','queued','extracted','reviewed')),
  reviewed_by          text,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz
);

-- 2. One row per product the lender declared (normalised from payload for querying / PLACED staging).
create table if not exists public.lender_products (
  id                   uuid primary key default gen_random_uuid(),
  criteria_id          uuid not null references public.lender_criteria(id) on delete cascade,
  product_key          text not null,              -- catalog key, e.g. bridge_resi, dev_exit, mezz, equity_jv
  family               text not null,              -- bridging | refurb | development | commercial | specialist | capital_stack | term
  label                text not null,
  min_loan             numeric,
  max_loan             numeric,
  charges              text[] not null default '{}',
  max_ltv_first        numeric,
  max_ltv_second       numeric,
  max_ltgdv            numeric,
  max_ltc              numeric,
  ltv_grid             jsonb,                      -- {asset_row:{charge_col:"75"}}
  term_min_months      integer,
  term_max_months      integer,
  min_interest         jsonb,                      -- {type:'months'|'pct_of_term'|'none', months, pct}
  exit_after_months    integer,
  interest_time_used   text,
  erc                  text,
  rate_from            numeric,
  rate_to              numeric,
  rate_basis           text,
  arrangement_fee      text,
  interest_options     text[] not null default '{}',
  rollover             jsonb,                      -- offered, max_ltv, max_count, paydown, reretain, fee, reval
  extra                jsonb,
  verification_status  text not null default 'lender_declared_unverified',
  matching_enabled     boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (criteria_id, product_key)
);

-- 3. Case-study answers = appetite signals (Yes 1 / Maybe 0.5 / No -1).
create table if not exists public.lender_case_study_answers (
  id                   uuid primary key default gen_random_uuid(),
  criteria_id          uuid not null references public.lender_criteria(id) on delete cascade,
  case_key             text not null,              -- cs01..cs11
  case_version         integer not null default 1, -- bump when a case study's wording changes
  answer               text not null check (answer in ('Yes','Maybe','No')),
  weight               numeric not null,
  reason               text,
  created_at           timestamptz not null default now(),
  unique (criteria_id, case_key, case_version)
);

-- 4. Decline-feedback loop: declines/sheet conflicts become PROPOSED rule changes.
--    A proposal only changes PLACED once evidence (written criteria or confirmed BDM response, with source + date)
--    is attached, a named reviewer approves and a different second approver signs off. Old versions are kept.
create table if not exists public.lender_rule_proposals (
  id                   uuid primary key default gen_random_uuid(),
  lender_id            text not null,
  criteria_id          uuid references public.lender_criteria(id) on delete set null,
  rule_path            text not null,              -- e.g. product.bridge_resi.max_ltv | hair.ccj_recent | asset.hmo_large
  current_value        text,
  proposed_value       text not null,
  rationale            text not null,
  trigger_kind         text not null check (trigger_kind in ('decline','case_study','sheet_conflict','bdm_update')),
  trigger_case_ref     text,
  trigger_quote        text,
  trigger_received_at  timestamptz not null,
  evidence_type        text not null default 'none' check (evidence_type in ('none','written_criteria','bdm_confirmed')),
  evidence_source_ref  text,
  evidence_source_date date,
  evidence_captured_by text,
  status               text not null default 'proposed'
                       check (status in ('proposed','evidence_attached','approved','active','rejected','superseded')),
  proposed_by          text not null,
  reviewer             text,
  reviewed_at          timestamptz,
  second_approver      text,
  approved_at          timestamptz,
  effective_from       timestamptz,
  version              integer,
  supersedes           uuid references public.lender_rule_proposals(id),
  created_at           timestamptz not null default now(),
  constraint approval_needs_evidence check (
    status not in ('approved','active') or (
      evidence_type <> 'none' and evidence_source_ref is not null and evidence_source_date is not null
      and reviewer is not null and second_approver is not null and second_approver <> reviewer)
  )
);

alter table public.lender_criteria            enable row level security;
alter table public.lender_products            enable row level security;
alter table public.lender_case_study_answers  enable row level security;
alter table public.lender_rule_proposals      enable row level security;

create index if not exists lender_criteria_status_idx on public.lender_criteria (status, updated_at desc);
create index if not exists lender_products_key_idx    on public.lender_products (product_key);
create index if not exists lender_rule_prop_idx       on public.lender_rule_proposals (lender_id, status);

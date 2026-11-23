-- DO NOT APPLY from this pull request.
-- Proposed only. Byron reviews it before anyone runs it.
-- Do not run it on production, preview, a branch database, or any Supabase project
-- until that review says so.
--
-- Additive. One new table. It does not alter pipeline.case_register,
-- pipeline.web_leads, public.leads, or any fee column.
-- Depends on pipeline.current_staff_role() from the lead-ops migration.
--
-- Morning Yes / No / Edit answers for one staff seat.
-- Every authenticated staff seat may read every row. The seat_code says
-- whose sheet the answer belongs to, so Byron and Chris see the same rows.

create table if not exists pipeline.seat_task_answers (
  id uuid primary key default gen_random_uuid(),
  seat_code text not null,
  subject_kind text not null,
  subject_id text not null,
  task_date date not null,
  prompt text not null default '',
  answer text,
  edited_text text not null default '',
  answered_by text not null default '',
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_task_answers_kind_chk check (subject_kind = any (array['case', 'lead'])),
  constraint seat_task_answers_answer_chk check (answer is null or answer = any (array['yes', 'no', 'edit'])),
  constraint seat_task_answers_seat_chk check (seat_code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint seat_task_answers_unique unique (seat_code, subject_kind, subject_id, task_date)
);

comment on table pipeline.seat_task_answers is
  'Morning yes/no/edit answers for one staff seat. Every staff seat may read every row. Additive; does not change case or lead rows.';

create index if not exists seat_task_answers_seat_day_idx
  on pipeline.seat_task_answers (seat_code, task_date desc);

alter table pipeline.seat_task_answers enable row level security;

revoke all on table pipeline.seat_task_answers from public, anon;

create policy seat_task_answers_staff_read on pipeline.seat_task_answers
  for select to authenticated
  using (pipeline.current_staff_role() is not null);

create policy seat_task_answers_staff_insert on pipeline.seat_task_answers
  for insert to authenticated
  with check (pipeline.current_staff_role() is not null);

create policy seat_task_answers_staff_update on pipeline.seat_task_answers
  for update to authenticated
  using (pipeline.current_staff_role() is not null)
  with check (pipeline.current_staff_role() is not null);

grant select, insert, update on table pipeline.seat_task_answers to authenticated, service_role;

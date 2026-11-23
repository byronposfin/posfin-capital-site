-- APPLIED 23 Nov 2026 to vgflcrfaudrvrdmxjdtl as migration 20261123_run_sheet_entries (one new table; nothing else changed).
-- Run sheet (Byron's phone sheet inside the staff cockpit). Additive: ONE new table.
-- Does not alter any existing table, function or policy.
-- Append-only event log: 'item' rows define the day's cards; 'answer' / 'voice' / 'transcript' rows record what staff did.
create table if not exists pipeline.run_sheet_entries (
  id uuid primary key default gen_random_uuid(),
  sheet_date date not null,
  item_ref text not null,
  entry_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_email text not null default '',
  client_id text,
  created_at timestamptz not null default now(),
  constraint run_sheet_entries_kind_chk check (entry_kind = any (array['item','answer','voice','transcript','retire'])),
  constraint run_sheet_entries_ref_chk check (item_ref ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  constraint run_sheet_entries_client_uniq unique (client_id)
);
comment on table pipeline.run_sheet_entries is
  'Run sheet: append-only. item rows = the day''s cards (written by Lizzy via the service role); answer/voice rows = staff Yes/No/Edit and voice notes. Staff may read and insert, never update or delete.';
create index if not exists run_sheet_entries_day_idx on pipeline.run_sheet_entries (sheet_date desc, created_at);
alter table pipeline.run_sheet_entries enable row level security;
revoke all on table pipeline.run_sheet_entries from public, anon;
create policy run_sheet_entries_staff_read on pipeline.run_sheet_entries
  for select to authenticated using (pipeline.current_staff_role() is not null);
create policy run_sheet_entries_staff_insert on pipeline.run_sheet_entries
  for insert to authenticated
  with check (pipeline.current_staff_role() is not null and entry_kind = any (array['answer','voice']));
grant select, insert on table pipeline.run_sheet_entries to authenticated;
grant all on table pipeline.run_sheet_entries to service_role;

-- SmartLink Section 1: ONE RECORD, MANY VIEWS
-- System of record for completion data. Sheets stay as mirrors.
--
-- DO NOT apply to production. This file is committed to the repo for
-- review and staging verification only.

-- ============================================================
-- 1. case_completion — the canonical record per case
-- ============================================================
create table if not exists case_completion (
  case_id           text primary key,                          -- reconciled Posfin ref, never blank
  version           integer not null default 1,                -- +1 on every accepted patch
  fields            jsonb not null default '{}'::jsonb,        -- { field_key: { value, source, confirmed_at, confirmed_by } }
  sections          jsonb not null default '{}'::jsonb,        -- { section_key: { status, completed_version } }
  broker_only       jsonb not null default '{}'::jsonb,        -- notes, decisions, proc fee: NEVER rendered to borrower/export
  updated_at        timestamptz not null default now(),
  updated_by        text not null default 'system'
);

comment on table  case_completion is 'SmartLink system of record. Sheets are projections.';
comment on column case_completion.fields is '{ field_key: { value, source, confirmed_at, confirmed_by } }. null = missing, explicit 0/false = answered.';
comment on column case_completion.broker_only is 'Never rendered to borrower or included in exports.';

-- ============================================================
-- 2. case_completion_audit — append-only change log
-- ============================================================
create table if not exists case_completion_audit (
  id                bigint generated always as identity primary key,
  case_id           text not null references case_completion(case_id),
  version           integer not null,
  actor             text not null,                             -- borrower, broker, claude, tom, system
  source            text not null,                             -- intake, crm_import, borrower, broker, claude, tom
  idempotency_key   text,                                      -- replayed key returns original result
  diff              jsonb not null default '{}'::jsonb,        -- { field_key: { old, new } }
  created_at        timestamptz not null default now()
);

create unique index if not exists audit_idempotency_idx
  on case_completion_audit (case_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists audit_case_version_idx
  on case_completion_audit (case_id, version);

comment on table case_completion_audit is 'Append-only audit trail. Every accepted patch creates one row.';

-- ============================================================
-- 3. case_tokens — opaque borrower access tokens (hash only)
-- ============================================================
create table if not exists case_tokens (
  id                bigint generated always as identity primary key,
  token_hash        text not null unique,                      -- SHA-256 of the raw token; raw token never stored
  case_id           text not null references case_completion(case_id),
  issued_at         timestamptz not null default now(),
  revoked_at        timestamptz,
  last_used_at      timestamptz
);

create index if not exists tokens_case_idx on case_tokens (case_id);

comment on table case_tokens is 'Opaque 128-bit random tokens. Only the SHA-256 hash is stored. Raw token never logged.';

-- ============================================================
-- 4. case_exports — versioned section exports
-- ============================================================
create table if not exists case_exports (
  id                bigint generated always as identity primary key,
  case_id           text not null references case_completion(case_id),
  section_key       text not null,
  version           integer not null,
  file_ref          text not null,                             -- storage path or blob key
  created_at        timestamptz not null default now()
);

create index if not exists exports_case_section_idx
  on case_exports (case_id, section_key, version desc);

comment on table case_exports is 'Versioned PDF exports per section. Borrower-safe fields only.';

-- ============================================================
-- 5. case_gate_attempts — postcode gate lockout state
-- ============================================================
create table if not exists case_gate_attempts (
  id                bigint generated always as identity primary key,
  case_id           text not null references case_completion(case_id),
  attempted_at      timestamptz not null default now(),
  success           boolean not null default false,
  ip_hash           text                                       -- hashed IP for rate limiting, never raw
);

create index if not exists gate_attempts_case_idx
  on case_gate_attempts (case_id, attempted_at desc);

comment on table case_gate_attempts is 'Postcode gate attempts for lockout (5 failures → 15 min cooldown).';

-- ============================================================
-- 6. case_verification_codes — 6-digit fallback codes
-- ============================================================
create table if not exists case_verification_codes (
  id                bigint generated always as identity primary key,
  case_id           text not null references case_completion(case_id),
  code_hash         text not null,                             -- SHA-256 of the 6-digit code
  channel           text not null,                             -- 'whatsapp' or 'email'
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  used_at           timestamptz,
  attempts          integer not null default 0
);

create index if not exists verification_case_idx
  on case_verification_codes (case_id, created_at desc);

comment on table case_verification_codes is '6-digit verification codes. Hash only stored. Expires after 10 min.';

-- ============================================================
-- 7. case_notifications — durable notification outbox
-- ============================================================
create table if not exists case_notifications (
  id                bigint generated always as identity primary key,
  case_id           text not null references case_completion(case_id),
  channel           text not null,                             -- 'telegram'
  recipient         text not null,                             -- chat_id or email
  message           text not null,
  status            text not null default 'pending',           -- pending, delivered, failed
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  last_attempt_at   timestamptz,
  delivered_at      timestamptz,
  last_error        text,
  created_at        timestamptz not null default now()
);

create index if not exists notifications_pending_idx
  on case_notifications (status, created_at)
  where status in ('pending', 'failed');

create index if not exists notifications_case_idx
  on case_notifications (case_id);

comment on table case_notifications is 'Durable notification outbox. Worker/cron processes pending and retries failed entries.';

-- ============================================================
-- 8. Notification event identity — prevents duplicate intent on replay
-- ============================================================
create unique index if not exists notifications_event_identity_idx
  on case_notifications (case_id, channel, recipient, status, attempts)
  where status = 'pending' and attempts = 0;
-- Note: the unique index prevents INSERT of an identical pending row for the
-- same case+channel+recipient. ON CONFLICT DO NOTHING makes replay safe.

-- ============================================================
-- 9. Atomic CAS update + audit + notification intent
-- ============================================================
-- Wraps case update, audit insert AND notification intent insert in a
-- single transaction. If ANY of these fails, ALL roll back. Returns
-- the number of rows updated (0 = version conflict, 1 = success).
-- Notification rows use ON CONFLICT DO NOTHING so replay is safe.
create or replace function patch_case_atomic(
  p_case_id text,
  p_expected_version integer,
  p_new_version integer,
  p_fields jsonb,
  p_updated_at timestamptz,
  p_updated_by text,
  p_broker_only jsonb,
  p_audit_actor text,
  p_audit_source text,
  p_audit_idempotency_key text,
  p_audit_diff jsonb,
  p_notify_message text default null,
  p_notify_recipients text[] default null
) returns integer language plpgsql as $$
declare
  affected integer;
  r text;
begin
  -- CAS update: only if version matches
  update case_completion
  set version = p_new_version,
      fields = p_fields,
      updated_at = p_updated_at,
      updated_by = p_updated_by,
      broker_only = coalesce(p_broker_only, broker_only)
  where case_id = p_case_id
    and version = p_expected_version;

  get diagnostics affected = row_count;

  if affected = 0 then
    return 0;  -- Version conflict — caller should return 409
  end if;

  -- Audit row — same transaction
  insert into case_completion_audit (case_id, version, actor, source, idempotency_key, diff)
  values (p_case_id, p_new_version, p_audit_actor, p_audit_source,
          nullif(p_audit_idempotency_key, ''), p_audit_diff);

  -- Notification intent — same transaction. ON CONFLICT DO NOTHING
  -- makes this safe on replay (duplicate pending row is a no-op).
  if p_notify_message is not null and p_notify_recipients is not null then
    foreach r in array p_notify_recipients loop
      insert into case_notifications (case_id, channel, recipient, message, status, attempts, max_attempts)
      values (p_case_id, 'telegram', r, p_notify_message, 'pending', 0, 3)
      on conflict do nothing;
    end loop;
  end if;

  return 1;
end;
$$;

-- ============================================================
-- 9. RLS — service-role only, deny all anon access
-- ============================================================
alter table case_completion         enable row level security;
alter table case_completion_audit   enable row level security;
alter table case_tokens             enable row level security;
alter table case_exports            enable row level security;
alter table case_gate_attempts      enable row level security;
alter table case_verification_codes enable row level security;
alter table case_notifications      enable row level security;

-- No policies for anon role → all access denied by default.
-- Service-role key bypasses RLS. All access is server-side only.

-- Grant service_role explicit privileges (required when tables are
-- created by the migration system rather than by service_role itself).
grant all on case_completion to service_role;
grant all on case_completion_audit to service_role;
grant all on case_tokens to service_role;
grant all on case_exports to service_role;
grant all on case_gate_attempts to service_role;
grant all on case_verification_codes to service_role;
grant all on case_notifications to service_role;
grant usage on all sequences in schema public to service_role;
grant execute on function patch_case_atomic to service_role;

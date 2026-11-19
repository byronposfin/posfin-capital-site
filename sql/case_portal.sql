-- Smart link case portal.
-- Builds on case_completion / case_tokens in the smartlink project.
-- Client pages are reached with an unguessable token. Only the hash is stored.
-- Staff pages use a session issued after a password check. Only the password hash is stored.
-- Lender-only notes stay in case_completion.broker_only and are never returned to the client.
-- Files live in the private Storage bucket "case-portal", one path per case:
--   cases/<case_id>/<submission_id>/<filename>
-- Anon has no table privileges. Short-lived grants allow a single object read or write.

create table if not exists public.case_portal (
  case_id text primary key references public.case_completion(case_id) on delete cascade,
  client_name text not null,
  facts jsonb not null default '{}'::jsonb,
  stage text,
  created_at timestamptz not null default now(),
  constraint case_portal_stage_chk check (stage is null or stage in ('gathering', 'terms', 'applied'))
);

create table if not exists public.case_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references public.case_completion(case_id) on delete cascade,
  gap_id text,
  kind text not null,
  status text not null default 'pending',
  text_value text,
  choice_value text,
  filename text,
  mime text,
  bytes integer,
  storage_path text,
  client_ref text,
  created_at timestamptz not null default now(),
  constraint case_submissions_kind_chk check (kind in ('text', 'choice', 'voice', 'file', 'photo')),
  constraint case_submissions_status_chk check (status in ('pending', 'stored')),
  constraint case_submissions_gap_chk check (
    gap_id is null or gap_id in (
      'solicitor', 'court_papers', 'redemption', 'occupancy', 'exit', 'property',
      'kyc_id', 'kyc_poa', 'kyc_credit', 'income', 'debts', 'insurance'
    )
  )
);

create unique index if not exists case_submissions_client_ref_uq
  on public.case_submissions (case_id, client_ref)
  where client_ref is not null;

create index if not exists case_submissions_case_idx
  on public.case_submissions (case_id, created_at);

create table if not exists public.case_upload_grants (
  id uuid primary key default gen_random_uuid(),
  object_path text not null,
  case_id text not null,
  op text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint case_upload_grants_op_chk check (op in ('read', 'write'))
);

create index if not exists case_upload_grants_path_idx
  on public.case_upload_grants (object_path, op, expires_at);

create table if not exists public.case_portal_auth (
  id integer primary key default 1,
  admin_secret_hash text not null,
  constraint case_portal_auth_one check (id = 1)
);

create table if not exists public.case_portal_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.case_portal enable row level security;
alter table public.case_submissions enable row level security;
alter table public.case_upload_grants enable row level security;
alter table public.case_portal_auth enable row level security;
alter table public.case_portal_sessions enable row level security;

revoke all on public.case_portal from public, anon, authenticated;
revoke all on public.case_submissions from public, anon, authenticated;
revoke all on public.case_upload_grants from public, anon, authenticated;
revoke all on public.case_portal_auth from public, anon, authenticated;
revoke all on public.case_portal_sessions from public, anon, authenticated;

comment on table public.case_portal is
  'Client-safe smart link case folder. Do not put lender names in facts.';
comment on table public.case_submissions is
  'Timestamped smart link answers and files. Bytes live in the private case-portal bucket.';

insert into storage.buckets (id, name, public, file_size_limit)
values ('case-portal', 'case-portal', false, 4194304)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

create or replace function public.case_portal_hash(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(convert_to(coalesce(p_value, ''), 'utf8'), 'sha256'), 'hex');
$$;

create or replace function public.case_portal_case_id(p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
  h text;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return null;
  end if;
  if p_token !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;
  h := public.case_portal_hash(p_token);
  select t.case_id into cid
    from public.case_tokens t
   where t.token_hash = h
     and t.revoked_at is null;
  if cid is not null then
    update public.case_tokens
       set last_used_at = now()
     where token_hash = h;
  end if;
  return cid;
end;
$$;

create or replace function public.case_portal_payload(p_case_id text, p_broker boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'case_id', p.case_id,
    'client_name', p.client_name,
    'facts', p.facts,
    'stage', p.stage,
    'broker', case when p_broker then c.broker_only else null end,
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'gap_id', s.gap_id,
        'kind', s.kind,
        'text', s.text_value,
        'choice', s.choice_value,
        'filename', s.filename,
        'mime', s.mime,
        'bytes', s.bytes,
        'created_at', s.created_at
      ) order by s.created_at)
      from public.case_submissions s
      where s.case_id = p.case_id
        and s.status = 'stored'
    ), '[]'::jsonb)
  )
    into result
    from public.case_portal p
    join public.case_completion c on c.case_id = p.case_id
   where p.case_id = p_case_id;
  return result;
end;
$$;

create or replace function public.case_portal_touch(p_case_id text, p_gap_id text, p_value text, p_client_ref text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  field_key text := coalesce(nullif(p_gap_id, ''), 'general_note');
  new_version integer;
begin
  update public.case_completion
     set fields = coalesce(fields, '{}'::jsonb) || jsonb_build_object(
           field_key,
           jsonb_build_object(
             'value', left(coalesce(p_value, ''), 4000),
             'source', 'borrower',
             'confirmed_at', to_jsonb(now()),
             'confirmed_by', 'borrower'
           )
         ),
         version = version + 1,
         updated_at = now(),
         updated_by = 'borrower'
   where case_id = p_case_id
   returning version into new_version;
  if new_version is not null then
    insert into public.case_completion_audit (case_id, version, actor, source, idempotency_key, diff)
    values (
      p_case_id,
      new_version,
      'borrower',
      'case_portal',
      nullif(left(coalesce(p_client_ref, ''), 80), ''),
      jsonb_build_object('gap_id', p_gap_id, 'kind', p_kind)
    );
  end if;
end;
$$;

create or replace function public.case_portal_open(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
begin
  cid := public.case_portal_case_id(p_token);
  if cid is null then
    return null;
  end if;
  return public.case_portal_payload(cid, false);
end;
$$;

create or replace function public.case_portal_submit(
  p_token text,
  p_gap_id text,
  p_kind text,
  p_text text,
  p_choice text,
  p_filename text,
  p_mime text,
  p_bytes integer,
  p_client_ref text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
  existing public.case_submissions%rowtype;
  sid uuid;
  v_name text;
  v_path text;
  v_text text := left(btrim(coalesce(p_text, '')), 4000);
  v_choice text := left(btrim(coalesce(p_choice, '')), 200);
  v_ref text := nullif(left(coalesce(p_client_ref, ''), 80), '');
  pending boolean;
begin
  cid := public.case_portal_case_id(p_token);
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if exists (
    select 1 from public.case_portal
     where case_id = cid and facts->>'ask_client' = 'false'
  ) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_gap_id is not null and p_gap_id not in (
    'solicitor', 'court_papers', 'redemption', 'occupancy', 'exit', 'property',
    'kyc_id', 'kyc_poa', 'kyc_credit', 'income', 'debts', 'insurance'
  ) then
    return jsonb_build_object('ok', false, 'error', 'bad_gap');
  end if;
  if p_kind not in ('text', 'choice', 'voice', 'file', 'photo') then
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
  end if;
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_ref');
  end if;
  if v_ref is not null then
    select * into existing
      from public.case_submissions
     where case_id = cid
       and client_ref = v_ref;
  end if;
  pending := p_kind in ('voice', 'file', 'photo');
  if pending then
    if coalesce(p_bytes, 0) < 1 or coalesce(p_bytes, 0) > 4194304 then
      return jsonb_build_object('ok', false, 'error', 'bad_file');
    end if;
    v_name := left(regexp_replace(coalesce(p_filename, 'file'), '[^A-Za-z0-9._-]', '_', 'g'), 80);
    if v_name is null or v_name = '' or v_name = '.' or v_name = '..' then
      v_name := 'file';
    end if;
  elsif p_kind = 'text' and v_text = '' then
    return jsonb_build_object('ok', false, 'error', 'empty');
  elsif p_kind = 'choice' and v_choice = '' then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;

  if existing.id is not null then
    if existing.status = 'stored' then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'submission_id', existing.id,
        'record', public.case_portal_payload(cid, false)
      );
    end if;
    insert into public.case_upload_grants (object_path, case_id, op, expires_at)
    values (existing.storage_path, cid, 'write', now() + interval '5 minutes');
    return jsonb_build_object(
      'ok', true,
      'pending', true,
      'submission_id', existing.id,
      'storage_path', existing.storage_path,
      'record', public.case_portal_payload(cid, false)
    );
  end if;

  if pending then
    insert into public.case_submissions (
      case_id, gap_id, kind, status, text_value, choice_value, filename, mime, bytes, client_ref
    ) values (
      cid, p_gap_id, p_kind, 'pending', nullif(v_text, ''), nullif(v_choice, ''), v_name,
      left(coalesce(p_mime, ''), 120), p_bytes, v_ref
    )
    returning id into sid;
    v_path := 'cases/' || cid || '/' || sid::text || '/' || v_name;
    update public.case_submissions set storage_path = v_path where id = sid;
    insert into public.case_upload_grants (object_path, case_id, op, expires_at)
    values (v_path, cid, 'write', now() + interval '5 minutes');
    return jsonb_build_object(
      'ok', true,
      'pending', true,
      'submission_id', sid,
      'storage_path', v_path
    );
  end if;

  insert into public.case_submissions (
    case_id, gap_id, kind, status, text_value, choice_value, client_ref
  ) values (
    cid, p_gap_id, p_kind, 'stored', nullif(v_text, ''), nullif(v_choice, ''), v_ref
  )
  returning id into sid;
  perform public.case_portal_touch(
    cid,
    p_gap_id,
    concat_ws(' — ', nullif(v_choice, ''), nullif(v_text, '')),
    v_ref,
    p_kind
  );
  return jsonb_build_object(
    'ok', true,
    'submission_id', sid,
    'record', public.case_portal_payload(cid, false)
  );
end;
$$;

create or replace function public.case_portal_finalize(p_token text, p_submission_id uuid, p_bytes integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
  row public.case_submissions%rowtype;
begin
  cid := public.case_portal_case_id(p_token);
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce(p_bytes, 0) < 1 or coalesce(p_bytes, 0) > 4194304 then
    return jsonb_build_object('ok', false, 'error', 'bad_file');
  end if;
  select * into row
    from public.case_submissions
   where id = p_submission_id
     and case_id = cid;
  if row.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if row.status = 'stored' then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'submission_id', row.id,
      'record', public.case_portal_payload(cid, false)
    );
  end if;
  update public.case_submissions
     set status = 'stored',
         bytes = p_bytes
   where id = row.id;
  update public.case_upload_grants
     set used_at = now()
   where object_path = row.storage_path
     and op = 'write'
     and used_at is null;
  perform public.case_portal_touch(
    cid,
    row.gap_id,
    concat_ws(' — ', nullif(row.choice_value, ''), nullif(row.text_value, ''), row.filename),
    row.client_ref,
    row.kind
  );
  return jsonb_build_object(
    'ok', true,
    'submission_id', row.id,
    'record', public.case_portal_payload(cid, false)
  );
end;
$$;

create or replace function public.case_portal_abort(p_token text, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
  row public.case_submissions%rowtype;
begin
  cid := public.case_portal_case_id(p_token);
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into row
    from public.case_submissions
   where id = p_submission_id
     and case_id = cid
     and status = 'pending';
  if row.id is null then
    return jsonb_build_object('ok', true);
  end if;
  update public.case_upload_grants
     set used_at = now()
   where object_path = row.storage_path
     and used_at is null;
  delete from public.case_submissions where id = row.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.case_portal_read_grant(p_token text, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cid text;
  row public.case_submissions%rowtype;
begin
  cid := public.case_portal_case_id(p_token);
  if cid is null then
    return null;
  end if;
  select * into row
    from public.case_submissions
   where id = p_submission_id
     and case_id = cid
     and status = 'stored'
     and storage_path is not null;
  if row.id is null then
    return null;
  end if;
  insert into public.case_upload_grants (object_path, case_id, op, expires_at)
  values (row.storage_path, cid, 'read', now() + interval '2 minutes');
  return jsonb_build_object(
    'path', row.storage_path,
    'mime', row.mime,
    'filename', row.filename
  );
end;
$$;

create or replace function public.case_portal_session_ok(p_session text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  if p_session is null or length(p_session) < 32 or length(p_session) > 128 then
    return false;
  end if;
  h := public.case_portal_hash(p_session);
  return exists (
    select 1
      from public.case_portal_sessions s
     where s.token_hash = h
       and s.expires_at > now()
  );
end;
$$;

create or replace function public.case_portal_staff_login(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  expected text;
  raw text;
begin
  if p_secret is null or length(p_secret) < 20 or length(p_secret) > 200 then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;
  select admin_secret_hash into expected from public.case_portal_auth where id = 1;
  if expected is null or expected <> public.case_portal_hash(p_secret) then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;
  raw := encode(gen_random_bytes(32), 'hex');
  insert into public.case_portal_sessions (token_hash, expires_at)
  values (public.case_portal_hash(raw), now() + interval '12 hours');
  return jsonb_build_object('ok', true, 'session', raw);
end;
$$;

create or replace function public.case_portal_staff_logout(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_session is not null and length(p_session) >= 32 then
    delete from public.case_portal_sessions
     where token_hash = public.case_portal_hash(p_session);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.case_portal_staff_list(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_id', p.case_id,
      'client_name', p.client_name,
      'facts', jsonb_build_object(
        'property_address', p.facts->'property_address',
        'postcode', p.facts->'postcode',
        'client_value', p.facts->'client_value',
        'loan_amount', p.facts->'loan_amount',
        'equity_known', p.facts->'equity_known',
        'ask_client', p.facts->'ask_client',
        'offer_issued', p.facts->'offer_issued'
      ),
      'staff_open', coalesce((
        select jsonb_array_length(c.broker_only->'staff_items')
          from public.case_completion c
         where c.case_id = p.case_id
           and jsonb_typeof(c.broker_only->'staff_items') = 'array'
      ), 0),
      'stage', p.stage,
      'answered', coalesce((
        select jsonb_agg(distinct s.gap_id)
          from public.case_submissions s
         where s.case_id = p.case_id
           and s.status = 'stored'
           and s.gap_id is not null
      ), '[]'::jsonb),
      'last_at', (
        select max(s.created_at)
          from public.case_submissions s
         where s.case_id = p.case_id
           and s.status = 'stored'
      )
    ) order by p.created_at desc)
    from public.case_portal p
  ), '[]'::jsonb);
end;
$$;

create or replace function public.case_portal_staff_case(p_session text, p_case_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  payload jsonb;
begin
  if not public.case_portal_session_ok(p_session) then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;
  if p_case_id is null or p_case_id !~ '^[A-Za-z0-9-]{6,48}$' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  payload := public.case_portal_payload(p_case_id, true);
  if payload is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'record', payload);
end;
$$;

create or replace function public.case_portal_staff_stage(p_session text, p_case_id text, p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  if p_stage is not null and p_stage not in ('gathering', 'terms', 'applied') then
    return jsonb_build_object('ok', false, 'error', 'bad_stage');
  end if;
  update public.case_portal
     set stage = p_stage
   where case_id = p_case_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'record', public.case_portal_payload(p_case_id, true));
end;
$$;

create or replace function public.case_portal_staff_read(p_session text, p_case_id text, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row public.case_submissions%rowtype;
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  select * into row
    from public.case_submissions
   where id = p_submission_id
     and case_id = p_case_id
     and status = 'stored'
     and storage_path is not null;
  if row.id is null then
    return null;
  end if;
  insert into public.case_upload_grants (object_path, case_id, op, expires_at)
  values (row.storage_path, row.case_id, 'read', now() + interval '2 minutes');
  return jsonb_build_object(
    'path', row.storage_path,
    'mime', row.mime,
    'filename', row.filename
  );
end;
$$;

revoke all on function public.case_portal_hash(text) from public, anon, authenticated;
revoke all on function public.case_portal_case_id(text) from public, anon, authenticated;
revoke all on function public.case_portal_payload(text, boolean) from public, anon, authenticated;
revoke all on function public.case_portal_touch(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.case_portal_session_ok(text) from public, anon, authenticated;

revoke all on function public.case_portal_open(text) from public;
revoke all on function public.case_portal_submit(text, text, text, text, text, text, text, integer, text) from public;
revoke all on function public.case_portal_finalize(text, uuid, integer) from public;
revoke all on function public.case_portal_abort(text, uuid) from public;
revoke all on function public.case_portal_read_grant(text, uuid) from public;
revoke all on function public.case_portal_staff_login(text) from public;
revoke all on function public.case_portal_staff_logout(text) from public;
revoke all on function public.case_portal_staff_list(text) from public;
revoke all on function public.case_portal_staff_case(text, text) from public;
revoke all on function public.case_portal_staff_stage(text, text, text) from public;
revoke all on function public.case_portal_staff_read(text, text, uuid) from public;

grant execute on function public.case_portal_open(text) to anon, authenticated, service_role;
grant execute on function public.case_portal_submit(text, text, text, text, text, text, text, integer, text) to anon, authenticated, service_role;
grant execute on function public.case_portal_finalize(text, uuid, integer) to anon, authenticated, service_role;
grant execute on function public.case_portal_abort(text, uuid) to anon, authenticated, service_role;
grant execute on function public.case_portal_read_grant(text, uuid) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_login(text) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_logout(text) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_list(text) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_case(text, text) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_stage(text, text, text) to anon, authenticated, service_role;
grant execute on function public.case_portal_staff_read(text, text, uuid) to anon, authenticated, service_role;

-- Storage policies call this. It reveals only whether a short-lived grant exists.
create or replace function public.case_portal_grant_open(p_path text, p_op text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.case_upload_grants g
     where g.object_path = p_path
       and g.op = p_op
       and g.used_at is null
       and g.expires_at > now()
  );
$$;

revoke all on function public.case_portal_grant_open(text, text) from public;
grant execute on function public.case_portal_grant_open(text, text) to anon, authenticated, service_role;

drop policy if exists case_portal_read_granted on storage.objects;
create policy case_portal_read_granted
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'case-portal'
  and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  and public.case_portal_grant_open(name, 'read')
);

drop policy if exists case_portal_write_granted on storage.objects;
create policy case_portal_write_granted
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'case-portal'
  and public.case_portal_grant_open(name, 'write')
);

-- Lead pipeline v1. NOT APPLIED.
-- Additive only: new tables, new columns, new functions, and two function replacements
-- (project to CRM, and the existing after-write audit). No deletes, no backfill of the
-- current web_leads rows, and no change to the Telegram outbox or its claim/finish RPCs.
--
-- How the Telegram outbox is drained today (left as-is):
--   pipeline.web_lead_enqueue_main_alert inserts pipeline.web_lead_alert_outbox rows
--   for chat ids 1750758657 and, for land, 8634157536.
--   public.web_lead_alert_claim / web_lead_alert_finish lease a row for 2 minutes.
--   An expired lease becomes state 'unknown' and is never retried.
--   lib/ff-alert-outbox.js sends those rows to the Telegram Bot API.
--   The caller is Vercel: cron /api/factfind-alert-worker (was every 5 minutes) and,
--   when FF_ALERT_DURABLE=true, the fact-find submit request. It is not a Supabase
--   edge function. If that env is unset, the Vercel worker refuses to run and any
--   other caller of the same RPCs (the suspected Mac/OpenClaw worker) is the sender.
--   Email does not fit that contract: recipient_chat_id is a two-value check and
--   message_id is a Telegram bigint. Email therefore uses its own outbox.
--
-- Switch-on is data, not a deploy of this file by itself. See README.md.
-- Assignment starts for new submissions when this file is applied.
-- Staff email, the applicant auto-reply, and the SLA email stay off until armed.

begin;

create table if not exists pipeline.staff_seats (
  seat_code text primary key check (seat_code ~ '^[a-z][a-z0-9_]{1,30}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  email text check (email is null or email ~* '^[^@[:space:]]+@posfincapital\.com$'),
  role text not null check (role in ('principal','crm_operator','case_owner','analyst','read_only')),
  round_robin boolean not null default false,
  round_robin_order smallint check (round_robin_order is null or round_robin_order between 1 and 99),
  fallback boolean not null default false,
  alert_copy boolean not null default false,
  active boolean not null default true,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists staff_seats_email_key
  on pipeline.staff_seats (lower(email)) where email is not null;
create unique index if not exists staff_seats_one_fallback
  on pipeline.staff_seats (fallback) where fallback;

alter table pipeline.staff_seats enable row level security;
alter table pipeline.staff_seats force row level security;
revoke all on pipeline.staff_seats from public, anon, authenticated;

-- Cai's mailbox was not in auth.users, public.crm_users, or this repo on 20 Nov 2026.
-- The seat is still in the rotation. Byron sets the @posfincapital.com address, then
-- reruns pipeline.link_staff_seats(). No address is guessed here.
insert into pipeline.staff_seats
  (seat_code, display_name, email, role, round_robin, round_robin_order, fallback, alert_copy)
values
  ('byron', 'Byron Hill', 'byron.hill@posfincapital.com', 'principal', false, null, true, true),
  ('jess', 'Jess', 'jessica@posfincapital.com', 'case_owner', true, 1, false, true),
  ('aadi', 'Aadi', 'aadi@posfincapital.com', 'case_owner', true, 2, false, false),
  ('cai', 'Cai', null, 'case_owner', true, 3, false, false),
  ('chris', 'Chris Shipton', 'chris.shipton@posfincapital.com', 'case_owner', true, 4, false, false)
on conflict (seat_code) do nothing;

alter table pipeline.staff add column if not exists email text;
alter table pipeline.staff add column if not exists seat_code text;
create unique index if not exists staff_email_key
  on pipeline.staff (lower(email)) where email is not null;

create table if not exists pipeline.lead_ops_control (
  id boolean primary key default true check (id),
  assignment_armed_at timestamptz,
  email_alerts_armed_at timestamptz,
  autoreply_armed_at timestamptz,
  sla_armed_at timestamptz,
  -- While set, the applicant auto-reply can go only to this address.
  -- Default is Byron, so a premature arm cannot mail other applicants.
  autoreply_allowlist text,
  updated_at timestamptz not null default now(),
  constraint lead_ops_autoreply_allowlist_check check (
    autoreply_allowlist is null
    or autoreply_allowlist ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

insert into pipeline.lead_ops_control (id, assignment_armed_at, autoreply_allowlist)
values (true, now(), 'byron.hill@posfincapital.com')
on conflict (id) do nothing;

alter table pipeline.lead_ops_control enable row level security;
alter table pipeline.lead_ops_control force row level security;
revoke all on pipeline.lead_ops_control from public, anon, authenticated;

create table if not exists pipeline.lead_assignment_cursor (
  id boolean primary key default true check (id),
  next_index integer not null default 0 check (next_index >= 0),
  updated_at timestamptz not null default now()
);
insert into pipeline.lead_assignment_cursor (id) values (true) on conflict (id) do nothing;
alter table pipeline.lead_assignment_cursor enable row level security;
alter table pipeline.lead_assignment_cursor force row level security;
revoke all on pipeline.lead_assignment_cursor from public, anon, authenticated;

alter table pipeline.web_leads add column if not exists assigned_seat text references pipeline.staff_seats(seat_code);
alter table pipeline.web_leads add column if not exists owner_assigned_at timestamptz;
alter table pipeline.web_leads add column if not exists sla_due_at timestamptz;
alter table pipeline.web_leads add column if not exists sla_escalated_at timestamptz;

-- Working-time deadline. 15 minutes inside 08:00–20:00 Europe/London, every day
-- (weekend cover was not decided; the window is not Mon–Fri). Time already used
-- before 20:00 carries to 08:00 the next morning. Keep in step with lib/lead-sla.js.
create or replace function pipeline.web_lead_sla_due(p_submitted timestamptz)
returns timestamptz
language plpgsql immutable
set search_path = ''
as $$
declare
  t timestamp;
  remain interval := interval '15 minutes';
  available interval;
  guard int := 0;
begin
  if p_submitted is null then return null; end if;
  t := timezone('Europe/London', p_submitted);
  loop
    guard := guard + 1;
    if guard > 8 then raise exception 'sla_window'; end if;
    if t::time < time '08:00' then
      t := date_trunc('day', t) + time '08:00';
    elsif t::time >= time '20:00' then
      t := date_trunc('day', t) + interval '1 day' + time '08:00';
    end if;
    available := (date_trunc('day', t) + time '20:00') - t;
    if remain <= available then
      return timezone('Europe/London', t + remain);
    end if;
    remain := remain - available;
    t := date_trunc('day', t) + interval '1 day' + time '08:00';
  end loop;
end $$;
revoke all on function pipeline.web_lead_sla_due(timestamptz) from public, anon, authenticated;

create or replace function pipeline.web_lead_assign_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat text;
  v_count int;
  v_index int;
  v_user uuid;
begin
  if new.form_stage is distinct from 'submitted' then return new; end if;
  if tg_op = 'UPDATE' and old.form_stage = 'submitted' then return new; end if;

  if new.sla_due_at is null then
    new.sla_due_at := pipeline.web_lead_sla_due(coalesce(new.submitted_at, now()));
  end if;

  if (select c.assignment_armed_at from pipeline.lead_ops_control c where c.id) is null then
    return new;
  end if;
  if new.assigned_seat is not null then return new; end if;

  if new.broker_tag = 'bh' then
    select s.seat_code into v_seat from pipeline.staff_seats s where s.seat_code = 'byron' and s.active;
  elsif new.broker_tag = 'chris' then
    select s.seat_code into v_seat from pipeline.staff_seats s where s.seat_code = 'chris' and s.active;
  end if;

  if v_seat is null then
    select count(*)::int into v_count from pipeline.staff_seats s where s.active and s.round_robin;
    if v_count > 0 then
      update pipeline.lead_assignment_cursor c
         set next_index = c.next_index + 1, updated_at = now()
       where c.id
       returning c.next_index - 1 into v_index;
      select s.seat_code into v_seat
        from pipeline.staff_seats s
       where s.active and s.round_robin
       order by s.round_robin_order, s.seat_code
       offset (v_index % v_count) limit 1;
    end if;
  end if;

  if v_seat is null then
    select s.seat_code into v_seat
      from pipeline.staff_seats s
     where s.active and s.fallback
     order by s.seat_code
     limit 1;
  end if;
  if v_seat is null then return new; end if;

  select s.auth_user_id into v_user from pipeline.staff_seats s where s.seat_code = v_seat;
  new.assigned_seat := v_seat;
  new.owner_assigned_at := coalesce(new.owner_assigned_at, now());
  if v_user is not null then new.assigned_to := v_user; end if;
  return new;
end $$;
revoke all on function pipeline.web_lead_assign_owner() from public, anon, authenticated;

drop trigger if exists web_leads_18_assign_owner on pipeline.web_leads;
create trigger web_leads_18_assign_owner
  before insert or update on pipeline.web_leads
  for each row execute function pipeline.web_lead_assign_owner();

-- Authenticated staff sessions only. Service role and the anonymous submit RPC
-- have no auth.uid() and are not limited here. Applicant PII, consent, and the
-- resume secret stay locked for every staff role, including principal.
create or replace function pipeline.web_leads_guard_staff_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_key text;
  v_owner uuid;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_allowed text[];
begin
  if auth.uid() is null then return new; end if;
  v_role := pipeline.current_staff_role();
  if v_role is null or v_role in ('read_only', 'analyst') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_role = 'principal' then
    v_allowed := array['status','contacted_at','closed_at','updated_at','updated_by','assigned_to','assigned_seat','owner_assigned_at'];
  else
    v_allowed := array['status','contacted_at','closed_at','updated_at','updated_by'];
  end if;
  if v_role <> 'principal' and new.status is distinct from old.status and new.status::text <> 'contacted' then
    raise exception 'status_not_allowed' using errcode = '42501';
  end if;
  if v_role = 'principal' and new.assigned_seat is distinct from old.assigned_seat then
    select s.auth_user_id into v_owner
      from pipeline.staff_seats s
     where s.seat_code = new.assigned_seat and s.active;
    new.assigned_to := v_owner;
    new.owner_assigned_at := now();
    v_new := to_jsonb(new);
  end if;
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any(v_allowed) then continue; end if;
    if (v_new -> v_key) is distinct from (v_old -> v_key) then
      raise exception 'locked_field' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function pipeline.web_leads_guard_staff_write() from public, anon, authenticated;

-- Runs before the other BEFORE triggers so their side effects are not treated as a staff edit.
drop trigger if exists web_leads_03_guard_staff_write on pipeline.web_leads;
create trigger web_leads_03_guard_staff_write
  before update on pipeline.web_leads
  for each row execute function pipeline.web_leads_guard_staff_write();

create table if not exists pipeline.web_lead_email_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references pipeline.web_leads(id),
  reference text not null check (reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'),
  kind text not null check (kind in ('staff_alert','applicant_reply','sla_escalation','delivery_alarm')),
  recipient_email text not null check (recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  state text not null default 'pending' check (state in ('pending','sending','sent','unknown','exhausted')),
  attempts int not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text,
  last_error text,
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) < 8000),
  idempotency_key uuid not null default gen_random_uuid(),
  alarmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, kind, recipient_email)
);

create index if not exists web_lead_email_due
  on pipeline.web_lead_email_outbox (next_attempt_at, id) where state = 'pending';

alter table pipeline.web_lead_email_outbox enable row level security;
alter table pipeline.web_lead_email_outbox force row level security;
revoke all on pipeline.web_lead_email_outbox from public, anon, authenticated;

create or replace function pipeline.web_lead_email_payload(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', p.reference,
    'is_test', p.is_test,
    'no_chase', coalesce(p.answers->>'no_chase', 'false') = 'true',
    'contact_consent', p.contact_consent,
    'ai_call_consent', p.ai_call_consent,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'owner_seat', p.assigned_seat,
    'owner_name', s.display_name,
    'owner_email', s.email,
    'submitted_at', p.submitted_at,
    'sla_due_at', p.sla_due_at,
    'purpose', p.purpose,
    'loan_amount', p.loan_amount,
    'property_value', p.property_value,
    'utm_source', p.utm_source,
    'utm_campaign', p.utm_campaign,
    'broker_tag', p.broker_tag
  )
  from pipeline.web_leads p
  left join pipeline.staff_seats s on s.seat_code = p.assigned_seat
  where p.id = p_id;
$$;
revoke all on function pipeline.web_lead_email_payload(uuid) from public, anon, authenticated;

-- Submitted fact finds only. Partial saves are not alerts.
-- no_chase still alerts staff, with the flag in the payload. It does not get an
-- applicant reply. Historical rows are not replayed.
create or replace function pipeline.web_lead_enqueue_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control pipeline.lead_ops_control;
  v_payload jsonb;
  v_email text;
begin
  if new.form_stage is distinct from 'submitted' then return null; end if;
  if tg_op = 'UPDATE' and old.form_stage = 'submitted' then return null; end if;
  if new.reference !~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$' then return null; end if;

  select * into v_control from pipeline.lead_ops_control c where c.id;
  v_payload := coalesce(pipeline.web_lead_email_payload(new.id), '{}'::jsonb);

  if v_control.email_alerts_armed_at is not null then
    insert into pipeline.web_lead_email_outbox (lead_id, reference, kind, recipient_email, payload)
    select new.id, new.reference, 'staff_alert', lower(s.email), v_payload
      from pipeline.staff_seats s
     where s.active and s.alert_copy and s.email is not null
    on conflict (lead_id, kind, recipient_email) do nothing;
  end if;

  v_email := lower(btrim(coalesce(new.email, '')));
  if v_control.autoreply_armed_at is not null
     and new.contact_consent
     and coalesce(new.answers->>'no_chase', 'false') <> 'true'
     and v_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     and (v_control.autoreply_allowlist is null or v_email = lower(v_control.autoreply_allowlist))
  then
    insert into pipeline.web_lead_email_outbox (lead_id, reference, kind, recipient_email, payload)
    values (new.id, new.reference, 'applicant_reply', v_email, v_payload)
    on conflict (lead_id, kind, recipient_email) do nothing;
  end if;
  return null;
end $$;
revoke all on function pipeline.web_lead_enqueue_email() from public, anon, authenticated;

drop trigger if exists web_leads_80_enqueue_email on pipeline.web_leads;
create trigger web_leads_80_enqueue_email
  after insert or update on pipeline.web_leads
  for each row execute function pipeline.web_lead_enqueue_email();

-- Email leases are retried. The provider call uses idempotency_key, so an expired
-- lease goes back to pending. The Telegram outbox does the opposite on purpose
-- and is not modified here.
create or replace function public.web_lead_email_claim(p_limit int default 4)
returns table (
  id uuid, lead_id uuid, reference text, kind text, recipient_email text,
  lease_id uuid, attempts int, idempotency_key uuid, payload jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update pipeline.web_lead_email_outbox o
     set state = 'pending', last_error = 'expired_lease', lease_id = null, lease_until = null,
         next_attempt_at = now(), updated_at = now()
   where o.state = 'sending' and o.lease_until < now();

  update pipeline.web_lead_email_outbox o
     set state = 'exhausted', updated_at = now()
   where o.state = 'pending' and o.attempts >= 8;

  return query
  with due as (
    select o.id
      from pipeline.web_lead_email_outbox o
     where o.state = 'pending' and o.attempts < 8 and o.next_attempt_at <= now()
     order by o.created_at, o.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 4), 10))
  )
  update pipeline.web_lead_email_outbox o
     set state = 'sending', attempts = o.attempts + 1, lease_id = gen_random_uuid(),
         lease_until = now() + interval '90 seconds', updated_at = now()
    from due
   where o.id = due.id
  returning o.id, o.lead_id, o.reference, o.kind, o.recipient_email, o.lease_id,
            o.attempts, o.idempotency_key, o.payload, o.created_at;
end $$;

create or replace function public.web_lead_email_finish(
  p_id uuid, p_lease_id uuid, p_result text, p_provider_id text default null,
  p_retry_seconds int default 60, p_error text default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if p_result not in ('sent','rejected','unknown','suppressed') then
    raise exception 'invalid result';
  end if;
  if p_result = 'sent' and nullif(btrim(coalesce(p_provider_id, '')), '') is null then
    raise exception 'receipt required';
  end if;
  update pipeline.web_lead_email_outbox o
     set state = case
           when p_result = 'sent' then 'sent'
           when p_result = 'suppressed' then 'exhausted'
           when o.attempts >= 8 then 'exhausted'
           else 'pending' end,
         provider_id = case when p_result = 'sent' then left(p_provider_id, 200) else o.provider_id end,
         last_error = case when p_result = 'sent' then null else left(coalesce(p_error, p_result), 200) end,
         alarmed_at = case when p_result = 'suppressed' then coalesce(o.alarmed_at, now()) else o.alarmed_at end,
         next_attempt_at = now() + make_interval(secs => greatest(30, least(coalesce(p_retry_seconds, 60), 3600))),
         lease_id = null, lease_until = null, updated_at = now()
   where o.id = p_id and o.lease_id = p_lease_id and o.state = 'sending';
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- One alarm per stuck staff alert or SLA email, to the alert-copy seats.
-- Delivery alarms are not themselves alarmed.
create or replace function public.web_lead_email_raise_alarms()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int := 0;
begin
  if (select c.email_alerts_armed_at from pipeline.lead_ops_control c where c.id) is null then
    return 0;
  end if;
  with stuck as (
    select o.id, o.lead_id, o.reference, o.kind, o.state, o.last_error, o.created_at, o.payload
      from pipeline.web_lead_email_outbox o
     where o.kind in ('staff_alert','sla_escalation')
       and o.state <> 'sent'
       and o.alarmed_at is null
       and o.created_at < now() - interval '2 minutes'
     for update
  ), marked as (
    update pipeline.web_lead_email_outbox o
       set alarmed_at = now(), updated_at = now()
      from stuck s
     where o.id = s.id
    returning s.lead_id, s.reference, s.kind, s.state, s.last_error, s.created_at, s.payload
  )
  insert into pipeline.web_lead_email_outbox (lead_id, reference, kind, recipient_email, payload)
  select m.lead_id, m.reference, 'delivery_alarm', lower(seat.email),
         jsonb_build_object(
           'reference', m.reference,
           'about_kind', m.kind,
           'about_state', m.state,
           'about_error', m.last_error,
           'about_created_at', m.created_at,
           'owner_name', m.payload->'owner_name',
           'owner_email', m.payload->'owner_email',
           'full_name', m.payload->'full_name',
           'email', m.payload->'email',
           'phone', m.payload->'phone',
           'contact_consent', m.payload->'contact_consent',
           'ai_call_consent', m.payload->'ai_call_consent',
           'no_chase', m.payload->'no_chase',
           'is_test', m.payload->'is_test'
         )
    from marked m
    join pipeline.staff_seats seat on seat.active and seat.alert_copy and seat.email is not null
  on conflict (lead_id, kind, recipient_email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Escalates to Byron when contacted_at is still null at sla_due_at.
-- no_chase is not escalated: chasing is forbidden. The clock itself is stored on submit.
create or replace function public.web_lead_sla_escalate(p_limit int default 10)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int := 0;
begin
  if (select c.sla_armed_at from pipeline.lead_ops_control c where c.id) is null then
    return 0;
  end if;
  with recipient as (
    select lower(s.email) as email
      from pipeline.staff_seats s
     where s.seat_code = 'byron' and s.active and s.email is not null
  ), due as (
    select l.id
      from pipeline.web_leads l
     where l.form_stage = 'submitted'
       and l.contacted_at is null
       and l.sla_escalated_at is null
       and l.sla_due_at is not null
       and l.sla_due_at <= now()
       and coalesce(l.answers->>'no_chase', 'false') <> 'true'
       and l.status not in ('closed_won','closed_lost','spam')
       and exists (select 1 from recipient)
     order by l.sla_due_at, l.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 10), 20))
  ), marked as (
    update pipeline.web_leads l
       set sla_escalated_at = now()
      from due d
     where l.id = d.id
    returning l.*
  )
  insert into pipeline.web_lead_email_outbox (lead_id, reference, kind, recipient_email, payload)
  select m.id, m.reference, 'sla_escalation', r.email,
         jsonb_build_object(
           'reference', m.reference,
           'is_test', m.is_test,
           'no_chase', coalesce(m.answers->>'no_chase', 'false') = 'true',
           'contact_consent', m.contact_consent,
           'ai_call_consent', m.ai_call_consent,
           'full_name', m.full_name,
           'email', m.email,
           'phone', m.phone,
           'owner_seat', m.assigned_seat,
           'owner_name', s.display_name,
           'owner_email', s.email,
           'submitted_at', m.submitted_at,
           'sla_due_at', m.sla_due_at,
           'purpose', m.purpose,
           'loan_amount', m.loan_amount,
           'property_value', m.property_value,
           'utm_source', m.utm_source,
           'utm_campaign', m.utm_campaign,
           'broker_tag', m.broker_tag
         )
    from marked m
    cross join recipient r
    left join pipeline.staff_seats s on s.seat_code = m.assigned_seat
  on conflict (lead_id, kind, recipient_email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.web_lead_email_claim(int) from public, anon, authenticated;
revoke all on function public.web_lead_email_finish(uuid, uuid, text, text, int, text) from public, anon, authenticated;
revoke all on function public.web_lead_email_raise_alarms() from public, anon, authenticated;
revoke all on function public.web_lead_sla_escalate(int) from public, anon, authenticated;
grant execute on function public.web_lead_email_claim(int) to service_role;
grant execute on function public.web_lead_email_finish(uuid, uuid, text, text, int, text) to service_role;
grant execute on function public.web_lead_email_raise_alarms() to service_role;
grant execute on function public.web_lead_sla_escalate(int) to service_role;

-- Every active seat can read the open queue. Writes are the mark-contacted RPC
-- (principal, crm_operator, case_owner) plus the column guard above.
create or replace function public.staff_new_web_leads()
returns table (
  id uuid, reference text, submitted_at timestamptz, full_name text, email text, phone text,
  owner_name text, owner_email text, assigned_seat text, contacted_at timestamptz,
  sla_due_at timestamptz, contact_consent boolean, ai_call_consent boolean,
  no_chase boolean, is_test boolean, status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not pipeline.has_role(array['principal','crm_operator','case_owner','analyst','read_only']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select l.id, l.reference, l.submitted_at, l.full_name, l.email, l.phone,
         s.display_name, s.email, l.assigned_seat, l.contacted_at, l.sla_due_at,
         l.contact_consent, l.ai_call_consent,
         coalesce(l.answers->>'no_chase', 'false') = 'true', l.is_test, l.status::text
    from pipeline.web_leads l
    left join pipeline.staff_seats s on s.seat_code = l.assigned_seat
   where l.form_stage = 'submitted'
     and l.closed_at is null
     and l.status not in ('closed_won','closed_lost','spam')
   order by l.submitted_at desc nulls last, l.id
   limit 100;
end $$;

create or replace function public.web_lead_mark_contacted(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_ref text;
begin
  if not pipeline.has_role(array['principal','crm_operator','case_owner']) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update pipeline.web_leads l
     set status = 'contacted', contacted_at = coalesce(l.contacted_at, now())
   where l.id = p_id
     and l.status not in ('closed_won','closed_lost','spam')
  returning l.reference into v_ref;
  if v_ref is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true, 'reference', v_ref);
end $$;

revoke all on function public.staff_new_web_leads() from public, anon, service_role;
revoke all on function public.web_lead_mark_contacted(uuid) from public, anon, service_role;
grant execute on function public.staff_new_web_leads() to authenticated;
grant execute on function public.web_lead_mark_contacted(uuid) to authenticated;

-- Links seats to auth users that already exist. Does not create logins or passwords.
-- Safe to rerun after Byron invites Jess, Chris, and Cai.
create or replace function pipeline.link_staff_seats()
returns table (seat_code text, email text, linked boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update pipeline.staff_seats s
     set auth_user_id = u.id, updated_at = now()
    from auth.users u
   where s.email is not null and lower(u.email) = lower(s.email);

  insert into pipeline.staff (user_id, display_name, role, is_active, email, seat_code)
  select u.id, s.display_name, s.role, true, s.email, s.seat_code
    from pipeline.staff_seats s
    join auth.users u on u.id = s.auth_user_id
  on conflict (user_id) do update
    set email = excluded.email,
        seat_code = excluded.seat_code,
        display_name = excluded.display_name,
        is_active = true,
        role = case when pipeline.staff.role = 'principal' then pipeline.staff.role else excluded.role end;

  update pipeline.web_leads l
     set assigned_to = s.auth_user_id
    from pipeline.staff_seats s
   where l.assigned_seat = s.seat_code
     and l.assigned_to is null
     and s.auth_user_id is not null;

  return query
  select s.seat_code, s.email, s.auth_user_id is not null
    from pipeline.staff_seats s
   order by s.round_robin_order nulls first, s.seat_code;
end $$;
revoke all on function pipeline.link_staff_seats() from public, anon, authenticated, service_role;

insert into public.crm_users (email, role)
values
  ('jessica@posfincapital.com', 'member'),
  ('chris.shipton@posfincapital.com', 'member')
on conflict (email) do nothing;

select pipeline.link_staff_seats();

-- Owner on the CRM projection follows the seat. First insert only; existing CRM rows stay.
create or replace function pipeline.web_lead_project_crm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.form_stage <> 'submitted' then return null; end if;
  insert into public.leads(id, full_name, email, phone, company_name, is_ltd, raw_answers, status, source,
    contact_hold_reason, contact_hold_by, contact_hold_at, consent_source, consent_at, market, assigned_to)
  values (
    new.id, new.full_name, new.email, new.phone, new.company_name,
    coalesce(new.borrower_type in ('Company','An existing company','A new SPV'), false),
    new.answers || jsonb_build_object(
      '_factfind_reference', new.reference, '_factfind_id', new.id,
      '_submitted_at', new.submitted_at, '_qualification', 'Pending broker review', '_is_test', new.is_test,
      '_owner_seat', new.assigned_seat,
      '_attribution', jsonb_build_object(
        'source', new.source, 'broker_tag', new.broker_tag, 'utm_source', new.utm_source,
        'utm_medium', new.utm_medium, 'utm_campaign', new.utm_campaign, 'utm_term', new.utm_term,
        'utm_content', new.utm_content, 'landing_path', new.landing_path, 'referrer_host', new.referrer_host
      ),
      '_consent_version', new.consent_text_version
    ),
    'new',
    case when new.is_test then 'web_factfind_test' else 'web_factfind_uk' end,
    case when new.is_test then 'SYNTHETIC TEST — DO NOT CONTACT' else 'Secured enquiry — broker review before outreach; not unsecured statement nurture' end,
    'factfind-integration', now(), 'UK Fact Find', new.contact_consent_at, 'UK',
    coalesce(
      (select s.email from pipeline.staff_seats s where s.seat_code = new.assigned_seat and s.email is not null),
      case new.broker_tag when 'chris' then 'chris.shipton@posfincapital.com' when 'bh' then 'byron.hill@posfincapital.com' end
    )
  )
  on conflict (id) do nothing;
  return null;
end $$;

create or replace function pipeline.web_leads_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text := pipeline.current_staff_role();
begin
  if tg_op = 'INSERT' then
    insert into pipeline.web_lead_events (lead_id, event_type, to_status, actor_uid, actor_role, detail)
    values (new.id, 'created', new.status, auth.uid(), v_role,
      jsonb_build_object('source', new.source, 'broker_tag', new.broker_tag, 'is_test', new.is_test, 'assigned_seat', new.assigned_seat));
  else
    if new.form_stage = 'submitted' and old.form_stage = 'partial' then
      insert into pipeline.web_lead_events (lead_id, event_type, to_status, actor_uid, actor_role, detail)
      values (new.id, 'fact_find_submitted', new.status, auth.uid(), v_role,
        jsonb_build_object('possible_duplicate', new.possible_duplicate_of is not null, 'assigned_seat', new.assigned_seat));
    end if;
    if new.status is distinct from old.status then
      insert into pipeline.web_lead_events (lead_id, event_type, from_status, to_status, actor_uid, actor_role)
      values (new.id, 'status_changed', old.status, new.status, auth.uid(), v_role);
    end if;
    if new.assigned_to is distinct from old.assigned_to or new.assigned_seat is distinct from old.assigned_seat then
      insert into pipeline.web_lead_events (lead_id, event_type, actor_uid, actor_role, detail)
      values (new.id, 'assigned', auth.uid(), v_role,
        jsonb_build_object('assigned_to', new.assigned_to, 'assigned_seat', new.assigned_seat));
    end if;
    if new.case_id is distinct from old.case_id then
      insert into pipeline.web_lead_events (lead_id, event_type, actor_uid, actor_role, detail)
      values (new.id, 'case_linked', auth.uid(), v_role, jsonb_build_object('case_id', new.case_id));
    end if;
  end if;
  return null;
end $$;

commit;

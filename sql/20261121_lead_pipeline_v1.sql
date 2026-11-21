-- Lead pipeline v1 adjustments. NOT APPLIED by this pull request.
-- Apply only after Byron has read it, and only after sql/20261120_lead_ops_v1.sql.
-- Additive: new columns, a new outbox, new functions. It does not remove tables,
-- columns, or existing lead rows. Existing web_leads rows are not copied into the sheet queue.
--
-- What changes for the NEXT submission, once this file has been applied:
--   Owner: Byron, then Jessica if Byron's seat is inactive.
--   Round-robin (Jess, Aadi, Cai, Chris) stays defined on the seats and runs only when
--   pipeline.lead_ops_control.round_robin_enabled is true. It defaults to false.
--   SLA: 15 minutes inside Mon–Fri 09:00–18:00 Europe/London. Weekends wait until Monday.
--   Applicant auto-reply allowlist: if it is empty, it is set back to Byron only.
--   Sheet sync stays off until sheet_armed_at is set. Nothing here sends email by itself.

begin;

alter table pipeline.lead_ops_control
  add column if not exists round_robin_enabled boolean not null default false;

alter table pipeline.lead_ops_control
  add column if not exists sheet_armed_at timestamptz;

alter table pipeline.lead_ops_control
  add column if not exists sheet_include_tests boolean not null default false;

alter table pipeline.staff_seats
  add column if not exists backup boolean not null default false;

create unique index if not exists staff_seats_one_backup
  on pipeline.staff_seats (backup) where backup;

-- Jessica is the backup owner. Does not replace a backup Byron has already chosen.
update pipeline.staff_seats
   set backup = true, updated_at = now()
 where seat_code = 'jess'
   and not exists (select 1 from pipeline.staff_seats where backup);

-- Draft applicant wording is not approved. Do not mail other applicants if the
-- allowlist was cleared. Leaves a non-null allowlist Byron already set as it is.
update pipeline.lead_ops_control
   set autoreply_allowlist = 'byron.hill@posfincapital.com', updated_at = now()
 where id and autoreply_allowlist is null;

alter table pipeline.web_leads add column if not exists next_action text;
alter table pipeline.web_leads add column if not exists staff_note text;

-- Mon–Fri 09:00–18:00 Europe/London. 15 minutes. Time left at 18:00 carries to 09:00
-- on the next weekday. Keep in step with lib/lead-sla.js.
create or replace function pipeline.web_lead_sla_due(p_submitted timestamptz)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  t timestamp;
  remain interval := interval '15 minutes';
  available interval;
  guard int := 0;
  dow int;
begin
  if p_submitted is null then return null; end if;
  t := timezone('Europe/London', p_submitted);
  loop
    guard := guard + 1;
    if guard > 12 then raise exception 'sla_window'; end if;
    dow := extract(isodow from t);
    if dow >= 6 then
      t := date_trunc('day', t) + ((8 - dow) * interval '1 day') + time '09:00';
    elsif t::time < time '09:00' then
      t := date_trunc('day', t) + time '09:00';
    elsif t::time >= time '18:00' then
      t := date_trunc('day', t) + interval '1 day' + time '09:00';
    else
      available := (date_trunc('day', t) + time '18:00') - t;
      if remain <= available then
        return timezone('Europe/London', t + remain);
      end if;
      remain := remain - available;
      t := date_trunc('day', t) + interval '1 day' + time '09:00';
    end if;
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
  v_round boolean;
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

  select coalesce(c.round_robin_enabled, false) into v_round
    from pipeline.lead_ops_control c where c.id;

  if v_seat is null and v_round then
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
  if v_seat is null then
    select s.seat_code into v_seat
      from pipeline.staff_seats s
     where s.active and s.backup
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

-- Same column lock as 20261120, plus next_action and staff_note for seats that may write.
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
    v_allowed := array['status','contacted_at','closed_at','updated_at','updated_by','assigned_to','assigned_seat','owner_assigned_at','next_action','staff_note'];
  else
    v_allowed := array['status','contacted_at','closed_at','updated_at','updated_by','next_action','staff_note'];
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
    'consent_text_version', p.consent_text_version,
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
    'utm_medium', p.utm_medium,
    'utm_campaign', p.utm_campaign,
    'utm_content', p.utm_content,
    'broker_tag', p.broker_tag
  )
  from pipeline.web_leads p
  left join pipeline.staff_seats s on s.seat_code = p.assigned_seat
  where p.id = p_id;
$$;
revoke all on function pipeline.web_lead_email_payload(uuid) from public, anon, authenticated;

-- One row per new submission. Idempotent on lead_id. No copy of older leads.
create table if not exists pipeline.web_lead_sheet_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references pipeline.web_leads(id),
  reference text not null check (reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'),
  state text not null default 'pending' check (state in ('pending','sending','sent','unknown','exhausted')),
  attempts int not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text,
  last_error text,
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) < 12000),
  alarmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_lead_sheet_due
  on pipeline.web_lead_sheet_outbox (next_attempt_at, id) where state = 'pending';

alter table pipeline.web_lead_sheet_outbox enable row level security;
alter table pipeline.web_lead_sheet_outbox force row level security;
revoke all on pipeline.web_lead_sheet_outbox from public, anon, authenticated;

create or replace function pipeline.web_lead_sheet_payload(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lead_id', p.id,
    'reference', p.reference,
    'submitted_at', p.submitted_at,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'postcode', coalesce(p.security_postcode, p.answers->>'security_postcode'),
    'address', coalesce(p.security_address, p.answers->>'security_address'),
    'loan_amount', p.loan_amount,
    'purpose', p.purpose,
    'utm_source', p.utm_source,
    'utm_medium', p.utm_medium,
    'utm_campaign', p.utm_campaign,
    'utm_content', p.utm_content,
    'contact_consent', p.contact_consent,
    'consent_text_version', p.consent_text_version,
    'owner_name', s.display_name,
    'status', p.status,
    'contacted_at', p.contacted_at,
    'next_action', p.next_action,
    'notes', coalesce(p.staff_note, p.answers->>'notes'),
    'is_test', p.is_test,
    'ai_call_consent', p.ai_call_consent,
    'no_chase', coalesce(p.answers->>'no_chase', 'false') = 'true'
  )
  from pipeline.web_leads p
  left join pipeline.staff_seats s on s.seat_code = p.assigned_seat
  where p.id = p_id;
$$;
revoke all on function pipeline.web_lead_sheet_payload(uuid) from public, anon, authenticated;

create or replace function pipeline.web_lead_enqueue_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control pipeline.lead_ops_control;
  v_payload jsonb;
begin
  if new.form_stage is distinct from 'submitted' then return null; end if;
  if tg_op = 'UPDATE' and old.form_stage = 'submitted' then return null; end if;
  if new.reference !~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$' then return null; end if;

  select * into v_control from pipeline.lead_ops_control c where c.id;
  if v_control.sheet_armed_at is null then return null; end if;
  if new.is_test and not coalesce(v_control.sheet_include_tests, false) then return null; end if;

  v_payload := coalesce(pipeline.web_lead_sheet_payload(new.id), '{}'::jsonb);
  insert into pipeline.web_lead_sheet_outbox (lead_id, reference, payload)
  values (new.id, new.reference, v_payload)
  on conflict (lead_id) do nothing;
  return null;
end $$;
revoke all on function pipeline.web_lead_enqueue_sheet() from public, anon, authenticated;

drop trigger if exists web_leads_81_enqueue_sheet on pipeline.web_leads;
create trigger web_leads_81_enqueue_sheet
  after insert or update on pipeline.web_leads
  for each row execute function pipeline.web_lead_enqueue_sheet();

create or replace function public.web_lead_sheet_claim(p_limit int default 4)
returns table (
  id uuid, lead_id uuid, reference text, lease_id uuid, attempts int, payload jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update pipeline.web_lead_sheet_outbox o
     set state = 'pending', last_error = 'expired_lease', lease_id = null, lease_until = null,
         next_attempt_at = now(), updated_at = now()
   where o.state = 'sending' and o.lease_until < now();

  update pipeline.web_lead_sheet_outbox o
     set state = 'exhausted', updated_at = now()
   where o.state = 'pending' and o.attempts >= 8;

  return query
  with due as (
    select o.id
      from pipeline.web_lead_sheet_outbox o
     where o.state = 'pending' and o.attempts < 8 and o.next_attempt_at <= now()
     order by o.created_at, o.id
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 4), 10))
  )
  update pipeline.web_lead_sheet_outbox o
     set state = 'sending', attempts = o.attempts + 1, lease_id = gen_random_uuid(),
         lease_until = now() + interval '90 seconds', updated_at = now()
    from due
   where o.id = due.id
  returning o.id, o.lead_id, o.reference, o.lease_id, o.attempts, o.payload, o.created_at;
end $$;

create or replace function public.web_lead_sheet_finish(
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
  update pipeline.web_lead_sheet_outbox o
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

-- Stuck sheet rows raise the same delivery_alarm email as a stuck staff alert.
-- The alarm email is queued only when staff email is armed. The worker still
-- reports the row as overdue when it is unsent after 2 minutes.
create or replace function public.web_lead_sheet_raise_alarms()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int := 0;
begin
  if (select c.sheet_armed_at from pipeline.lead_ops_control c where c.id) is null then
    return 0;
  end if;
  with stuck as (
    select o.id, o.lead_id, o.reference, o.state, o.last_error, o.created_at, o.payload
      from pipeline.web_lead_sheet_outbox o
     where o.state <> 'sent'
       and o.alarmed_at is null
       and o.created_at < now() - interval '2 minutes'
     for update
  ), marked as (
    update pipeline.web_lead_sheet_outbox o
       set alarmed_at = now(), updated_at = now()
      from stuck s
     where o.id = s.id
    returning s.lead_id, s.reference, s.state, s.last_error, s.created_at, s.payload
  )
  insert into pipeline.web_lead_email_outbox (lead_id, reference, kind, recipient_email, payload)
  select m.lead_id, m.reference, 'delivery_alarm', lower(seat.email),
         jsonb_build_object(
           'reference', m.reference,
           'about_kind', 'sheet_append',
           'about_state', m.state,
           'about_error', m.last_error,
           'about_created_at', m.created_at,
           'owner_name', m.payload->'owner_name',
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
   where (select c.email_alerts_armed_at from pipeline.lead_ops_control c where c.id) is not null
  on conflict (lead_id, kind, recipient_email) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.web_lead_sheet_claim(int) from public, anon, authenticated;
revoke all on function public.web_lead_sheet_finish(uuid, uuid, text, text, int, text) from public, anon, authenticated;
revoke all on function public.web_lead_sheet_raise_alarms() from public, anon, authenticated;
grant execute on function public.web_lead_sheet_claim(int) to service_role;
grant execute on function public.web_lead_sheet_finish(uuid, uuid, text, text, int, text) to service_role;
grant execute on function public.web_lead_sheet_raise_alarms() to service_role;

-- New signature, so this is a new function. The v1 reader stays.
create or replace function public.staff_new_web_leads_v2(p_include_tests boolean default false)
returns table (
  id uuid, reference text, submitted_at timestamptz, full_name text, email text, phone text,
  owner_name text, owner_email text, assigned_seat text, contacted_at timestamptz,
  sla_due_at timestamptz, contact_consent boolean, ai_call_consent boolean,
  no_chase boolean, is_test boolean, status text, next_action text, staff_note text,
  consent_text_version text
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
         coalesce(l.answers->>'no_chase', 'false') = 'true', l.is_test, l.status::text,
         l.next_action, l.staff_note, l.consent_text_version
    from pipeline.web_leads l
    left join pipeline.staff_seats s on s.seat_code = l.assigned_seat
   where l.form_stage = 'submitted'
     and l.closed_at is null
     and (coalesce(p_include_tests, false) or l.is_test = false)
     and l.status not in ('closed_won','closed_lost','spam')
   order by l.submitted_at desc nulls last, l.id
   limit 100;
end $$;

create or replace function public.web_lead_staff_patch(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := pipeline.current_staff_role();
  v_status text;
  v_seat text;
  v_next text;
  v_note text;
  v_ref text;
begin
  if v_role is null or v_role in ('read_only', 'analyst') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  if p_patch ? 'status' then
    v_status := p_patch->>'status';
    if v_status not in ('new','contacted','qualified','fact_find_complete','referred','closed_won','closed_lost','spam') then
      raise exception 'status_not_allowed' using errcode = '42501';
    end if;
    if v_role <> 'principal' and v_status <> 'contacted' then
      raise exception 'status_not_allowed' using errcode = '42501';
    end if;
  end if;
  if p_patch ? 'assigned_seat' then
    if v_role <> 'principal' then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    v_seat := p_patch->>'assigned_seat';
    if not exists (
      select 1 from pipeline.staff_seats s where s.seat_code = v_seat and s.active
    ) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  if p_patch ? 'next_action' then
    v_next := left(btrim(coalesce(p_patch->>'next_action', '')), 240);
  end if;
  if p_patch ? 'staff_note' then
    v_note := left(btrim(coalesce(p_patch->>'staff_note', '')), 1000);
  end if;

  update pipeline.web_leads l
     set status = coalesce(v_status::pipeline.web_lead_status, l.status),
         contacted_at = case
           when v_status = 'contacted' then coalesce(l.contacted_at, now())
           else l.contacted_at end,
         assigned_seat = coalesce(v_seat, l.assigned_seat),
         next_action = case when p_patch ? 'next_action' then nullif(v_next, '') else l.next_action end,
         staff_note = case when p_patch ? 'staff_note' then nullif(v_note, '') else l.staff_note end,
         updated_at = now(),
         updated_by = auth.uid()
   where l.id = p_id
     and l.form_stage = 'submitted'
  returning l.reference into v_ref;
  if v_ref is null then raise exception 'not_allowed' using errcode = '42501'; end if;

  if p_patch ? 'next_action' or p_patch ? 'staff_note' then
    insert into pipeline.web_lead_events (lead_id, event_type, actor_uid, actor_role, detail)
    values (
      p_id, 'note_added', auth.uid(), v_role,
      jsonb_strip_nulls(jsonb_build_object(
        'next_action', case when p_patch ? 'next_action' then v_next else null end,
        'staff_note', case when p_patch ? 'staff_note' then v_note else null end
      ))
    );
  end if;
  return jsonb_build_object('ok', true, 'reference', v_ref);
end $$;

revoke all on function public.staff_new_web_leads_v2(boolean) from public, anon, service_role;
revoke all on function public.web_lead_staff_patch(uuid, jsonb) from public, anon, service_role;
grant execute on function public.staff_new_web_leads_v2(boolean) to authenticated;
grant execute on function public.web_lead_staff_patch(uuid, jsonb) to authenticated;

-- Server-side read for the staff cockpit. No browser key. The cockpit checks its own
-- staff session before calling this. It does not replace the role-checked v2 reader.
create or replace function public.staff_new_web_leads_service(p_include_tests boolean default false)
returns table (
  id uuid, reference text, submitted_at timestamptz, full_name text, email text, phone text,
  owner_name text, owner_email text, assigned_seat text, contacted_at timestamptz,
  sla_due_at timestamptz, contact_consent boolean, ai_call_consent boolean,
  no_chase boolean, is_test boolean, status text, next_action text, staff_note text,
  consent_text_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select l.id, l.reference, l.submitted_at, l.full_name, l.email, l.phone,
         s.display_name, s.email, l.assigned_seat, l.contacted_at, l.sla_due_at,
         l.contact_consent, l.ai_call_consent,
         coalesce(l.answers->>'no_chase', 'false') = 'true', l.is_test, l.status::text,
         l.next_action, l.staff_note, l.consent_text_version
    from pipeline.web_leads l
    left join pipeline.staff_seats s on s.seat_code = l.assigned_seat
   where l.form_stage = 'submitted'
     and l.closed_at is null
     and (coalesce(p_include_tests, false) or l.is_test = false)
     and l.status not in ('closed_won','closed_lost','spam')
   order by l.submitted_at desc nulls last, l.id
   limit 100;
end $$;
revoke all on function public.staff_new_web_leads_service(boolean) from public, anon, authenticated;
grant execute on function public.staff_new_web_leads_service(boolean) to service_role;

commit;

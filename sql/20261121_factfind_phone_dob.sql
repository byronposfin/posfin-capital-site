-- Fact-find phone and date of birth. NOT APPLIED.
-- Additive only. No deletes, no drops, no backfill of old rows.
-- Phone already has a column. These statements copy it from answers when present,
-- add nullable date-of-birth columns, and include both values on the staff email
-- payload, the lead-sheet payload, and new staff readers. The v1 and v2 readers stay.

begin;

alter table pipeline.web_leads add column if not exists applicant_dob date;
alter table pipeline.web_leads add column if not exists joint_applicant_dob date;

create or replace function pipeline.web_leads_project_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a jsonb := coalesce(new.answers, '{}'::jsonb);
  v_joint boolean := a->>'ownership' = 'Joint with spouse or partner';
begin
  if nullif(btrim(a->>'phone'), '') is not null then
    new.phone := left(btrim(a->>'phone'), 40);
  end if;
  if a->>'applicant_dob' ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      new.applicant_dob := (a->>'applicant_dob')::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      null;
    end;
  end if;
  if v_joint and a->>'applicant_2_dob' ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      new.joint_applicant_dob := (a->>'applicant_2_dob')::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      null;
    end;
  elsif not v_joint then
    new.joint_applicant_dob := null;
  end if;
  return new;
end $$;

revoke all on function pipeline.web_leads_project_contact() from public, anon, authenticated;

do $contact$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'web_leads_13_project_contact'
      and tgrelid = 'pipeline.web_leads'::regclass
  ) then
    create trigger web_leads_13_project_contact
      before insert or update of answers on pipeline.web_leads
      for each row execute function pipeline.web_leads_project_contact();
  end if;
end
$contact$;

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
    'phone', coalesce(nullif(btrim(p.phone), ''), nullif(btrim(p.answers->>'phone'), '')),
    'applicant_dob', coalesce(to_char(p.applicant_dob, 'YYYY-MM-DD'), nullif(p.answers->>'applicant_dob', '')),
    'joint_applicant_dob', case
      when p.answers->>'ownership' = 'Joint with spouse or partner'
      then coalesce(to_char(p.joint_applicant_dob, 'YYYY-MM-DD'), nullif(p.answers->>'applicant_2_dob', ''))
      else null end,
    'owner_seat', p.assigned_seat,
    'owner_name', s.display_name,
    'owner_email', s.email,
    'submitted_at', p.submitted_at,
    'sla_due_at', p.sla_due_at,
    'purpose', p.purpose,
    'loan_amount', p.loan_amount,
    'property_value', p.property_value,
    'address', coalesce(p.security_address, p.answers->>'security_address'),
    'postcode', coalesce(p.security_postcode, p.answers->>'security_postcode'),
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
    'phone', coalesce(nullif(btrim(p.phone), ''), nullif(btrim(p.answers->>'phone'), '')),
    'applicant_dob', coalesce(to_char(p.applicant_dob, 'YYYY-MM-DD'), nullif(p.answers->>'applicant_dob', '')),
    'joint_applicant_dob', case
      when p.answers->>'ownership' = 'Joint with spouse or partner'
      then coalesce(to_char(p.joint_applicant_dob, 'YYYY-MM-DD'), nullif(p.answers->>'applicant_2_dob', ''))
      else null end,
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

create or replace function public.staff_new_web_leads_v3(p_include_tests boolean default false)
returns table (
  id uuid, reference text, submitted_at timestamptz, full_name text, email text, phone text,
  applicant_dob text, joint_applicant_dob text,
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
  select l.id, l.reference, l.submitted_at, l.full_name, l.email,
         coalesce(nullif(btrim(l.phone), ''), nullif(btrim(l.answers->>'phone'), '')),
         coalesce(to_char(l.applicant_dob, 'YYYY-MM-DD'), nullif(l.answers->>'applicant_dob', '')),
         case when l.answers->>'ownership' = 'Joint with spouse or partner'
           then coalesce(to_char(l.joint_applicant_dob, 'YYYY-MM-DD'), nullif(l.answers->>'applicant_2_dob', ''))
           else null end,
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

create or replace function public.staff_new_web_leads_service_v2(p_include_tests boolean default false)
returns table (
  id uuid, reference text, submitted_at timestamptz, full_name text, email text, phone text,
  applicant_dob text, joint_applicant_dob text,
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
  select l.id, l.reference, l.submitted_at, l.full_name, l.email,
         coalesce(nullif(btrim(l.phone), ''), nullif(btrim(l.answers->>'phone'), '')),
         coalesce(to_char(l.applicant_dob, 'YYYY-MM-DD'), nullif(l.answers->>'applicant_dob', '')),
         case when l.answers->>'ownership' = 'Joint with spouse or partner'
           then coalesce(to_char(l.joint_applicant_dob, 'YYYY-MM-DD'), nullif(l.answers->>'applicant_2_dob', ''))
           else null end,
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

revoke all on function public.staff_new_web_leads_v3(boolean) from public, anon, service_role;
revoke all on function public.staff_new_web_leads_service_v2(boolean) from public, anon, authenticated;
grant execute on function public.staff_new_web_leads_v3(boolean) to authenticated;
grant execute on function public.staff_new_web_leads_service_v2(boolean) to service_role;

commit;

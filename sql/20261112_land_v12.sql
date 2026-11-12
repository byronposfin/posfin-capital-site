-- LAND v1.2. Stage/test this transaction before release. Existing cases are not replayed.
begin;
create table pipeline.web_lead_land_control(id boolean primary key default true check(id),armed_at timestamptz not null default now());
insert into pipeline.web_lead_land_control default values;
alter table pipeline.web_lead_land_control enable row level security;
alter table pipeline.web_lead_land_control force row level security;
revoke all on pipeline.web_lead_land_control from public,anon,authenticated;
alter table pipeline.web_lead_alert_outbox add column recipient_chat_id text not null default '1750758657' check(recipient_chat_id in ('1750758657','8634157536'));
alter table pipeline.web_lead_alert_outbox drop constraint web_lead_alert_outbox_lead_id_key;
alter table pipeline.web_lead_alert_outbox add constraint web_lead_alert_recipient_key unique(lead_id,recipient_chat_id);
drop function public.web_lead_alert_claim(int);
create or replace function pipeline.web_lead_land_gate() returns trigger language plpgsql set search_path='' as $$
declare v numeric; declined boolean;
begin
 if new.answers->>'intake_type'<>'pa_land' or new.answers->>'intake_type' is null then return new; end if;
 v:=case when new.answers->>'property_value' ~ '^[0-9]+$' then (new.answers->>'property_value')::numeric end;
 declined:=v is not null and v<200000;
 new.answers:=new.answers || jsonb_build_object('no_chase',declined,'decline_reason',case when declined then 'Below minimum value' else null end);
 if declined then
  if new.form_stage='submitted' then raise exception 'Below minimum value'; end if;
  new.status:='closed_lost';
 elsif tg_op='UPDATE' and old.answers->>'decline_reason'='Below minimum value' and new.status='closed_lost' then new.status:='new';
 end if;
 if new.form_stage='submitted' and (new.answers->>'term_months' is null or new.answers->>'term_months' not in ('6','9','12','18','24')) then raise exception 'Invalid land term'; end if;
 return new;
end $$;
create trigger web_leads_05_land_gate before insert or update on pipeline.web_leads for each row execute function pipeline.web_lead_land_gate();
revoke all on function pipeline.web_lead_land_gate() from public,anon,authenticated;
create or replace function pipeline.web_lead_enqueue_main_alert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.form_stage='submitted' and coalesce(new.answers->>'no_chase','false')<>'true' and new.reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'
 and (tg_op='INSERT' or old.form_stage is distinct from 'submitted') then
  insert into pipeline.web_lead_alert_outbox(lead_id,reference) values(new.id,new.reference) on conflict(lead_id,recipient_chat_id) do nothing;
  if new.answers->>'intake_type'='pa_land' then
   insert into pipeline.web_lead_alert_outbox(lead_id,reference,recipient_chat_id) values(new.id,new.reference,'8634157536') on conflict(lead_id,recipient_chat_id) do nothing;
  end if;
 end if;
 return null;
end $$;
revoke all on function pipeline.web_lead_enqueue_main_alert() from public,anon,authenticated;


create function public.web_lead_alert_claim(p_limit int default 10)
returns table(id uuid,reference text,lease_id uuid,attempts int,recipient_chat_id text)
language plpgsql security definer set search_path='' as $$
begin
 -- Reconcile any submitted records written since activation; historical tests are not replayed.
 insert into pipeline.web_lead_alert_outbox(lead_id,reference)
 select l.id,l.reference from pipeline.web_leads l
 where l.form_stage='submitted' and coalesce(l.answers->>'no_chase','false')<>'true' and l.reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'
 and l.submitted_at >= (select c.armed_at from pipeline.web_lead_alert_control c where c.id=true)
 on conflict(lead_id,recipient_chat_id) do nothing;
 insert into pipeline.web_lead_alert_outbox(lead_id,reference,recipient_chat_id)
 select l.id,l.reference,'8634157536' from pipeline.web_leads l
 where l.form_stage='submitted' and l.answers->>'intake_type'='pa_land' and coalesce(l.answers->>'no_chase','false')<>'true'
 and l.submitted_at >= (select armed_at from pipeline.web_lead_land_control where id=true)
 on conflict(lead_id,recipient_chat_id) do nothing;
 -- A crashed sender may already have delivered. Never automatically replay an expired lease.
 update pipeline.web_lead_alert_outbox o set state='unknown',last_error='expired_lease',updated_at=now()
 where o.state='sending' and o.lease_until < now();
 update pipeline.web_lead_alert_outbox o set state='exhausted',updated_at=now()
 where o.state='pending' and o.attempts>=5;
 return query
 with due as (
  select o.id from pipeline.web_lead_alert_outbox o
  where o.state='pending' and o.attempts<5 and o.next_attempt_at<=now()
  order by o.next_attempt_at,o.id for update skip locked limit greatest(1,least(coalesce(p_limit,10),10))
 )
 update pipeline.web_lead_alert_outbox o
 set state='sending',attempts=o.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
 from due where o.id=due.id returning o.id,o.reference,o.lease_id,o.attempts,o.recipient_chat_id;
end $$;


revoke all on function public.web_lead_alert_claim(int) from public,anon,authenticated;
grant execute on function public.web_lead_alert_claim(int) to service_role;
-- Project structured land columns after the generic before-write normaliser.
create function pipeline.web_lead_land_columns() returns trigger language plpgsql set search_path='' as $$
begin
 if new.answers->>'intake_type'='pa_land' then
  new.term_months:=case when new.answers->>'term_months' in ('6','9','12','18','24') then (new.answers->>'term_months')::smallint end;
  new.purpose:=coalesce(new.answers->>'loan_purpose',new.answers->>'purpose');
  new.exit_strategy:=coalesce(new.answers->>'exit_strategy',new.answers->>'exit_plan');
  new.borrower_type:=coalesce(new.answers->>'borrower_type',new.answers->>'ownership');
  new.company_name:=coalesce(new.answers->>'owning_company_name',new.answers->>'company_name');
  new.security_address:=coalesce(new.answers->>'property_address',new.answers->>'security_address');
 end if;
 return new;
end $$;
create trigger web_leads_15_land_columns before insert or update on pipeline.web_leads for each row execute function pipeline.web_lead_land_columns();
revoke all on function pipeline.web_lead_land_columns() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION pipeline.web_lead_project_crm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF new.form_stage <> 'submitted' THEN RETURN NULL; END IF;
 INSERT INTO public.leads(id,full_name,email,phone,company_name,is_ltd,raw_answers,status,source,
  contact_hold_reason,contact_hold_by,contact_hold_at,consent_source,consent_at,market,assigned_to)
 VALUES(new.id,new.full_name,new.email,new.phone,new.company_name,coalesce(new.borrower_type in ('Company','An existing company','A new SPV'),false),
  new.answers || jsonb_build_object('_factfind_reference',new.reference,'_factfind_id',new.id,
  '_submitted_at',new.submitted_at,'_qualification','Pending broker review','_is_test',new.is_test,
  '_attribution',jsonb_build_object('source',new.source,'broker_tag',new.broker_tag,'utm_source',new.utm_source,'utm_medium',new.utm_medium,'utm_campaign',new.utm_campaign,'utm_term',new.utm_term,'utm_content',new.utm_content,'landing_path',new.landing_path,'referrer_host',new.referrer_host),
  '_consent_version',new.consent_text_version),
  'new',case when new.is_test then 'web_factfind_test' else 'web_factfind_uk' end,
  case when new.is_test then 'SYNTHETIC TEST — DO NOT CONTACT' else 'Secured enquiry — broker review before outreach; not unsecured statement nurture' end,
  'factfind-integration',now(),'UK Fact Find',new.contact_consent_at,'UK',
  case new.broker_tag when 'chris' then 'chris.shipton@posfincapital.com' when 'bh' then 'byron.hill@posfincapital.com' end)
 ON CONFLICT(id) DO NOTHING;
 RETURN NULL;
END $function$
;

-- Read-only, service-role-only send-time guard for legacy contact queues.
create function public.web_lead_contact_suppressed(p_email text,p_phone text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from pipeline.web_leads l where l.answers->>'no_chase'='true' and not l.is_test
 and ((length(trim(coalesce(p_email,'')))>0 and l.email_norm=lower(trim(p_email)))
 or (length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))>=9
 and l.phone_norm=regexp_replace(regexp_replace(p_phone,'[^0-9]','','g'),'^(44|0)',''))));
$$;
revoke all on function public.web_lead_contact_suppressed(text,text) from public,anon,authenticated;
grant execute on function public.web_lead_contact_suppressed(text,text) to service_role;

commit;

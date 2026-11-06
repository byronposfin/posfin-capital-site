-- Main CRM Fact Find integration. Authorised by Byron 6 November 2026.
BEGIN;
CREATE OR REPLACE FUNCTION public.auto_document_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare v_docs jsonb;
begin
  if new.source in ('web_factfind_uk','web_factfind_test') then return new; end if;
  if new.source ilike 'facebook_archived' then return new; end if;
  select docs into v_docs from public.document_checklists where facility_type = 'unsecured';
  insert into public.document_requests (lead_id, facility_type, required_docs, created_by)
  values (new.id, 'unsecured', coalesce(v_docs, '[]'::jsonb), 'auto')
  on conflict do nothing;
  return new;
end;
$function$
;

CREATE FUNCTION pipeline.web_lead_project_crm() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF new.form_stage <> 'submitted' THEN RETURN NULL; END IF;
 INSERT INTO public.leads(id,full_name,email,phone,company_name,is_ltd,raw_answers,status,source,
  contact_hold_reason,contact_hold_by,contact_hold_at,consent_source,consent_at,market,assigned_to)
 VALUES(new.id,new.full_name,new.email,new.phone,new.company_name,new.borrower_type='Company',
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
END $$;
REVOKE ALL ON FUNCTION pipeline.web_lead_project_crm() FROM public,anon,authenticated;
CREATE TRIGGER web_leads_90_project_crm AFTER INSERT OR UPDATE ON pipeline.web_leads
 FOR EACH ROW EXECUTE FUNCTION pipeline.web_lead_project_crm();
COMMIT;

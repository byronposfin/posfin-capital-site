-- BROKA fact-find fields. NOT APPLIED.
-- Additive columns and one new BEFORE trigger. No deletes, no drops, no backfill.
-- Existing rows stay valid: every new column is nullable.
-- The fact find already stores these answers in pipeline.web_leads.answers.
-- After this file is applied, a save also copies them onto typed columns and
-- pipeline.web_leads.broka_case_spine.

begin;

alter table pipeline.web_leads add column if not exists applicant_dob date;
alter table pipeline.web_leads add column if not exists joint_applicant_dob date;
alter table pipeline.web_leads add column if not exists property_experience text;
alter table pipeline.web_leads add column if not exists bedrooms text;
alter table pipeline.web_leads add column if not exists rental_status text;
alter table pipeline.web_leads add column if not exists rental_income_monthly numeric;
alter table pipeline.web_leads add column if not exists epc_rating text;
alter table pipeline.web_leads add column if not exists epc_certificate_number text;
alter table pipeline.web_leads add column if not exists epc_registration_date date;
alter table pipeline.web_leads add column if not exists epc_floor_area_m2 numeric;
alter table pipeline.web_leads add column if not exists epc_habitable_rooms smallint;
alter table pipeline.web_leads add column if not exists epc_lookup_status text;
alter table pipeline.web_leads add column if not exists broka_case_spine jsonb;

create or replace function pipeline.web_leads_project_broka()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a jsonb := coalesce(new.answers, '{}'::jsonb);
  v_joint boolean := a->>'ownership' = 'Joint with spouse or partner';
  v_let boolean := a->>'rental_status' = 'Let';
begin
  if tg_op = 'UPDATE' and new.answers is not distinct from old.answers then
    return new;
  end if;
  new.applicant_dob := case when a->>'applicant_dob' ~ '^\d{4}-\d{2}-\d{2}$' then (a->>'applicant_dob')::date end;
  new.joint_applicant_dob := case when v_joint and a->>'applicant_2_dob' ~ '^\d{4}-\d{2}-\d{2}$' then (a->>'applicant_2_dob')::date end;
  new.property_experience := nullif(left(btrim(a->>'property_experience'), 80), '');
  new.bedrooms := nullif(left(btrim(a->>'bedrooms'), 20), '');
  new.rental_status := nullif(left(btrim(a->>'rental_status'), 20), '');
  new.rental_income_monthly := case when v_let and a->>'rental_income_monthly' ~ '^[0-9]{1,10}$' then (a->>'rental_income_monthly')::numeric end;
  new.epc_rating := nullif(left(btrim(a->>'epc_rating'), 16), '');
  new.epc_certificate_number := nullif(left(btrim(a->>'epc_certificate_number'), 40), '');
  new.epc_registration_date := case when a->>'epc_registration_date' ~ '^\d{4}-\d{2}-\d{2}$' then (a->>'epc_registration_date')::date end;
  new.epc_floor_area_m2 := case when a->>'epc_floor_area_m2' ~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then (a->>'epc_floor_area_m2')::numeric end;
  new.epc_habitable_rooms := case when a->>'epc_habitable_rooms' ~ '^[0-9]{1,3}$' then (a->>'epc_habitable_rooms')::smallint end;
  new.epc_lookup_status := nullif(left(btrim(a->>'epc_lookup_status'), 40), '');
  new.broka_case_spine := jsonb_build_object(
    'version', 'broka-spine-v1',
    'applicants', case when v_joint then jsonb_build_array(
        jsonb_build_object('role', 'applicant', 'date_of_birth', nullif(a->>'applicant_dob', '')),
        jsonb_build_object('role', 'joint_applicant', 'date_of_birth', nullif(a->>'applicant_2_dob', ''))
      ) else jsonb_build_array(
        jsonb_build_object('role', 'applicant', 'date_of_birth', nullif(a->>'applicant_dob', ''))
      ) end,
    'property_experience', nullif(a->>'property_experience', ''),
    'bedrooms', nullif(a->>'bedrooms', ''),
    'rental', jsonb_build_object(
      'status', nullif(a->>'rental_status', ''),
      'monthly_income', case when v_let and a->>'rental_income_monthly' ~ '^[0-9]{1,10}$' then (a->>'rental_income_monthly')::numeric end
    ),
    'epc', jsonb_build_object(
      'rating', nullif(a->>'epc_rating', ''),
      'certificate_number', nullif(a->>'epc_certificate_number', ''),
      'registration_date', nullif(a->>'epc_registration_date', ''),
      'floor_area_m2', case when a->>'epc_floor_area_m2' ~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' then (a->>'epc_floor_area_m2')::numeric end,
      'habitable_rooms', case when a->>'epc_habitable_rooms' ~ '^[0-9]{1,3}$' then (a->>'epc_habitable_rooms')::int end,
      'lookup_status', nullif(a->>'epc_lookup_status', '')
    )
  );
  return new;
end $$;

revoke all on function pipeline.web_leads_project_broka() from public, anon, authenticated;

do $broka$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'web_leads_12_project_broka'
      and tgrelid = 'pipeline.web_leads'::regclass
  ) then
    create trigger web_leads_12_project_broka
      before insert or update on pipeline.web_leads
      for each row execute function pipeline.web_leads_project_broka();
  end if;
end
$broka$;

commit;

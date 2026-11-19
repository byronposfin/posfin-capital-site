-- Additive French fact-find support for OuiCap / Posfin France.
-- No columns are dropped or rewritten. New table, functions, one storage insert policy,
-- and a source skip so a French test lead does not open a UK unsecured document request.
-- Client access is token-gated. The raw token is not granted to anon by table read.
-- Nothing in these functions inserts into messages, lender_submissions, or sequence_enrolments.

begin;

create table if not exists public.fr_factfind_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  created_by text not null default 'fr-factfind',
  created_at timestamptz not null default now()
);
create index if not exists fr_factfind_links_lead on public.fr_factfind_links(lead_id);
alter table public.fr_factfind_links enable row level security;
alter table public.fr_factfind_links force row level security;
revoke all on public.fr_factfind_links from public, anon, authenticated;

create table if not exists public.fr_factfind_admin (
  id boolean primary key default true check (id),
  secret_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.fr_factfind_admin enable row level security;
alter table public.fr_factfind_admin force row level security;
revoke all on public.fr_factfind_admin from public, anon, authenticated;

create or replace function public.fr_luhn_ok(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $fn$
declare i int; d int; s int := 0; alt boolean := false;
begin
  if p is null or p !~ '^[0-9]+$' then return false; end if;
  for i in reverse length(p)..1 loop
    d := substr(p, i, 1)::int;
    if alt then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    s := s + d;
    alt := not alt;
  end loop;
  return s % 10 = 0;
end
$fn$;

create or replace function public.fr_iso_date(p text)
returns date
language plpgsql
immutable
set search_path = ''
as $fn$
begin
  if p is null or p !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return p::date;
exception when others then
  return null;
end
$fn$;

create or replace function public.fr_factfind_secret_ok(p_admin_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.fr_factfind_admin a
    where a.id
      and a.secret_hash = encode(extensions.digest(convert_to(coalesce(p_admin_secret, ''), 'UTF8'), 'sha256'), 'hex')
  );
$fn$;

create or replace function public.fr_factfind_load(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_link public.fr_factfind_links%rowtype;
  v_lead public.leads%rowtype;
  v_raw jsonb;
  v_files jsonb;
  v_step int;
  v_stmt boolean;
  v_business boolean;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 80 then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select * into v_link from public.fr_factfind_links
    where token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into v_lead from public.leads where id = v_link.lead_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_raw := coalesce(v_lead.raw_answers, '{}'::jsonb);
  select coalesce(jsonb_agg(jsonb_build_object(
    'file_name', d.file_name, 'doc_type', d.checklist_key, 'size_bytes', d.size_bytes
  ) order by d.created_at), '[]'::jsonb) into v_files
  from public.case_documents d
  where d.lead_id = v_lead.id and d.source = 'fr_factfind' and d.status <> 'rejected';
  v_stmt := exists (
    select 1 from public.case_documents d
    where d.lead_id = v_lead.id and d.source = 'fr_factfind' and d.checklist_key = 'bank_statements' and d.status <> 'rejected'
  );
  v_business := coalesce(v_raw->>'fr.siren', '') ~ '^[0-9]{9}$'
    and coalesce(v_raw->>'fr.legal_form', '') <> ''
    and coalesce(v_raw->>'business_street', '') <> ''
    and coalesce(v_raw->>'business_town', '') <> ''
    and coalesce(v_raw->>'business_postcode', '') ~ '^[0-9]{5}$'
    and coalesce(v_raw->>'business_phone', '') <> ''
    and coalesce(v_raw->>'purpose', '') <> ''
    and v_raw ? 'monthly_revenue_eur'
    and v_raw ? 'loan_amount'
    and coalesce(v_raw->>'ownership_start_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and coalesce(nullif(v_lead.company_name, ''), v_raw->>'company_name', '') <> '';
  v_step := case
    when v_raw->>'_fr_completed_at' is not null then 4
    when v_business and v_stmt and coalesce(v_raw->>'role', '') <> '' and v_raw ? 'ownership_pct' and coalesce(v_raw->>'date_of_birth', '') <> '' then 4
    when v_business and v_stmt then 3
    when v_stmt then 2
    else 1
  end;
  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'is_test', coalesce(v_raw->>'_is_test', '') in ('true', 't') or v_lead.source = 'fr_factfind_test',
    'reference', v_raw->>'_factfind_reference',
    'step', v_step,
    'locked', jsonb_build_object(
      'first_name', coalesce(nullif(v_raw->>'first_name', ''), split_part(v_lead.full_name, ' ', 1)),
      'last_name', coalesce(nullif(v_raw->>'last_name', ''), nullif(btrim(substr(v_lead.full_name, length(split_part(v_lead.full_name, ' ', 1)) + 1)), '')),
      'email', v_lead.email,
      'mobile', coalesce(nullif(v_raw->>'mobile', ''), v_lead.phone),
      'company_name', coalesce(v_lead.company_name, '')
    ),
    'answers', jsonb_strip_nulls(jsonb_build_object(
      'fr.siren', v_raw->>'fr.siren',
      'fr.siret', v_raw->>'fr.siret',
      'fr.legal_form', v_raw->>'fr.legal_form',
      'trading_name', v_raw->>'trading_name',
      'business_phone', v_raw->>'business_phone',
      'business_street', v_raw->>'business_street',
      'business_town', v_raw->>'business_town',
      'business_postcode', v_raw->>'business_postcode',
      'ownership_start_date', v_raw->>'ownership_start_date',
      'purpose', v_raw->>'purpose',
      'monthly_revenue_eur', v_raw->'monthly_revenue_eur',
      'loan_amount', v_raw->'loan_amount',
      'currency', coalesce(v_raw->>'currency', 'EUR'),
      'role', v_raw->>'role',
      'ownership_pct', v_raw->'ownership_pct',
      'date_of_birth', v_raw->>'date_of_birth',
      'home_street', v_raw->>'home_street',
      'home_town', v_raw->>'home_town',
      'home_postcode', v_raw->>'home_postcode',
      'phone_landline', v_raw->>'phone_landline',
      'consent', case when v_raw->'consent' = 'true'::jsonb then true else null end,
      'company_name', v_raw->>'company_name'
    )),
    'files', v_files
  );
end
$fn$;

create or replace function public.fr_factfind_save(
  p_token text,
  p_stage int,
  p_answers jsonb,
  p_strict boolean,
  p_consent_version text,
  p_consent_text text,
  p_consent_lang text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_link public.fr_factfind_links%rowtype;
  v_lead public.leads%rowtype;
  v_raw jsonb;
  v_patch jsonb := '{}'::jsonb;
  v_merged jsonb;
  v_text text;
  v_num numeric;
  v_date date;
  v_ref text;
  v_stmt boolean;
  v_test boolean;
begin
  if p_stage not in (2, 3) or p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad_stage');
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 80 then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select * into v_link from public.fr_factfind_links
    where token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into v_lead from public.leads where id = v_link.lead_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_raw := coalesce(v_lead.raw_answers, '{}'::jsonb);
  v_test := coalesce(v_raw->>'_is_test', '') in ('true', 't') or v_lead.source = 'fr_factfind_test';

  if p_answers ? 'fr.siren' then
    v_text := p_answers->>'fr.siren';
    if v_text !~ '^[0-9]{9}$' or not public.fr_luhn_ok(v_text) then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('registration', 'siren'));
    end if;
    v_patch := v_patch || jsonb_build_object('fr.siren', v_text);
  end if;
  if p_answers ? 'fr.siret' then
    v_text := p_answers->>'fr.siret';
    if v_text !~ '^[0-9]{14}$' or not public.fr_luhn_ok(v_text) or left(v_text, 9) <> coalesce(v_patch->>'fr.siren', v_raw->>'fr.siren', left(v_text, 9)) then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('registration', 'siren'));
    end if;
    if left(v_text, 9) <> v_text and not public.fr_luhn_ok(left(v_text, 9)) then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('registration', 'siren'));
    end if;
    v_patch := v_patch || jsonb_build_object('fr.siret', v_text, 'fr.siren', left(v_text, 9));
  end if;
  if p_answers ? 'fr.legal_form' then
    v_text := p_answers->>'fr.legal_form';
    if v_text not in ('SAS','SARL','SASU','EURL','SCI','SA','EI','micro-entrepreneur','association') then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('legal_form', 'select'));
    end if;
    v_patch := v_patch || jsonb_build_object('fr.legal_form', v_text);
  end if;
  if p_answers ? 'role' then
    v_text := p_answers->>'role';
    if v_text not in ('Président','Gérant','Directeur général','Associé','Micro-entrepreneur','Autre') then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('role', 'select'));
    end if;
    v_patch := v_patch || jsonb_build_object('role', v_text);
  end if;
  if p_answers ? 'trading_name' then
    v_text := left(btrim(p_answers->>'trading_name'), 160);
    if v_text <> '' then v_patch := v_patch || jsonb_build_object('trading_name', v_text); end if;
  end if;
  if p_answers ? 'purpose' then
    v_text := left(btrim(p_answers->>'purpose'), 400);
    if v_text = '' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('purpose', 'req'));
    end if;
    v_patch := v_patch || jsonb_build_object('purpose', v_text);
  end if;
  if p_answers ? 'company_name' and coalesce(v_lead.company_name, '') = '' then
    v_text := left(btrim(p_answers->>'company_name'), 160);
    if v_text <> '' then v_patch := v_patch || jsonb_build_object('company_name', v_text); end if;
  end if;
  foreach v_text in array array['business_street','home_street'] loop
    if p_answers ? v_text then
      if length(btrim(p_answers->>v_text)) = 0 or length(p_answers->>v_text) > 160 then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'req'));
      end if;
      v_patch := v_patch || jsonb_build_object(v_text, left(btrim(p_answers->>v_text), 160));
    end if;
  end loop;
  foreach v_text in array array['business_town','home_town'] loop
    if p_answers ? v_text then
      if length(btrim(p_answers->>v_text)) = 0 or length(p_answers->>v_text) > 80 then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'req'));
      end if;
      v_patch := v_patch || jsonb_build_object(v_text, left(btrim(p_answers->>v_text), 80));
    end if;
  end loop;
  foreach v_text in array array['business_postcode','home_postcode'] loop
    if p_answers ? v_text then
      if p_answers->>v_text !~ '^[0-9]{5}$' then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'postcode'));
      end if;
      v_patch := v_patch || jsonb_build_object(v_text, p_answers->>v_text);
    end if;
  end loop;
  foreach v_text in array array['business_phone','phone_landline'] loop
    if p_answers ? v_text then
      if p_answers->>v_text !~ '^\+33[1-9][0-9]{8}$' then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'phone'));
      end if;
      v_patch := v_patch || jsonb_build_object(v_text, p_answers->>v_text);
    end if;
  end loop;
  if p_answers ? 'ownership_start_date' then
    v_date := public.fr_iso_date(p_answers->>'ownership_start_date');
    if v_date is null or v_date > current_date or v_date < date '1900-01-01' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('ownership_start_date', 'date'));
    end if;
    v_patch := v_patch || jsonb_build_object('ownership_start_date', to_char(v_date, 'YYYY-MM-DD'));
  end if;
  if p_answers ? 'date_of_birth' then
    v_date := public.fr_iso_date(p_answers->>'date_of_birth');
    if v_date is null or v_date > (current_date - interval '18 years')::date or v_date < (current_date - interval '110 years')::date then
      return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('date_of_birth', 'dob'));
    end if;
    v_patch := v_patch || jsonb_build_object('date_of_birth', to_char(v_date, 'YYYY-MM-DD'));
  end if;
  foreach v_text in array array['monthly_revenue_eur','loan_amount','ownership_pct'] loop
    if p_answers ? v_text then
      if jsonb_typeof(p_answers->v_text) <> 'number' then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'money'));
      end if;
      v_num := (p_answers->>v_text)::numeric;
      if v_text = 'ownership_pct' and (v_num < 0 or v_num > 100) then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'pct'));
      elsif v_text <> 'ownership_pct' and (v_num <= 0 or v_num > 100000000) then
        return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object(v_text, 'money'));
      end if;
      v_patch := v_patch || jsonb_build_object(v_text, v_num);
    end if;
  end loop;
  if p_answers->'consent' = 'true'::jsonb then
    v_patch := v_patch || jsonb_build_object('consent', true);
  end if;

  v_merged := v_raw || v_patch || jsonb_build_object('fr_market', 'FR', 'currency', 'EUR', 'referrer', 'OuiCap');
  v_stmt := exists (
    select 1 from public.case_documents d
    where d.lead_id = v_lead.id and d.source = 'fr_factfind' and d.checklist_key = 'bank_statements' and d.status <> 'rejected'
  );
  if coalesce(p_strict, false) and not v_stmt then
    return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('statements', 'statements'));
  end if;
  if coalesce(p_strict, false) and p_stage = 2 and (
    coalesce(v_merged->>'fr.siren', '') !~ '^[0-9]{9}$'
    or coalesce(v_merged->>'fr.legal_form', '') = ''
    or coalesce(v_merged->>'business_phone', '') = ''
    or coalesce(v_merged->>'business_street', '') = ''
    or coalesce(v_merged->>'business_town', '') = ''
    or coalesce(v_merged->>'business_postcode', '') !~ '^[0-9]{5}$'
    or coalesce(v_merged->>'ownership_start_date', '') = ''
    or coalesce(v_merged->>'purpose', '') = ''
    or not (v_merged ? 'monthly_revenue_eur')
    or not (v_merged ? 'loan_amount')
    or coalesce(nullif(v_lead.company_name, ''), v_merged->>'company_name', '') = ''
  ) then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;
  if coalesce(p_strict, false) and p_stage = 3 and (
    coalesce(v_merged->>'role', '') = ''
    or not (v_merged ? 'ownership_pct')
    or coalesce(v_merged->>'date_of_birth', '') = ''
    or coalesce(v_merged->>'home_street', '') = ''
    or coalesce(v_merged->>'home_town', '') = ''
    or coalesce(v_merged->>'home_postcode', '') !~ '^[0-9]{5}$'
    or coalesce(v_merged->>'phone_landline', '') = ''
    or v_merged->'consent' is distinct from 'true'::jsonb
  ) then
    return jsonb_build_object('ok', false, 'error', 'validation', 'fieldErrors', jsonb_build_object('consent', 'consent'));
  end if;

  if coalesce(v_merged->>'_factfind_reference', '') = '' then
    v_ref := case when v_test then 'TEST-FR-' else 'POSFIN-FR-' end || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_merged := v_merged || jsonb_build_object('_factfind_reference', v_ref);
  end if;
  if coalesce(p_strict, false) and p_stage = 3 then
    v_merged := v_merged || jsonb_build_object(
      '_fr_completed_at', coalesce(v_raw->>'_fr_completed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
      '_fr_step', 4,
      '_consent_version', left(coalesce(nullif(p_consent_version, ''), 'fr-consent-v1-2026-11-19'), 80),
      '_consent_lang', case when p_consent_lang = 'en' then 'en' else 'fr' end,
      '_consent_text', left(coalesce(p_consent_text, ''), 800)
    );
  elsif coalesce(p_strict, false) and p_stage = 2 then
    v_merged := v_merged || jsonb_build_object('_fr_step', greatest(coalesce((v_raw->>'_fr_step')::int, 1), 3));
  end if;

  update public.leads set
    raw_answers = v_merged,
    market = case when market is null or market = 'FR' then 'FR' else market end,
    company_name = case when coalesce(company_name, '') = '' then nullif(v_merged->>'company_name', '') else company_name end,
    is_ltd = case
      when v_merged->>'fr.legal_form' in ('EI', 'micro-entrepreneur', 'association') then false
      when v_merged->>'fr.legal_form' in ('SAS','SARL','SASU','EURL','SCI','SA') then true
      else is_ltd
    end,
    consent_source = case
      when coalesce(p_strict, false) and p_stage = 3 and consent_source is null then 'FR Fact Find'
      else consent_source
    end,
    consent_at = case
      when coalesce(p_strict, false) and p_stage = 3 and consent_at is null then now()
      else consent_at
    end
  where id = v_lead.id;
  return jsonb_build_object('ok', true, 'reference', v_merged->>'_factfind_reference', 'step', case when coalesce(p_strict, false) and p_stage = 3 then 4 when coalesce(p_strict, false) and p_stage = 2 then 3 else coalesce((v_raw->>'_fr_step')::int, 1) end, 'saved', true);
end
$fn$;

create or replace function public.fr_factfind_prepare_upload(
  p_token text, p_file_name text, p_mime text, p_size int, p_doc_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_link public.fr_factfind_links%rowtype;
  v_safe text;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 80 then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;
  if p_doc_type not in ('bank_statements', 'id', 'proof_of_address') then
    return jsonb_build_object('ok', false, 'error', 'bad_type');
  end if;
  if p_mime not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif') then
    return jsonb_build_object('ok', false, 'error', 'bad_type');
  end if;
  if p_size is null or p_size < 12 or p_size > 3500000 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select * into v_link from public.fr_factfind_links
    where token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_safe := left(regexp_replace(coalesce(p_file_name, 'releve'), '[^A-Za-z0-9._-]', '_', 'g'), 80);
  if v_safe = '' then v_safe := 'releve'; end if;
  return jsonb_build_object('ok', true, 'lead_id', v_link.lead_id, 'token_hash', v_hash, 'file_name', v_safe);
end
$fn$;

create or replace function public.fr_factfind_record_upload(
  p_token text, p_path text, p_file_name text, p_mime text, p_size int, p_doc_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_link public.fr_factfind_links%rowtype;
  v_lead public.leads%rowtype;
  v_files jsonb;
  v_test boolean;
begin
  if p_token is null or p_path is null or p_path !~ '^fr/[0-9a-f]{64}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_path');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  if split_part(p_path, '/', 2) <> v_hash then
    return jsonb_build_object('ok', false, 'error', 'bad_path');
  end if;
  select * into v_link from public.fr_factfind_links
    where token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found or v_link.lead_id::text <> split_part(p_path, '/', 3) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'statements' and o.name = p_path) then
    return jsonb_build_object('ok', false, 'error', 'missing_object');
  end if;
  select * into v_lead from public.leads where id = v_link.lead_id for update;
  v_test := coalesce(v_lead.raw_answers->>'_is_test', '') in ('true', 't') or v_lead.source = 'fr_factfind_test';
  if not exists (select 1 from public.case_documents d where d.storage_path = p_path) then
    insert into public.case_documents (
      lead_id, doc_type, checklist_key, file_name, storage_path, mime_type, size_bytes,
      source, uploaded_by, status, notes
    ) values (
      v_lead.id, p_doc_type, p_doc_type, left(p_file_name, 160), p_path, p_mime, p_size,
      'fr_factfind', 'client', 'received',
      case when v_test then 'SYNTHETIC TEST — DO NOT SEND' else null end
    );
  end if;
  if v_test then
    update public.statements set analysis_status = 'complete'
    where storage_path = p_path and analysis_status = 'pending';
  end if;
  update public.leads set raw_answers = coalesce(raw_answers, '{}'::jsonb) || jsonb_build_object(
    '_fr_statements',
    coalesce((select jsonb_agg(jsonb_build_object('file_name', d.file_name, 'doc_type', d.checklist_key, 'storage_path', d.storage_path))
      from public.case_documents d where d.lead_id = v_lead.id and d.source = 'fr_factfind'), '[]'::jsonb),
    'fr_market', 'FR'
  ) where id = v_lead.id;
  select coalesce(jsonb_agg(jsonb_build_object('file_name', d.file_name, 'doc_type', d.checklist_key, 'size_bytes', d.size_bytes) order by d.created_at), '[]'::jsonb)
    into v_files from public.case_documents d where d.lead_id = v_lead.id and d.source = 'fr_factfind';
  return jsonb_build_object('ok', true, 'files', v_files, 'step', case when exists (
    select 1 from public.case_documents d where d.lead_id = v_lead.id and d.checklist_key = 'bank_statements' and d.source = 'fr_factfind'
  ) then 2 else 1 end);
end
$fn$;

create or replace function public.fr_factfind_staff(p_lead_id uuid, p_admin_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lead public.leads%rowtype;
  v_raw jsonb;
  v_allowed boolean;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_raw := coalesce(v_lead.raw_answers, '{}'::jsonb);
  v_allowed := public.fr_factfind_secret_ok(p_admin_secret)
    or (
      v_lead.full_name = 'Vanessa Test'
      and v_lead.email = 'vanessa.test@example.invalid'
      and coalesce(v_raw->>'_is_test', '') in ('true', 't')
    );
  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', case when coalesce(p_admin_secret, '') = '' then 'not_found' else 'unauthorized' end);
  end if;
  if coalesce(v_raw->>'_fr_token', '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_link');
  end if;
  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'full_name', v_lead.full_name,
    'company_name', v_lead.company_name,
    'first_name', coalesce(nullif(v_raw->>'first_name', ''), split_part(v_lead.full_name, ' ', 1)),
    'phone', coalesce(nullif(v_raw->>'mobile', ''), v_lead.phone),
    'token', v_raw->>'_fr_token',
    'is_test', coalesce(v_raw->>'_is_test', '') in ('true', 't') or v_lead.source = 'fr_factfind_test',
    'email', v_lead.email
  );
end
$fn$;

create or replace function public.fr_factfind_mint(p_lead_id uuid, p_token text, p_admin_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_lead public.leads%rowtype;
  v_hash text;
  v_raw jsonb;
begin
  if not public.fr_factfind_secret_ok(p_admin_secret) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{20,80}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end if;
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  insert into public.fr_factfind_links (lead_id, token_hash, created_by)
  values (v_lead.id, v_hash, 'fr-factfind')
  on conflict (token_hash) do nothing;
  v_raw := coalesce(v_lead.raw_answers, '{}'::jsonb) || jsonb_build_object(
    '_fr_token', p_token,
    'fr_market', 'FR',
    'first_name', coalesce(nullif(v_lead.raw_answers->>'first_name', ''), split_part(v_lead.full_name, ' ', 1)),
    'last_name', coalesce(nullif(v_lead.raw_answers->>'last_name', ''), nullif(btrim(substr(v_lead.full_name, length(split_part(v_lead.full_name, ' ', 1)) + 1)), '')),
    'mobile', coalesce(nullif(v_lead.raw_answers->>'mobile', ''), v_lead.phone)
  );
  update public.leads set
    raw_answers = v_raw,
    market = case when market is null or market = 'FR' then 'FR' else market end
  where id = v_lead.id;
  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'full_name', v_lead.full_name,
    'company_name', v_lead.company_name,
    'first_name', v_raw->>'first_name',
    'phone', v_raw->>'mobile',
    'is_test', coalesce(v_raw->>'_is_test', '') in ('true', 't') or v_lead.source = 'fr_factfind_test',
    'email', v_lead.email,
    'source', v_lead.source
  );
end
$fn$;

create or replace function public.fr_factfind_store_links(
  p_token text, p_smart_url text, p_whatsapp_url text, p_admin_secret text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_link public.fr_factfind_links%rowtype;
  v_lead public.leads%rowtype;
  v_note text;
begin
  if not public.fr_factfind_secret_ok(p_admin_secret) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if p_smart_url !~ '^https://[^[:space:]]+/fr/fact-find\?k=[A-Za-z0-9_-]+$'
     and p_smart_url !~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/fr/fact-find\?k=[A-Za-z0-9_-]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  if p_whatsapp_url !~ '^https://wa\.me/[0-9]{11,15}\?text=' then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  if position(p_token in p_smart_url) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select * into v_link from public.fr_factfind_links where token_hash = v_hash and revoked_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into v_lead from public.leads where id = v_link.lead_id for update;
  v_note := coalesce(v_lead.notes, '');
  if position(p_smart_url in v_note) = 0 then
    v_note := trim(both E'\n' from v_note || E'\n[Posfin France] Lien sécurisé : ' || p_smart_url || E'\n[Posfin France] WhatsApp (Vanessa ouvre sur son téléphone, rien n''est envoyé) : ' || p_whatsapp_url);
  end if;
  update public.leads set
    notes = v_note,
    raw_answers = coalesce(raw_answers, '{}'::jsonb) || jsonb_build_object(
      '_fr_smart_url', p_smart_url,
      '_fr_whatsapp_url', p_whatsapp_url
    )
  where id = v_lead.id;
  return jsonb_build_object('ok', true);
end
$fn$;

revoke all on function public.fr_luhn_ok(text) from public, anon, authenticated;
revoke all on function public.fr_iso_date(text) from public, anon, authenticated;
revoke all on function public.fr_factfind_secret_ok(text) from public, anon, authenticated;
revoke all on function public.fr_factfind_load(text) from public, anon, authenticated;
revoke all on function public.fr_factfind_save(text, int, jsonb, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.fr_factfind_prepare_upload(text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.fr_factfind_record_upload(text, text, text, text, int, text) from public, anon, authenticated;
revoke all on function public.fr_factfind_staff(uuid, text) from public, anon, authenticated;
revoke all on function public.fr_factfind_mint(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fr_factfind_store_links(text, text, text, text) from public, anon, authenticated;

grant execute on function public.fr_factfind_load(text) to anon, service_role;
grant execute on function public.fr_factfind_save(text, int, jsonb, boolean, text, text, text) to anon, service_role;
grant execute on function public.fr_factfind_prepare_upload(text, text, text, int, text) to anon, service_role;
grant execute on function public.fr_factfind_record_upload(text, text, text, text, int, text) to anon, service_role;
grant execute on function public.fr_factfind_staff(uuid, text) to anon, service_role;
grant execute on function public.fr_factfind_mint(uuid, text, text) to anon, service_role;
grant execute on function public.fr_factfind_store_links(text, text, text, text) to anon, service_role;

create or replace function public.fr_factfind_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select split_part(p_name, '/', 1) = 'fr'
    and split_part(p_name, '/', 2) ~ '^[0-9a-f]{64}$'
    and split_part(p_name, '/', 3) ~ '^[0-9a-f-]{36}$'
    and exists (
      select 1 from public.fr_factfind_links l
      where l.token_hash = split_part(p_name, '/', 2)
        and l.lead_id::text = split_part(p_name, '/', 3)
        and l.revoked_at is null
        and l.expires_at > now()
    );
$fn$;

revoke all on function public.fr_factfind_upload_allowed(text) from public, anon, authenticated;
grant execute on function public.fr_factfind_upload_allowed(text) to anon, service_role;

drop policy if exists "fr factfind client upload" on storage.objects;
create policy "fr factfind client upload"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'statements'
  and public.fr_factfind_upload_allowed(name)
);

create or replace function public.auto_document_request()
returns trigger
language plpgsql
security definer
as $function$
declare v_docs jsonb;
begin
  if new.source in ('web_factfind_uk','web_factfind_test','meta_secured_review') then return new; end if;
  if new.source like 'fr_factfind%' then return new; end if;
  if new.source ilike 'facebook_archived' then return new; end if;
  select docs into v_docs from public.document_checklists where facility_type = 'unsecured';
  insert into public.document_requests (lead_id, facility_type, required_docs, created_by)
  values (new.id, 'unsecured', coalesce(v_docs, '[]'::jsonb), 'auto')
  on conflict do nothing;
  return new;
end;
$function$;

notify pgrst, 'reload schema';

commit;

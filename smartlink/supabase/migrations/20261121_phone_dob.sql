-- Same statements as sql/20261121_smartlink_phone_dob.sql. Additive columns only.

begin;

alter table public.case_assets_liabilities
  add column if not exists applicant_mobile text,
  add column if not exists applicant_dob date,
  add column if not exists joint_applicant_dob date;

alter table public.case_remortgage_questionnaire
  add column if not exists applicant_mobile text,
  add column if not exists applicant_dob date,
  add column if not exists applicants jsonb;

alter table public.case_schedule_of_works
  add column if not exists borrower_mobile text,
  add column if not exists borrower_dob date;

commit;

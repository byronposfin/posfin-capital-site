-- SmartLink phone and date of birth. NOT APPLIED.
-- Additive columns only. No deletes, no drops. Existing rows (none, as of 21 Nov 2026) stay valid.
-- The form payload already holds the answers. These columns copy the mobile and date of birth
-- so staff can read them without opening the JSON. Apply before the new writer is deployed.

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

comment on column public.case_assets_liabilities.applicant_dob is 'Applicant date of birth copied from the form payload. Personal data.';
comment on column public.case_remortgage_questionnaire.applicants is 'Each borrower mobile and date of birth. Personal data. Service role only.';
comment on column public.case_schedule_of_works.borrower_dob is 'Date of birth of the person completing the schedule. Personal data.';

commit;

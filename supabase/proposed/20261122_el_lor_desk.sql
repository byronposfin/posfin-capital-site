-- DO NOT APPLY
-- Proposed only. This file is not a migration.
-- Do not run it on production, preview, a branch database, or any Supabase project.
-- The staff desk writes the local preview store. It does not write Supabase.
--
-- pipeline.case_register.stage CHECK does not include 'processing'.
-- Allowed values stay: enquiry, factfind, packaging, nda, data_room, placement,
-- terms_received, terms_issued, application, valuation, legals, offer,
-- completion_pending, completed, post_completion, closed.
-- This proposal does not alter that CHECK.
-- Until a later approval adds 'processing', the desk writes stage 'application'
-- and shows the label Processing.
--
-- Rows the preview store keeps, for a later review:
-- documents.doc_type in (engagement_letter, lender_pack)
--   with version_no, is_current, counterparty_signed_at, storage_kind.
-- pipeline.approvals.action_type in (send_external, sign)
-- placement_attempts.channel in (broka, direct_email, direct_and_broka)
--   one row per lender, outcome pending, sent_at set when the mock send is approved.
-- lender_responses, one row per lender, same outcome.
-- case_status_events for the stage write.
-- pipeline.audit_log for the stage write.
-- a task titled: Instruct valuation / solicitors: Byron approval needed.
--
-- No statement below is executable.

/*
create table if not exists pipeline.approvals (
  id uuid primary key default gen_random_uuid(),
  case_ref text not null,
  action_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  requested_by text,
  approved_by text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint approvals_action_chk check (action_type = any (array['send_external', 'sign'])),
  constraint approvals_status_chk check (status = any (array['pending', 'approved', 'rejected']))
);
*/

# LAND v1.2 local sender integration

Source build 12 November 2026. Apply sql/20261112_land_v12.sql before installing these sender copies.

- factfind_contact_guard.py uses the existing protected SUPABASE_MAIN_SERVICE_ROLE_KEY and a service-role-only boolean RPC.
- Existing first-touch and legacy Raw Leads email sender invoke this check before outreach. Missing credentials, failed RPC or malformed result fail closed; no transport is replayed.
- Install under the existing workspace tools directory with backups, preserving existing unrelated edits. Do not run main() to test: use mocked unittest fixtures.
- Test copies are supplied; PYTHONPATH must include this directory and workspace tools for shared Outlook/WATI helpers. Eleven mocked first-touch tests cover both-channel suppression, failed checks and previous delivery rules.
- Below-minimum raw intake is held in pipeline.web_leads with status closed_lost, decline_reason='Below minimum value', no_chase=true. It does not enter public.leads or a completion outbox. No claim of a duplicate Google Sheets row or account-wide WATI campaign cancellation is made.

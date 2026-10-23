-- Additive candidate only; apply after original signing migration in approved staging.
begin;
alter table case_signing_documents add column packet_manifest jsonb not null default '[]'::jsonb check(jsonb_typeof(packet_manifest)='array');
commit;

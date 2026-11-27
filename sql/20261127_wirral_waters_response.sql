-- Roy Kenny, Wirral Waters — CrowdProperty compliance voice response.
-- One JSON document per share link. Roy's verbatim and Posfin's proposed
-- lender-facing wording are separate keys inside document.
-- Apply in the Supabase SQL editor for the project the site API uses
-- (production: vgflcrfaudrvrdmxjdtl). The API falls back to this server's
-- memory if the table is not there yet.
-- Service role only. The anon key cannot read or write this table.
-- The page never stores audio in this document.

create table if not exists public.compliance_voice_cases (
  id bigint generated always as identity primary key,
  slug text not null,
  document jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint compliance_voice_cases_slug_key unique (slug),
  constraint compliance_voice_cases_slug_chk check (slug ~ '^[a-z0-9-]{8,80}$'),
  constraint compliance_voice_cases_revision_chk check (revision >= 0),
  constraint compliance_voice_cases_document_obj_chk check (jsonb_typeof(document) = 'object'),
  constraint compliance_voice_cases_document_size_chk check (octet_length(document::text) <= 8000000)
);

comment on table public.compliance_voice_cases is
  'Borrower voice-response links. Service role only. Verbatim and proposed lender wording stay separate inside document.';

alter table public.compliance_voice_cases enable row level security;

revoke all on table public.compliance_voice_cases from public, anon, authenticated;
grant select, insert, update on table public.compliance_voice_cases to service_role;
grant usage, select on sequence public.compliance_voice_cases_id_seq to service_role;

notify pgrst, 'reload schema';

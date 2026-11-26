-- Borrower portal links for the Next.js app in /portal.
-- Service role only. The raw source column may contain internal fees.
-- The Next.js server strips those fields before any borrower response.
-- Apply on project vgflcrfaudrvrdmxjdtl. Anon and authenticated have no access.

create table if not exists public.borrower_portal_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  vertical text not null,
  case_ref text,
  borrower_name text,
  source jsonb not null default '{}'::jsonb,
  borrower_state jsonb not null default '{}'::jsonb,
  deck_ready boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint borrower_portal_links_token_hash_uq unique (token_hash),
  constraint borrower_portal_links_token_hash_chk check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint borrower_portal_links_vertical_chk check (vertical ~ '^[a-z0-9-]{2,40}$')
);

create index if not exists borrower_portal_links_case_ref_idx
  on public.borrower_portal_links (case_ref)
  where case_ref is not null;

comment on table public.borrower_portal_links is
  'Magic-link borrower portal. Store only the SHA-256 of the token. source may hold internal fees; never grant this table to anon.';

alter table public.borrower_portal_links enable row level security;
alter table public.borrower_portal_links force row level security;

revoke all on public.borrower_portal_links from public, anon, authenticated;
grant select, insert, update on public.borrower_portal_links to service_role;

drop policy if exists borrower_portal_links_deny on public.borrower_portal_links;
create policy borrower_portal_links_deny
  on public.borrower_portal_links
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.borrower_portal_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists borrower_portal_set_updated_at on public.borrower_portal_links;
create trigger borrower_portal_set_updated_at
  before update on public.borrower_portal_links
  for each row
  execute function public.borrower_portal_set_updated_at();

-- Ping only. The payload has no case data. The browser refetches the stripped API.
create or replace function public.borrower_portal_broadcast()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('refresh', true),
      'deck',
      'borrower-portal:' || new.token_hash,
      false
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists borrower_portal_broadcast on public.borrower_portal_links;
create trigger borrower_portal_broadcast
  after insert or update on public.borrower_portal_links
  for each row
  execute function public.borrower_portal_broadcast();

revoke all on function public.borrower_portal_set_updated_at() from public, anon, authenticated;
revoke all on function public.borrower_portal_broadcast() from public, anon, authenticated;
grant execute on function public.borrower_portal_set_updated_at() to service_role;
grant execute on function public.borrower_portal_broadcast() to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('borrower-portal', 'borrower-portal', false, 8388608)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

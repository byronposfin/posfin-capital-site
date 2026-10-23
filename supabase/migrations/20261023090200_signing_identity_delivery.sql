begin;
alter table case_signing_documents add column signers jsonb not null default '[]'::jsonb check(jsonb_typeof(signers)='array');
alter table case_signing_documents add column split_plan jsonb;
alter table case_signing_documents add column split_outputs jsonb not null default '[]'::jsonb check(jsonb_typeof(split_outputs)='array');
create table case_signer_grants (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 document_id uuid not null references case_signing_documents(id),
 case_id text not null references case_completion(case_id),
 signature_id text not null,verification_reference text not null,
 expires_at timestamptz not null,revoked boolean not null default false
);
-- Staging mirror only. No borrower-stage transition, payment, message or lender dispatch.
create table case_signing_delivery (
 id text primary key,mirror_row bigint generated always as identity (start with 2) unique,document_id uuid not null references case_signing_documents(id),
 payload jsonb not null,status text not null default 'pending',attempts integer not null default 0,
 available_at timestamptz not null default now(),lease uuid,last_error text
);
alter table case_signer_grants enable row level security;
alter table case_signing_delivery enable row level security;
revoke all on case_signer_grants,case_signing_delivery from public,anon,authenticated;
grant all on case_signer_grants,case_signing_delivery to service_role;
grant usage,select on sequence case_signing_delivery_mirror_row_seq to service_role;
create function enqueue_signing_delivery() returns trigger language plpgsql as $$
declare item jsonb; items jsonb;
begin
 if new.status is distinct from old.status then
  items=case when jsonb_array_length(new.packet_manifest)>0 then new.packet_manifest else jsonb_build_array(jsonb_build_object('id',new.id,'kind',new.kind)) end;
  for item in select * from jsonb_array_elements(items) loop
   insert into case_signing_delivery(id,document_id,payload)
   values(new.id::text||':'||new.status||':'||(item->>'id'),new.id,jsonb_build_object('case_id',new.case_id,'document_id',new.id,'item_id',item->>'id','status',new.status,'kind',item->>'kind')) on conflict do nothing;
  end loop;
 end if;
 return new;
end; $$;
create trigger signing_delivery_transition after update of status on case_signing_documents for each row execute function enqueue_signing_delivery();
create function claim_signing_delivery() returns setof case_signing_delivery language plpgsql as $$
begin
 update case_signing_delivery set status='exhausted' where attempts>=8 and status in ('pending','processing') and available_at<=now();
 return query update case_signing_delivery set status='processing',attempts=attempts+1,lease=gen_random_uuid(),available_at=now()+interval '5 minutes'
 where id=(select id from case_signing_delivery where status in ('pending','processing') and available_at<=now() and attempts<8 order by available_at for update skip locked limit 1) returning *;
end; $$;
create function settle_signing_delivery(p_id text,p_lease uuid,p_success boolean) returns void language plpgsql as $$
begin
 update case_signing_delivery set status=case when p_success then 'done' when attempts>=8 then 'exhausted' else 'pending' end,
 available_at=now()+interval '1 minute'*power(2,least(attempts,8)),last_error=case when p_success then null else 'Staging mirror failed' end
 where id=p_id and lease=p_lease and status='processing';
 if not found then raise exception 'Lost delivery lease'; end if;
end; $$;
-- Extend prior atomic event completion without weakening original lease/audit semantics.
alter function finish_signing_event(text,uuid,jsonb) rename to finish_signing_event_base;
create function finish_signing_event(p_key text,p_lease uuid,p_patch jsonb) returns void language plpgsql as $$
declare e case_signing_events; d case_signing_documents;
begin
 if p_patch ? 'split_outputs' then
  select * into e from case_signing_events where event_key=p_key and lease=p_lease and status='processing' for update;
  if not found then raise exception 'Lost lease'; end if;
  select * into d from case_signing_documents where request_id=e.request_id for update;
  if d.status<>'archived' or not coalesce((d.split_plan->>'approved')::boolean,false) or jsonb_typeof(p_patch->'split_outputs')<>'array' or jsonb_array_length(p_patch->'split_outputs')<>jsonb_array_length(d.packet_manifest) then raise exception 'Invalid held split'; end if;
  update case_signing_documents set split_outputs=p_patch->'split_outputs',updated_at=now() where id=d.id;
 end if;
 perform finish_signing_event_base(p_key,p_lease,p_patch-'split_outputs');
end; $$;
revoke all on function enqueue_signing_delivery(),claim_signing_delivery(),settle_signing_delivery(text,uuid,boolean),finish_signing_event(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function claim_signing_delivery(),settle_signing_delivery(text,uuid,boolean),finish_signing_event(text,uuid,jsonb) to service_role;
commit;

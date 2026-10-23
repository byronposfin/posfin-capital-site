-- REVIEW/STAGING ONLY. Not applied by this file. No downstream messages or payment triggers.
begin;
create table case_signing_documents (
 id uuid primary key default gen_random_uuid(),
 case_id text not null references case_completion(case_id),
 request_id text not null unique,
 signature_id text not null unique,
 signer_email text not null,
 client_id text not null,
 kind text not null check(kind in ('EL','LOA','BUSINESS_PURPOSE','DUMMY')),
 template_sha256 text not null check(template_sha256 ~ '^[a-f0-9]{64}$'),
 approved boolean not null default false,
 test_mode boolean not null default true check(test_mode),
 status text not null default 'awaiting_signature' check(status in ('awaiting_signature','declined','archived')),
 signed_path text,
 signed_sha256 text,
 updated_at timestamptz not null default now()
);
create table case_signing_events (
 event_key text primary key,
 request_id text not null references case_signing_documents(request_id),
 event_type text not null,
 status text not null default 'pending',
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 lease uuid,
 last_error text,
 created_at timestamptz not null default now()
);
alter table case_signing_documents enable row level security;
alter table case_signing_events enable row level security;
revoke all on case_signing_documents,case_signing_events from public,anon,authenticated;
grant all on case_signing_documents,case_signing_events to service_role;
create function claim_signing_event() returns setof case_signing_events language plpgsql as $$
begin
 update case_signing_events set status='exhausted' where attempts>=8 and status in ('pending','processing') and available_at<=now();
 return query
 update case_signing_events set status='processing',attempts=attempts+1,lease=gen_random_uuid(),available_at=now()+interval '5 minutes'
 where event_key=(select event_key from case_signing_events where status in ('pending','processing') and available_at<=now() and attempts<8 order by available_at for update skip locked limit 1)
 returning *;
end; $$;
create function finish_signing_event(p_key text,p_lease uuid,p_patch jsonb) returns void language plpgsql as $$
declare e case_signing_events; d case_signing_documents;
begin
 select * into e from case_signing_events where event_key=p_key and lease=p_lease and status='processing' for update;
 if not found then raise exception 'Lost lease'; end if;
 select * into d from case_signing_documents where request_id=e.request_id for update;
 if p_patch is not null and d.status<>'archived' then
   if p_patch->>'status' not in ('declined','archived') then raise exception 'Invalid status'; end if;
   if p_patch->>'status'='archived' and (p_patch->>'signed_sha256' is null or p_patch->>'signed_path' is null) then raise exception 'Archive missing'; end if;
   update case_signing_documents set status=p_patch->>'status',signed_path=p_patch->>'signed_path',signed_sha256=p_patch->>'signed_sha256',updated_at=now() where id=d.id;
   -- Status is stored per document: one LOA must not incorrectly complete another LOA or the EL.
   insert into case_completion_audit(case_id,version,actor,source,idempotency_key,diff)
   select d.case_id,version,'system','dropbox_sign','esign:'||p_key,
     jsonb_build_object('signing_document',jsonb_build_object('id',d.id,'old',d.status,'new',p_patch->>'status'))
   from case_completion where case_id=d.case_id;
 end if;
 update case_signing_events set status='done',last_error=null where event_key=p_key;
end; $$;
create function retry_signing_event(p_key text,p_lease uuid,p_error text) returns void language sql as $$
 update case_signing_events set status=case when attempts>=8 then 'exhausted' else 'pending' end,
 available_at=now()+interval '1 minute'*power(2,least(attempts,8)),last_error=left(p_error,200)
 where event_key=p_key and lease=p_lease and status='processing';
$$;
revoke all on function claim_signing_event(),finish_signing_event(text,uuid,jsonb),retry_signing_event(text,uuid,text) from public,anon,authenticated;
grant execute on function claim_signing_event(),finish_signing_event(text,uuid,jsonb),retry_signing_event(text,uuid,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('signing-test-private','signing-test-private',false,26214400,array['application/pdf']);
commit;

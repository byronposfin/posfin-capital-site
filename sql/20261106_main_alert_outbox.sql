-- Main project vgflcrfaudrvrdmxjdtl ONLY; no historical enqueue.
begin;
create table pipeline.web_lead_alert_control (
 id boolean primary key default true check(id), armed_at timestamptz not null default now()
);
insert into pipeline.web_lead_alert_control default values;
create table pipeline.web_lead_alert_outbox (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null unique references pipeline.web_leads(id),
 reference text not null check(reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'),
 state text not null default 'pending' check(state in ('pending','sending','sent','unknown','exhausted')),
 attempts int not null default 0 check(attempts between 0 and 5),
 next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 message_id bigint, last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index web_lead_alert_due on pipeline.web_lead_alert_outbox(next_attempt_at) where state='pending';
alter table pipeline.web_lead_alert_control enable row level security;
alter table pipeline.web_lead_alert_control force row level security;
alter table pipeline.web_lead_alert_outbox enable row level security;
alter table pipeline.web_lead_alert_outbox force row level security;
revoke all on pipeline.web_lead_alert_control,pipeline.web_lead_alert_outbox from public,anon,authenticated;

create function pipeline.web_lead_enqueue_main_alert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.form_stage='submitted' and new.reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'
 and (tg_op='INSERT' or old.form_stage is distinct from 'submitted') then
  insert into pipeline.web_lead_alert_outbox(lead_id,reference) values(new.id,new.reference) on conflict(lead_id) do nothing;
 end if;
 return null;
end $$;
revoke all on function pipeline.web_lead_enqueue_main_alert() from public,anon,authenticated;
create trigger web_lead_enqueue_main_alert after insert or update on pipeline.web_leads
 for each row execute function pipeline.web_lead_enqueue_main_alert();

create function public.web_lead_alert_claim(p_limit int default 10)
returns table(id uuid,reference text,lease_id uuid,attempts int)
language plpgsql security definer set search_path='' as $$
begin
 -- Reconcile any submitted records written since activation; historical tests are not replayed.
 insert into pipeline.web_lead_alert_outbox(lead_id,reference)
 select l.id,l.reference from pipeline.web_leads l
 where l.form_stage='submitted' and l.reference ~ '^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$'
 and l.submitted_at >= (select c.armed_at from pipeline.web_lead_alert_control c where c.id=true)
 on conflict(lead_id) do nothing;
 -- A crashed sender may already have delivered. Never automatically replay an expired lease.
 update pipeline.web_lead_alert_outbox o set state='unknown',last_error='expired_lease',updated_at=now()
 where o.state='sending' and o.lease_until < now();
 update pipeline.web_lead_alert_outbox o set state='exhausted',updated_at=now()
 where o.state='pending' and o.attempts>=5;
 return query
 with due as (
  select o.id from pipeline.web_lead_alert_outbox o
  where o.state='pending' and o.attempts<5 and o.next_attempt_at<=now()
  order by o.next_attempt_at,o.id for update skip locked limit greatest(1,least(coalesce(p_limit,10),10))
 )
 update pipeline.web_lead_alert_outbox o
 set state='sending',attempts=o.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now()
 from due where o.id=due.id returning o.id,o.reference,o.lease_id,o.attempts;
end $$;

create function public.web_lead_alert_finish(p_id uuid,p_lease_id uuid,p_result text,p_message_id bigint default null,p_retry_seconds int default 60)
returns boolean language plpgsql security definer set search_path='' as $$
declare n int;
begin
 if p_result not in ('sent','rejected','unknown') then raise exception 'invalid result'; end if;
 if p_result='sent' and p_message_id is null then raise exception 'receipt required'; end if;
 update pipeline.web_lead_alert_outbox o set
 state=case when p_result='sent' then 'sent' when p_result='unknown' then 'unknown'
 when o.attempts>=5 then 'exhausted' else 'pending' end,
 message_id=case when p_result='sent' then p_message_id else null end,
 last_error=case when p_result='sent' then null else p_result end,
 next_attempt_at=now()+make_interval(secs=>greatest(30,least(coalesce(p_retry_seconds,60),86400))),
 lease_until=null, updated_at=now()
 where o.id=p_id and o.lease_id=p_lease_id and o.state='sending';
 get diagnostics n=row_count;
 return n=1;
end $$;
revoke all on function public.web_lead_alert_claim(int),public.web_lead_alert_finish(uuid,uuid,text,bigint,int) from public,anon,authenticated;
grant execute on function public.web_lead_alert_claim(int),public.web_lead_alert_finish(uuid,uuid,text,bigint,int) to service_role;
commit;

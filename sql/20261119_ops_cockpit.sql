-- Posfin staff operations cockpit.
-- DO NOT APPLY to the live smartlink project. This file is for review only.
-- The preview cockpit does not run this script and does not write these tables.
-- Apply only after Tom has approved the schema.
--
-- Depends on sql/case_portal.sql (public.case_portal_session_ok and case_portal).
-- Case facts stay in case_portal and case_completion. This file does not update
-- those tables, does not read or write case_tokens, and does not insert notifications.
-- Nothing here sends a message or releases a borrower link. Tom still releases
-- borrower links on SmartLink.
--
-- ops_case_desk is the staff overlay for a portal case (status, owner, next action, note).
-- Deleting that row is "back to shared source": the case returns to case_portal.
-- ops_tasks holds work that is not a case: build, systems, and strategic items.
-- ops_audit is append-only: who, when, old value, new value.

create table if not exists public.ops_case_desk (
  case_id text primary key references public.case_completion(case_id) on delete cascade,
  status text,
  owner text,
  next_action text,
  note text,
  due_on date,
  done boolean not null default false,
  draft_message text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ops_case_desk_owner_chk check (
    owner is null or owner in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy')
  )
);

create table if not exists public.ops_tasks (
  id text primary key,
  title text not null,
  section text not null,
  status text,
  description text,
  owner text,
  next_action text,
  note text,
  due_on date,
  known_done text,
  release_line text,
  done boolean not null default false,
  draft_message text,
  source_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint ops_tasks_id_chk check (id ~ '^task-[a-z0-9-]{4,40}$'),
  constraint ops_tasks_section_chk check (section in ('do_now', 'today', 'build', 'strategic', 'done')),
  constraint ops_tasks_owner_chk check (
    owner is null or owner in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy')
  )
);

create table if not exists public.ops_audit (
  id bigint generated always as identity primary key,
  subject_type text not null,
  subject_id text not null,
  actor text not null,
  field_name text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  constraint ops_audit_type_chk check (subject_type in ('case', 'task')),
  constraint ops_audit_actor_chk check (actor in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy'))
);

create index if not exists ops_audit_subject_idx
  on public.ops_audit (subject_type, subject_id, created_at desc);

alter table public.ops_case_desk enable row level security;
alter table public.ops_tasks enable row level security;
alter table public.ops_audit enable row level security;

revoke all on public.ops_case_desk from public, anon, authenticated;
revoke all on public.ops_tasks from public, anon, authenticated;
revoke all on public.ops_audit from public, anon, authenticated;

comment on table public.ops_case_desk is
  'Staff overlay for a smart-link case. Delete the row to return to case_portal. Draft text is never sent from here.';
comment on table public.ops_tasks is
  'Non-case cockpit work: build, systems, and strategic items. source_snapshot is the shared source for revert.';
comment on table public.ops_audit is
  'Append-only cockpit history. One row per changed field: actor, time, old value, new value.';

-- Staff session gate. Same password and pf_staff session as /staff/cases.
-- Defined in public so PostgREST can call it the same way as case_portal RPCs.
-- anon has no table privileges. The function returns nothing unless the session is live.
create or replace function public.ops_cockpit_actor_ok(p_actor text)
returns boolean
language sql
immutable
as $$
  select p_actor in ('Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy');
$$;

create or replace function public.ops_cockpit_audit_add(
  p_type text,
  p_id text,
  p_actor text,
  p_field text,
  p_old text,
  p_new text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_old is not distinct from p_new then
    return;
  end if;
  insert into public.ops_audit (subject_type, subject_id, actor, field_name, old_value, new_value)
  values (p_type, p_id, p_actor, p_field, p_old, p_new);
end;
$$;

create or replace function public.ops_cockpit_board(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  return jsonb_build_object(
    'ok', true,
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'case_id', p.case_id,
        'client_name', p.client_name,
        'stage', p.stage,
        'kyc_status', coalesce(p.kyc->>'status', 'not_started'),
        'facts', jsonb_build_object(
          'property_address', p.facts->'property_address',
          'postcode', p.facts->'postcode',
          'eviction_at', p.facts->'eviction_at',
          'offer_issued', p.facts->'offer_issued',
          'ask_client', p.facts->'ask_client'
        ),
        'overlay', (
          select jsonb_build_object(
            'status', d.status,
            'owner', d.owner,
            'next_action', d.next_action,
            'note', d.note,
            'due_on', d.due_on,
            'done', d.done,
            'draft_message', d.draft_message
          )
          from public.ops_case_desk d
          where d.case_id = p.case_id
        ),
        'evidence', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', s.id,
            'filename', s.filename,
            'created_at', s.created_at
          ) order by s.created_at desc)
          from public.case_submissions s
          where s.case_id = p.case_id
            and s.status = 'stored'
            and s.filename is not null
        ), '[]'::jsonb)
      ) order by p.created_at desc)
      from public.case_portal p
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'section', t.section,
        'status', t.status,
        'description', t.description,
        'owner', t.owner,
        'next_action', t.next_action,
        'note', t.note,
        'due_on', t.due_on,
        'known_done', t.known_done,
        'release_line', t.release_line,
        'done', t.done,
        'draft_message', t.draft_message
      ) order by t.created_at desc)
      from public.ops_tasks t
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'subject_type', a.subject_type,
        'subject_id', a.subject_id,
        'actor', a.actor,
        'field', a.field_name,
        'old_value', a.old_value,
        'new_value', a.new_value,
        'at', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.ops_audit order by created_at desc limit 200
      ) a
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ops_cockpit_save(
  p_session text,
  p_kind text,
  p_id text,
  p_patch jsonb,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old public.ops_case_desk%rowtype;
  task public.ops_tasks%rowtype;
  v_status text;
  v_owner text;
  v_next text;
  v_note text;
  v_due date;
  v_done boolean;
  v_draft text;
  v_title text;
  v_section text;
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  if not public.ops_cockpit_actor_ok(p_actor) then
    return jsonb_build_object('ok', false, 'error', 'bad_actor');
  end if;
  if p_kind not in ('case', 'task') then
    return jsonb_build_object('ok', false, 'error', 'refused');
  end if;
  if exists (
    select 1
      from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) as k(key)
     where k.key not in (
       'status', 'owner', 'next_action', 'note', 'due_on', 'done', 'draft_message', 'title', 'section', 'description'
     )
  ) then
    return jsonb_build_object('ok', false, 'error', 'refused');
  end if;
  if p_patch ? 'owner' and not public.ops_cockpit_actor_ok(p_patch->>'owner') then
    return jsonb_build_object('ok', false, 'error', 'bad_owner');
  end if;

  if p_kind = 'case' then
    if p_id is null or p_id !~ '^[A-Za-z0-9-]{6,48}$' then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    if not exists (select 1 from public.case_portal where case_id = p_id) then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    select * into old from public.ops_case_desk where case_id = p_id;
    v_status := coalesce(p_patch->>'status', old.status);
    v_owner := coalesce(p_patch->>'owner', old.owner);
    v_next := coalesce(p_patch->>'next_action', old.next_action);
    v_note := coalesce(p_patch->>'note', old.note);
    v_draft := coalesce(p_patch->>'draft_message', old.draft_message);
    v_done := case when p_patch ? 'done' then (p_patch->>'done')::boolean else coalesce(old.done, false) end;
    v_due := case
      when p_patch ? 'due_on' and nullif(p_patch->>'due_on', '') is null then null
      when p_patch ? 'due_on' then (p_patch->>'due_on')::date
      else old.due_on
    end;
    insert into public.ops_case_desk (case_id, status, owner, next_action, note, due_on, done, draft_message, updated_at, updated_by)
    values (p_id, v_status, v_owner, v_next, v_note, v_due, v_done, v_draft, now(), p_actor)
    on conflict (case_id) do update
      set status = excluded.status,
          owner = excluded.owner,
          next_action = excluded.next_action,
          note = excluded.note,
          due_on = excluded.due_on,
          done = excluded.done,
          draft_message = excluded.draft_message,
          updated_at = now(),
          updated_by = excluded.updated_by;
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'status', old.status, v_status);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'owner', old.owner, v_owner);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'next_action', old.next_action, v_next);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'note', old.note, v_note);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'due_on', old.due_on::text, v_due::text);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'done', old.done::text, v_done::text);
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'draft_message', old.draft_message, v_draft);
    return jsonb_build_object('ok', true);
  end if;

  if p_id is null or p_id !~ '^task-[a-z0-9-]{4,40}$' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into task from public.ops_tasks where id = p_id;
  if task.id is null then
    v_title := left(coalesce(p_patch->>'title', ''), 140);
    v_section := coalesce(p_patch->>'section', 'build');
    if length(trim(v_title)) < 4 or v_section not in ('build', 'strategic', 'do_now', 'today', 'done') then
      return jsonb_build_object('ok', false, 'error', 'bad_task');
    end if;
    v_owner := p_patch->>'owner';
    v_status := coalesce(nullif(p_patch->>'status', ''), 'REVIEW TOMORROW');
    v_next := p_patch->>'next_action';
    v_note := p_patch->>'note';
    v_draft := p_patch->>'draft_message';
    v_done := case when p_patch ? 'done' then (p_patch->>'done')::boolean else false end;
    v_due := case when nullif(p_patch->>'due_on', '') is null then null else (p_patch->>'due_on')::date end;
    insert into public.ops_tasks (
      id, title, section, status, description, owner, next_action, note, due_on, done, draft_message, source_snapshot, updated_by
    )
    values (
      p_id, v_title, v_section, v_status, left(coalesce(p_patch->>'description', ''), 500),
      v_owner, v_next, v_note, v_due, v_done, v_draft,
      jsonb_build_object(
        'title', v_title, 'section', v_section, 'status', v_status, 'owner', v_owner,
        'next_action', v_next, 'note', v_note, 'due_on', v_due, 'done', v_done, 'draft_message', v_draft
      ),
      p_actor
    );
    perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'title', '', v_title);
    return jsonb_build_object('ok', true, 'id', p_id);
  end if;

  v_title := coalesce(nullif(p_patch->>'title', ''), task.title);
  v_section := coalesce(nullif(p_patch->>'section', ''), task.section);
  if v_section not in ('do_now', 'today', 'build', 'strategic', 'done') then
    return jsonb_build_object('ok', false, 'error', 'bad_task');
  end if;
  v_status := coalesce(p_patch->>'status', task.status);
  v_owner := coalesce(p_patch->>'owner', task.owner);
  v_next := coalesce(p_patch->>'next_action', task.next_action);
  v_note := coalesce(p_patch->>'note', task.note);
  v_draft := coalesce(p_patch->>'draft_message', task.draft_message);
  v_done := case when p_patch ? 'done' then (p_patch->>'done')::boolean else task.done end;
  v_due := case
    when p_patch ? 'due_on' and nullif(p_patch->>'due_on', '') is null then null
    when p_patch ? 'due_on' then (p_patch->>'due_on')::date
    else task.due_on
  end;
  update public.ops_tasks
     set title = v_title,
         section = v_section,
         status = v_status,
         description = coalesce(p_patch->>'description', description),
         owner = v_owner,
         next_action = v_next,
         note = v_note,
         due_on = v_due,
         done = v_done,
         draft_message = v_draft,
         updated_at = now(),
         updated_by = p_actor
   where id = p_id;
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'title', task.title, v_title);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'section', task.section, v_section);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'status', task.status, v_status);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'owner', task.owner, v_owner);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'next_action', task.next_action, v_next);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'note', task.note, v_note);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'due_on', task.due_on::text, v_due::text);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'done', task.done::text, v_done::text);
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'draft_message', task.draft_message, v_draft);
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.ops_cockpit_revert(
  p_session text,
  p_kind text,
  p_id text,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old public.ops_case_desk%rowtype;
  task public.ops_tasks%rowtype;
  snap jsonb;
begin
  if not public.case_portal_session_ok(p_session) then
    return null;
  end if;
  if not public.ops_cockpit_actor_ok(p_actor) then
    return jsonb_build_object('ok', false, 'error', 'bad_actor');
  end if;
  if p_kind = 'case' then
    select * into old from public.ops_case_desk where case_id = p_id;
    if old.case_id is null then
      return jsonb_build_object('ok', true, 'unchanged', true);
    end if;
    delete from public.ops_case_desk where case_id = p_id;
    perform public.ops_cockpit_audit_add('case', p_id, p_actor, 'source', 'overlay', 'case_portal');
    return jsonb_build_object('ok', true);
  end if;
  if p_kind <> 'task' then
    return jsonb_build_object('ok', false, 'error', 'refused');
  end if;
  select * into task from public.ops_tasks where id = p_id;
  if task.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  snap := task.source_snapshot;
  update public.ops_tasks
     set title = coalesce(snap->>'title', title),
         section = coalesce(snap->>'section', section),
         status = snap->>'status',
         owner = snap->>'owner',
         next_action = snap->>'next_action',
         note = snap->>'note',
         due_on = nullif(snap->>'due_on', '')::date,
         done = coalesce((snap->>'done')::boolean, false),
         draft_message = snap->>'draft_message',
         updated_at = now(),
         updated_by = p_actor
   where id = p_id;
  perform public.ops_cockpit_audit_add('task', p_id, p_actor, 'source', 'overlay', 'snapshot');
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ops_cockpit_actor_ok(text) from public, anon, authenticated;
revoke all on function public.ops_cockpit_audit_add(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ops_cockpit_board(text) from public;
revoke all on function public.ops_cockpit_save(text, text, text, jsonb, text) from public;
revoke all on function public.ops_cockpit_revert(text, text, text, text) from public;

grant execute on function public.ops_cockpit_board(text) to anon, authenticated, service_role;
grant execute on function public.ops_cockpit_save(text, text, text, jsonb, text) to anon, authenticated, service_role;
grant execute on function public.ops_cockpit_revert(text, text, text, text) to anon, authenticated, service_role;

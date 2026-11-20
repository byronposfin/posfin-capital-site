import { randomBytes } from 'node:crypto';
import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { FILTERS, OWNERS, applyEdit, groupBoard, lizzyQueue } from '../lib/cockpit.js';
import { renderBoard, renderLizzy, renderLogin, renderMessage } from '../lib/cockpit-html.js';
import { PILOT_REF, presentSpine, spineRefStatus } from '../lib/case-spine.js';
import { renderSpine, renderSpineLogin } from '../lib/case-spine-html.js';
import { sharedSpineStore } from '../lib/case-spine-store.js';
import {
  attachAudit, cockpitMode, endSession, establishSession, loadSupabaseBoard, saveSupabase, revertSupabase,
  sessionAllows, sharedPreviewStore, writePreviewFile,
} from '../lib/cockpit-store.js';

function queryOf(req) {
  if (req.query && (req.query.filter || req.query.view || req.query.caseId || req.query.spine || req.query.waiting)) return req.query;
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(url.searchParams);
  } catch {
    return req.query || {};
  }
}

function patchFrom(fields) {
  return {
    status: fields.status,
    owner: fields.owner,
    nextAction: fields.next_action,
    note: fields.note,
    dueOn: fields.due_on,
    done: fields.done,
    draftMessage: fields.draft_message,
  };
}

function locationFor(fields, id) {
  const filter = FILTERS.some((item) => item.id === fields.filter) ? fields.filter : 'all';
  const view = fields.view === 'lizzy' ? 'lizzy' : 'board';
  const path = view === 'lizzy' ? `/staff/cockpit?view=lizzy&filter=${filter}` : `/staff/cockpit?filter=${filter}`;
  return id ? `${path}#card-${encodeURIComponent(id)}` : path;
}

function hydrate(store, req) {
  if (!store || store._hydrated || !store.dump || !store.load) return;
  store._hydrated = true;
  const dumped = store.dump();
  const empty = !Object.keys(dumped.overlay || {}).length && !(dumped.extra || []).length && !(dumped.audit || []).length;
  if (!empty) return;
  const raw = readCookie(req, 'pf_cockpit_state');
  if (!raw) return;
  try { store.load(JSON.parse(raw)); } catch { /* a damaged cookie stays on the fixture board */ }
}

function previewStore(deps, env, req) {
  if (deps.store) return deps.store;
  const store = sharedPreviewStore(env);
  hydrate(store, req);
  return store;
}

function persist(store, res) {
  if (store && store.file) writePreviewFile(store.file, store);
  if (!store || !store.dump) return;
  const payload = encodeURIComponent(JSON.stringify(store.dump(40)));
  if (payload.length > 3800) return;
  const cookie = `pf_cockpit_state=${payload}; HttpOnly; Path=/staff; SameSite=Lax; Max-Age=604800`;
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (existing) res.setHeader('Set-Cookie', [].concat(existing, cookie));
  else res.setHeader('Set-Cookie', cookie);
}

function safeNext(value) {
  return value === `/staff/cockpit/spine/${PILOT_REF}` ? value : '';
}

function spineStoreOf(deps) {
  return deps.spineStore || sharedSpineStore();
}

function spineBack(fields) {
  const waiting = fields.waiting === 'preview' ? '?waiting=preview' : '';
  const id = fields.id ? `#action-${encodeURIComponent(fields.id)}` : '';
  return `/staff/cockpit/spine/${PILOT_REF}${waiting}${id}`;
}

function sendSpine(res, query, mode, deps, env) {
  const status = spineRefStatus(query.spine);
  if (status === 'wrong_case') {
    return sendHtml(res, 404, renderMessage('Not this case', 'PC-004 is Winslade Park / Mark Edworthy. The Stage-2 pilot ref is POSFIN-WEB-EYCTQ6.'));
  }
  if (status !== 'pilot') return sendHtml(res, 404, renderMessage('Not on this pilot', 'The Stage-2 spine currently has one case, POSFIN-WEB-EYCTQ6.'));
  const store = spineStoreOf(deps);
  const spine = store.get();
  const view = presentSpine(spine, env, query, mode, deps.now);
  const auditByAction = {};
  for (const item of spine.actions) auditByAction[item.id] = store.auditFor(item.id);
  return sendHtml(res, 200, renderSpine(view, auditByAction));
}

function handleSpinePost(fields, res, deps, env, mode) {
  if (fields.spine === 'PC-004' || fields.id === 'PC-004') {
    return sendHtml(res, 404, renderMessage('Not this case', 'PC-004 is Winslade Park / Mark Edworthy. The Stage-2 pilot ref is POSFIN-WEB-EYCTQ6.'));
  }
  if (mode === 'supabase') {
    return sendHtml(res, 503, renderMessage('Not written', 'The spine tables are not applied. This preview did not write to Supabase.'));
  }
  const actor = String(fields.actor || '');
  const now = deps.now || new Date().toISOString();
  const store = spineStoreOf(deps);
  const action = String(fields.action || '');
  let result;
  if (action === 'spine-revert') result = store.revert(actor, now);
  else if (action === 'spine-done') result = store.setDone(String(fields.id || ''), true, actor, now);
  else if (action === 'spine-reopen') result = store.setDone(String(fields.id || ''), false, actor, now);
  else return sendHtml(res, 400, renderMessage('Not available', 'That action is not on this spine.'));
  if (!result || result.error) return sendHtml(res, 400, renderMessage('Not saved', 'That desk note was not saved. Nothing was sent.'));
  return redirect(res, spineBack(fields));
}

function blank() {
  return { status: 'AWAITING REPLY', owner: 'Byron', nextAction: '', note: '', dueOn: '', done: false, draftMessage: '' };
}

async function handlePreviewPost(fields, req, res, deps, env) {
  const action = String(fields.action || '');
  if (action === 'send' || action === 'release' || action === 'notify') {
    return sendHtml(res, 400, renderMessage('Not available', 'This cockpit does not send messages or release borrower links.'));
  }
  const store = previewStore(deps, env, req);
  const actor = String(fields.actor || '');
  const now = deps.now || new Date().toISOString();
  let result;
  if (action === 'add') {
    result = store.addTask({
      title: fields.title,
      section: fields.section,
      owner: fields.owner,
      nextAction: fields.next_action,
    }, actor, now);
  } else if (action === 'revert') {
    result = store.revert(String(fields.id || ''), actor, now);
  } else if (action === 'reopen') {
    const patch = patchFrom(fields);
    patch.done = false;
    result = store.save(String(fields.id || ''), patch, actor, now);
  } else if (action === 'save') {
    result = store.save(String(fields.id || ''), patchFrom(fields), actor, now);
  } else {
    return sendHtml(res, 400, renderMessage('Not available', 'That action is not on this cockpit.'));
  }
  if (!result || result.error) {
    const text = result && result.error === 'refused'
      ? 'This cockpit does not send messages or release borrower links.'
      : 'That change was not saved.';
    return sendHtml(res, 400, renderMessage('Not saved', text));
  }
  if (!deps.store) persist(store, res);
  else if (deps.persist) persist(store, res);
  const id = result.removed ? '' : (result.card && result.card.id);
  return redirect(res, locationFor(fields, id));
}

async function handleLivePost(fields, session, res, deps) {
  const action = String(fields.action || '');
  if (action === 'send' || action === 'release' || action === 'notify') {
    return sendHtml(res, 400, renderMessage('Not available', 'This cockpit does not send messages or release borrower links.'));
  }
  const actor = String(fields.actor || '');
  if (!OWNERS.includes(actor)) return sendHtml(res, 400, renderMessage('Not saved', 'Choose who is recording the change.'));
  let result;
  if (action === 'add') {
    if (!OWNERS.includes(fields.owner)) return sendHtml(res, 400, renderMessage('Not saved', 'Choose an owner.'));
    const id = `task-${randomBytes(4).toString('hex')}`;
    result = await saveSupabase(session, 'task', id, {
      title: fields.title,
      section: fields.section === 'strategic' ? 'strategic' : 'build',
      owner: fields.owner,
      nextAction: fields.next_action || '',
      description: 'Added from the staff cockpit.',
    }, actor, deps);
    if (result && result.ok) return redirect(res, locationFor(fields, id));
  } else if (action === 'revert') {
    result = await revertSupabase(session, fields.kind === 'task' ? 'task' : 'case', String(fields.id || ''), actor, deps);
  } else if (action === 'reopen' || action === 'save') {
    const patch = patchFrom(fields);
    if (action === 'reopen') patch.done = false;
    const probe = applyEdit(blank(), patch, actor);
    if (!probe.ok) return sendHtml(res, 400, renderMessage('Not saved', 'Check the status, owner and date.'));
    result = await saveSupabase(session, fields.kind === 'task' ? 'task' : 'case', String(fields.id || ''), {
      status: probe.card.status,
      owner: probe.card.owner,
      nextAction: probe.card.nextAction,
      note: probe.card.note,
      dueOn: probe.card.dueOn,
      done: probe.card.done,
      draftMessage: probe.card.draftMessage,
    }, actor, deps);
  } else {
    return sendHtml(res, 400, renderMessage('Not available', 'That action is not on this cockpit.'));
  }
  if (result && result.denied) return sendHtml(res, 401, renderLogin('password'));
  if (result && result.error === 'schema_pending') {
    return sendHtml(res, 503, renderMessage('Tables not ready', 'The cockpit tables are not on the database yet. Nothing was written.'));
  }
  if (!result || result.error) return sendHtml(res, 400, renderMessage('Not saved', 'That change was not saved.'));
  return redirect(res, locationFor(fields, String(fields.id || '')));
}

export async function handleCockpit(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const mode = cockpitMode(env);
  const depsEnv = { ...deps, env };
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      const action = String(fields.action || '');
      const session = readCookie(req, 'pf_staff');
      if (action === 'logout') {
        if (session && await sessionAllows(session, depsEnv)) await endSession(session, depsEnv);
        writeStaffCookie(res, req, '', 0);
        return redirect(res, '/staff/cockpit');
      }
      if (!action) {
        const login = await establishSession(String(fields.password || ''), depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderLogin(login.error || 'password'));
        writeStaffCookie(res, req, login.session);
        return redirect(res, safeNext(fields.next) || '/staff/cockpit');
      }
      if (!session || !await sessionAllows(session, depsEnv)) {
        const next = safeNext(fields.next) || (fields.spine === PILOT_REF ? `/staff/cockpit/spine/${PILOT_REF}` : '');
        if (next) return sendHtml(res, 401, renderSpineLogin('password', next));
        return sendHtml(res, 401, renderLogin('password'));
      }
      if (action === 'send' || action === 'release' || action === 'notify') {
        return sendHtml(res, 400, renderMessage('Not available', 'This cockpit does not send messages or release borrower links.'));
      }
      if (action === 'spine-done' || action === 'spine-reopen' || action === 'spine-revert') {
        return handleSpinePost(fields, res, depsEnv, env, mode);
      }
      if (mode === 'supabase') return handleLivePost(fields, session, res, depsEnv);
      return handlePreviewPost(fields, req, res, depsEnv, env);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendHtml(res, 405, renderMessage('Not available', 'Open the cockpit in a browser.'));
    }
    const session = readCookie(req, 'pf_staff');
    const query = queryOf(req);
    if (!session || !await sessionAllows(session, depsEnv)) {
      if (query.spine && spineRefStatus(query.spine) === 'pilot') {
        return sendHtml(res, 401, renderSpineLogin('', `/staff/cockpit/spine/${PILOT_REF}`));
      }
      return sendHtml(res, 401, renderLogin(''));
    }
    if (query.spine) return sendSpine(res, query, mode, depsEnv, env);
    if (mode === 'supabase') {
      const loaded = await loadSupabaseBoard(session, depsEnv);
      if (loaded.denied) return sendHtml(res, 401, renderLogin('password'));
      const filter = FILTERS.some((item) => item.id === query.filter) ? query.filter : 'all';
      const cards = attachAudit(loaded.cards, normalise(loaded.audit));
      const model = {
        mode,
        filter,
        schemaPending: loaded.schema === false,
        sections: groupBoard(cards, filter),
        queue: lizzyQueue(cards),
      };
      const html = query.view === 'lizzy' ? renderLizzy(model) : renderBoard(model);
      return sendHtml(res, 200, html);
    }
    const store = previewStore(deps, env, req);
    const filter = FILTERS.some((item) => item.id === query.filter) ? query.filter : 'all';
    const cards = attachAudit(store.list(), store.allAudit());
    const model = {
      mode: 'preview',
      filter,
      schemaPending: false,
      sections: groupBoard(cards, filter),
      queue: lizzyQueue(cards),
    };
    const html = query.view === 'lizzy' ? renderLizzy(model) : renderBoard(model);
    return sendHtml(res, 200, html);
  } catch (error) {
    console.error('[cockpit]', error.code || 'cockpit_failed');
    return sendHtml(res, 503, renderMessage('Please try again', 'The cockpit is temporarily unavailable.'));
  }
}

function normalise(rows) {
  return (rows || []).map((row) => ({
    subjectId: row.subjectId || row.subject_id,
    actor: row.actor,
    field: row.field || row.field_name,
    oldValue: row.oldValue ?? row.old_value ?? '',
    newValue: row.newValue ?? row.new_value ?? '',
    at: row.at || '',
  }));
}

export default function handler(req, res) {
  return handleCockpit(req, res, {});
}

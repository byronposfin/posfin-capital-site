import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { staffList, staffLogin, staffLogout, storeConfig } from './case-store.js';
import { previewPasswordAllowed, staffActorFromToken, supabaseAccessToken, supabasePasswordLogin } from './staff-auth.js';
import {
  OWNERS, RELEASE_LINE, applyEdit, auditRows, canon, cardsFromRemote, clean, diffFromSource, previewSeed, remotePatch,
} from './cockpit.js';

export function cockpitMode(env = process.env) {
  return env.COCKPIT_SOURCE === 'supabase' ? 'supabase' : 'preview';
}

export function mintPreviewSession(env = process.env, now = Date.now()) {
  const secret = String(env.COCKPIT_PREVIEW_PASSWORD || '');
  if (!secret) return '';
  const exp = now + 12 * 60 * 60 * 1000;
  const body = `pv.${exp}`;
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return `${body}.${sig}`;
}

export function previewSessionOk(token, env = process.env, now = Date.now()) {
  const secret = String(env.COCKPIT_PREVIEW_PASSWORD || '');
  if (!secret) return false;
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'pv') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = createHmac('sha256', secret).update(`pv.${parts[1]}`).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(parts[2]);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createPreviewStore(seed = previewSeed()) {
  const source = new Map(seed.map((item) => [item.id, structuredClone(item)]));
  const overlay = new Map();
  const extra = new Map();
  const audit = [];

  function materialise(item) {
    return { ...item, ...(overlay.get(item.id) || {}) };
  }

  const store = {
    mode: 'preview',
    list() {
      const seeded = [...source.values()].map(materialise);
      return seeded.concat([...extra.values()].map(materialise));
    },
    get(id) {
      if (extra.has(id)) return materialise(extra.get(id));
      if (!source.has(id)) return null;
      return materialise(source.get(id));
    },
    sourceOf(id) {
      if (extra.has(id)) return structuredClone(extra.get(id));
      if (!source.has(id)) return null;
      return structuredClone(source.get(id));
    },
    auditFor(id) {
      return audit.filter((row) => row.subjectId === id);
    },
    allAudit() {
      return audit.slice();
    },
    save(id, patch, actor, now) {
      const current = store.get(id);
      const result = applyEdit(current, patch, actor);
      if (!result.ok) return result;
      if (!result.changes.length) return { ok: true, card: current, changes: [] };
      const base = extra.has(id) ? extra.get(id) : source.get(id);
      const nextOverlay = { ...(overlay.get(id) || {}) };
      for (const change of result.changes) nextOverlay[change.field] = result.card[change.field];
      overlay.set(id, nextOverlay);
      if (extra.has(id)) extra.set(id, { ...base, ...nextOverlay, added: true });
      pushAudit(audit, current.kind, id, actor, result.changes, now);
      return { ok: true, card: store.get(id), changes: result.changes };
    },
    reopen(id, actor, now) {
      const current = store.get(id);
      if (!current) return { error: 'not_found' };
      return store.save(id, { done: false }, actor, now);
    },
    revert(id, actor, now) {
      if (!OWNERS.includes(actor)) return { error: 'bad_actor' };
      const current = store.get(id);
      if (!current) return { error: 'not_found' };
      if (current.added && extra.has(id)) {
        extra.delete(id);
        overlay.delete(id);
        pushAudit(audit, 'task', id, actor, [{ field: 'source', oldValue: 'added', newValue: 'removed' }], now);
        return { ok: true, removed: true };
      }
      const src = source.get(id);
      if (!src) return { error: 'not_found' };
      const changes = diffFromSource(current, src);
      overlay.delete(id);
      if (changes.length) pushAudit(audit, current.kind, id, actor, changes, now);
      pushAudit(audit, current.kind, id, actor, [{ field: 'source', oldValue: 'overlay', newValue: 'fixture' }], now);
      return { ok: true, card: store.get(id), changes };
    },
    addTask(input, actor, now) {
      if (!OWNERS.includes(actor)) return { error: 'bad_actor' };
      const title = clean(input.title, 140);
      if (title.length < 4) return { error: 'bad_title' };
      const owner = input.owner;
      if (!OWNERS.includes(owner)) return { error: 'bad_owner' };
      const section = input.section === 'strategic' ? 'strategic' : 'build';
      const id = `task-${randomBytes(4).toString('hex')}`;
      const item = {
        id,
        kind: 'task',
        preview: true,
        added: true,
        title,
        section,
        status: 'REVIEW TOMORROW',
        description: 'Added on the preview board. Not a live systems ticket.',
        owner,
        nextAction: clean(input.nextAction, 400),
        knownDone: '',
        releaseLine: RELEASE_LINE,
        dueOn: '',
        note: '',
        done: false,
        draftMessage: '',
        evidence: [],
      };
      extra.set(id, item);
      pushAudit(audit, 'task', id, actor, [{ field: 'title', oldValue: '', newValue: title }], now);
      return { ok: true, card: item };
    },
    dump(limitAudit = 0) {
      const rows = limitAudit ? audit.slice(-limitAudit) : audit.slice();
      return {
        overlay: Object.fromEntries(overlay),
        extra: [...extra.values()],
        audit: rows,
      };
    },
    load(data) {
      overlay.clear();
      extra.clear();
      audit.length = 0;
      const savedOverlay = data && data.overlay || {};
      for (const [id, value] of Object.entries(savedOverlay)) {
        if (source.has(id) || (data.extra || []).some((item) => item.id === id)) overlay.set(id, value);
      }
      for (const item of data && data.extra || []) {
        if (item && item.added && typeof item.id === 'string' && item.id.startsWith('task-')) extra.set(item.id, item);
      }
      for (const row of data && data.audit || []) {
        if (row && row.subjectId && row.field) audit.push(row);
      }
    },
  };
  return store;
}

function pushAudit(audit, kind, id, actor, changes, now) {
  for (const change of changes) {
    audit.push({
      subjectType: kind,
      subjectId: id,
      actor,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      at: now,
    });
  }
}

export function readPreviewFile(file) {
  if (!file) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writePreviewFile(file, store) {
  if (!file) return;
  writeFileSync(file, JSON.stringify(store.dump()));
}

const memory = globalThis.__posfinCockpitMemory || { store: null };
globalThis.__posfinCockpitMemory = memory;

export function sharedPreviewStore(env = process.env) {
  if (!memory.store) {
    const store = createPreviewStore();
    const file = env.COCKPIT_STORE_PATH || '';
    const saved = readPreviewFile(file);
    if (saved) store.load(saved);
    store.file = file;
    memory.store = store;
  }
  return memory.store;
}

export function resetSharedPreviewStore() {
  memory.store = null;
}

async function rpc(name, args, deps) {
  const cfg = storeConfig(deps.env);
  const fetcher = deps.fetch || fetch;
  const res = await fetcher(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error('schema_pending');
    error.code = res.status === 401 ? 'denied' : 'schema_pending';
    throw error;
  }
  if (!text || text === 'null') return null;
  return JSON.parse(text);
}

export async function loadSupabaseBoard(session, deps = {}) {
  const rows = await staffList(session, deps);
  if (!rows) return { denied: true };
  try {
    const payload = await rpc('ops_cockpit_board', { p_session: session }, deps);
    if (!payload) return { denied: true };
    return { ok: true, cards: cardsFromRemote(payload), audit: payload.audit || [], schema: true };
  } catch (error) {
    if (error.code === 'denied') return { denied: true };
    const cards = rows.map((row) => cardsFromRemote({ cases: [row], tasks: [] })).flat();
    return { ok: true, cards, audit: [], schema: false, error: 'schema_pending' };
  }
}

export async function saveSupabase(session, kind, id, patch, actor, deps = {}) {
  const body = remotePatch(patch);
  if (Object.keys(body).some((key) => ['send', 'release', 'token', 'notify'].includes(key))) {
    return { error: 'refused' };
  }
  try {
    const result = await rpc('ops_cockpit_save', {
      p_session: session,
      p_kind: kind,
      p_id: id,
      p_patch: body,
      p_actor: actor,
    }, deps);
    if (!result) return { denied: true };
    if (result.ok === false) return { error: result.error || 'store' };
    return { ok: true };
  } catch (error) {
    if (error.code === 'denied') return { denied: true };
    return { error: 'schema_pending' };
  }
}

export async function revertSupabase(session, kind, id, actor, deps = {}) {
  try {
    const result = await rpc('ops_cockpit_revert', {
      p_session: session,
      p_kind: kind,
      p_id: id,
      p_actor: actor,
    }, deps);
    if (!result) return { denied: true };
    if (result.ok === false) return { error: result.error || 'store' };
    return { ok: true };
  } catch (error) {
    if (error.code === 'denied') return { denied: true };
    return { error: 'schema_pending' };
  }
}

export async function establishSession(password, deps = {}) {
  const env = deps.env || process.env;
  const input = password && typeof password === 'object' ? password : { password };
  const secret = String(input.password || '');
  if (!previewPasswordAllowed(env)) {
    return supabasePasswordLogin(input.email, secret, { ...deps, env });
  }
  if (cockpitMode(env) === 'preview' && env.COCKPIT_PREVIEW_PASSWORD && secret === env.COCKPIT_PREVIEW_PASSWORD) {
    return { ok: true, session: mintPreviewSession(env), preview: true };
  }
  if (env.COCKPIT_AUTH === 'preview') return { ok: false, error: 'preview_password' };
  const login = deps.login || staffLogin;
  const result = await login(secret, deps);
  if (!result || result.ok !== true || !result.session) return { ok: false, error: 'password' };
  return { ok: true, session: result.session, preview: false };
}

export async function sessionAllows(token, deps = {}) {
  const env = deps.env || process.env;
  if (!token) return false;
  const access = supabaseAccessToken(token);
  if (access) {
    const actor = await staffActorFromToken(access, { ...deps, env });
    return actor.ok === true;
  }
  if (previewSessionOk(token, env)) return previewPasswordAllowed(env);
  if (deps.sessionOk) return deps.sessionOk(token);
  if (env.COCKPIT_AUTH === 'preview') return false;
  const rows = await staffList(token, deps);
  return Array.isArray(rows);
}

export async function endSession(token, deps = {}) {
  const env = deps.env || process.env;
  if (supabaseAccessToken(token)) return;
  if (previewSessionOk(token, env) || env.COCKPIT_AUTH === 'preview') return;
  const logout = deps.logout || staffLogout;
  await logout(token, deps);
}

export function attachAudit(cards, audit) {
  return cards.map((item) => ({ ...item, audit: auditRows(audit, item.id) }));
}

export { canon };

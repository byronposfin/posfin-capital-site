// Persistence for the Wirral Waters response.
// Prefers public.compliance_voice_cases via the service role.
// If the table is missing, or no service role is configured, the document stays
// in memory for this server process so the page still accepts Roy's words.

import { SLUG, freshState, normaliseState, applyAction } from './wirral-response.js';

const MAIN_URL = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';
const memory = new Map();

export function storeEnv(env = process.env) {
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || env.FF_ALERT_SERVICE_KEY || '').trim();
  const setUrl = String(env.SUPABASE_URL || env.FF_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const url = setUrl || (key ? MAIN_URL : '');
  return { url, key };
}

function jar(deps) {
  return deps.memory || memory;
}

function fallbackState(deps) {
  const hit = jar(deps).get(SLUG);
  return hit ? normaliseState(hit) : freshState(deps.now ? deps.now() : new Date().toISOString());
}

function remember(deps, state) {
  jar(deps).set(SLUG, state);
  return state;
}

function remoteHeaders(cfg, write) {
  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    Accept: 'application/json',
  };
  if (write) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=representation';
  }
  return headers;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tableMissing(status, body) {
  const code = String(body && (body.code || '') || '');
  const message = String(body && (body.message || body.error || '') || '');
  return status === 404
    || code === 'PGRST205'
    || code === '42P01'
    || code === 'PGRST106'
    || /compliance_voice_cases/i.test(message);
}

function rowState(row, now) {
  if (!row || typeof row !== 'object') return null;
  const state = normaliseState(row.document, now);
  if (Number.isInteger(row.revision) && row.revision >= 0) state.revision = row.revision;
  if (row.updated_at) state.updatedAt = String(row.updated_at);
  return state;
}

async function remoteLoad(cfg, deps) {
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(
    `${cfg.url}/rest/v1/compliance_voice_cases?slug=eq.${encodeURIComponent(SLUG)}&select=document,revision,updated_at`,
    { headers: remoteHeaders(cfg, false) },
  );
  const body = await readJson(response);
  if (tableMissing(response.status, body) || response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'schema_pending' };
  }
  if (!response.ok) return { ok: false, reason: 'unavailable' };
  const row = Array.isArray(body) ? body[0] : null;
  return { ok: true, state: row ? rowState(row, deps.now ? deps.now() : new Date().toISOString()) : null };
}

async function remoteInsert(cfg, deps, state) {
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(`${cfg.url}/rest/v1/compliance_voice_cases`, {
    method: 'POST',
    headers: remoteHeaders(cfg, true),
    body: JSON.stringify({
      slug: SLUG,
      document: state,
      revision: state.revision,
      updated_at: state.updatedAt,
    }),
  });
  const body = await readJson(response);
  if (tableMissing(response.status, body) || response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'schema_pending' };
  }
  if (response.status === 409) return { ok: false, reason: 'exists' };
  if (!response.ok) return { ok: false, reason: 'unavailable' };
  const row = Array.isArray(body) ? body[0] : body;
  return { ok: true, state: rowState(row, state.updatedAt) || state };
}

async function remoteUpdate(cfg, deps, state, expectedRevision) {
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(
    `${cfg.url}/rest/v1/compliance_voice_cases?slug=eq.${encodeURIComponent(SLUG)}&revision=eq.${encodeURIComponent(String(expectedRevision))}`,
    {
      method: 'PATCH',
      headers: remoteHeaders(cfg, true),
      body: JSON.stringify({
        document: state,
        revision: state.revision,
        updated_at: state.updatedAt,
      }),
    },
  );
  const body = await readJson(response);
  if (tableMissing(response.status, body) || response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'schema_pending' };
  }
  if (!response.ok) return { ok: false, reason: 'unavailable' };
  const row = Array.isArray(body) ? body[0] : null;
  if (!row) return { ok: false, reason: 'conflict' };
  return { ok: true, state: rowState(row, state.updatedAt) || state };
}

export async function loadCase(deps = {}) {
  const cfg = storeEnv(deps.env || process.env);
  if (!cfg.url || !cfg.key || deps.forceLocal) {
    return { ok: true, state: fallbackState(deps), storage: 'local', persisted: false };
  }
  try {
    const remote = await remoteLoad(cfg, deps);
    if (!remote.ok) return { ok: true, state: fallbackState(deps), storage: 'local', persisted: false };
    if (!remote.state) {
      const local = jar(deps).get(SLUG);
      const cached = local ? normaliseState(local) : null;
      if (cached && cached.revision > 0) return { ok: true, state: cached, storage: 'local', persisted: false };
      return { ok: true, state: freshState(deps.now ? deps.now() : new Date().toISOString()), storage: 'supabase', persisted: true };
    }
    remember(deps, remote.state);
    return { ok: true, state: remote.state, storage: 'supabase', persisted: true };
  } catch {
    return { ok: true, state: fallbackState(deps), storage: 'local', persisted: false };
  }
}

function localSave(deps, state) {
  remember(deps, state);
  return { ok: true, state, storage: 'local', persisted: false };
}

function remoteSave(deps, saved) {
  remember(deps, saved.state);
  return { ok: true, state: saved.state, storage: 'supabase', persisted: true };
}

async function persist(state, expectedRevision, deps) {
  const cfg = storeEnv(deps.env || process.env);
  if (!cfg.url || !cfg.key || deps.forceLocal) return localSave(deps, state);
  try {
    if (expectedRevision > 0) {
      const updated = await remoteUpdate(cfg, deps, state, expectedRevision);
      if (updated.ok) return remoteSave(deps, updated);
      if (updated.reason !== 'conflict') return localSave(deps, state);
      const inserted = await remoteInsert(cfg, deps, state);
      if (inserted.ok) return remoteSave(deps, inserted);
      if (inserted.reason === 'exists') return { ok: false, error: 'conflict', reason: 'conflict' };
      return localSave(deps, state);
    }
    const inserted = await remoteInsert(cfg, deps, state);
    if (inserted.ok) return remoteSave(deps, inserted);
    if (inserted.reason === 'exists') {
      const updated = await remoteUpdate(cfg, deps, state, expectedRevision);
      if (updated.ok) return remoteSave(deps, updated);
      if (updated.reason === 'conflict') return { ok: false, error: 'conflict', reason: 'conflict' };
    }
    return localSave(deps, state);
  } catch {
    return localSave(deps, state);
  }
}

export async function commit(action, deps = {}) {
  const now = deps.now ? deps.now() : new Date().toISOString();
  const loaded = await loadCase(deps);
  if (action && action.type !== 'save_draft' && action.revision !== loaded.state.revision) {
    return {
      ok: false,
      error: 'conflict',
      message: 'This page was updated. Review the latest version, then send again.',
      state: loaded.state,
      storage: loaded.storage,
      persisted: loaded.persisted,
    };
  }
  const applied = applyAction(loaded.state, action, now);
  if (!applied.ok) return { ...applied, storage: loaded.storage, persisted: loaded.persisted };
  let saved = await persist(applied.state, loaded.state.revision, deps);
  if (!saved.ok && saved.reason === 'conflict' && action && action.type === 'save_draft') {
    const again = await loadCase(deps);
    const redraft = applyAction(again.state, { type: 'save_draft', inputs: applied.state.draft }, now);
    saved = await persist(redraft.state, again.state.revision, deps);
  }
  if (!saved.ok) {
    const again = await loadCase(deps);
    return {
      ok: false,
      error: 'conflict',
      message: 'This page was updated. Review the latest version, then send again.',
      state: again.state,
      storage: again.storage,
      persisted: again.persisted,
    };
  }
  return saved;
}

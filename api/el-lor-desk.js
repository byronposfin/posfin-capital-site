import { readCookie, readRaw, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { documentBody, presentCase, presentList, runAction } from '../lib/el-lor-desk.js';
import { elLorEnabled } from '../lib/el-lor-flag.js';
import {
  renderCasePage, renderDocument, renderElLorDenied, renderElLorLogin, renderElLorMessage, renderElLorMissing, renderLiveCases,
} from '../lib/el-lor-html.js';
import { loadSeed } from '../lib/el-lor-seed.js';
import { sharedElLorStore } from '../lib/el-lor-store.js';

const NOTICES = new Set([
  'el-draft', 'lor-draft', 'approval-pending', 'mock-sent', 'viewed', 'signed', 'marked', 'lor-sent', 'response', 'processing',
]);

function queryOf(req) {
  if (req.query && (req.query.case || req.query.doc || req.query.stage || req.query.owner || req.query.el || req.query.lor || req.query.ready || req.query.notice)) {
    return req.query;
  }
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return Object.fromEntries(url.searchParams);
  } catch {
    return req.query || {};
  }
}

function formFields(raw) {
  const params = new URLSearchParams(raw);
  const fields = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    fields[key] = values.length > 1 ? values : values[0];
  }
  return fields;
}

async function fieldsOf(req) {
  const type = String(req.headers?.['content-type'] || '');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRaw(req);
  const text = raw ? raw.toString('utf8') : '';
  if (type.includes('application/json')) return JSON.parse(text || '{}');
  return formFields(text);
}

function caseRefOf(query, fields) {
  const raw = String((fields && fields.case_ref) || query.case || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(raw) ? raw : '';
}

async function seedStore(store, env, deps) {
  if (deps.seed) {
    store.useSeed(deps.seed);
    return { warning: '' };
  }
  const loaded = await loadSeed(env, deps.fetch || globalThis.fetch);
  store.useSeed(loaded.cases);
  return loaded;
}

export async function handleElLorDesk(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  if (!elLorEnabled(env)) return sendHtml(res, 404, renderElLorMissing());
  const store = deps.store || sharedElLorStore();
  const now = deps.now || new Date().toISOString();
  const depsEnv = { ...deps, env };
  try {
    const loaded = await seedStore(store, env, deps);
    if (req.method === 'POST') {
      const fields = await fieldsOf(req);
      if (fields.password && !fields.action) {
        const login = await establishSession(String(fields.password || ''), depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderElLorLogin('/staff/cockpit/live'));
        writeStaffCookie(res, req, login.session);
        const next = caseRefOf(queryOf(req), fields);
        return redirect(res, next ? `/staff/cockpit/el/${encodeURIComponent(next)}` : '/staff/cockpit/live');
      }
      const session = readCookie(req, 'pf_staff');
      if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderElLorLogin('/staff/cockpit/live'));
      const ref = caseRefOf(queryOf(req), fields);
      const row = ref ? store.seedRow(ref) : null;
      if (!row) return sendHtml(res, 404, renderElLorMessage('Not on this desk', 'That case reference is not on the desk.'));
      const result = runAction(store, row, fields, now, env, { sink: deps.networkLog });
      if (result.redirect) return redirect(res, result.redirect);
      if (result.status === 403 && result.error === 'owner_only') {
        return sendHtml(res, 403, renderElLorDenied('Owner seat required. Nothing was changed.'));
      }
      if (result.status === 403 && result.error === 'no_ai') {
        const view = presentCase(store, row, now, { env, notice: '' });
        return sendHtml(res, 403, renderCasePage(view));
      }
      const view = presentCase(store, row, now, { env, failures: result.failures || [] });
      if (result.error === 'processing') view.processing = { ...view.processing, enabled: false, reason: result.reason || view.processing.reason };
      return sendHtml(res, result.status || 400, renderCasePage(view));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendHtml(res, 405, renderElLorMessage('Not available', 'Open the desk in a browser.'));
    }
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderElLorLogin('/staff/cockpit/live'));
    const query = queryOf(req);
    const ref = caseRefOf(query, null);
    if (!ref) {
      return sendHtml(res, 200, renderLiveCases(presentList(store, query, now, loaded.warning)));
    }
    const row = store.seedRow(ref);
    if (!row) return sendHtml(res, 404, renderElLorMessage('Not on this desk', 'That case reference is not on the desk.'));
    if (query.doc === 'el' || query.doc === 'lor') {
      const doc = documentBody(store, row, query.doc, now);
      if (!doc) return sendHtml(res, 404, renderElLorMessage('No document', 'There is no current document of that kind to view.'));
      return sendHtml(res, 200, renderDocument({ ...doc, caseRef: ref }));
    }
    const notice = NOTICES.has(String(query.notice || '')) ? String(query.notice) : '';
    return sendHtml(res, 200, renderCasePage(presentCase(store, row, now, { env, notice })));
  } catch (error) {
    console.error('[el-lor]', error.code || 'el_lor_failed');
    return sendHtml(res, 503, renderElLorMessage('Please try again', 'The desk is temporarily unavailable.'));
  }
}

export default function handler(req, res) {
  return handleElLorDesk(req, res, {});
}

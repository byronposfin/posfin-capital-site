import { readCookie, readRaw, sendHtml, setPrivate } from '../lib/case-http.js';
import { renderLogin } from '../lib/cockpit-html.js';
import { sessionAllows } from '../lib/cockpit-store.js';
import {
  cleanVia, findFlowCase, presentApprove, presentCase, presentDocument, presentHome, presentLeadership, presentLender, presentLenders, presentPlace, presentProcessing, saveProcessingDraft, submitApproval,
} from '../lib/flow.js';
import { portalMode } from '../lib/flow-links.js';
import { renderFlowMessage, renderNotFound } from '../lib/flow-html.js';
import { supabaseAccessToken, staffActorFromToken } from '../lib/staff-auth.js';

function queryOf(req) {
  let fromUrl = {};
  try {
    fromUrl = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch {
    fromUrl = {};
  }
  return { ...fromUrl, ...(req.query || {}) };
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

function splitKind(kind, format) {
  const raw = String(kind || '');
  const pdf = raw.endsWith('.pdf') || String(format || '') === 'pdf';
  const base = raw.replace(/\.pdf$/i, '');
  if (base !== 'el' && base !== 'lor') return null;
  return { kind: base, pdf };
}

async function actorOf(req, deps) {
  if (deps.actor) {
    return {
      seat: String(deps.actor.seat || deps.actor.code || '').trim().toLowerCase(),
      role: String(deps.actor.role || ''),
      name: deps.actor.name || '',
    };
  }
  const access = supabaseAccessToken(readCookie(req, 'pf_staff'));
  if (!access) return { seat: '', role: '', name: '' };
  const actor = await staffActorFromToken(access, deps);
  if (!actor.ok) return { seat: '', role: '', name: '' };
  return { seat: actor.seat.code, role: actor.role || actor.seat.role, name: actor.seat.name };
}

function sendPdf(res, filename, bytes) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${String(filename).replace(/"/g, '')}"`);
  res.end(bytes);
}

export async function handleFlow(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  if (String(env.VERCEL_ENV || '') === 'production') return sendHtml(res, 404, renderNotFound());
  const depsEnv = { ...deps, env };
  try {
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderLogin(''));
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
      return sendHtml(res, 405, renderFlowMessage('Not available', 'Open this page in a browser.'));
    }
    const query = queryOf(req);
    const fields = method === 'POST' ? await fieldsOf(req) : {};
    const view = String(query.view || 'home');
    const ref = String(query.case || '').trim();
    const flowCase = ref ? findFlowCase(ref) : null;
    const caseFree = view === 'home' || view === 'lenders' || view === 'lender' || view === 'leadership' || (view === 'processing' && !ref);
    if (!caseFree && !flowCase) {
      return sendHtml(res, 404, renderFlowMessage('Not on this demo', 'That case is not on the Posfin Flow demo.'));
    }
    const actor = await actorOf(req, depsEnv);
    const mode = portalMode(env);
    if (view === 'home') return sendHtml(res, 200, presentHome(query).html);
    if (view === 'leadership') return sendHtml(res, 200, presentLeadership(depsEnv).html);
    if (view === 'processing') {
      if (method === 'POST') {
        if (!flowCase) return sendHtml(res, 404, renderFlowMessage('Not on this demo', 'That case is not on the Posfin Flow demo.'));
        const page = saveProcessingDraft(flowCase, { ...fields, audience: fields.audience || query.audience }, depsEnv);
        return sendHtml(res, page.status, page.html);
      }
      const page = presentProcessing(flowCase, depsEnv);
      return sendHtml(res, page.status, page.html);
    }
    if (view === 'lenders') return sendHtml(res, 200, presentLenders(query).html);
    if (view === 'lender') {
      const page = presentLender(query.id);
      return sendHtml(res, page.status, page.html);
    }
    if (view === 'case') return sendHtml(res, 200, presentCase(flowCase, query, depsEnv).html);
    if (view === 'doc') {
      const parsed = splitKind(query.kind, query.format);
      if (!parsed) return sendHtml(res, 404, renderFlowMessage('Not on this demo', 'That document is not on the Posfin Flow demo.'));
      const result = presentDocument(flowCase, parsed.kind, { ...query, pdf: parsed.pdf }, depsEnv);
      if (result.pdf) return sendPdf(res, result.filename, result.pdf);
      return sendHtml(res, result.status, result.html);
    }
    const via = cleanVia(fields.via || query.via);
    if (view === 'place') {
      if (!via) return sendHtml(res, 400, renderFlowMessage('Choose a route', 'Say whether this is BROKA or Placed. Nothing was sent.'));
      if (mode === 'live') {
        const page = presentApprove(flowCase, via, actor, depsEnv);
        return sendHtml(res, page.status, page.html);
      }
      const page = presentPlace(flowCase, via, { ...depsEnv, audience: query.audience }, { record: method === 'POST' });
      return sendHtml(res, page.status, page.html);
    }
    if (view === 'approve') {
      if (!via) return sendHtml(res, 400, renderFlowMessage('Choose a route', 'Say whether this is BROKA or Placed. Nothing was submitted.'));
      if (method === 'POST') {
        const page = submitApproval(flowCase, { ...fields, via }, actor, depsEnv);
        return sendHtml(res, page.status, page.html);
      }
      const page = presentApprove(flowCase, via, actor, depsEnv);
      return sendHtml(res, page.status, page.html);
    }
    return sendHtml(res, 404, renderNotFound());
  } catch (error) {
    console.error('[flow]', error.code || 'flow_failed');
    return sendHtml(res, 503, renderFlowMessage('Please try again', 'Posfin Flow is temporarily unavailable.'));
  }
}

export default function handler(req, res) {
  return handleFlow(req, res, {});
}

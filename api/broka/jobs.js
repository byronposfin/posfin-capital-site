import { readCookie, readFields, redirect, sendHtml, sendJson, setPrivate } from '../../lib/case-http.js';
import { sessionAllows } from '../../lib/cockpit-store.js';
import { activeSeat, caseRefOk } from '../../lib/broka.js';
import { renderBrokaMessage } from '../../lib/broka-html.js';
import { openJob } from '../../lib/broka-state.js';
import { caseView } from '../broka-desk.js';

const PRODUCTION = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

export function brokaWriteTarget(env = process.env) {
  const url = String(env.BROKA_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!url) return { mode: 'preview' };
  if (url === PRODUCTION) return { mode: 'blocked' };
  const key = String(env.BROKA_SUPABASE_KEY || '').trim();
  if (!key) return { mode: 'unconfigured' };
  return { mode: 'remote', url, key };
}

function wantsJson(req) {
  const accept = String(req.headers?.accept || '');
  const type = String(req.headers?.['content-type'] || '');
  return accept.includes('application/json') || type.includes('application/json');
}

function regulatedOf(value) {
  if (value === 'yes' || value === true || value === 'true') return true;
  if (value === 'no' || value === false || value === 'false') return false;
  return null;
}

function snapshot(check, regulated) {
  const epc = (check.fields || []).find((field) => field.key === 'epc_rating');
  return {
    missing: check.missing || [],
    blocks: (check.blocks || []).map((item) => item.id),
    epcSource: epc && !epc.missing ? epc.source : '',
    regulated,
  };
}

async function remoteOpen(target, payload, fetcher) {
  const res = await fetcher(`${target.url}/rest/v1/rpc/broka_open_job`, {
    method: 'POST',
    headers: {
      apikey: target.key,
      Authorization: `Bearer ${target.key}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'pipeline',
      'Accept-Profile': 'pipeline',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: 'store' };
  const body = await res.json();
  return body && typeof body === 'object' ? body : { ok: false, error: 'store' };
}

function reply(req, res, status, body, caseRef) {
  if (!wantsJson(req) && body.ok && caseRef) {
    return redirect(res, `/staff/cockpit/broka/${encodeURIComponent(caseRef)}?notice=${encodeURIComponent(body.job.status)}`);
  }
  if (!wantsJson(req)) return sendHtml(res, status, renderBrokaMessage('Not recorded', 'That eligibility job was not recorded. BROKA was not contacted.'));
  return sendJson(res, status, body);
}

export async function handleBrokaJob(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
  try {
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, { ...deps, env })) {
      return wantsJson(req) ? sendJson(res, 401, { ok: false, error: 'seat' }) : sendHtml(res, 401, renderBrokaMessage('Sign in', 'An active seat is required. Nothing was recorded.'));
    }
    const fields = await readFields(req);
    const seat = activeSeat(fields.seat);
    if (!seat) return reply(req, res, 401, { ok: false, error: 'seat' });
    const caseRef = caseRefOk(fields.case_ref) ? fields.case_ref : '';
    if (!caseRef) return reply(req, res, 404, { ok: false, error: 'case' });
    const view = caseView(caseRef, String(fields.stage || ''));
    if (!view.submitted) return reply(req, res, 409, { ok: false, error: 'factfind' }, caseRef);
    const target = brokaWriteTarget(env);
    if (target.mode === 'blocked') return reply(req, res, 409, { ok: false, error: 'production_write_blocked' }, caseRef);
    if (target.mode === 'unconfigured') return reply(req, res, 503, { ok: false, error: 'unconfigured' }, caseRef);
    const regulated = regulatedOf(fields.regulated);
    const safePreflight = snapshot(view.preflight, regulated);
    let result;
    if (target.mode === 'remote') {
      result = await remoteOpen(target, {
        p_seat: seat.code,
        p_case_ref: caseRef,
        p_submitted: true,
        p_regulated: regulated,
        p_preflight: safePreflight,
      }, deps.fetch || fetch);
    } else {
      result = openJob({
        seat: seat.code,
        caseRef,
        submitted: true,
        regulated,
        preflight: safePreflight,
        now: deps.now,
      });
    }
    if (!result || result.ok !== true) {
      const error = result && result.error ? result.error : 'store';
      const status = error === 'seat' ? 401 : error === 'factfind' ? 409 : 400;
      return reply(req, res, status, { ok: false, error }, caseRef);
    }
    const placed = result.placed_run || result.placedRun;
    if (!placed || placed.called !== false) return reply(req, res, 409, { ok: false, error: 'not_called' }, caseRef);
    return reply(req, res, 201, { ok: true, job: result.job, placed_run: placed }, caseRef);
  } catch (error) {
    console.error('[broka-jobs]', error.code || 'broka_job_failed');
    return sendJson(res, 503, { ok: false, error: 'unavailable' });
  }
}

export default function handler(req, res) {
  return handleBrokaJob(req, res, {});
}

import { setPrivate, sendHtml, sendJson, readRaw } from '../lib/case-http.js';
import { phaseOf } from '../lib/wirral-response.js';
import { loadCase, commit } from '../lib/wirral-response-store.js';
import { renderPage, responseParts } from '../lib/wirral-response-html.js';
import { transcribe } from '../lib/run-sheet-store.js';

const PAGE = 'wirral';

function modeOf(req) {
  const value = String(req.query?.mode || '').toLowerCase();
  return value === 'review' ? 'review' : 'borrower';
}

function noticeFor(action, state) {
  const phase = phaseOf(state);
  if (action === 'submit_inputs') return 'Sent to Byron. These are your exact words, unchanged.';
  if (action === 'save_proposed') {
    return phase === 'in_review'
      ? 'Sent back to Roy for him to check. The wording is only what you saved.'
      : 'Wording saved. Roy can review it once every point has wording.';
  }
  if (action === 'sign_off') {
    return phase === 'signed_off'
      ? 'Confirmed. This is ready for CrowdProperty when Posfin sends it.'
      : 'Those points are marked confirmed. The overall confirmation waits until every point is ticked.';
  }
  return '';
}

function pageHeaders(req) {
  const header = req.headers?.['x-posfin-page'] || req.headers?.['X-Posfin-Page'];
  return String(header || '') === PAGE;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const raw = await readRaw(req, 3500000);
  if (!raw || !raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}

function actionFrom(body) {
  const name = String(body.action || '');
  if (name === 'save_draft') return { type: 'save_draft', inputs: body.inputs };
  if (name === 'submit_inputs') return { type: 'submit_inputs', revision: Number(body.revision), inputs: body.inputs };
  if (name === 'save_proposed') return { type: 'save_proposed', revision: Number(body.revision), actor: body.actor, proposed: body.proposed };
  if (name === 'sign_off') return { type: 'sign_off', revision: Number(body.revision), signoff: body.signoff, overall: body.overall === true };
  return null;
}

async function transcribeAudio(body, deps) {
  const audio = String(body.audio || '');
  const mime = String(body.mime || 'audio/webm').slice(0, 80);
  if (!audio) return { ok: false, status: 400, message: 'Type your exact words in the box. No recording arrived.' };
  if (audio.length > 3400000) {
    return { ok: false, status: 413, message: 'That recording is too long to send. Type your exact words, or record a shorter answer.' };
  }
  let buf;
  try {
    buf = Buffer.from(audio, 'base64');
  } catch {
    return { ok: false, status: 400, message: 'That recording could not be read. Type your exact words in the box.' };
  }
  if (buf.length < 800) {
    return { ok: true, text: '', message: 'That recording was too short. Try again, or type your exact words.' };
  }
  if (buf.length > 2500000) {
    return { ok: true, text: '', message: 'That recording is too long to send. Type your exact words, or record a shorter answer.' };
  }
  const result = await transcribe(deps.env || process.env, buf, mime, deps);
  if (result.status === 'done' && String(result.text || '').trim()) {
    return { ok: true, text: String(result.text).trim() };
  }
  if (result.status === 'no_key') {
    return {
      ok: true,
      text: '',
      message: 'This browser cannot turn speech into text on the page, and transcription is not connected. Type your exact words in the box. We only keep what you confirm there.',
    };
  }
  return { ok: true, text: '', message: 'We could not transcribe that recording. Type your exact words in the box. We only keep what you confirm there.' };
}

export default async function handler(req, res) {
  return handle(req, res, {});
}

export async function handle(req, res, deps = {}) {
  setPrivate(res);
  const mode = modeOf(req);
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    return res.end();
  }
  if (req.method === 'GET') {
    const loaded = await loadCase(deps);
    const html = renderPage(loaded.state, { mode, storage: loaded.storage, persisted: loaded.persisted });
    return sendHtml(res, 200, html);
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return sendJson(res, 405, { ok: false, message: 'Open the Wirral Waters page and use the buttons there.' });
  }
  if (!pageHeaders(req)) {
    return sendJson(res, 403, { ok: false, message: 'Open the Wirral Waters page and use the buttons there.' });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const tooLarge = error && error.code === 'too_large';
    return sendJson(res, tooLarge ? 413 : 400, { ok: false, message: tooLarge ? 'That recording is too long.' : 'That could not be read.' });
  }
  if (body.action === 'transcribe') {
    const spoken = await transcribeAudio(body, deps);
    return sendJson(res, spoken.status || 200, spoken);
  }
  const action = actionFrom(body);
  if (!action) return sendJson(res, 400, { ok: false, message: 'That action is not available.' });
  if (action.type === 'save_proposed' && mode !== 'review') {
    return sendJson(res, 403, { ok: false, message: 'Lender-facing wording is saved from the staff review page.' });
  }
  const saved = await commit(action, deps);
  if (!saved.ok) {
    return sendJson(res, saved.error === 'conflict' ? 409 : 400, {
      ok: false,
      error: saved.error,
      message: saved.message,
      revision: saved.state && saved.state.revision,
    });
  }
  if (action.type === 'save_draft') {
    return sendJson(res, 200, {
      ok: true,
      revision: saved.state.revision,
      storage: saved.storage,
      persisted: saved.persisted,
      phase: phaseOf(saved.state),
    });
  }
  const parts = responseParts(saved.state, {
    mode,
    storage: saved.storage,
    persisted: saved.persisted,
    notice: noticeFor(action.type, saved.state),
  });
  return sendJson(res, 200, {
    ok: true,
    revision: parts.revision,
    storage: saved.storage,
    persisted: saved.persisted,
    phase: parts.phase,
    html: parts.html,
    boot: parts.boot,
  });
}

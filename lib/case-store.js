import { randomBytes } from 'node:crypto';
import { baseMime, tokenOk, validateSubmission } from './case-portal.js';

// Publishable key for the existing smartlink project. It is not a secret:
// tables are revoked from anon, and every call still needs the case token or a staff session.
// Override with SMARTLINK_SUPABASE_KEY when rotating.
const PUBLISHABLE = 'sb_publishable_44_c4HPuriSbAe5nRcHEmg_3K1jtiCN';
const DEFAULT_URL = 'https://dxlebqovfphultrdbriz.supabase.co';

const MESSAGES = {
  empty: 'Add a few words, pick an option, or attach a file.',
  bad_file: 'That file type is not accepted. Please send a photo, a PDF, or a voice note.',
  too_large: 'That file is over 4MB. Please photograph the pages, or send a smaller file.',
  bad_choice: 'Please choose one of the options, or type the answer.',
  bad_gap: 'That question is not on this case.',
  not_found: 'This link is not valid. Please contact Posfin Capital and we will send a fresh one.',
  closed: 'Nothing is being asked on this page.',
  stale_date: 'That document is more than 90 days old. Please send one dated within the last 90 days.',
  future_date: 'That date is in the future. Please use the date printed on the document.',
  missing_date: 'Add the date printed on each proof of address.',
  kyc_incomplete: 'The identity check is not complete yet. A passport needs your driving licence and one other proof of address. Without a passport, send your UK driving licence and two proofs of address.',
  passed: 'Your portal is already open.',
  store: 'We could not store that just now. Please try again.',
};

export function storeConfig(env = process.env) {
  return {
    url: String(env.SMARTLINK_SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, ''),
    key: String(env.SMARTLINK_SUPABASE_KEY || PUBLISHABLE),
  };
}

export function safeName(name) {
  const base = String(name || 'file').split(/[/\\]/).pop();
  const clean = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80);
  return clean && clean !== '.' && clean !== '..' ? clean : 'file';
}

function clientMessage(code) {
  return MESSAGES[code] || MESSAGES.store;
}

async function rpc(name, args, cfg, fetcher) {
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
    const error = new Error('store');
    error.code = 'store';
    error.status = res.status;
    throw error;
  }
  if (!text || text === 'null') return null;
  return JSON.parse(text);
}

function objectUrl(cfg, path) {
  const encoded = String(path || '').split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${cfg.url}/storage/v1/object/case-portal/${encoded}`;
}

export async function openCase(token, deps = {}) {
  if (!tokenOk(token)) return null;
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_open', { p_token: token }, cfg, deps.fetch || fetch);
}

export async function submitAnswer(token, input, deps = {}) {
  if (!tokenOk(token)) return { ok: false, error: 'not_found', message: clientMessage('not_found') };
  const parsed = validateSubmission(input || {});
  if (parsed.error) return { ok: false, error: parsed.error, message: clientMessage(parsed.error) };
  const cfg = storeConfig(deps.env);
  const fetcher = deps.fetch || fetch;
  const ref = parsed.clientRef || randomBytes(16).toString('hex');
  let started;
  try {
    started = await rpc('case_portal_submit', {
      p_token: token,
      p_gap_id: parsed.gapId,
      p_kind: parsed.kind,
      p_text: parsed.text,
      p_choice: parsed.choice,
      p_filename: parsed.file ? safeName(parsed.file.filename) : null,
      p_mime: parsed.file ? baseMime(parsed.file.mime) : null,
      p_bytes: parsed.file ? parsed.file.bytes.length : null,
      p_client_ref: ref,
    }, cfg, fetcher);
  } catch (error) {
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
  if (!started || started.ok === false) {
    const code = started && started.error === 'not_found' ? 'not_found' : (started && started.error) || 'store';
    return { ok: false, error: code, message: clientMessage(code) };
  }
  if (!started.pending) return { ok: true, submissionId: started.submission_id, record: started.record };
  let uploaded;
  try {
    uploaded = await fetcher(objectUrl(cfg, started.storage_path), {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': baseMime(parsed.file.mime) || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: parsed.file.bytes,
    });
  } catch {
    uploaded = { ok: false, status: 0 };
  }
  if (!uploaded.ok && uploaded.status !== 409) {
    await rpc('case_portal_abort', { p_token: token, p_submission_id: started.submission_id }, cfg, fetcher).catch(() => {});
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
  try {
    const done = await rpc('case_portal_finalize', {
      p_token: token,
      p_submission_id: started.submission_id,
      p_bytes: parsed.file.bytes.length,
    }, cfg, fetcher);
    if (!done || done.ok === false) return { ok: false, error: 'store', message: clientMessage('store') };
    return { ok: true, submissionId: done.submission_id, record: done.record };
  } catch {
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
}

async function download(cfg, meta, fetcher) {
  if (!meta || !meta.path) return null;
  const res = await fetcher(objectUrl(cfg, meta.path), {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return { filename: meta.filename || 'file', mime: meta.mime || 'application/octet-stream', bytes };
}

export async function readClientFile(token, submissionId, deps = {}) {
  if (!tokenOk(token)) return null;
  const cfg = storeConfig(deps.env);
  const fetcher = deps.fetch || fetch;
  const meta = await rpc('case_portal_read_grant', { p_token: token, p_submission_id: submissionId }, cfg, fetcher);
  return download(cfg, meta, fetcher);
}

export async function staffLogin(secret, deps = {}) {
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_staff_login', { p_secret: String(secret || '') }, cfg, deps.fetch || fetch);
}

export async function staffLogout(session, deps = {}) {
  const cfg = storeConfig(deps.env);
  await rpc('case_portal_staff_logout', { p_session: session }, cfg, deps.fetch || fetch).catch(() => {});
}

export async function staffList(session, deps = {}) {
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_staff_list', { p_session: session }, cfg, deps.fetch || fetch);
}

export async function staffCase(session, caseId, deps = {}) {
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_staff_case', { p_session: session, p_case_id: caseId }, cfg, deps.fetch || fetch);
}

export async function staffStage(session, caseId, stage, deps = {}) {
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_staff_stage', { p_session: session, p_case_id: caseId, p_stage: stage }, cfg, deps.fetch || fetch);
}

export async function readStaffFile(session, caseId, submissionId, deps = {}) {
  const cfg = storeConfig(deps.env);
  const fetcher = deps.fetch || fetch;
  const meta = await rpc('case_portal_staff_read', { p_session: session, p_case_id: caseId, p_submission_id: submissionId }, cfg, fetcher);
  return download(cfg, meta, fetcher);
}

export async function submitKycFile(token, input, deps = {}) {
  if (!tokenOk(token)) return { ok: false, error: 'not_found', message: clientMessage('not_found') };
  const cfg = storeConfig(deps.env);
  const fetcher = deps.fetch || fetch;
  const file = input.file;
  if (!file || !file.bytes || !file.bytes.length) return { ok: false, error: 'bad_file', message: clientMessage('bad_file') };
  let started;
  try {
    started = await rpc('case_portal_kyc_file', {
      p_token: token,
      p_part: input.part,
      p_doc_type: input.docType || '',
      p_doc_date: input.docDate || '',
      p_filename: safeName(file.filename),
      p_mime: baseMime(file.mime),
      p_bytes: file.bytes.length,
      p_client_ref: input.clientRef || null,
    }, cfg, fetcher);
  } catch {
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
  if (!started || started.ok === false) {
    const code = started && started.error || 'store';
    return { ok: false, error: code, message: clientMessage(code) };
  }
  let uploaded;
  try {
    uploaded = await fetcher(objectUrl(cfg, started.storage_path), {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': baseMime(file.mime) || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: file.bytes,
    });
  } catch {
    uploaded = { ok: false, status: 0 };
  }
  if (!uploaded.ok && uploaded.status !== 409) {
    await rpc('case_portal_abort', { p_token: token, p_submission_id: started.submission_id }, cfg, fetcher).catch(() => {});
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
  try {
    const done = await rpc('case_portal_finalize', { p_token: token, p_submission_id: started.submission_id, p_bytes: file.bytes.length }, cfg, fetcher);
    if (!done || done.ok === false) return { ok: false, error: 'store', message: clientMessage('store') };
    return { ok: true, submissionId: done.submission_id };
  } catch {
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
}

export async function finishKyc(token, input, deps = {}) {
  if (!tokenOk(token)) return { ok: false, error: 'not_found', message: clientMessage('not_found') };
  const cfg = storeConfig(deps.env);
  try {
    const done = await rpc('case_portal_kyc_finish', {
      p_token: token,
      p_full_name: input.fullName || '',
      p_address: input.address || '',
      p_id_type: input.idType || '',
    }, cfg, deps.fetch || fetch);
    if (!done || done.ok === false) {
      const code = done && done.error || 'store';
      return { ok: false, error: code, message: clientMessage(code) };
    }
    return { ok: true, record: done.record };
  } catch {
    return { ok: false, error: 'store', message: clientMessage('store') };
  }
}

export async function staffKyc(session, caseId, status, deps = {}) {
  const cfg = storeConfig(deps.env);
  return rpc('case_portal_staff_kyc', { p_session: session, p_case_id: caseId, p_status: status }, cfg, deps.fetch || fetch);
}

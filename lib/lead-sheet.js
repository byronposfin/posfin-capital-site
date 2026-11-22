// Appends one new fact find to the Leads tab. Does not read or write old rows except
// to see whether this lead_id is already in column B. Credentials stay in the environment.
import { MAIN_DB, PREVIEW_DB } from './ff-alert-outbox.js';

export const SHEET_TAB = 'Leads';
export const SHEET_HEADERS = [
  'Received (UK time)',
  'Lead ID',
  'Name',
  'Email',
  'Phone',
  'Property postcode',
  'Property address',
  'Loan amount',
  'Purpose',
  'UTM source',
  'UTM medium',
  'UTM campaign',
  'UTM content',
  'Consent',
  'Consent version',
  'Owner',
  'Status',
  'Contacted at',
  'Next action',
  'Notes',
];

// Added after Notes so a sheet that has not been extended yet still accepts rows.
export const DOB_HEADERS = ['Date of birth', 'Joint date of birth'];

export function sheetHeaderMode(cells) {
  const trimmed = (cells || []).map((cell) => String(cell ?? '').trim());
  while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
  if (trimmed.join('|') === SHEET_HEADERS.join('|')) return 'core';
  if (trimmed.join('|') === [...SHEET_HEADERS, ...DOB_HEADERS].join('|')) return 'extended';
  return '';
}

const LONDON = 'Europe/London';

function text(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

export function ukStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const parts = {};
  for (const part of fmt.formatToParts(date)) parts[part.type] = part.value;
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n)) : '';
}

export function sheetRow(payload, mode = 'core') {
  const lead = payload || {};
  const notes = [];
  if (lead.is_test === true) notes.push('SYNTHETIC TEST — DO NOT CONTACT.');
  if (lead.no_chase === true) notes.push('DO NOT CHASE.');
  if (lead.ai_call_consent !== true) notes.push('NO AI CALL.');
  const ownNotes = text(lead.notes, 500);
  if (ownNotes) notes.push(ownNotes);
  const row = [
    ukStamp(lead.submitted_at),
    text(lead.lead_id, 40),
    text(lead.full_name, 120),
    text(lead.email, 160),
    text(lead.phone, 40),
    text(lead.postcode, 12),
    text(lead.address, 200),
    money(lead.loan_amount),
    text(lead.purpose, 160),
    text(lead.utm_source, 100),
    text(lead.utm_medium, 100),
    text(lead.utm_campaign, 150),
    text(lead.utm_content, 150),
    lead.contact_consent === true ? 'yes' : 'no',
    text(lead.consent_text_version, 80),
    text(lead.owner_name, 80),
    text(lead.status, 40),
    ukStamp(lead.contacted_at),
    text(lead.next_action, 240),
    notes.join(' ').slice(0, 500),
  ];
  if (mode === 'extended') row.push(text(lead.applicant_dob, 10), text(lead.joint_applicant_dob, 10));
  return row;
}

export const SHEET_SERVICE_ACCOUNT = 'posfin-sheets@posfin-sheets.iam.gserviceaccount.com';

function parseServiceAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    const email = String(parsed.client_email || '').trim();
    const key = String(parsed.private_key || '').replace(/\\n/g, '\n').trim();
    if (!email || !key.includes('PRIVATE KEY')) return null;
    return { email, key };
  } catch {
    return null;
  }
}

export function sheetCredentials(env = process.env) {
  const email = String(env.GOOGLE_SA_EMAIL || '').trim();
  const key = String(env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  if (email && key.includes('PRIVATE KEY')) return { email, key, source: 'env' };
  const fromBlob = parseServiceAccount(env.GOOGLE_SA_B64) || parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (fromBlob && fromBlob.email === SHEET_SERVICE_ACCOUNT) return { ...fromBlob, source: 'GOOGLE_SA_B64' };
  return null;
}

export function sheetConfig(env = process.env) {
  const id = String(env.LEADS_SHEET_ID || '').trim();
  const creds = sheetCredentials(env);
  const isolated = env.VERCEL_ENV === 'preview' && env.FF_TEST_RUN === 'true' && env.FF_SUPABASE_URL === PREVIEW_DB;
  const production = env.VERCEL_ENV === 'production' && env.FF_TEST_RUN !== 'true' && env.FF_SUPABASE_URL === MAIN_DB;
  const ok = env.LEADS_SHEET_ENABLED === 'true'
    && (isolated || production)
    && !!env.FF_ALERT_SERVICE_KEY
    && /^[a-zA-Z0-9_-]{20,}$/.test(id)
    && !!creds;
  return {
    ok, id, email: creds ? creds.email : '', key: creds ? creds.key : '', production, isolated,
    url: env.FF_SUPABASE_URL,
    serviceKey: env.FF_ALERT_SERVICE_KEY,
  };
}

function safeCode(error) {
  const raw = String(error && (error.code || error.message) || error || 'sheet_error');
  if (/PRIVATE KEY|BEGIN /.test(raw)) return 'sheet_auth';
  return raw.replace(/\s+/g, ' ').slice(0, 80);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

export async function googleSheetClient(cfg) {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: cfg.email,
    key: cfg.key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return {
    async get(range) {
      const response = await sheets.spreadsheets.values.get({ spreadsheetId: cfg.id, range });
      return response.data.values || [];
    },
    async append(values) {
      const end = values.length > SHEET_HEADERS.length ? 'V' : 'T';
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: cfg.id,
        range: `${SHEET_TAB}!A2:${end}`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });
      return (response.data.updates && response.data.updates.updatedRange) || '';
    },
  };
}

export async function appendLeadRow(client, payload) {
  const header = await client.get(`${SHEET_TAB}!A1:V1`);
  const mode = sheetHeaderMode(header[0]);
  if (!mode) return { outcome: 'rejected', errorCode: 'sheet_header', retrySeconds: 300 };
  const values = sheetRow(payload, mode);
  const expected = mode === 'extended' ? SHEET_HEADERS.length + DOB_HEADERS.length : SHEET_HEADERS.length;
  if (values.length !== expected || !values[1]) return { outcome: 'rejected', errorCode: 'bad_row' };
  const column = await client.get(`${SHEET_TAB}!B:B`);
  const found = column.findIndex((cell, index) => index > 0 && String(cell[0] || '').trim() === values[1]);
  if (found >= 0) return { outcome: 'sent', providerId: `existing:${SHEET_TAB}!B${found + 1}` };
  const updated = await client.append(values);
  if (!updated) return { outcome: 'unknown', errorCode: 'sheet_no_range' };
  return { outcome: 'sent', providerId: String(updated).slice(0, 200) };
}

async function request(fetcher, url, options) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try { return await fetcher(url, { ...options, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

export async function drainSheet(env = process.env, fetcher = fetch, client) {
  const cfg = sheetConfig(env);
  const empty = { ok: true, skipped: true, reason: 'not_configured', claimed: 0, sent: 0, failed: 0, alarms: 0, overdue: false };
  if (!cfg.ok) return empty;
  const rpc = async (name, args) => {
    const response = await request(fetcher, `${cfg.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    if (!response.ok) throw Error('outbox_storage_unavailable');
    return response.json();
  };
  const scalar = (value, name) => {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value[name] === 'number') return value[name];
    if (Array.isArray(value) && value[0] && typeof value[0][name] === 'number') return value[0][name];
    return Number(value) || 0;
  };
  const sheets = client || await googleSheetClient(cfg);
  const result = { ok: true, skipped: false, claimed: 0, sent: 0, failed: 0, unrecorded: 0, alarms: 0, overdue: false };
  result.alarms = scalar(await rpc('web_lead_sheet_raise_alarms'), 'web_lead_sheet_raise_alarms');
  const rows = await rpc('web_lead_sheet_claim', { p_limit: 4 });
  const list = Array.isArray(rows) ? rows : [];
  result.claimed = list.length;
  for (const row of list) {
    let outcome = 'unknown';
    let providerId = null;
    let errorCode = 'sheet_error';
    let retrySeconds = 60;
    try {
      const appended = await withTimeout(appendLeadRow(sheets, row.payload || {}), 8000);
      outcome = appended.outcome;
      providerId = appended.providerId || null;
      errorCode = appended.errorCode || outcome;
      retrySeconds = appended.retrySeconds || 60;
    } catch (error) {
      outcome = 'unknown';
      errorCode = safeCode(error);
    }
    if (outcome === 'sent') result.sent++;
    else {
      result.failed++;
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age > 2 * 60 * 1000) result.overdue = true;
    }
    try {
      const recorded = await rpc('web_lead_sheet_finish', {
        p_id: row.id, p_lease_id: row.lease_id, p_result: outcome,
        p_provider_id: providerId, p_retry_seconds: Math.min(retrySeconds, 3600), p_error: errorCode,
      });
      if (recorded !== true) throw Error('lost_lease');
    } catch {
      result.ok = false;
      result.unrecorded++;
    }
  }
  if (result.failed) result.ok = false;
  return result;
}

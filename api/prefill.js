import crypto from 'crypto';
import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const TAB = 'Prefill_Tokens';
const HEADERS = [
  'Token','Created_At','Expires_At','Status','First_Name','Mobile','Email','Source_Channel','Note','Case_Ref','Route_Hint','Resolved_At','Last_Submitted_At'
];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function safeString(v, max = 1200) {
  return String(v || '').trim().slice(0, max);
}

function columnName(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function sheetsClient() {
  const saB64 = process.env.GOOGLE_SA_B64;
  if (!saB64) throw new Error('GOOGLE_SA_B64 not set');
  const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensurePrefillSheet(sheets) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
  });
  const existing = (meta.data.sheets || []).find(s => s.properties?.title === TAB);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 1000, columnCount: HEADERS.length } } } }] },
    });
  }
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:${columnName(HEADERS.length)}1` });
  const firstRow = current.data.values?.[0] || [];
  if (HEADERS.some((h, i) => firstRow[i] !== h)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A1:${columnName(HEADERS.length)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADERS] },
    });
  }
}

async function getRows(sheets) {
  await ensurePrefillSheet(sheets);
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A:${columnName(HEADERS.length)}` });
  return r.data.values || [];
}

async function appendTokenRow(sheets, row) {
  await ensurePrefillSheet(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${TAB}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function stamp(sheets, rowNumber, header, value) {
  const idx = HEADERS.indexOf(header);
  if (idx < 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${TAB}'!${columnName(idx + 1)}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

function publicRecord(row) {
  const obj = Object.fromEntries(HEADERS.map((h, i) => [h, row[i] || '']));
  return {
    first_name: obj.First_Name,
    mobile: obj.Mobile,
    email: obj.Email,
    source_channel: obj.Source_Channel,
    note: obj.Note,
    case_ref: obj.Case_Ref,
    route_hint: obj.Route_Hint,
    expiry: obj.Expires_At,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Prefill-Admin-Token');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const sheets = await sheetsClient();

    if (req.method === 'POST') {
      const adminToken = process.env.PREFILL_ADMIN_TOKEN;
      if (adminToken) {
        const supplied = String(req.headers['x-prefill-admin-token'] || '').trim() || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        if (supplied !== adminToken) { res.status(401).json({ error: 'Unauthorized' }); return; }
      }
      const b = req.body || {};
      const token = crypto.randomBytes(18).toString('base64url');
      const now = new Date();
      const expiry = safeString(b.expiry) || addDays(now, Number(b.ttl_days || 30)).toISOString();
      const row = [
        token,
        now.toISOString(),
        expiry,
        'Active',
        safeString(b.first_name || b.name, 160),
        safeString(b.mobile || b.phone, 80),
        safeString(b.email, 240),
        safeString(b.source_channel || 'click-roll', 160),
        safeString(b.note, 1200),
        safeString(b.case_ref, 120),
        safeString(b.route_hint || 'main_loan', 80),
        '',
        '',
      ];
      await appendTokenRow(sheets, row);
      res.status(200).json({ ok: true, token, url: `/apply?k=${token}`, expiry }); return;
    }

    if (req.method === 'GET') {
      const token = safeString(req.query?.k || req.query?.token, 120);
      if (!token) { res.status(400).json({ error: 'Missing token' }); return; }
      const rows = await getRows(sheets);
      const idx = rows.findIndex((r, i) => i > 0 && r[0] === token);
      if (idx < 0) { res.status(404).json({ error: 'Token not found' }); return; }
      const row = rows[idx];
      const status = String(row[3] || '').toLowerCase();
      const expires = new Date(row[2] || 0);
      if (status && status !== 'active') { res.status(410).json({ error: 'Token inactive' }); return; }
      if (Number.isFinite(expires.getTime()) && expires < new Date()) { res.status(410).json({ error: 'Token expired' }); return; }
      await stamp(sheets, idx + 1, 'Resolved_At', new Date().toISOString()).catch(() => {});
      res.status(200).json({ ok: true, prefill: publicRecord(row) }); return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Prefill API Error]', err);
    res.status(500).json({ error: 'Server error' });
  }
}

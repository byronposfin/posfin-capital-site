/**
 * Posfin Capital — Acquisition Finance Lead Capture API
 * POST /api/acquisition-lead
 *
 * Writes public /acquisition-finance enquiries to CRM tab: "Acquisition Leads".
 */

import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const TAB = 'Acquisition Leads';
const TELE_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BYRON_CHAT_ID = '1750758657';

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function clean(v) {
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v));
}

function genRef() {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `POSFIN-ACQ-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function getSheets() {
  const saB64 = process.env.GOOGLE_SA_B64;
  if (!saB64) throw new Error('GOOGLE_SA_B64 not configured');
  const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 1000, columnCount: 20 } } } }] },
    });
  }
  const headers = [
    'Timestamp', 'Full name', 'Company / SPV', 'Email', 'Phone', 'Acquisition type',
    'Approx purchase price', 'Target asset/business', 'Other assets to leverage', 'Timeline',
    'Notes', 'Ack: docs once mandated', 'Ack: indicative only', 'Source', 'Status',
    'Assigned Broker', 'Last Action', 'Next Step', 'Raw Payload', 'Lead Ref',
  ];
  const current = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${TAB}'!A1:T1` });
  if (!current.data.values?.[0]?.some(Boolean)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A1:T1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  }
}

async function alertByron(d, ref) {
  if (!TELE_TOKEN) return;
  const lines = [
    '🏢 New Acquisition Finance enquiry',
    '',
    `Ref: ${ref}`,
    `Name: ${clean(d.name)}`,
    `Company/SPV: ${clean(d.company) || 'TBC'}`,
    `Email: ${clean(d.email)}`,
    `Phone: ${clean(d.phone) || 'TBC'}`,
    `Type: ${clean(d.type) || 'TBC'}`,
    `Ticket: ${clean(d.ticket) || 'TBC'}`,
    `Target: ${clean(d.target) || 'TBC'}`,
    `Timeline: ${clean(d.timeline) || 'TBC'}`,
    '',
    'Saved to CRM tab: Acquisition Leads',
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: BYRON_CHAT_ID, text: lines }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const d = req.body || {};
    if (!clean(d.name) || !clean(d.email)) {
      return res.status(400).json({ ok: false, error: 'Name and email are required' });
    }
    if (!d.ack_later || !d.ack_indicative) {
      return res.status(400).json({ ok: false, error: 'Both acknowledgements are required' });
    }

    const now = ts();
    const ref = genRef();
    const sheets = await getSheets();
    await ensureTab(sheets);

    const row = [
      now,
      clean(d.name),
      clean(d.company),
      clean(d.email),
      clean(d.phone),
      clean(d.type),
      clean(d.ticket),
      clean(d.target),
      clean(d.other_assets),
      clean(d.timeline),
      clean(d.brief),
      d.ack_later ? 'on' : '',
      d.ack_indicative ? 'on' : '',
      clean(d.source) || 'Acquisition Finance landing page',
      'NEW',
      'Byron/Chris',
      now,
      'Structuring call / initial read',
      JSON.stringify(d),
      ref,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${TAB}'!A:T`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    await alertByron(d, ref);
    return res.status(200).json({ ok: true, ref });
  } catch (err) {
    console.error('acquisition-lead error', err);
    return res.status(500).json({ ok: false, error: 'Lead capture failed' });
  }
}

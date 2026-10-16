import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';

function columnName(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

async function appendRowAtFirstEmpty(sheets, tabName, row) {
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A:A`,
  });
  const values = colA.data.values || [];
  let last = 0;
  values.forEach((r, idx) => {
    if (String(r?.[0] || '').trim()) last = idx + 1;
  });
  const nextRow = Math.max(last + 1, 2);
  const endCol = columnName(row.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A${nextRow}:${endCol}${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return nextRow;
}

function normalisePhone(v = '') {
  return String(v).replace(/[^0-9]/g, '').replace(/^0/, '44');
}

function detailsBlock(d, ts) {
  return [
    `Solicitor details submitted via Posfin link — ${ts}`,
    d.deal_ref ? `Deal ref: ${d.deal_ref}` : '',
    d.borrower_name ? `Borrower: ${d.borrower_name}` : '',
    d.borrower_phone ? `Borrower mobile: ${d.borrower_phone}` : '',
    '',
    `Name of firm: ${d.firm_name || 'TBC'}`,
    `Address of firm: ${d.firm_address || 'TBC'}`,
    `Phone number: ${d.firm_phone || 'TBC'}`,
    `Acting Solicitor Name: ${d.acting_solicitor_name || 'TBC'}`,
    `Acting Solicitor direct email: ${d.acting_solicitor_email || 'TBC'}`,
    `Acting Solicitors direct phone number: ${d.acting_solicitor_phone || 'TBC'}`,
  ].filter((line) => line !== '').join('\n');
}

function websiteFormRow(d, ts) {
  const notes = detailsBlock(d, ts);
  const [firstName = '', ...rest] = String(d.borrower_name || '').trim().split(/\s+/);
  const lastName = rest.join(' ');
  const row = Array(66).fill('');
  row[0] = ts;                               // Submitted At
  row[1] = `Solicitor Details${d.deal_ref ? ` · ${d.deal_ref}` : ''}`; // Deal Summary
  row[20] = d.first_name || firstName || ''; // First Name
  row[21] = d.last_name || lastName || '';   // Last Name
  row[22] = notes;                           // Notes
  row[24] = d.borrower_email || '';          // Email
  row[25] = d.borrower_phone || '';          // Phone
  row[52] = 'FALSE';                         // Tom Processed
  row[54] = 'SOLICITOR DETAILS RECEIVED';    // Status
  row[55] = 'Captured via /solicitor-details form'; // Status Notes
  row[57] = 'solicitor-details-form';        // Source
  return row;
}

async function findPipelineRow(sheets, d) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'PIPELINE'!A2:T`,
  });
  const rows = resp.data.values || [];
  const ref = String(d.deal_ref || '').trim().toLowerCase();
  const email = String(d.borrower_email || '').trim().toLowerCase();
  const phone = normalisePhone(d.borrower_phone || '');
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowRef = String(row[19] || '').trim().toLowerCase();
    const rowPhone = normalisePhone(row[3] || '');
    const rowEmail = String(row[4] || '').trim().toLowerCase();
    if (ref && rowRef && ref === rowRef) return i + 2;
    if (email && rowEmail && email === rowEmail) return i + 2;
    if (phone && rowPhone && phone === rowPhone) return i + 2;
  }
  return null;
}

async function updatePipeline(sheets, d, ts) {
  const rowNumber = await findPipelineRow(sheets, d);
  const notes = detailsBlock(d, ts);
  const solicitorSummary = [
    '⚖️ SOLICITOR DETAILS RECEIVED',
    `Firm: ${d.firm_name || 'TBC'}`,
    `Address: ${String(d.firm_address || 'TBC').replace(/\s*\n\s*/g, ', ')}`,
    `Firm phone: ${d.firm_phone || 'TBC'}`,
    `Acting solicitor: ${d.acting_solicitor_name || 'TBC'}`,
    `Solicitor email: ${d.acting_solicitor_email || 'TBC'}`,
    `Solicitor direct phone: ${d.acting_solicitor_phone || 'TBC'}`,
  ].join('\n');
  if (rowNumber) {
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'PIPELINE'!A${rowNumber}:L${rowNumber}`,
    });
    const values = current.data.values?.[0] || [];
    const existingSummary = values[0] || '';
    const existingNotes = values[1] || '';
    const nextSummary = existingSummary.includes('⚖️ SOLICITOR DETAILS RECEIVED')
      ? `${existingSummary}\n\n${solicitorSummary}`
      : [existingSummary, solicitorSummary].filter(Boolean).join('\n\n');
    const nextNotes = [existingNotes, notes].filter(Boolean).join('\n\n---\n');
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'PIPELINE'!A${rowNumber}`, values: [[nextSummary]] },
          { range: `'PIPELINE'!B${rowNumber}`, values: [[nextNotes]] },
          { range: `'PIPELINE'!I${rowNumber}`, values: [['SOLICITOR DETAILS RECEIVED']] },
          { range: `'PIPELINE'!L${rowNumber}`, values: [['Review solicitor details / handover']] },
        ],
      },
    });
    return { matched: true, row: rowNumber };
  }

  const [firstName = '', ...rest] = String(d.borrower_name || '').trim().split(/\s+/);
  const lastName = rest.join(' ');
  const pipelineRow = Array(131).fill('');
  pipelineRow[0] = `📅 ${new Date().toLocaleDateString('en-GB')} · ${d.borrower_name || 'Borrower'} · ${d.deal_ref || 'Solicitor Details'}\nSolicitor details received via Posfin form.`;
  pipelineRow[1] = notes;
  pipelineRow[2] = 'SOLICITOR DETAILS RECEIVED';
  pipelineRow[3] = d.borrower_phone || '';
  pipelineRow[4] = d.borrower_email || '';
  pipelineRow[5] = d.first_name || firstName || '';
  pipelineRow[6] = d.last_name || lastName || '';
  pipelineRow[7] = 'Website';
  pipelineRow[8] = 'SOLICITOR DETAILS RECEIVED';
  pipelineRow[10] = 'Solicitor Details';
  pipelineRow[11] = 'Review solicitor details / match to case';
  pipelineRow[19] = d.deal_ref || '';
  pipelineRow[71] = 'solicitor-details-form';
  const appended = await appendRowAtFirstEmpty(sheets, 'PIPELINE', pipelineRow);
  return { matched: false, row: appended };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const d = req.body || {};
    const required = [
      'borrower_name',
      'borrower_phone',
      'firm_name',
      'firm_address',
      'firm_phone',
      'acting_solicitor_name',
      'acting_solicitor_email',
      'acting_solicitor_phone',
    ];
    const missing = required.filter((k) => !String(d[k] || '').trim());
    if (missing.length) {
      res.status(400).json({ error: 'Missing required fields', missing }); return;
    }

    const saB64 = process.env.GOOGLE_SA_B64;
    if (!saB64) { res.status(500).json({ error: 'Server misconfiguration' }); return; }
    const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const websiteRow = await appendRowAtFirstEmpty(sheets, 'Website Form', websiteFormRow(d, ts));
    const pipeline = await updatePipeline(sheets, d, ts);

    const TELE_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (TELE_TOKEN) {
      const msg = [
        '🦅 *Solicitor Details Received*',
        '',
        d.deal_ref ? `*Ref:* ${d.deal_ref}` : '',
        d.borrower_name ? `*Borrower:* ${d.borrower_name}` : '',
        d.borrower_phone ? `*Borrower mobile:* ${d.borrower_phone}` : '',
        `*Firm:* ${d.firm_name}`,
        `*Solicitor:* ${d.acting_solicitor_name}`,
        `*Email:* ${d.acting_solicitor_email}`,
        `*Phone:* ${d.acting_solicitor_phone}`,
        '',
        `Website Form row: ${websiteRow}`,
        `Pipeline row: ${pipeline.row}${pipeline.matched ? ' (matched)' : ' (new row)'}`,
      ].filter(Boolean).join('\n');
      fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '1750758657', text: msg, parse_mode: 'Markdown' }),
      }).catch((e) => console.warn('[Solicitor Details API] Telegram failed:', e.message));
    }

    res.status(200).json({ ok: true, websiteFormRow: websiteRow, pipeline });
  } catch (err) {
    console.error('[Solicitor Details API Error]', err);
    res.status(500).json({ error: err.message });
  }
}

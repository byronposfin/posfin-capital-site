/**
 * Posfin Capital — Deal Scorecard (Permanent URL)
 * GET /api/scorecard?ref=POSFIN-ML-SMITH
 *
 * Reads from PIPELINE tab, renders the same format as the on-screen
 * Step 5 confirmation. Shareable with broker (Telegram) and borrower (WATI).
 */

import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';

function fmt(v) { return v && v !== 'TBC' && v !== '' ? v : '—'; }
function fmtCurrency(v) {
  if (!v || v === 'TBC' || v === '') return '—';
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return isNaN(n) || n === 0 ? '—' : '£' + n.toLocaleString('en-GB');
}

function row(label, value, opts = {}) {
  const color = opts.teal ? '#00B5B0' : opts.amber ? '#D4A853' : '#1C184F';
  const weight = opts.bold ? '700' : '500';
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.4rem 0;border-bottom:1px solid rgba(28,24,79,0.07)">
    <span style="font-size:0.82rem;color:#6F6B7A">${label}</span>
    <span style="font-size:0.85rem;font-weight:${weight};color:${color}">${value || '—'}</span>
  </div>`;
}

function section(label) {
  return `<p style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:#D4A853;font-family:monospace;margin:1.2rem 0 0.5rem">${label}</p>`;
}

function scorecard(d) {
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const additionsRows = [];
  let totalAdditions = 0;
  if (d.secondChargeBalance && Number(String(d.secondChargeBalance).replace(/[^\d]/g,'')) > 0) {
    const v = Number(String(d.secondChargeBalance).replace(/[^\d]/g,''));
    totalAdditions += v;
    additionsRows.push(row(`Redeem 2nd charge — ${d.secondChargeProvider || 'TBC'}`, fmtCurrency(v), { amber: true }));
  }
  if (d.legalBuffer) {
    totalAdditions += 3000;
    additionsRows.push(row('Legal cost buffer', '£3,000', { amber: true }));
  }
  if (d.overrunBuffer) {
    totalAdditions += 10000;
    additionsRows.push(row('Contingency buffer', '£10,000', { amber: true }));
  }

  const additionsSection = additionsRows.length > 0 ? `
    <div style="margin-bottom:1.2rem;padding:0.8rem;border-radius:5px;background:rgba(212,168,83,0.05);border:1px solid rgba(212,168,83,0.2)">
      ${section('Additions to Loan')}
      ${additionsRows.join('')}
      <div style="display:flex;justify-content:space-between;padding-top:0.4rem;margin-top:0.2rem;border-top:1px solid rgba(212,168,83,0.3)">
        <span style="font-size:0.82rem;font-weight:700;color:#1C184F">Total additions</span>
        <span style="font-size:0.85rem;font-weight:700;color:#D4A853">${fmtCurrency(totalAdditions)}</span>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Posfin Capital · ${d.ref}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FAF8F3;font-family:'DM Sans',-apple-system,sans-serif;color:#1A1A2E;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:2rem 1.25rem 4rem}
.header{text-align:center;padding-bottom:1.5rem;border-bottom:2px solid #1C184F;margin-bottom:0.5rem}
.icon{font-size:2.5rem;margin-bottom:0.75rem}
.headline{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:600;color:#1C184F;margin:0 0 0.4rem}
.subline{font-size:0.82rem;color:#5A5770}
.scorecard-label{font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#9E9AAA;font-family:monospace;margin:1rem 0 0.75rem}
.ref-box{margin-top:1.5rem;padding:1rem;border-radius:5px;background:#1C184F;text-align:center}
.ref-label{color:rgba(255,255,255,0.7);font-size:0.78rem;margin-bottom:0.3rem}
.ref-value{color:#00B5B0;font-family:monospace;font-size:0.9rem;font-weight:600}
.ref-sub{color:rgba(255,255,255,0.6);font-size:0.75rem;margin-top:0.6rem}
.top-bar{background:#13113A;color:rgba(255,255,255,0.78);padding:10px 24px;font-size:11px;letter-spacing:0.12em;display:flex;justify-content:space-between;align-items:center}
.generated{font-size:11px;color:#9E9AAA;text-align:center;margin-top:2rem}
@media(max-width:600px){.wrap{padding:1.5rem 1rem 3rem}.top-bar{flex-direction:column;gap:4px;text-align:center}}
</style>
</head>
<body>
<div class="top-bar">
  <span>POSFIN CAPITAL · BRIDGING FINANCE SPECIALISTS</span>
  <span>FCA AUTHORISED · FRN 913022</span>
</div>
<div class="wrap">
  <div class="header">
    <div class="icon">${d.product === 'Speed Loan' ? '⚡' : d.product?.includes('Dev') ? '🏗' : '✅'}</div>
    <h2 class="headline">Application received.</h2>
    <p class="subline">Byron or Chris will call you within 30 minutes during business hours with your indicative terms.</p>
  </div>

  <p class="scorecard-label">Your scorecard</p>

  <div style="margin-bottom:1.2rem">
    ${section('Your Details')}
    ${row('Name', fmt(d.borrowerName))}
    ${row('Mobile', fmt(d.mobile))}
    ${row('Email', fmt(d.email))}
  </div>

  <div style="margin-bottom:1.2rem">
    ${section('The Security Property')}
    ${row('Address', fmt(d.securityAddress))}
    ${row('Postcode', fmt(d.postcode))}
    ${row('Estimated Value', fmtCurrency(d.propertyValue))}
    ${d.tenure ? row('Tenure', fmt(d.tenure)) : ''}
    ${row('1st Charge Lender', fmt(d.firstChargeLender) || 'None')}
    ${row('Mortgage Balance', fmtCurrency(d.firstChargeBalance))}
    ${d.arrearsAmount && d.arrearsAmount !== '0' ? row('Arrears', fmtCurrency(d.arrearsAmount), { amber: true }) : ''}
    ${d.secondCharges === 'Yes' ? row(`2nd Charge (${d.secondChargeProvider || 'TBC'})`, fmtCurrency(d.secondChargeBalance), { amber: true }) : ''}
  </div>

  ${additionsSection}

  <div style="margin-bottom:1.2rem">
    ${section('Your Loan')}
    ${row('Net cash to you on day 1', fmtCurrency(d.netCash), { teal: true, bold: true })}
    ${totalAdditions > 0 ? row('Additions (redemptions + buffers)', fmtCurrency(totalAdditions), { amber: true }) : ''}
    ${row('Total facility required', (fmtCurrency(d.totalFacility) || '—') + ' (approx, before lender fees)', { bold: true })}
    ${row('Net or gross', fmt(d.netOrGross))}
    ${row('Purpose', fmt(d.purpose))}
    ${row('Exit strategy', fmt(d.exitStrategy))}
    ${d.timescale ? row('Timescale', fmt(d.timescale)) : ''}
    ${d.ltv ? row('Estimated LTV', fmt(d.ltv)) : ''}
  </div>

  <div class="ref-box">
    <p class="ref-label">Reference</p>
    <p class="ref-value">${d.ref}</p>
    <p class="ref-sub">Check your WhatsApp — your scorecard is on its way to ${fmt(d.mobile)}</p>
  </div>

  <p class="generated">Generated ${now} · Posfin Capital Ltd · FCA FRN 913022 · 96 Kensington High Street, London W8 4SG</p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const ref = req.query.ref;
  if (!ref) { res.status(400).send('Missing ref parameter'); return; }

  try {
    const saB64 = process.env.GOOGLE_SA_B64;
    if (!saB64) { res.status(500).send('Server misconfiguration'); return; }
    const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'PIPELINE'!A:AQ`,
    });
    const rows = result.data.values || [];

    // Find row by deal ref (col U = index 20)
    const dataRow = rows.find(r => r[20] === ref);
    if (!dataRow) {
      res.status(404).send(`<html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h2 style="color:#1C184F">Scorecard not found</h2>
        <p style="color:#6F6B7A">Reference: ${ref}</p>
        <p style="color:#6F6B7A;margin-top:1rem">This deal may not have been submitted via the website form.</p>
      </body></html>`);
      return;
    }

    // Parse summary text from col A
    const summary = dataRow[0] || '';
    const get = (pattern) => summary.match(pattern)?.[1]?.trim() || '';

    const loanAmount = dataRow[18] || '';
    const propertyValue = dataRow[21] || '';
    const firstChargeBalance = dataRow[23] || '';
    const arrearsAmount = dataRow[25] || '';
    const secondChargeBalance = dataRow[27] || '';
    const secondChargeProvider = dataRow[26] || '';

    // Calculate net cash
    const loan = Number(String(loanAmount).replace(/[^\d]/g, '')) || 0;
    const arrears = Number(String(arrearsAmount).replace(/[^\d]/g, '')) || 0;
    const sc = Number(String(secondChargeBalance).replace(/[^\d]/g, '')) || 0;
    const hasAdditions = arrears > 0 || sc > 0;
    const netCash = hasAdditions ? Math.max(0, loan - arrears - sc) : loan;

    const d = {
      ref,
      borrowerName: `${dataRow[5] || ''} ${dataRow[6] || ''}`.trim() || get(/Name: ([^\n]+)/),
      mobile:       dataRow[3] || '',
      email:        dataRow[4] || '',
      product:      dataRow[11] || '',
      securityAddress: get(/Address: ([^\n]+)/),
      postcode:     get(/Postcode: ([^\n]+)/),
      propertyValue,
      tenure:       get(/tenure.*?([^\n·]+)/i),
      firstChargeLender: dataRow[22] || '',
      firstChargeBalance,
      arrearsAmount,
      secondCharges: sc > 0 ? 'Yes' : 'No',
      secondChargeProvider,
      secondChargeBalance,
      legalBuffer:  summary.includes('Legal cost buffer') || summary.includes('legalBuffer: Yes'),
      overrunBuffer: summary.includes('Contingency buffer') || summary.includes('overrunBuffer: Yes'),
      loanAmount,
      netCash,
      totalFacility: loan,
      netOrGross:   get(/Net or gross: ([^\n]+)/),
      purpose:      get(/🎯 PURPOSE\n([^\n]+)/),
      exitStrategy: get(/🚪 EXIT\n([^\n]+)/),
      timescale:    get(/Timescale: ([^\n]+)/),
      ltv:          get(/LTV: ([^\n]+)/),
    };

    const html = scorecard(d);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(html);

  } catch (err) {
    console.error('[Scorecard API Error]', err);
    res.status(500).send('Error generating scorecard: ' + err.message);
  }
}

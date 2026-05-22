/**
 * Posfin Capital — Deal Scorecard
 * GET /api/scorecard?ref=POSFIN-ML-SMITH
 *
 * Reads deal data from PIPELINE tab and renders a branded HTML scorecard.
 * URL is permanent — shareable with broker and borrower.
 */

import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';

function fmt(v) {
  if (!v || v === 'TBC' || v === '') return '—';
  return v;
}

function fmtCurrency(v) {
  if (!v || v === 'TBC' || v === '') return '—';
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  if (isNaN(n) || n === 0) return '—';
  return '£' + n.toLocaleString('en-GB');
}

function scorecard(d) {
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const productColour = {
    'Speed Loan': '#00B5B0',
    'Main Loan': '#1C184F',
    'Back-to-Back': '#7B5EA7',
    'Development Finance': '#D4A853',
    'Dev Exit': '#2E7D32',
  }[d.product] || '#1C184F';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Posfin Capital · Deal Scorecard · ${d.ref}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#FAF8F3;font-family:'DM Sans',sans-serif;color:#1A1A2E;min-height:100vh}
.top-bar{background:#13113A;color:rgba(255,255,255,0.78);padding:10px 24px;font-size:11px;letter-spacing:0.12em;display:flex;justify-content:space-between;align-items:center}
.header{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);padding:32px 40px 28px;color:#fff}
.logo{height:32px;width:auto;margin-bottom:16px}
.product-badge{display:inline-block;padding:4px 14px;border-radius:2px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;margin-bottom:16px}
.header h1{font-family:'Playfair Display',serif;font-size:28px;font-weight:500;margin-bottom:6px}
.header .ref{font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:4px}
.generated{font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.1em}
.body{max-width:760px;margin:0 auto;padding:32px 24px 64px}
.section{margin-bottom:28px;background:#fff;border:1px solid #E8E4DB;border-radius:4px;overflow:hidden}
.section-header{padding:12px 20px;background:#1C184F;color:#fff;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;font-weight:600}
.rows{padding:0 20px}
.row{display:flex;padding:11px 0;border-bottom:1px solid #F0EDE5;font-size:14px;align-items:baseline}
.row:last-child{border-bottom:none}
.label{width:44%;color:#6F6B7A;flex-shrink:0;font-size:13px}
.value{flex:1;color:#1A1A2E;font-weight:500}
.value.teal{color:#00B5B0}
.value.gold{color:#D4A853}
.value.red{color:#C62828}
.value.green{color:#2E7D32}
.ltv-bar{height:8px;background:#E8E4DB;border-radius:4px;margin-top:6px;overflow:hidden}
.ltv-fill{height:100%;border-radius:4px;transition:width 0.3s}
.flag{display:inline-block;padding:3px 10px;border-radius:2px;font-size:11px;font-weight:600;letter-spacing:0.08em}
.flag.green{background:#E8F5E9;color:#2E7D32}
.flag.amber{background:#FFF3E0;color:#E65100}
.flag.red{background:#FFEBEE;color:#C62828}
.footer{text-align:center;padding:24px;font-size:11px;color:#9E9AAA;letter-spacing:0.08em}
@media(max-width:600px){.label{width:46%}.body{padding:20px 12px 48px}}
</style>
</head>
<body>
<div class="top-bar">
  <span>POSFIN CAPITAL · BRIDGING FINANCE SPECIALISTS</span>
  <span>FCA Authorised · FRN 913022</span>
</div>
<div class="header">
  <img class="logo" src="https://posfincapital.com/logo.png" alt="Posfin Capital"/>
  <div class="product-badge" style="background:${productColour};color:#fff">${fmt(d.product)}</div>
  <div class="ref">${fmt(d.ref)}</div>
  <h1>${fmt(d.borrowerName)}</h1>
  <div class="generated">Generated ${now}</div>
</div>
<div class="body">

  <div class="section">
    <div class="section-header">Borrower</div>
    <div class="rows">
      <div class="row"><span class="label">Name</span><span class="value">${fmt(d.borrowerName)}</span></div>
      <div class="row"><span class="label">Mobile</span><span class="value">${fmt(d.mobile)}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${fmt(d.email)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Security Property</div>
    <div class="rows">
      <div class="row"><span class="label">Address</span><span class="value">${fmt(d.securityAddress)}</span></div>
      <div class="row"><span class="label">Stated Value</span><span class="value">${fmtCurrency(d.propertyValue)}</span></div>
      <div class="row"><span class="label">1st Charge Lender</span><span class="value">${fmt(d.firstChargeLender)}</span></div>
      <div class="row"><span class="label">1st Charge Balance</span><span class="value">${fmtCurrency(d.firstChargeBalance)}</span></div>
      <div class="row"><span class="label">Arrears</span><span class="value ${d.arrears && d.arrears !== 'None' ? 'red' : ''}">${fmt(d.arrears)}${d.arrearsAmount ? ' · ' + fmtCurrency(d.arrearsAmount) : ''}</span></div>
      <div class="row"><span class="label">2nd / Other Charges</span><span class="value">${fmt(d.secondCharges)}${d.secondChargeProvider ? ' · ' + d.secondChargeProvider : ''}${d.secondChargeBalance ? ' · ' + fmtCurrency(d.secondChargeBalance) : ''}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Loan Structure</div>
    <div class="rows">
      <div class="row"><span class="label">Product</span><span class="value" style="color:${productColour};font-weight:600">${fmt(d.product)}</span></div>
      <div class="row"><span class="label">Requested</span><span class="value teal">${fmtCurrency(d.loanAmount)}</span></div>
      <div class="row"><span class="label">Estimated LTV</span><span class="value">
        ${fmt(d.ltv)}
        ${d.ltvFlag ? `<span class="flag ${d.ltvFlag === 'PASS' ? 'green' : d.ltvFlag === 'WARN' ? 'amber' : 'red'}">${d.ltvFlag}</span>` : ''}
      </span></div>
      <div class="row"><span class="label">Purpose</span><span class="value">${fmt(d.purpose)}</span></div>
      <div class="row"><span class="label">Exit Strategy</span><span class="value">${fmt(d.exit)}</span></div>
      <div class="row"><span class="label">Regulated</span><span class="value">${fmt(d.regulated)}</span></div>
    </div>
  </div>

  ${d.additionalInfo ? `
  <div class="section">
    <div class="section-header">Additional Notes</div>
    <div class="rows">
      <div class="row" style="display:block;padding:14px 0"><span style="font-size:14px;color:#1A1A2E;line-height:1.6">${d.additionalInfo}</span></div>
    </div>
  </div>` : ''}

</div>
<div class="footer">
  Posfin Capital Limited · FCA FRN 913022 · 96 Kensington High Street, London W8 4SG<br/>
  This scorecard is confidential and prepared for internal use and borrower review only.
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

    // Search PIPELINE tab for this ref
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'PIPELINE'!A:AQ`,
    });
    const rows = result.data.values || [];
    const dataRow = rows.find(r => r[20] === ref); // col U = deal ref

    if (!dataRow) {
      res.status(404).send(`Scorecard not found for ref: ${ref}`);
      return;
    }

    // Map columns from pipeline row
    const d = {
      ref,
      borrowerName: `${dataRow[5] || ''} ${dataRow[6] || ''}`.trim() || dataRow[0]?.slice(0, 40) || 'Borrower',
      mobile:       dataRow[3] || '',
      email:        dataRow[4] || '',
      product:      dataRow[11] || '',
      securityAddress: dataRow[0]?.match(/Address: ([^\n]+)/)?.[1] || '',
      propertyValue:   dataRow[21] || '',
      firstChargeLender: dataRow[22] || '',
      firstChargeBalance: dataRow[23] || '',
      arrears:      '',
      arrearsAmount: dataRow[25] || '',
      secondCharges: '',
      secondChargeProvider: dataRow[26] || '',
      secondChargeBalance:  dataRow[27] || '',
      loanAmount:   dataRow[18] || '',
      ltv:          '',
      ltvFlag:      '',
      purpose:      '',
      exit:         '',
      regulated:    '',
      additionalInfo: dataRow[1] || '',
    };

    // Parse summary text for richer data
    const summary = dataRow[0] || '';
    d.purpose  = summary.match(/🎯 PURPOSE\n([^\n]+)/)?.[1] || '';
    d.exit     = summary.match(/🚪 EXIT\n([^\n]+)/)?.[1] || '';
    d.regulated = summary.match(/Regulated[^·\n]*(?:·\s*)?([^\n·]+regulated[^\n]*)/i)?.[0]?.split('·')?.[0]?.trim() || '';
    d.arrears  = summary.match(/Arrears: ([^\n·]+)/)?.[1]?.trim() || '';
    d.securityAddress = d.securityAddress || summary.match(/Address: ([^\n]+)/)?.[1]?.trim() || '';

    const html = scorecard(d);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(html);

  } catch (err) {
    console.error('[Scorecard API Error]', err);
    res.status(500).send('Error generating scorecard: ' + err.message);
  }
}

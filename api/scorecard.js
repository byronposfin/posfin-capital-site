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
  const color = opts.teal ? '#008F8A' : opts.amber ? '#1C184F' : '#1C184F';
  const weight = opts.bold ? '700' : '500';
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding:0.62rem 0;border-bottom:1px solid #E8EEF0">
    <span style="font-size:0.9rem;color:#425466;line-height:1.35">${label}</span>
    <span style="font-size:0.94rem;font-weight:${weight};color:${color};text-align:right;line-height:1.35;max-width:58%">${value || '—'}</span>
  </div>`;
}

function section(label) {
  return `<p style="font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#008F8A;font-family:'DM Sans',-apple-system,sans-serif;font-weight:800;margin:1.35rem 0 0.55rem">${label}</p>`;
}

function scorecard(d) {
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Mandatory redemptions
  const redemptionRows = [];
  let totalRedemptions = 0;
  if (d.arrearsAmount && Number(String(d.arrearsAmount).replace(/[^`\d]/g,'')) > 0) {
    const v = Number(String(d.arrearsAmount).replace(/[^\d]/g,''));
    totalRedemptions += v;
    redemptionRows.push(row('Arrears to clear', fmtCurrency(v), { amber: true }));
  }
  if (d.secondChargeBalance && Number(String(d.secondChargeBalance).replace(/[^\d]/g,'')) > 0) {
    const v = Number(String(d.secondChargeBalance).replace(/[^\d]/g,''));
    totalRedemptions += v;
    redemptionRows.push(row(`Redeem 2nd charge — ${d.secondChargeProvider || 'TBC'}`, fmtCurrency(v), { amber: true }));
  }

  // Legal / buffer additions
  let legalCost = 0;
  let bufferCost = 0;
  const bufferRows = [];
  if (d.legalBuffer) {
    legalCost = Number(String(d.estimatedLegalCost || '2000').replace(/[^\d]/g,'')) || 2000;
    bufferRows.push(row('Legal cost buffer', fmtCurrency(legalCost), { amber: true }));
  }
  if (d.overrunBuffer) {
    bufferCost = Number(String(d.contingencyAmount || '5000').replace(/[^\d]/g,'')) || 5000;
    bufferRows.push(row('Contingency buffer', fmtCurrency(bufferCost), { amber: true }));
  }

  const totalAdditions = totalRedemptions + legalCost + bufferCost;

  const chargePositionBadge = d.chargePosition
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;background:${/2nd|second/i.test(d.chargePosition) ? '#FFF3CD;color:#856404' : '#D1F5F3;color:#006B67'}">${d.chargePosition}</span>`
    : '';

  const solicitorBadge = d.panelSolicitorOptIn
    ? `<span style="display:inline-block;padding:3px 10px;border-radius:3px;font-size:11px;font-weight:800;letter-spacing:0.10em;text-transform:uppercase;background:${d.panelSolicitorOptIn === 'Yes' ? '#D1F5F3;color:#006B67' : d.panelSolicitorOptIn === 'No' ? '#F5F5F5;color:#555' : '#FFF3E0;color:#856404'}">${d.panelSolicitorOptIn === 'Yes' ? '✓ Panel solicitor' : d.panelSolicitorOptIn === 'No' ? 'Own solicitor' : 'Solicitor TBC'}</span>`
    : '';

  const additionsSection = (redemptionRows.length > 0 || bufferRows.length > 0) ? `
    <div style="margin-bottom:1.2rem;padding:0.8rem;border-radius:5px;background:#FFFBF0;border:2px solid #F0C040">
      ${section('Mandatory Redemptions & Additions')}
      ${redemptionRows.join('')}
      ${redemptionRows.length > 0 ? `<div style="display:flex;justify-content:space-between;padding:0.35rem 0 0.55rem;border-bottom:1px dashed #E0C060"><span style="font-size:0.82rem;font-weight:700;color:#856404">Total mandatory redemptions</span><span style="font-size:0.85rem;font-weight:700;color:#856404">${fmtCurrency(totalRedemptions)}</span></div>` : ''}
      ${bufferRows.join('')}
      ${totalAdditions > 0 ? `<div style="display:flex;justify-content:space-between;padding-top:0.4rem;margin-top:0.2rem;border-top:1px solid #E0C060"><span style="font-size:0.82rem;font-weight:700;color:#1C184F">Total added to facility</span><span style="font-size:0.85rem;font-weight:700;color:#008F8A">${fmtCurrency(totalAdditions)}</span></div>` : ''}
    </div>` : '';

  const solicitorSection = (d.panelSolicitorOptIn || d.estimatedLegalCost) ? `
    <div style="margin-bottom:1.2rem">
      ${section('Legal & Solicitor')}
      ${d.panelSolicitorOptIn ? row('Panel solicitor', d.panelSolicitorOptIn === 'Yes' ? '✓ Yes — LARK / Ackroyds / Taylor Rose' : d.panelSolicitorOptIn === 'No' ? 'No — own solicitor' : 'TBC — discuss on call') : ''}
      ${d.estimatedLegalCost && d.estimatedLegalCost !== '0' ? row('Estimated legal cost', fmtCurrency(d.estimatedLegalCost), { teal: true }) : ''}
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
body{background:#FFFFFF;font-family:'DM Sans',-apple-system,sans-serif;color:#1A1A2E;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:600px;margin:0 auto;padding:2rem 1.1rem 4rem;background:#FFFFFF}
.header{text-align:center;padding:1.25rem 0 1.5rem;border-bottom:3px solid #1C184F;margin-bottom:0.75rem;background:#FFFFFF}
.icon{font-size:2.5rem;margin-bottom:0.75rem}
.headline{font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:600;color:#1C184F;margin:0 0 0.4rem}
.subline{font-size:0.82rem;color:#5A5770}
.scorecard-label{font-size:11px;text-transform:uppercase;letter-spacing:0.20em;color:#1C184F;font-weight:800;margin:1.15rem 0 0.9rem}
.ref-box{margin-top:1.5rem;padding:1rem;border-radius:5px;background:#1C184F;text-align:center}
.ref-label{color:rgba(255,255,255,0.7);font-size:0.78rem;margin-bottom:0.3rem}
.ref-value{color:#00B5B0;font-family:monospace;font-size:0.9rem;font-weight:600}
.ref-sub{color:rgba(255,255,255,0.6);font-size:0.75rem;margin-top:0.6rem}
.top-bar{background:#13113A;color:#FFFFFF;padding:11px 24px;font-size:11px;font-weight:700;letter-spacing:0.12em;display:flex;justify-content:space-between;align-items:center}
.generated{font-size:11px;color:#9E9AAA;text-align:center;margin-top:2rem}
@media(max-width:600px){.wrap{padding:1.35rem 1rem 3rem}.top-bar{flex-direction:column;gap:4px;text-align:center;font-size:10px}.headline{font-size:1.55rem}.subline{font-size:.88rem}.icon{font-size:2.35rem}}
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
    ${chargePositionBadge ? `<div style="margin-top:0.75rem">${chargePositionBadge}</div>` : ''}
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
    ${d.arrearsAmount && d.arrearsAmount !== '0' ? row('Arrears (to clear)', fmtCurrency(d.arrearsAmount), { amber: true }) : ''}
    ${d.secondCharges === 'Yes' ? row(`2nd Charge — ${d.secondChargeProvider || 'TBC'}`, fmtCurrency(d.secondChargeBalance), { amber: true }) : ''}
    ${d.chargePosition ? row('Charge position requested', fmt(d.chargePosition), { bold: true }) : ''}
  </div>

  ${additionsSection}

  <div style="margin-bottom:1.2rem">
    ${section('Your Loan')}
    ${row('Net cash to you on day 1', fmtCurrency(d.netCash), { teal: true, bold: true })}
    ${totalAdditions > 0 ? row('Total additions to facility', fmtCurrency(totalAdditions), { amber: true }) : ''}
    ${row('Total facility required', (fmtCurrency(d.totalFacility) || '—') + ' (approx, before lender fees)', { bold: true })}
    ${row('Net or gross', fmt(d.netOrGross))}
    ${row('Purpose', fmt(d.purpose))}
    ${row('Exit strategy', fmt(d.exitStrategy))}
    ${d.timescale ? row('Timescale', fmt(d.timescale)) : ''}
    ${d.ltv ? row('Estimated LTV', fmt(d.ltv)) : ''}
  </div>

  ${solicitorSection}

  <div class="ref-box">
    <p class="ref-label">Reference</p>
    <p class="ref-value">${d.ref}</p>
    ${solicitorBadge ? `<p style="margin-top:0.5rem">${solicitorBadge}</p>` : ''}
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
      range: `'Pipeline'!A:BO`,
    });
    const rows = result.data.values || [];
    const headers = rows[0] || [];
    const idx = (names) => {
      const list = Array.isArray(names) ? names : [names];
      return headers.findIndex(h => list.some(name => String(h || '').toLowerCase().includes(String(name).toLowerCase())));
    };
    const val = (row, names) => {
      const i = idx(names);
      return i >= 0 ? (row[i] || '') : '';
    };

    const refIdx = idx(['case_id', '🔖 Ref', 'Ref']);
    const dataRow = rows.slice(1).find(r => String(r[refIdx] || '').trim() === ref);
    if (!dataRow) {
      res.status(404).send(`<html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h2 style="color:#1C184F">Scorecard not found</h2>
        <p style="color:#6F6B7A">Reference: ${ref}</p>
        <p style="color:#6F6B7A;margin-top:1rem">This deal may not have been submitted via the website form.</p>
      </body></html>`);
      return;
    }

    // Parse summary text from col A as fallback only; current data should come from headers.
    const summary = dataRow[0] || '';
    const get = (pattern) => summary.match(pattern)?.[1]?.trim() || '';

    // Read using actual Pipeline schema column headers
    const loanAmount = val(dataRow, ['requested_amount_net', '💷 Net', 'FNR — Final Net Request', 'Net (£)']);
    const propertyValue = val(dataRow, ['property_value_stated', '📊 Property Value (Stated)', 'Property Value (Stated)']);
    const firstChargeBalance = val(dataRow, ['charge1_balance', '1st Charge Clean', '1st Charge Gross']);
    const arrearsAmount = val(dataRow, ['arrears_amount', 'Arrears']);
    const secondChargeBalance = val(dataRow, ['second_charge_balance', '2nd Charge Balance']);
    const secondChargeProvider = val(dataRow, ['second_charge_lender', '2nd Charge Provider', 'AR']);
    const legalBufferRaw = val(dataRow, ['legal_buffer', 'AZ']);
    const contingencyRaw = val(dataRow, ['contingency_buffer', 'BA']);

    // Calculate net cash
    const loan = Number(String(loanAmount).replace(/[^\d]/g, '')) || 0;
    const arrears = Number(String(arrearsAmount).replace(/[^\d]/g, '')) || 0;
    const sc = Number(String(secondChargeBalance).replace(/[^\d]/g, '')) || 0;
    const hasAdditions = arrears > 0 || sc > 0;
    const netCash = hasAdditions ? Math.max(0, loan - arrears - sc) : loan;

    const d = {
      ref,
      borrowerName: val(dataRow, ['borrower_name', '👤 First Name', 'First Name']) || get(/Name: ([^\n]+)/),
      mobile:       val(dataRow, ['mobile_e164', '📱 Mobile', 'Mobile']),
      email:        val(dataRow, ['email', '📧 Email', 'Email']),
      product:      val(dataRow, ['product_route', '⚡ Product', 'Product']),
      securityAddress: val(dataRow, ['security_address', 'Security Address']) || get(/Address: ([^\n]+)/),
      postcode:     val(dataRow, ['postcode', 'Postcode']) || get(/Postcode: ([^\n]+)/),
      propertyValue,
      tenure:       val(dataRow, ['tenure', 'Tenure']) || get(/Tenure: ([^\n]+)/),
      firstChargeLender: val(dataRow, ['charge1_lender', '1st Charge Provider']),
      firstChargeBalance,
      arrearsAmount,
      secondCharges: sc > 0 ? 'Yes' : 'No',
      secondChargeProvider,
      secondChargeBalance,
      legalBuffer:  legalBufferRaw === 'Yes' || legalBufferRaw === 'Yes',
      overrunBuffer: contingencyRaw === 'Yes',
      chargePosition: val(dataRow, ['charge_position_sought', 'AI']) || get(/Charge position: ([^\n]+)/),
      panelSolicitorOptIn: get(/Panel solicitor opt-in: ([^\n]+)/),
      contingencyAmount: (() => { const m = String(contingencyRaw || '').match(/[\d,]+/); return m ? m[0].replace(/,/g,'') : null; })(),
      estimatedLegalCost: legalBufferRaw === 'Yes' ? '2000' : null,
      loanAmount,
      netCash,
      totalFacility: loan,
      netOrGross:   val(dataRow, ['loan_request_type', 'Net or Gross']) || get(/Net or gross: ([^\n]+)/),
      purpose:      val(dataRow, ['purpose_of_funds', 'Purpose of Funds']) || get(/Purpose: ([^\n]+)/),
      exitStrategy: val(dataRow, ['exit_strategy', 'Exit Strategy']) || get(/Exit: ([^\n]+)/),
      timescale:    val(dataRow, ['term_months', 'ETA Completion Days']) || get(/Timescale: ([^\n]+)/),
      ltv:          val(dataRow, ['net_ltv_stated', 'Combined LTV%', 'Current LTV']) || get(/LTV: ([^\n]+)/),
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

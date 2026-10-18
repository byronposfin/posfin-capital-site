/**
 * Posfin Capital — Deal Scorecard (Permanent URL)
 * GET /api/scorecard?ref=POSFIN-WEB-...
 *
 * Borrower-facing scorecard. Source of truth is PIPELINE_v2.scorecard_json
 * where present; flat PIPELINE_v2 columns are fallback only.
 */

import { validToken, scorecardLink } from '../lib/scorecard-access.js';
import { google } from 'googleapis';
import { render as renderCanonical } from '../lib/factfind-contract.js';

const SHEET_ID = process.env.FACTFIND_SHEET_ID || '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function raw(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function num(v) {
  const n = Number(raw(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function money(n) {
  const v = typeof n === 'number' ? n : num(n);
  return v > 0 ? `£${Math.round(v).toLocaleString('en-GB')}` : '—';
}
function title(v) {
  const s = raw(v);
  if (!s) return '—';
  const map = {
    net: 'Net cash requested',
    gross: 'Total facility requested',
    sell_property: 'Sale of property',
    refinance: 'Refinance',
    retained: 'Interest retained',
    add_to_facility: 'Add redemptions to facility',
    deduct_from_advance: 'Deduct redemptions from advance',
    freehold: 'Freehold',
    leasehold: 'Leasehold',
  };
  return map[s] || s.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}
function safeDisplay(v) {
  const s = raw(v);
  if (!s || s === 'TBC') return '—';
  const internal = new Set(['website/router submission', 'raw Meta/router response']);
  return internal.has(s.toLowerCase()) ? '—' : s;
}
function first(...vals) { return vals.find(v => raw(v)) || ''; }
function row(label, value, opts = {}) {
  const strong = opts.strong ? 'font-weight:800;color:#008F8A' : 'font-weight:650;color:#1C184F';
  return `<div class="row"><span>${esc(label)}</span><b style="${strong}">${esc(value || '—')}</b></div>`;
}
function calcLine(label, value, note = '') {
  return `<div class="calc-line"><div><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ''}</div><strong>${esc(value)}</strong></div>`;
}
function pct(n) { return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}%` : '—'; }

function extractModel(ref, flat, scorecardJson) {
  const answers = scorecardJson?.answers || {};
  const lead = scorecardJson?.lead_data || {};

  const borrowerName = first(flat.borrower_name, `${lead.first_name || ''} ${lead.last_name || ''}`.trim(), lead.full_name);
  const mobile = first(flat.mobile_e164, lead.mobile, lead.phone);
  const email = first(flat.email, lead.email);
  const securityAddress = first(answers.securityAddress, flat.security_address, lead.security_address, lead.property_address);
  const postcode = first(answers.securityPostcode, lead.security_postcode, lead.postcode);
  const propertyValue = num(first(answers.propertyValue, flat.property_value_stated, lead.property_value));
  const firstLender = first(answers.firstChargeLender, flat.charge1_lender, lead.first_charge_lender);
  const firstBalance = num(first(answers.firstChargeBalance, flat.charge1_balance, lead.first_charge_balance));
  const firstArrears = num(first(answers.firstChargeArrearsAmount, flat.arrears_amount, lead.arrears_amount));
  const secondProvider = first(answers.secondChargeProvider, flat.second_charge_lender, lead.second_charge_provider);
  const secondBalance = num(first(answers.secondChargeBalance, flat.second_charge_balance, lead.second_charge_balance));
  const requested = num(first(answers.loanAmount, flat.requested_amount_net, flat.cash_to_borrower_est, lead.loan_amount));
  const redemptionStructure = first(answers.redemptionStructure, lead.redemption_structure);
  const legal = raw(answers.legalCosts).includes('2000') || raw(flat.legal_buffer).toLowerCase() === 'yes' ? 2000 : num(answers.legalCosts);
  const buffer = num(first(answers.bufferAmount, flat.contingency_buffer === 'Yes' ? '5000' : '', lead.buffer_amount));
  const mandatoryRedemptions = firstArrears + secondBalance;
  const redemptionsAdded = redemptionStructure !== 'deduct_from_advance';
  const totalFacility = requested + (redemptionsAdded ? mandatoryRedemptions : 0) + legal + buffer;
  const netCash = redemptionsAdded ? requested : Math.max(0, requested - mandatoryRedemptions - legal - buffer);
  const ltv = propertyValue > 0 ? (totalFacility / propertyValue) * 100 : 0;

  return {
    ref,
    borrowerName,
    mobile,
    email,
    product: safeDisplay(first(flat.product_route, lead.product, scorecardJson?.product)),
    securityAddress,
    postcode,
    propertyValue,
    tenure: title(first(answers.tenure, flat.tenure, lead.tenure)),
    bedrooms: first(answers.bedrooms, lead.spec_beds),
    bathrooms: first(answers.bathrooms, lead.spec_baths),
    firstLender,
    firstBalance,
    firstArrears,
    firstBalanceType: title(answers.firstChargeBalanceType),
    secondProvider,
    secondBalance,
    requested,
    netGross: title(first(answers.netGrossRequest, flat.loan_request_type)),
    redemptionStructure: title(redemptionStructure),
    legal,
    buffer,
    mandatoryRedemptions,
    totalFacility,
    netCash,
    ltv,
    purpose: title(first(lead.loan_purpose, answers.purpose, flat.purpose_of_funds, flat.use_of_funds_class)),
    exitStrategy: title(first(answers.exitStrategy, flat.exit_strategy, lead.exit_strategy)),
    repaymentPreference: title(first(answers.repaymentPreference, lead.repayment_preference)),
    timescale: title(first(answers.requiredTimescale, flat.funds_needed_by, lead.required_timescale)),
    solicitorPreference: title(first(answers.solicitorPreference, lead.solicitor_preference)),
  };
}

function renderScorecard(d) {
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const propertyValue = money(d.propertyValue);
  const ltvFormula = d.propertyValue > 0 ? `${money(d.totalFacility)} / ${propertyValue} = ${pct(d.ltv)}` : '—';
  const propertySpec = [d.tenure !== '—' ? d.tenure : '', d.bedrooms ? `${d.bedrooms} beds` : '', d.bathrooms ? `${d.bathrooms} baths` : ''].filter(Boolean).join(' · ') || '—';

  const redemptionRows = [
    d.firstArrears > 0 ? calcLine('Clear first-charge arrears', money(d.firstArrears), d.firstLender ? `${d.firstLender}` : '') : '',
    d.secondBalance > 0 ? calcLine(`Redeem second charge${d.secondProvider ? ` — ${d.secondProvider}` : ''}`, money(d.secondBalance)) : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Posfin Capital · ${esc(d.ref)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box} body{margin:0;background:#f7f4ed;color:#1A1A2E;font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}.top{background:#13113A;color:white;padding:12px 20px;font-size:11px;font-weight:800;letter-spacing:.13em;display:flex;justify-content:space-between;gap:14px}.wrap{max-width:760px;margin:0 auto;padding:24px 14px 44px}.hero{background:white;border:1px solid #e8e4db;padding:24px 22px;text-align:center;border-top:4px solid #00B5B0}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#008F8A;font-weight:800}.hero h1{font-family:'Playfair Display',serif;color:#1C184F;margin:10px 0 8px;font-size:30px}.sub{color:#5A5770;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}.metric{background:#1C184F;color:white;padding:16px;border-radius:6px}.metric small{display:block;color:rgba(255,255,255,.68);font-size:11px;text-transform:uppercase;letter-spacing:.13em;margin-bottom:8px}.metric b{font-size:22px;color:#00D1C8}.card{background:white;border:1px solid #e8e4db;border-radius:6px;padding:18px;margin-top:14px}.card h2{margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#008F8A}.row{display:flex;justify-content:space-between;gap:18px;padding:10px 0;border-bottom:1px solid #edf0ef;align-items:baseline}.row span{color:#53616a}.row b{text-align:right}.calc{border:1px solid #dcebea;background:#fbfefd;border-radius:6px;overflow:hidden}.calc-line{display:flex;justify-content:space-between;gap:14px;padding:13px 14px;border-bottom:1px solid #dcebea;align-items:baseline}.calc-line b{color:#1C184F}.calc-line small{display:block;color:#6F6B7A;font-size:12px;margin-top:3px}.calc-line strong{color:#1C184F;white-space:nowrap}.total{background:#1C184F;color:white}.total b,.total strong{color:#00D1C8!important}.note{font-size:12px;color:#6F6B7A;line-height:1.45;margin-top:10px}.ref{background:#1C184F;color:white;text-align:center;border-radius:6px;padding:16px;margin-top:16px}.ref code{color:#00D1C8;font-weight:800}.footer{text-align:center;color:#858091;font-size:11px;margin-top:18px;line-height:1.45}@media(max-width:680px){.top{display:block;text-align:center}.grid{grid-template-columns:1fr}.hero h1{font-size:25px}.row{display:block}.row b{display:block;text-align:left;margin-top:4px}.calc-line{font-size:14px}.wrap{padding-left:10px;padding-right:10px}}
</style>
</head>
<body>
<div class="top"><span>POSFIN CAPITAL · BRIDGING FINANCE SPECIALISTS</span><span>FCA AUTHORISED · FRN 913022</span></div>
<div class="wrap">
  <section class="hero">
    <div class="eyebrow">Application scorecard</div>
    <h1>Application received.</h1>
    <p class="sub">A senior broker will call you to review your Fact Find and match your case to the right lender. Have your photo ID and a recent proof of address to hand for the call.</p>
  </section>

  <section class="grid">
    <div class="metric"><small>Cash to borrower</small><b>${esc(money(d.netCash))}</b></div>
    <div class="metric"><small>Total facility</small><b>${esc(money(d.totalFacility))}</b></div>
    <div class="metric"><small>Estimated net LTV</small><b>${esc(pct(d.ltv))}</b></div>
  </section>

  <section class="card">
    <h2>Your details</h2>
    ${row('Name', safeDisplay(d.borrowerName))}
    ${row('Mobile', safeDisplay(d.mobile))}
    ${row('Email', safeDisplay(d.email))}
  </section>

  <section class="card">
    <h2>The security property</h2>
    ${row('Address', safeDisplay(d.securityAddress))}
    ${row('Postcode', safeDisplay(d.postcode))}
    ${row('Estimated value', propertyValue, {strong:true})}
    ${row('Property', propertySpec)}
    ${row('1st charge lender', safeDisplay(d.firstLender))}
    ${row('1st charge balance', money(d.firstBalance))}
    ${d.firstArrears > 0 ? row('Arrears to clear', money(d.firstArrears)) : ''}
    ${d.secondBalance > 0 ? row(`2nd charge${d.secondProvider ? ` — ${d.secondProvider}` : ''}`, money(d.secondBalance)) : ''}
  </section>

  <section class="card">
    <h2>Loan build-up</h2>
    <div class="calc">
      ${calcLine('Net cash requested', money(d.requested), d.netGross !== '—' ? d.netGross : '')}
      ${redemptionRows || ''}
      ${d.mandatoryRedemptions > 0 ? calcLine('Mandatory redemptions subtotal', money(d.mandatoryRedemptions), d.redemptionStructure) : ''}
      ${d.legal > 0 ? calcLine('Legal cost allowance', money(d.legal)) : ''}
      ${d.buffer > 0 ? calcLine('Contingency buffer', money(d.buffer)) : ''}
      <div class="calc-line total"><div><b>Total facility required</b><small>Approximate, before lender fees</small></div><strong>${esc(money(d.totalFacility))}</strong></div>
    </div>
    <p class="note">Estimated net LTV: ${esc(ltvFormula)}</p>
  </section>

  <section class="card">
    <h2>Purpose and exit</h2>
    ${row('Purpose', safeDisplay(d.purpose))}
    ${row('Exit strategy', safeDisplay(d.exitStrategy))}
    ${row('Interest preference', safeDisplay(d.repaymentPreference))}
    ${row('Timescale', safeDisplay(d.timescale))}
    ${row('Solicitor preference', safeDisplay(d.solicitorPreference))}
  </section>

  <div class="ref"><div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:6px">Reference</div><code>${esc(d.ref)}</code></div>
  <p class="footer">Generated ${esc(generated)} · This is a summary of your declared position only. No credit search has been made. Posfin Capital Ltd · FCA FRN 913022 · 96 Kensington High Street, London W8 4SG</p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const ref = raw(req.query.ref);
  if (!ref) { res.status(400).send('Missing ref parameter'); return; }

  try {
    if (!validToken(ref, req.query.token)) return res.status(403).send('This scorecard link is not valid. Please contact Posfin for a new link.');
    const saB64 = process.env.GOOGLE_SA_B64;
    if (!saB64) { res.status(500).send('Server misconfiguration'); return; }
    const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'Pipeline V1.0'!A:ZZ` });
    const rows = result.data.values || [];
    const headers = rows[0] || [];
    const refIdx = headers.findIndex(h => String(h || '').trim() === '🔖 Ref');
    const dataRow = rows.slice(1).find(r => String(r[refIdx] || '').trim() === ref);
    if (!dataRow) {
      res.status(404).send(`<html><body style="font-family:sans-serif;text-align:center;padding:4rem"><h2 style="color:#1C184F">Scorecard not found</h2><p style="color:#6F6B7A">Reference: ${esc(ref)}</p></body></html>`);
      return;
    }

    const flat = {};
    headers.forEach((h, i) => { flat[String(h || '').trim()] = dataRow[i] || ''; });
    let scorecardJson = {};
    try { scorecardJson = flat.scorecard_json ? JSON.parse(flat.scorecard_json) : {}; } catch (_) { scorecardJson = {}; }

    const model = extractModel(ref, flat, scorecardJson);
    const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Fact Find — Posfin Capital</title></head><body>'+renderCanonical({...scorecardJson.answers,scorecard_url:scorecardLink('',ref)}, ref)+'<script src="/factfind-events.js"></script></body></html>';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(html);
  } catch (err) {
    console.error('[Scorecard API Error]', err);
    res.status(500).send('Error generating scorecard');
  }
}

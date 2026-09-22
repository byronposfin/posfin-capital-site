/**
 * Posfin Capital — Lead Capture API
 * POST /api/lead
 *
 * Accepts form payloads from /development-finance and /dev-exit
 * Writes directly to Google Sheets CRM (Master Sheet)
 *
 * Product → Tab mapping:
 *   development_finance         → Dev Finance Leads
 *   development_exit_finance    → Dev Exit Leads
 */

import { google } from 'googleapis';

const SHEET_ID = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';

const TAB_MAP = {
  development_finance:       'Dev Finance Leads',
  development_exit_finance:  'Dev Exit Leads',
  speed_loan:                'Speed Loan Leads',
  equitable_charges:        'Speed Loan Leads',
  main_loan:                 'Main Loan Leads',
  bank_bridge:               'Main Loan Leads',
  back_to_back:              'Back to Back Leads',
  purchase_refurb:           'Main Loan Leads',
  acquisition_finance:       'Main Loan Leads',
  trade_finance:             'Trade Finance Leads',
};

function formatDevFinanceRow(d, ts) {
  return [
    ts,
    d.deal_ref || d.deal_id || '',
    'NEW',
    d.first_name || '',
    d.last_name || '',
    d.mobile || '',
    d.email || '',
    d.site_address || '',
    d.postcode || '',
    d.site_ownership || '',
    d.scheme_type || '',
    d.planning_status || '',
    d.gdv_estimate_gbp || '',
    d.build_cost_estimate_gbp || '',
    d.equity_contribution || '',
    d.qs_appointed || '',
    d.main_contractor_identified || '',
    d.loan_size_gbp || '',
    d.loan_purpose || '',
    d.exit_strategy || '',
    d.biggest_challenge || '',
    d.additional_info || '',
    d.developer_experience || '',
    d.page_source || 'development-finance',
    ts,
    d.additional_security_properties_summary || '',
    d.portfolio_spreadsheet_file_name || '',
    d.additional_security_properties_json || '',
  ];
}

function formatDevExitRow(d, ts) {
  return [
    ts,
    d.deal_ref || d.deal_id || '',
    'NEW',
    d.first_name || '',
    d.last_name || '',
    d.mobile || '',
    d.email || '',
    d.site_address || '',
    d.postcode || '',
    d.scheme_type || '',
    d.number_of_units || '',
    d.units_sold || '',
    d.scheme_value || '',
    d.current_lender || '',
    d.outstanding_balance || '',
    d.loan_expiry || '',
    d.practical_completion || '',
    d.planning_status || '',
    d.loan_size_gbp || '',
    d.loan_purpose || '',
    d.biggest_challenge || '',
    d.additional_info || '',
    d.page_source || 'dev-exit',
    ts,
    d.additional_security_properties_summary || '',
    d.portfolio_spreadsheet_file_name || '',
    d.additional_security_properties_json || '',
  ];
}

function formatSpeedLoanRow(d, ts) {
  return [
    ts,
    d.deal_ref || '',
    'NEW',
    d.first_name || '',
    d.last_name || '',
    d.mobile || '',
    d.email || '',
    d.urgency || '',
    d.property_address || '',
    d.residential_address || d.home_address || d.property_address || '',
    d.postcode || '',
    d.property_value || '',
    d.first_charge_lender || '',
    d.first_charge_balance || '',
    d.second_charges || '',
    d.tenure || '',
    d.loan_needed || '',
    d.estimated_ltv || '',
    d.ltv_flag || '',
    d.purpose_of_funds || '',
    d.exit_strategy || '',
    d.arrears || '',
    d.arrears_amount || '',
    d.page_source || 'speed-loan',
    ts,
  ];
}

function formatMainLoanRow(d, ts) {
  const additionalSecuritySummary = d.additional_security_properties_summary || '';
  const additionalSecurityFlag = additionalSecuritySummary && !/^no additional security/i.test(additionalSecuritySummary)
    ? 'Yes'
    : 'No';
  return [
    ts, d.deal_ref||'', 'NEW',
    d.first_name||'', d.last_name||'', d.mobile||'', d.email||'',
    d.loan_purpose||'', d.regulated||'',
    d.property_address||'', d.residential_address || d.property_address || '', d.postcode||'',
    d.property_value||'', d.first_charge_lender||'', d.first_charge_balance||'',
    d.second_charges||'', d.tenure||'', d.arrears||'',
    d.loan_amount||'', d.net_or_gross||'', d.estimated_ltv||'', d.ltv_flag||'',
    d.exit_strategy||'', d.timescale||'',
    d.legal_buffer||'', d.overrun_buffer||'',
    d.second_charge_provider||'', d.second_charge_balance||'', d.charge_request||'',
    d.page_source||'main-loan', d.submitted_at || ts,
    additionalSecuritySummary || 'No additional security offered',
    additionalSecurityFlag,
    d.additional_security_properties_json||'',
  ];
}

function formatCurrency(v) {
  const n = Number(String(v || '').replace(/[^\d.]/g, ''));
  if (!n) return 'TBC';
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function hasExplicitOwnerTag(d) {
  const blob = [d.assigned_broker, d.owner, d.broker, d.broker_name, d.assigned_to, d.source_url]
    .filter(Boolean).join(' ').toLowerCase();
  return /\b(chris|byron|bh|cs)\b/.test(blob);
}

function ownerNameFromData(d) {
  const blob = [d.assigned_broker, d.owner, d.broker, d.broker_name, d.assigned_to, d.source_url]
    .filter(Boolean).join(' ').toLowerCase();
  if (/\b(chris|cs)\b/.test(blob)) return 'Chris';
  if (/\b(byron|bh)\b/.test(blob)) return 'Byron';
  return 'Byron';
}


function normalisePhone(v) {
  return String(v || '').replace(/[^0-9]/g, '').replace(/^44/, '0');
}

function sourceParam(d, key) {
  try {
    const u = new URL(d.source_url || '');
    return u.searchParams.get(key) || '';
  } catch { return ''; }
}

function rawLeadMatchTokens(d) {
  return {
    ref: String(d.raw_lead_ref || d.lead_ref || d.lead_token || d.k || d.token || sourceParam(d, 'k') || sourceParam(d, 'raw_lead_ref') || '').trim().toLowerCase(),
    phone: normalisePhone(d.mobile || d.phone || d.telephone),
    email: String(d.email || '').trim().toLowerCase(),
    name: `${d.first_name || ''} ${d.last_name || ''}`.trim().toLowerCase(),
  };
}

async function markRawLeadAssignedIfMatched(sheets, d, ownerName, dealRef, pipelineRowNumber) {
  const tokens = rawLeadMatchTokens(d);
  if (!tokens.ref && !tokens.phone && !tokens.email) return null;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'Raw Leads'!A2:AD1200` });
  const rows = resp.data.values || [];
  let match = null;
  rows.some((row, idx) => {
    const rowNum = idx + 2;
    const blob = row.map(x => String(x || '').toLowerCase()).join(' | ');
    const rowPhone = normalisePhone(row[2] || blob);
    const rowEmail = String(row[3] || '').trim().toLowerCase();
    const rowLeadRef = String(row[13] || '').trim().toLowerCase();
    const ok = (tokens.ref && (rowLeadRef === tokens.ref || blob.includes(tokens.ref)))
      || (tokens.email && rowEmail === tokens.email)
      || (tokens.phone && rowPhone && tokens.phone && rowPhone.includes(tokens.phone));
    if (ok) { match = { rowNum, row }; return true; }
    return false;
  });
  if (!match) return null;
  const existingNotes = match.row[7] || '';
  const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour12: false });
  const note = `${stamp} — ${ownerName} ownership confirmed from completed online form${dealRef ? ` (${dealRef})` : ''}${pipelineRowNumber ? `; PIPELINE:${pipelineRowNumber}` : ''}. Do not cross-call without checking ${ownerName}.`;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'Raw Leads'!F${match.rowNum}`, values: [[`ASSIGNED — ${ownerName.toUpperCase()}`]] },
        { range: `'Raw Leads'!H${match.rowNum}`, values: [[existingNotes ? `${existingNotes}\n${note}` : note]] },
        { range: `'Raw Leads'!AC${match.rowNum}`, values: [[ownerName]] },
      ],
    },
  });
  return match.rowNum;
}

function fmtDateShort(ts) {
  const d = new Date(ts.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatPipelineRow(d, ts, product) {
  if (!['main_loan', 'bank_bridge', 'speed_loan', 'equitable_charges', 'back_to_back', 'purchase_refurb', 'acquisition_finance', 'development_finance', 'development_exit_finance'].includes(product)) return null;
  const first = d.first_name || '';
  const last = d.last_name || '';
  const isSpeed = product === 'speed_loan' || product === 'equitable_charges';
  const productLabel = product === 'speed_loan' ? 'Speed Loan'
    : product === 'equitable_charges' ? 'Equitable Charges'
    : product === 'main_loan' ? 'Main Loan'
    : product === 'bank_bridge' ? 'Bank Bridge'
    : product === 'back_to_back' ? 'Back-to-Back'
    : product === 'purchase_refurb' ? 'Purchase & Refurb'
    : product === 'development_finance' ? 'Development Finance'
    : 'Dev Exit';
  const requestedAmount = (product === 'speed_loan' || product === 'equitable_charges') ? d.loan_needed
    : (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb' || product === 'acquisition_finance') ? d.loan_amount
    : product === 'back_to_back' ? d.full_loan_required
    : product === 'development_finance' ? d.loan_size_gbp
    : d.gross_borrowing_gbp || d.loan_size_gbp;
  const term = product === 'speed_loan' ? '3 months'
    : product === 'equitable_charges' ? '12 months · 6-month minimum exit'
    : (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb' || product === 'acquisition_finance') ? (d.timescale || '12 months')
    : product === 'back_to_back' ? '3 + 12 months'
    : product === 'development_finance' ? 'Development term TBC'
    : (d.term || 'Dev exit term TBC');
  const purpose = (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb' || product === 'acquisition_finance') ? d.loan_purpose : (d.purpose_of_funds || d.loan_purpose || d.use_of_funds || d.biggest_challenge || d.consent_issue);
  const source = `${productLabel} form`;
  const ownerName = ownerNameFromData(d);
  const securityAddress = d.property_address || d.site_address || 'TBC';
  const value = d.property_value || d.gdv_estimate_gbp || d.scheme_value || d.scheme_value_gbp;
  const name = `${first} ${last}`.trim() || `New ${productLabel} Lead`;
  const ref = d.deal_ref || '';
  const summary = [
    `📅 ${fmtDateShort(ts)} · ${name} · ${ref}`,
    `Looking for ${formatCurrency(requestedAmount)} ${isSpeed ? 'net' : String(d.net_or_gross || 'net').toLowerCase()} · ${term} · ${productLabel}`,
    `${d.regulated || (isSpeed ? 'Regulation TBC' : 'Regulation TBC')} · ${d.second_charges === 'Yes' ? '2nd charge / further charge noted' : 'Charge position TBC'}`,
    '',
    '👤 BORROWER',
    `Name: ${name}`,
    `Email: ${d.email || 'TBC'}`,
    `Mobile: ${d.mobile || 'TBC'}`,
    `Ref: ${ref}`,
    '',
    '🏠 SECURITY',
    `Address: ${securityAddress}`,
    `Home address: ${d.residential_address || d.home_address || 'TBC'}`,
    `Security is home: ${d.security_is_home_address || d.securityIsHome || 'TBC'}`,
    `Postcode: ${d.postcode || 'TBC'}`,
    '',
    '🏡 PROPERTY SPEC',
    (() => {
      const parts = [];
      if (d.spec_beds)        parts.push(`${d.spec_beds} bed`);
      if (d.spec_baths)       parts.push(`${d.spec_baths} bath`);
      if (d.spec_receptions)  parts.push(`${d.spec_receptions} reception`);
      if (d.spec_parking && d.spec_parking !== 'None') parts.push(d.spec_parking);
      if (d.spec_garden === 'Yes') parts.push('Garden');
      if (d.spec_sqft)        parts.push(`~${d.spec_sqft} ${d.spec_sqft_unit || 'sq ft'}`);
      if (d.spec_year_built)  parts.push(`Built: ${d.spec_year_built}`);
      return parts.length ? parts.join(' · ') : 'Spec TBC — confirm on call';
    })(),
    '',
    '📊 VALUATION',
    `Stated/GDV: ${formatCurrency(value)}`,
    '',
    '🏦 CHARGES',
    `1st Charge: ${d.first_charge_lender || 'TBC'} (${formatCurrency(d.first_charge_balance)})`,
    `Arrears: ${d.arrears || 'TBC'}${d.arrears_amount ? ` · ${formatCurrency(d.arrears_amount)}` : ''}`,
    `2nd / Other Charges: ${d.second_charges || 'TBC'}${d.second_charge_provider ? ` · ${d.second_charge_provider}` : ''}${d.second_charge_balance ? ` · ${formatCurrency(d.second_charge_balance)}` : ''}`,
    `Additional Security: ${d.additional_security_properties_summary || 'No additional security offered'}`,
    '',
    '💰 LOAN',
    `Requested: ${formatCurrency(requestedAmount)}`,
    `LTV: ${d.estimated_ltv || 'TBC'} ${d.ltv_flag ? `(${d.ltv_flag})` : ''}`,
    product === 'back_to_back' && d.cash_needed_now ? `Cash needed now: ${formatCurrency(d.cash_needed_now)}` : '',
    product === 'development_finance' && d.build_cost_estimate_gbp ? `Build cost: ${formatCurrency(d.build_cost_estimate_gbp)}` : '',
    product === 'development_exit_finance' && d.outstanding_balance_gbp ? `Current lender balance: ${formatCurrency(d.outstanding_balance_gbp)}` : '',
    isSpeed && d.urgency ? `Urgency: ${d.urgency}` : '',
    '',
    '🎯 PURPOSE',
    purpose || 'TBC',
    '',
    '🚪 EXIT',
    d.exit_strategy || 'TBC',
    '',
    `⚡ Status: TRIAGE · Owner: ${ownerName} · Source: ${source}`,
  ].filter(Boolean).join('\n');

  return [
    summary,
    d.additional_info || `Source: ${source}`,
    '',
    d.mobile || '',
    d.email || '',
    first,
    last,
    ownerName,
    'TRIAGE',
    'FALSE',
    productLabel,
    'Callback — qualify and confirm lender route',
    '', '', '', '',
    '',
    requestedAmount || '',
    '',
    ref,
    value || '',
    d.first_charge_lender || '',
    d.first_charge_balance || '',
    d.clean_first_charge_balance || '',
    d.arrears_amount || '',
    d.second_charge_provider || '',
    d.second_charge_balance || '',
    d.additional_security_properties_summary || '',
    '',
    d.additional_info || '',
  ];
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

async function ensureSheetHasRow(sheets, tabName, rowNumber) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))',
  });
  const sheet = (meta.data.sheets || []).find(s => s.properties?.title === tabName);
  if (!sheet) throw new Error(`Sheet not found: ${tabName}`);
  const currentRows = sheet.properties?.gridProperties?.rowCount || 0;
  if (currentRows >= rowNumber) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        appendDimension: {
          sheetId: sheet.properties.sheetId,
          dimension: 'ROWS',
          length: rowNumber - currentRows,
        },
      }],
    },
  });
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
  await ensureSheetHasRow(sheets, tabName, nextRow);
  const endCol = columnName(row.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A${nextRow}:${endCol}${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return nextRow;
}


function formatCaseTimelineRow(d, ts, product, tabName, leadRowNumber, pipelineRowNumber, scorecardUrl) {
  const first = d.first_name || '';
  const last = d.last_name || '';
  const name = `${first} ${last}`.trim() || d.borrower_full_name || 'New lead';
  const ref = d.deal_ref || '';
  const productLabel = String(product || '').replace(/_/g, ' ') || 'secured enquiry';
  const security = d.property_address || d.security_address_full || d.site_address || 'TBC';
  const nextAction = product === 'equitable_charges'
    ? 'Call now — qualify Cavendish/equitable charge route'
    : 'Callback — qualify route, confirm missing facts, then open LOR/LAR base file';
  const summary = [
    `Tier 1/Get Your Options submission captured`,
    `Borrower: ${name}`,
    ref ? `Ref: ${ref}` : '',
    `Product/source: ${productLabel}`,
    `Security: ${security}`,
    `Loan: ${d.loan_amount || d.loan_needed || d.loan_required_net || d.full_loan_required || 'TBC'}`,
    `Purpose: ${d.loan_purpose || d.purpose_of_funds || d.purpose_category || 'TBC'}`,
    `Exit: ${d.exit_strategy || d.exit_type || 'TBC'}`,
    d.prefill_case_ref ? `Click-roll case ref: ${d.prefill_case_ref}` : '',
    d.source_channel ? `Attributed source: ${d.source_channel}` : '',
    d.prefill_note ? `What borrower was shown: ${d.prefill_note}` : '',
    scorecardUrl ? `Scorecard: ${scorecardUrl}` : '',
  ].filter(Boolean).join('\n');
  return [
    ts,                         // Timestamp
    ref,                        // Case Ref
    name,                       // Borrower / Entity
    'Website Tier 1 Form',      // Channel
    'INBOUND_CAPTURE',          // Event Type
    'Website',                  // Actor
    'System capture',           // Direction
    summary,                    // Summary / Notes
    nextAction,                 // Next Action
    'OPEN',                     // Status
    tabName,                    // Source Tab
    leadRowNumber || '',        // Source Row
    pipelineRowNumber || '',    // Pipeline Row
    scorecardUrl || '',         // Link
    JSON.stringify({ product, leadRowNumber, pipelineRowNumber }),
  ];
}

function formatBackToBackRow(d, ts) {
  return [
    ts, d.deal_ref||'', 'NEW',
    d.first_name||'', d.last_name||'', d.mobile||'', d.email||'',
    d.property_address||'', d.residential_address || d.home_address || d.property_address || '', d.postcode||'', d.property_value||'',
    d.first_charge_lender||'', d.first_charge_balance||'',
    d.second_charges||'', d.tenure||'',
    d.cash_needed_now||'', d.full_loan_required||'',
    d.exit_strategy||'',
    d.legal_buffer||'', d.overrun_buffer||'',
    d.charge_request||'',
    d.page_source||'back-to-back', ts,
    [d.purpose_of_funds, d.urgency, d.additional_info].filter(Boolean).join(' | '),
    d.page_source||'back-to-back', ts,
  ];
}

function formatTradeFinanceRow(d, ts) {
  return [
    ts, d.deal_ref||'', 'NEW',
    d.first_name||'', d.last_name||'', d.mobile||'', d.email||'',
    d.company_name||'', d.company_number||'',
    d.annual_turnover||'', d.trade_type||'',
    d.countries_involved||'', d.transaction_value||'',
    d.instrument_required||'', d.existing_trade_finance||'',
    d.banking_relationship||'', d.purpose||'', d.timescale||'',
    d.additional_info||'', d.page_source||'trade-finance', ts,
  ];
}

function explicitBrokerOwner(d) {
  if (ownerNameFromData(d) === 'Chris') return { name: 'Chris', tab: 'CHRIS CALLS', chatId: '8634157536' };
  return { name: 'Byron', tab: 'BYRON CALLS', chatId: '1750758657' };
}

function genericProductLabel(product) {
  return product === 'speed_loan' || product === 'equitable_charges' ? 'Speed Loan'
    : product === 'acquisition_finance' ? 'Acquisition Finance'
    : product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb' ? 'Main Loan'
    : product === 'back_to_back' ? 'Back-to-Back'
    : product === 'development_finance' ? 'Development Finance'
    : product === 'development_exit_finance' ? 'Dev Exit'
    : product === 'trade_finance' ? 'Trade Finance'
    : String(product || 'Website Lead').replace(/_/g, ' ');
}

function formatBrokerCallRow(d, ts, product, pipelineRowNumber, leadRowNumber, tabName) {
  const owner = explicitBrokerOwner(d);
  const first = d.first_name || '';
  const last = d.last_name || '';
  const name = `${first} ${last}`.trim() || `New ${genericProductLabel(product)} Lead`;
  const sourceRow = pipelineRowNumber ? `PIPELINE:${pipelineRowNumber}` : `${tabName}:${leadRowNumber || ''}`;
  const ref = d.deal_ref || '';
  const property = d.property_address || d.site_address || 'TBC';
  const loan = d.loan_amount || d.loan_needed || d.full_loan_required || d.loan_size_gbp || 'TBC';
  const summary = [
    `NEW ${genericProductLabel(product).toUpperCase()} WEBSITE LEAD — ${name}`,
    ref ? `Ref: ${ref}` : '',
    `Owner: ${owner.name}`,
    `Source: ${d.page_source || genericProductLabel(product) + ' form'}`,
    `Security: ${property}`,
    `Home: ${d.residential_address || d.home_address || 'TBC'}`,
    `Loan: ${formatCurrency(loan)}`,
    `Purpose: ${d.purpose_of_funds || d.loan_purpose || 'TBC'}`,
    `Exit: ${d.exit_strategy || 'TBC'}`,
    `LTV: ${d.estimated_ltv || 'TBC'} ${d.ltv_flag ? '(' + d.ltv_flag + ')' : ''}`,
    '',
    'Call goal: qualify borrower, confirm charge stack, address/value, purpose, exit, timescale and lender route.'
  ].filter(Boolean).join('\n');
  return { tab: owner.tab, row: [
    ts.slice(0,10), 'P1 — CALL NOW', name, d.mobile || '', 'Call', d.email || '', genericProductLabel(product),
    sourceRow, summary, '', '', 'Call now — qualify and confirm lender route', '',
    ref ? `OPEN LOR — ${name}` : '', ref ? `Canonical LOR JSON — ${name}` : '',
    '', '', '', '', '', '', '', '', '', 'FALSE', owner.name
  ]};
}

function formatEquitableCallRow(d, ts, pipelineRowNumber, leadRowNumber) {
  const owner = explicitBrokerOwner(d);
  const first = d.first_name || '';
  const last = d.last_name || '';
  const name = `${first} ${last}`.trim() || 'New Equitable Charge Lead';
  const sourceRow = pipelineRowNumber ? `PIPELINE:${pipelineRowNumber}` : `Speed Loan Leads:${leadRowNumber || ''}`;
  const ref = d.deal_ref || '';
  const property = d.property_address || d.site_address || 'TBC';
  const loan = d.loan_amount || d.loan_needed || 'TBC';
  const tomSummary = [
    `NEW EQUITABLE CHARGE LEAD — ${name}`,
    ref ? `Ref: ${ref}` : '',
    `Source: website Equitable Charges form`,
    `Security: ${property}`,
    `Home: ${d.residential_address || d.home_address || 'TBC'}`,
    `Security is home: ${d.security_is_home_address || d.securityIsHome || 'TBC'}`,
    `Loan: ${formatCurrency(loan)}`,
    `Purpose: ${d.purpose_of_funds || d.loan_purpose || 'TBC'}`,
    `Exit: ${d.exit_strategy || 'TBC'}`,
    `Consent issue: ${d.consent_issue || 'TBC'}`,
    '',
    'Call goal: confirm full address, value, first-charge balance/lender, business/unregulated purpose, consent issue, exit/refi route, and whether Cavendish equitable charge is suitable.'
  ].filter(Boolean).join('\n');
  return {
    tab: owner.tab,
    row: [
      ts.slice(0,10),
      'P1 — CALL NOW',
      name,
      d.mobile || '',
      'Call',
      d.email || '',
      'Equitable Charges',
      sourceRow,
      tomSummary,
      '',
      '',
      'Call now — qualify Cavendish equitable charge route',
      '',
      ref ? `OPEN LOR — ${name}` : '',
      ref ? `Canonical LOR JSON — ${name}` : '',
      '', '', '', '', '', '', '', '', '', 'FALSE', owner.name
    ]
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const body = req.body;
    const { product, ...data } = body;

    const tabName = TAB_MAP[product];
    if (!tabName) {
      res.status(400).json({ error: `Unknown product: ${product}` }); return;
    }

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const formatters = {
      development_finance:      formatDevFinanceRow,
      development_exit_finance: formatDevExitRow,
      speed_loan:               formatSpeedLoanRow,
      equitable_charges:        formatSpeedLoanRow,
      main_loan:                formatMainLoanRow,
      bank_bridge:              formatMainLoanRow,
      purchase_refurb:          formatMainLoanRow,
      acquisition_finance:      formatMainLoanRow,
      back_to_back:             formatBackToBackRow,
      trade_finance:            formatTradeFinanceRow,
    };
    const formatter = formatters[product] || formatSpeedLoanRow;
    const row = formatter(data, ts);
    const pipelineRow = formatPipelineRow(data, ts, product);

    // Healthcheck-safe path: validate product mapping and row formatting without
    // writing fake leads to Google Sheets. Used by Tom's scheduled page checks.
    if (data.dry_run === true || data.dry_run === 'true') {
      res.status(200).json({
        ok: true,
        dryRun: true,
        product,
        tab: tabName,
        rowColumns: row.length,
        pipeline: !!pipelineRow,
        pipelineColumns: pipelineRow ? pipelineRow.length : 0,
      }); return;
    }

    // Auth via service account JSON stored in Vercel env
    const saB64 = process.env.GOOGLE_SA_B64;
    if (!saB64) {
      console.error('[Lead API] GOOGLE_SA_B64 not set');
      res.status(500).json({ error: 'Server misconfiguration' }); return;
    }
    const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const leadRowNumber = await appendRowAtFirstEmpty(sheets, tabName, row);

    let pipelineRowNumber = null;
    if (pipelineRow) {
      pipelineRowNumber = await appendRowAtFirstEmpty(sheets, 'PIPELINE', pipelineRow);
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `'PIPELINE'!BH${pipelineRowNumber}:BI${pipelineRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              data.property_address || data.site_address || '',
              data.residential_address || data.home_address || data.property_address || data.site_address || '',
            ]],
          },
        });
      } catch (e) { console.warn('[Lead API] Pipeline address detail write failed:', e.message); }
    }

    // ── Scorecard URL ──────────────────────────────────────────────────
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://posfincapital.com';
    const scorecardUrl = data.deal_ref ? `${BASE_URL}/api/scorecard?ref=${encodeURIComponent(data.deal_ref)}` : null;

    // ── Save scorecard URL back to PIPELINE row (col AQ = 43) ─────────
    if (scorecardUrl && pipelineRowNumber) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `'PIPELINE'!AQ${pipelineRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[`=HYPERLINK("${scorecardUrl}","View Scorecard")`]] },
        });
      } catch (e) { console.warn('[Lead API] Scorecard URL write failed:', e.message); }
    }


    // ── Case_Timeline row (mandatory touch log) ───────────────────────
    let timelineRowNumber = null;
    try {
      const timelineRow = formatCaseTimelineRow(data, ts, product, tabName, leadRowNumber, pipelineRowNumber, scorecardUrl);
      timelineRowNumber = await appendRowAtFirstEmpty(sheets, 'Case_Timeline', timelineRow);
    } catch (e) { console.warn('[Lead API] Case_Timeline write failed:', e.message); }

    // ── Owner CALLS queue ─────────────────────────────────────────────
    let callSheetRowNumber = null;
    let callSheetTab = null;
    const owner = explicitBrokerOwner(data);
    let rawLeadRowNumber = null;
    try {
      rawLeadRowNumber = await markRawLeadAssignedIfMatched(sheets, data, owner.name, data.deal_ref, pipelineRowNumber);
    } catch (e) { console.warn('[Lead API] Raw Leads owner stamp failed:', e.message); }
    const suppressCalls = data.suppress_calls === true || data.suppress_calls === 'true'
      || data.partial_route_check === true || data.partial_route_check === 'true'
      || data.route_check_stage === 'router_initial'
      || data.page_source === 'apply-intelligent-router';
    if (!suppressCalls && (product === 'equitable_charges' || (hasExplicitOwnerTag(data) && (owner.name === 'Chris' || owner.name === 'Byron')))) {
      try {
        const call = product === 'equitable_charges'
          ? formatEquitableCallRow(data, ts, pipelineRowNumber, leadRowNumber)
          : formatBrokerCallRow(data, ts, product, pipelineRowNumber, leadRowNumber, tabName);
        callSheetTab = call.tab;
        callSheetRowNumber = await appendRowAtFirstEmpty(sheets, callSheetTab, call.row);
      } catch (e) { console.warn('[Lead API] call sheet write failed:', e.message); }
    }

    // ── Telegram broker alert ──────────────────────────────────────────
    const TELE_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const isMain = ['main_loan', 'bank_bridge', 'purchase_refurb', 'acquisition_finance', 'equitable_charges', 'development_finance', 'development_exit_finance'].includes(product);
    const brokerName = owner.name;

    if (TELE_TOKEN && data.deal_ref) {
      const productLabel = pipelineRow ? pipelineRow[11] : product.replace(/_/g,' ');
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      const msg = [
        `🦅 *New ${productLabel} Lead*`,
        ``,
        `*Owner:* ${brokerName}`,
        `*Ref:* ${data.deal_ref}`,
        `*Name:* ${name}`,
        `*Mobile:* ${data.mobile || 'TBC'}`,
        `*Email:* ${data.email || 'TBC'}`,
        `*Property:* ${data.property_address || data.site_address || 'TBC'}`,
        `*Loan:* ${data.loan_amount || data.loan_needed || data.full_loan_required || 'TBC'}`,
        `*LTV:* ${data.estimated_ltv || 'TBC'} ${data.ltv_flag ? '(' + data.ltv_flag + ')' : ''}`,
        `*Exit:* ${data.exit_strategy || 'TBC'}`,
        scorecardUrl ? `\n[📊 View Scorecard](${scorecardUrl})` : '',
      ].filter(Boolean).join('\n');

      const recipients = [...new Set([owner.chatId, '1750758657', '8634157536'])];
      Promise.all(recipients.map((chatId) => fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown', disable_web_page_preview: false }),
      }))).catch(e => console.warn('[Lead API] Telegram failed:', e.message));
    }

    if (data.prefill_token) {
      try {
        const prefillRows = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'Prefill_Tokens'!A:M` });
        const rows = prefillRows.data.values || [];
        const idx = rows.findIndex((r, i) => i > 0 && r[0] === data.prefill_token);
        if (idx > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `'Prefill_Tokens'!M${idx + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[new Date().toISOString()]] },
          });
        }
      } catch (e) { console.warn('[Lead API] Prefill token submit stamp failed:', e.message); }
    }

    console.log(`[Lead API] ${data.deal_ref} → ${tabName} | Scorecard: ${scorecardUrl}`);
    res.status(200).json({ ok: true, leadRef: data.deal_ref, tab: tabName, row: leadRowNumber, pipeline: !!pipelineRow, pipelineRow: pipelineRowNumber, callSheet: callSheetTab, callSheetRow: callSheetRowNumber, rawLeadRow: rawLeadRowNumber, scorecardUrl, timelineRow: timelineRowNumber }); return;

  } catch (err) {
    console.error('[Lead API Error]', err);
    res.status(500).json({ error: err.message }); return;
  }
}

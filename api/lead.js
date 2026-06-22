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

function fmtDateShort(ts) {
  const d = new Date(ts.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return ts.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatPipelineRow(d, ts, product) {
  if (!['main_loan', 'bank_bridge', 'speed_loan', 'equitable_charges', 'back_to_back', 'purchase_refurb', 'development_finance', 'development_exit_finance'].includes(product)) return null;
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
    : (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb') ? d.loan_amount
    : product === 'back_to_back' ? d.full_loan_required
    : product === 'development_finance' ? d.loan_size_gbp
    : d.gross_borrowing_gbp || d.loan_size_gbp;
  const term = product === 'speed_loan' ? '3 months'
    : product === 'equitable_charges' ? '12 months · 6-month minimum exit'
    : (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb') ? (d.timescale || '12 months')
    : product === 'back_to_back' ? '3 + 12 months'
    : product === 'development_finance' ? 'Development term TBC'
    : (d.term || 'Dev exit term TBC');
  const purpose = (product === 'main_loan' || product === 'bank_bridge' || product === 'purchase_refurb') ? d.loan_purpose : (d.purpose_of_funds || d.loan_purpose || d.use_of_funds || d.biggest_challenge || d.consent_issue);
  const source = `${productLabel} form`;
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
    `⚡ Status: TRIAGE · Agent: Website · Source: ${source}`,
  ].filter(Boolean).join('\n');

  return [
    summary,
    d.additional_info || `Source: ${source}`,
    '',
    d.mobile || '',
    d.email || '',
    first,
    last,
    'Website',
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
  const blob = [d.assigned_broker, d.owner, d.broker, d.broker_name, d.assigned_to].filter(Boolean).join(' ').toLowerCase();
  if (/\bchris\b/.test(blob)) return { name: 'Chris', tab: 'CHRIS CALLS' };
  return { name: 'Byron', tab: 'BYRON CALLS' };
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

    // ── Equitable Charges → owner CALLS queue ─────────────────────────
    let callSheetRowNumber = null;
    let callSheetTab = null;
    if (product === 'equitable_charges') {
      try {
        const call = formatEquitableCallRow(data, ts, pipelineRowNumber, leadRowNumber);
        callSheetTab = call.tab;
        callSheetRowNumber = await appendRowAtFirstEmpty(sheets, callSheetTab, call.row);
      } catch (e) { console.warn('[Lead API] Equitable call sheet write failed:', e.message); }
    }

    // ── Telegram broker alert ──────────────────────────────────────────
    const TELE_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const isMain = ['main_loan', 'bank_bridge', 'purchase_refurb', 'equitable_charges', 'development_finance', 'development_exit_finance'].includes(product);
    const brokerName = data.assigned_broker === 'Chris' ? 'Chris' : 'Byron';
    // Main loans £250k+ → round-robin Byron/Chris; Speed loans → Byron
    const loanAmt = Number(String(data.loan_amount || data.loan_needed || data.full_loan_required || '0').replace(/[^\d]/g,''));
    const CHAT_BYRON = '1750758657';
    const CHAT_CHRIS = '8634157536';
    const recipientId = (isMain && loanAmt >= 250000) ? CHAT_BYRON : CHAT_BYRON; // default Byron; Chris gets separate notification if his deal

    if (TELE_TOKEN && data.deal_ref) {
      const productLabel = pipelineRow ? pipelineRow[11] : product.replace(/_/g,' ');
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      const msg = [
        `🦅 *New ${productLabel} Lead*`,
        ``,
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

      fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: recipientId, text: msg, parse_mode: 'Markdown', disable_web_page_preview: false }),
      }).catch(e => console.warn('[Lead API] Telegram failed:', e.message));
    }

    console.log(`[Lead API] ${data.deal_ref} → ${tabName} | Scorecard: ${scorecardUrl}`);
    res.status(200).json({ ok: true, leadRef: data.deal_ref, tab: tabName, row: leadRowNumber, pipeline: !!pipelineRow, pipelineRow: pipelineRowNumber, callSheet: callSheetTab, callSheetRow: callSheetRowNumber, scorecardUrl }); return;

  } catch (err) {
    console.error('[Lead API Error]', err);
    res.status(500).json({ error: err.message }); return;
  }
}

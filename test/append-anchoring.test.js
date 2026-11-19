/**
 * Append anchoring regression — staging acceptance blocker at 1224843.
 *
 * Observed on the staging sheet: values.append(range 'Raw Leads'!A:AF) wrote
 * the new row starting at AC (index 28) and 'Clean' A:AF at AE (index 30),
 * because Sheets' table detection picked a right-hand block of the header row
 * (blank / isolated header cells). Lead Ref then sat outside the A:AF read
 * range, so resume appended again and scorecard / event lookups 404'd.
 *
 * The model below reproduces that observation for values.append and models
 * AppendCellsRequest as documented ("after the last row with data in a sheet",
 * rows start at column A). Headers mirror staging: Raw A1 is a single space,
 * isolated header at index 28, blanks around it; Clean has 'Important' and an
 * explanatory note at index 30/31. Reads behave like values.get: FORMATTED
 * strings, trailing empty cells and rows trimmed.
 *
 * Run: node --test test/append-anchoring.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');
const { RAW, CLEAN, saveIntake, readCase, recordClick, markAlertSent, unpack } = await import('../lib/clean-intake.js');

const SHEET = 'staging-model-sheet';
const AF = 31; // last column index read by A:AF

// ── Staging-shaped headers ───────────────────────────────────────────
const RAW_HEADERS = Array(36).fill('');
Object.assign(RAW_HEADERS, {
  0: ' ', 1: 'Name', 2: 'Phone', 3: 'Email', 4: 'Source', 5: 'Product', 6: 'Lead Stage', 7: '👣 Lead Touch / Progress',
  8: 'Owner', 9: 'Tom Summary', 10: 'Next Action', 11: 'Call Outcome', 12: 'Follow Up', 13: 'Priority', 14: 'Lead Ref',
  15: 'Loan', 16: 'Value', 17: 'LTV', 18: 'Exit', 19: 'Purpose', 20: 'Security', 21: 'First Charge', 22: 'Second Charge',
  23: 'Arrears', 24: 'Broker', 25: 'Introducer', 26: 'Notes',
  // 27 blank; isolated header at 28; 29–31 blank (inside A:AF); stray cell beyond AF
  28: 'Legacy Import', 34: 'Archive note',
});
const CLEAN_NAMES = ['👤 Borrower', '🚦 Status ▼', '🔖 Case ID', '📊 Scorecard link', '📞 Mobile / WhatsApp', '📧 Email', 'Router completed Y/N', '🏠 Security address', '📊 Stated value', '💷 Net req', '🏦 1st charge provider', '💸 1st charge £', '🚨 Arrears Y/N', '🚨 Arrears £', '🏦 2nd charge lender', '💸 2nd charge £', '🔁 Mandatory redemptions', '🧑‍💼 Sales owner ▼', '🎯 Next action', '❓ Missing/open items', '⚡ Route', 'Lender', 'Valuation', 'Legals', 'Offer', 'Completion', 'Fees', 'Comments', 'Last touched'];
const CLEAN_HEADERS = [...CLEAN_NAMES, '', 'Important', 'Explanatory note: Status drives the board; do not reorder columns'];
assert.equal(CLEAN_HEADERS.indexOf('Important'), 30);

// ── Sheets model ─────────────────────────────────────────────────────
let grid, calls;
const empty = v => v === undefined || v === null || v === '';
const colNum = l => [...l].reduce((c, ch) => c * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const tabOf = r => r.match(/^'([^']+)'/)[1];
const lastDataRow = rows => { for (let i = rows.length - 1; i >= 0; i--) if ((rows[i] || []).some(v => !empty(v))) return i; return -1; };

function reset(rawRows = [], cleanRows = []) {
  calls = [];
  grid = { [RAW]: [RAW_HEADERS.slice(), ...rawRows], [CLEAN]: [CLEAN_HEADERS.slice(), ...cleanRows] };
}

// Table detection as observed on staging: within the range's columns, the
// header row splits into contiguous non-empty blocks and the right-most block
// is the table; append goes below its last data row from its first column.
function detectTable(rows, c0, c1) {
  const header = rows[0] || [];
  let start = -1;
  for (let c = c0; c <= c1; c++) if (!empty(header[c]) && (c === c0 || empty(header[c - 1]))) start = c;
  if (start < 0) start = c0;
  let end = start; while (end + 1 <= c1 && !empty(header[end + 1])) end++;
  let last = 0; rows.forEach((r, i) => { for (let c = start; c <= end; c++) if (!empty(r?.[c])) last = i; });
  return { col: start, row: last + 1 };
}

const sheets = {
  spreadsheets: {
    async get() { calls.push('get'); return { data: { sheets: Object.keys(grid).map((title, sheetId) => ({ properties: { sheetId, title } })) } }; },
    async batchUpdate({ requestBody }) {
      calls.push('batchUpdate');
      for (const { appendCells } of requestBody.requests) {
        assert.equal(appendCells.fields, 'userEnteredValue');
        const rows = grid[Object.keys(grid)[appendCells.sheetId]];
        let at = lastDataRow(rows) + 1;
        for (const r of appendCells.rows) {
          rows[at++] = r.values.map(c => { const v = c.userEnteredValue; return v ? (v.stringValue ?? v.numberValue ?? v.boolValue) : ''; });
        }
      }
      return { data: {} };
    },
    values: {
      async get({ range }) {
        calls.push('values.get');
        const m = range.match(/!([A-Z]+)(?:\d*):([A-Z]+)/);
        const c1 = m ? colNum(m[2]) : AF;
        const rows = grid[tabOf(range)].slice(0, lastDataRow(grid[tabOf(range)]) + 1).map(r => {
          const out = (r || []).slice(0, c1 + 1).map(v => empty(v) ? '' : String(v));
          while (out.length && out[out.length - 1] === '') out.pop();
          return out;
        });
        return { data: { values: rows } };
      },
      async append({ range, requestBody }) {
        calls.push('values.append');
        const tab = tabOf(range);
        const m = range.match(/!([A-Z]+)\d*(?::([A-Z]+)\d*)?$/);
        const c0 = colNum(m[1]), c1 = m[2] ? colNum(m[2]) : c0;
        const { col, row } = detectTable(grid[tab], c0, c1);
        for (const [k, values] of requestBody.values.entries()) {
          const r = []; values.forEach((v, i) => { r[col + i] = v; });
          grid[tab].splice(row + k, 0, r);
        }
        return { data: { updates: { updatedRange: `'${tab}'!X${row + 1}` } } };
      },
      async batchUpdate({ requestBody }) {
        calls.push('values.batchUpdate');
        for (const d of requestBody.data) {
          const [, tab, l, n] = d.range.match(/^'([^']+)'!([A-Z]+)(\d+)$/);
          (grid[tab][Number(n) - 1] ||= [])[colNum(l)] = d.values[0][0];
        }
        return { data: {} };
      },
    },
  },
};

// ── Fixtures ─────────────────────────────────────────────────────────
const rawRow = cells => { const r = []; for (const [h, v] of Object.entries(cells)) r[RAW_HEADERS.indexOf(h)] = v; return r; };
const EXISTING_RAW = [
  rawRow({ ' ': '2026-01-01', Name: 'Earlier Lead', 'Lead Ref': 'POSFIN-OLD-1' }),
  rawRow({ Name: 'No timestamp (gap in column A)', 'Lead Ref': 'POSFIN-OLD-2' }),
  // A row mis-anchored by the old writer: data starts at index 28.
  Object.assign([], { 28: '2026-10-22T10:00:00Z', 29: 'Misaligned Synthetic', 42: 'POSFIN-SYNTH-OLD' }),
];
const submission = (ref, extra = {}) => ({
  deal_ref: ref, first_name: 'Ada', last_name: 'Anchor', mobile: '07700900123', email: 'ada.anchor@example.com',
  property_address: '1 Anchor Street, London', property_value: 600000, loan_amount: 200000,
  first_charge_lender: 'TestBank', first_charge_balance: 100000, first_charge_arrears_amount: 0,
  second_charge_present: 'no', second_charge_balance: 0, exit_strategy: 'Refinance', loan_purpose: 'Business', ...extra,
});
const at = (tab, row, header) => grid[tab][row - 1]?.[(tab === RAW ? RAW_HEADERS : CLEAN_HEADERS).indexOf(header)];

beforeEach(() => reset(EXISTING_RAW.map(r => r.slice())));

describe('model reproduces the staging observation for values.append(A:AF)', () => {
  it('Raw A:AF anchors at index 28 and Clean A:AF at index 30', async () => {
    await sheets.spreadsheets.values.append({ range: `'${RAW}'!A:AF`, requestBody: { values: [['ts', 'Name']] } });
    await sheets.spreadsheets.values.append({ range: `'${CLEAN}'!A:AF`, requestBody: { values: [['Borrower', 'Status']] } });
    const raw = grid[RAW].find(r => r?.includes('ts'));
    const clean = grid[CLEAN].find(r => r?.includes('Borrower'));
    assert.equal(raw.indexOf('ts'), 28);
    assert.equal(raw.indexOf('Name'), 29);
    assert.equal(clean.indexOf('Borrower'), 30);
    assert.equal(clean.indexOf('Status'), 31);
  });

  it('a narrow A:A range is still table detection: a gap in column A lands the row mid-sheet', async () => {
    await sheets.spreadsheets.values.append({ range: `'${RAW}'!A:A`, requestBody: { values: [['ts']] } });
    const idx = grid[RAW].findIndex(r => r?.[0] === 'ts');
    assert.ok(idx < lastDataRow(grid[RAW]), 'inserted above existing rows, not at the end');
  });
});

describe('saveIntake on staging-shaped tabs: every new row starts at column A', () => {
  it('Raw and Clean rows align to headers by name; nothing written via values.append', async () => {
    const r = await saveIntake(sheets, SHEET, submission('POSFIN-ANCHOR-0001'), 'main_loan', 'https://example.test/sc', () => true);
    assert.equal(calls.includes('values.append'), false);

    const rawN = r.rawLeadRow;
    assert.equal(rawN, EXISTING_RAW.length + 2, 'appended after the last row with any data, incl. the misaligned one');
    assert.ok(String(at(RAW, rawN, ' ')).match(/^\d{4}-\d\d-\d\dT/), 'timestamp under the single-space A1 header');
    assert.equal(at(RAW, rawN, 'Name'), 'Ada Anchor');
    assert.equal(at(RAW, rawN, 'Phone'), '447700900123');
    assert.equal(at(RAW, rawN, 'Email'), 'ada.anchor@example.com');
    assert.equal(at(RAW, rawN, 'Lead Ref'), 'POSFIN-ANCHOR-0001');
    assert.equal(at(RAW, rawN, 'Lead Stage'), 'NEW — FACT FIND');
    assert.equal(unpack(at(RAW, rawN, 'Tom Summary')).answers.deal_ref, 'POSFIN-ANCHOR-0001');
    const raw = grid[RAW][rawN - 1];
    for (const c of [27, 28, 29, 30, 31, 34]) assert.ok(empty(raw[c]), `blank/isolated header column ${c} untouched`);

    const cleanN = r.pipelineRow;
    assert.equal(cleanN, 2);
    assert.equal(at(CLEAN, 2, '👤 Borrower'), 'Ada Anchor');
    assert.equal(at(CLEAN, 2, '🔖 Case ID'), 'POSFIN-ANCHOR-0001');
    assert.equal(at(CLEAN, 2, '📊 Scorecard link'), 'https://example.test/sc');
    assert.equal(at(CLEAN, 2, '🚦 Status ▼'), 'TRIAGE');
    assert.equal(at(CLEAN, 2, '📊 Stated value'), 600000, 'numbers stay numbers (RAW semantics)');
    assert.ok(empty(grid[CLEAN][1][30]) && empty(grid[CLEAN][1][31]), 'Important / note columns untouched');
  });

  it('resume updates the same row in place (no second append); readCase, recordClick, markAlertSent find it', async () => {
    const ref = 'POSFIN-ANCHOR-0002';
    const first = await saveIntake(sheets, SHEET, submission(ref, { route_check_stage: 'progress', progress_step: 2 }), 'main_loan', 'u', () => true);
    const rows = grid[RAW].length;
    const second = await saveIntake(sheets, SHEET, submission(ref), 'main_loan', 'u', () => true);
    assert.equal(second.rawLeadRow, first.rawLeadRow);
    assert.equal(grid[RAW].length, rows, 'no extra Raw row on resume');
    assert.equal(grid[RAW].filter(r => r?.[RAW_HEADERS.indexOf('Lead Ref')] === ref).length, 1);

    const hit = await readCase(sheets, SHEET, ref);
    assert.equal(hit.i + 2, first.rawLeadRow);
    assert.equal(hit.state.completed, true);
    assert.equal(await recordClick(sheets, SHEET, ref), true);
    assert.equal(await markAlertSent(sheets, SHEET, ref), true);
    assert.equal(grid[RAW].length, rows, 'click / alert update in place');
    const state = unpack(at(RAW, first.rawLeadRow, 'Tom Summary'));
    assert.ok(state.answers.whatsapp_cta_clicked_at && state.broker_alert_sent);
    assert.equal(grid[CLEAN].filter(r => r?.[CLEAN_HEADERS.indexOf('🔖 Case ID')] === ref).length, 1, 'one Clean row');
  });

  it('cross-instance duplicate appends still merge into the earliest aligned row', async () => {
    const ref = 'POSFIN-ANCHOR-0003';
    const a = await import(`../lib/clean-intake.js?anchor=a`);
    const b = await import(`../lib/clean-intake.js?anchor=b`);
    const [ra, rb] = await Promise.all([
      a.saveIntake(sheets, SHEET, submission(ref, { first_name: 'A' }), 'main_loan', 'u', () => true),
      b.saveIntake(sheets, SHEET, submission(ref, { first_name: 'B' }), 'main_loan', 'u', () => true),
    ]);
    const refCol = RAW_HEADERS.indexOf('Lead Ref'), stageCol = RAW_HEADERS.indexOf('Lead Stage');
    const mine = grid[RAW].map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => r?.[refCol] === ref);
    const live = mine.filter(({ r }) => !String(r[stageCol]).startsWith('DUPLICATE-MERGED'));
    assert.equal(live.length, 1, 'exactly one canonical row');
    assert.ok(mine.every(({ r }) => /^\d{4}-/.test(r[0])), 'every row, including the duplicate, starts at column A');
    assert.ok([ra.rawLeadRow, rb.rawLeadRow].includes(live[0].n));
  });
});

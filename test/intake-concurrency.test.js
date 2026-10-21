/**
 * 20-submission concurrency regression test — Section 0
 *
 * Mocks the Google Sheets API with an in-memory store, then fires 20
 * concurrent saveIntake calls and asserts:
 *   1. No duplicate rows for the same case_ref (cross-instance idempotency)
 *   2. No data loss for distinct case_refs
 *   3. Correct header-name-based column alignment on every row
 *
 * Uses node:test (zero external deps).
 *
 * Run: node --test test/intake-concurrency.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Bootstrap globals that factfind-contract.js expects ──────────────
// Import the config files that set up globalThis.PosfinIntakeConfig etc.
await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');

// Now import the module under test
const { saveIntake, readTable, findRaw, unpack, RAW, CLEAN } = await import('../lib/clean-intake.js');

// ── In-memory Sheets mock ────────────────────────────────────────────

const RAW_HEADERS = [
  'Submitted At', 'Name', 'Phone', 'Email', 'Lead Ref', 'Tom Summary',
  'Lead Stage', '👣 Lead Touch / Progress',
];
const CLEAN_HEADERS = [
  '🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📞 Mobile / WhatsApp',
  '📧 Email', 'Router completed Y/N', '🏠 Security address', '📊 Stated value',
  '💷 Net req', '🏦 1st charge provider', '💸 1st charge £',
  '🚨 Arrears Y/N', '🚨 Arrears £', '🏦 2nd charge lender', '💸 2nd charge £',
  '🔁 Mandatory redemptions', '🚦 Status ▼', '🧑‍💼 Sales owner ▼',
  '🎯 Next action', '❓ Missing/open items', '⚡ Route',
];

function createMockSheets() {
  // In-memory storage: tab name → array of row arrays
  const tabs = {
    [RAW]: [RAW_HEADERS],
    [CLEAN]: [CLEAN_HEADERS],
  };

  // Configurable artificial delay (ms) to simulate network latency and expose races
  let writeDelay = 0;

  function delay(ms) {
    return ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve();
  }

  const sheets = {
    _tabs: tabs,
    _setWriteDelay(ms) { writeDelay = ms; },
    spreadsheets: {
      values: {
        async get({ spreadsheetId, range }) {
          const tabMatch = range.match(/^'([^']+)'/);
          const tab = tabMatch ? tabMatch[1] : range;
          const rows = tabs[tab] || [];
          return { data: { values: rows.map(r => [...r]) } };
        },
        async append({ spreadsheetId, range, requestBody }) {
          const tabMatch = range.match(/^'([^']+)'/);
          const tab = tabMatch ? tabMatch[1] : range;
          if (!tabs[tab]) tabs[tab] = [];
          await delay(writeDelay);
          const rowNum = tabs[tab].length + 1;
          for (const row of requestBody.values) {
            tabs[tab].push([...row]);
          }
          const endRow = tabs[tab].length;
          return {
            data: {
              updates: {
                updatedRange: `'${tab}'!A${rowNum}:AF${endRow}`,
              },
            },
          };
        },
        async update({ spreadsheetId, range, requestBody }) {
          const tabMatch = range.match(/^'([^']+)'/);
          const tab = tabMatch ? tabMatch[1] : range;
          const rowMatch = range.match(/!.*?(\d+)/);
          const rowNum = rowMatch ? Number(rowMatch[1]) : null;
          if (!tabs[tab]) tabs[tab] = [];
          await delay(writeDelay);
          if (rowNum !== null && requestBody.values) {
            const idx = rowNum - 1; // 0-indexed
            while (tabs[tab].length <= idx) tabs[tab].push([]);
            const newRow = requestBody.values[0];
            // Merge: update columns that are present in the range
            const headers = tabs[tab][0] || [];
            tabs[tab][idx] = headers.map((_, ci) =>
              ci < newRow.length ? newRow[ci] : (tabs[tab][idx]?.[ci] || '')
            );
          }
          return { data: {} };
        },
        async batchUpdate({ spreadsheetId, requestBody }) {
          await delay(writeDelay);
          for (const d of requestBody.data || []) {
            const tabMatch = d.range.match(/^'([^']+)'/);
            const tab = tabMatch ? tabMatch[1] : '';
            const rowMatch = d.range.match(/(\d+)$/);
            const colMatch = d.range.match(/!([A-Z]+)/);
            if (!tab || !rowMatch || !colMatch) continue;
            const rowNum = Number(rowMatch[1]);
            const colLetter = colMatch[1];
            // Convert column letter to index
            let colIdx = 0;
            for (let i = 0; i < colLetter.length; i++) {
              colIdx = colIdx * 26 + (colLetter.charCodeAt(i) - 64);
            }
            colIdx--; // 0-indexed
            if (!tabs[tab]) tabs[tab] = [];
            while (tabs[tab].length <= rowNum - 1) tabs[tab].push([]);
            const row = tabs[tab][rowNum - 1];
            while (row.length <= colIdx) row.push('');
            row[colIdx] = d.values[0][0];
          }
          return { data: {} };
        },
      },
    },
  };

  return sheets;
}

function makeSubmission(dealRef, idx) {
  return {
    deal_ref: dealRef,
    first_name: `Test${idx}`,
    last_name: `User${idx}`,
    mobile: `0712345${String(idx).padStart(4, '0')}`,
    email: `test${idx}@example.com`,
    property_address: `${idx} Test Street, London`,
    property_value: 500000,
    loan_amount: 250000,
    first_charge_lender: 'TestBank',
    first_charge_balance: 200000,
    first_charge_arrears_amount: 0,
    second_charge_present: 'no',
    second_charge_balance: 0,
    exit_strategy: 'Refinance',
    loan_purpose: 'Property purchase',
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Section 0 — intake column alignment & idempotency', () => {

  it('20 distinct case_refs: no data loss, correct column alignment', async () => {
    const sheets = createMockSheets();
    const sheetId = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = sheetId;

    const submissions = Array.from({ length: 20 }, (_, i) =>
      makeSubmission(`POSFIN-TEST-${String(i).padStart(3, '0')}`, i)
    );

    const results = await Promise.all(
      submissions.map(sub =>
        saveIntake(sheets, sheetId, sub, 'main_loan', 'https://example.com/scorecard', () => true)
      )
    );

    // All should succeed
    for (const r of results) {
      assert.equal(r.ok, true, `Submission failed: ${JSON.stringify(r)}`);
    }

    // Check Raw Leads tab
    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const dataRows = rawTab.slice(1).filter(r => r.some(c => String(c || '').trim()));
    const refIdx = headers.indexOf('Lead Ref');

    // Every submission should have exactly one row
    const refs = dataRows.map(r => r[refIdx]).filter(Boolean);
    assert.equal(refs.length, 20, `Expected 20 rows, got ${refs.length}`);
    const uniqueRefs = new Set(refs);
    assert.equal(uniqueRefs.size, 20, `Expected 20 unique refs, got ${uniqueRefs.size}`);

    // Column alignment: every data row should have values in the correct columns
    const nameIdx = headers.indexOf('Name');
    const phoneIdx = headers.indexOf('Phone');
    const emailIdx = headers.indexOf('Email');
    for (const row of dataRows) {
      const ref = row[refIdx];
      assert.ok(ref, 'Lead Ref should be set');
      assert.ok(row[nameIdx], `Name should be set for ${ref}`);
      assert.ok(row[phoneIdx], `Phone should be set for ${ref}`);
      assert.ok(row[emailIdx], `Email should be set for ${ref}`);
      // Tom Summary should contain packed state
      const summaryIdx = headers.indexOf('Tom Summary');
      const state = unpack(row[summaryIdx] || '');
      assert.ok(state, `Tom Summary should contain packed state for ${ref}`);
      assert.equal(state.answers.deal_ref, ref, `Packed deal_ref should match for ${ref}`);
    }
  });

  it('20 identical case_refs: exactly 1 row survives (dedup)', async () => {
    const sheets = createMockSheets();
    // Add artificial delay to expose race conditions
    sheets._setWriteDelay(5);
    const sheetId = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = sheetId;

    const submissions = Array.from({ length: 20 }, (_, i) =>
      makeSubmission('POSFIN-RACE-SINGLE', i)
    );

    const results = await Promise.allSettled(
      submissions.map(sub =>
        saveIntake(sheets, sheetId, sub, 'main_loan', 'https://example.com/scorecard', () => true)
      )
    );

    const successes = results.filter(r => r.status === 'fulfilled');
    assert.ok(successes.length >= 1, 'At least one submission should succeed');

    // Check Raw Leads: only 1 non-blank row with this ref
    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const refIdx = headers.indexOf('Lead Ref');
    const dataRows = rawTab.slice(1).filter(r => r[refIdx] === 'POSFIN-RACE-SINGLE' && r.some(c => String(c || '').trim()));
    assert.equal(dataRows.length, 1, `Expected exactly 1 surviving row for POSFIN-RACE-SINGLE, got ${dataRows.length}`);

    // The surviving row should have correct alignment
    const row = dataRows[0];
    const nameIdx = headers.indexOf('Name');
    assert.ok(row[nameIdx], 'Surviving row should have Name set');
    const state = unpack(row[headers.indexOf('Tom Summary')] || '');
    assert.ok(state, 'Surviving row should have packed state');
    assert.equal(state.answers.deal_ref, 'POSFIN-RACE-SINGLE');
  });

  it('mixed: 10 unique refs + 10 duplicates of one ref → 11 rows', async () => {
    const sheets = createMockSheets();
    sheets._setWriteDelay(3);
    const sheetId = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = sheetId;

    const unique = Array.from({ length: 10 }, (_, i) =>
      makeSubmission(`POSFIN-MIX-${String(i).padStart(3, '0')}`, i)
    );
    const dupes = Array.from({ length: 10 }, (_, i) =>
      makeSubmission('POSFIN-MIX-DUPE', 100 + i)
    );

    const all = [...unique, ...dupes];
    // Shuffle to simulate real interleaving
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    const results = await Promise.allSettled(
      all.map(sub =>
        saveIntake(sheets, sheetId, sub, 'main_loan', 'https://example.com/scorecard', () => true)
      )
    );

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const refIdx = headers.indexOf('Lead Ref');
    const dataRows = rawTab.slice(1).filter(r => r.some(c => String(c || '').trim()));
    const refs = dataRows.map(r => r[refIdx]).filter(Boolean);

    // 10 unique + 1 deduped = 11 non-blank rows
    assert.equal(refs.length, 11, `Expected 11 rows, got ${refs.length}: ${JSON.stringify(refs)}`);
    const dupeCount = refs.filter(r => r === 'POSFIN-MIX-DUPE').length;
    assert.equal(dupeCount, 1, `Expected 1 POSFIN-MIX-DUPE row, got ${dupeCount}`);
  });

  it('header-name alignment: values land in correct columns regardless of header order', async () => {
    // Use a tab with reordered headers to prove we aren't writing by index
    const reorderedHeaders = [
      'Lead Stage', 'Tom Summary', 'Email', 'Lead Ref', 'Name', 'Phone',
      'Submitted At', '👣 Lead Touch / Progress',
    ];
    const sheets = createMockSheets();
    sheets._tabs[RAW] = [reorderedHeaders];
    const sheetId = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = sheetId;

    const sub = makeSubmission('POSFIN-REORDER-001', 1);
    const result = await saveIntake(
      sheets, sheetId, sub, 'main_loan', 'https://example.com/scorecard', () => true
    );

    assert.equal(result.ok, true);

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const dataRow = rawTab[1];

    // Verify each value is in the correct column position
    assert.equal(dataRow[headers.indexOf('Lead Ref')], 'POSFIN-REORDER-001');
    assert.equal(dataRow[headers.indexOf('Name')], 'Test1 User1');
    assert.ok(dataRow[headers.indexOf('Phone')], 'Phone should be set');
    assert.equal(dataRow[headers.indexOf('Email')], 'test1@example.com');
    assert.equal(dataRow[headers.indexOf('Lead Stage')], 'NEW — FACT FIND');
    assert.ok(unpack(dataRow[headers.indexOf('Tom Summary')]), 'Tom Summary should have packed state');
  });

  it('explicit zero and "no" are stored as values, not null', async () => {
    const sheets = createMockSheets();
    const sheetId = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = sheetId;

    const sub = makeSubmission('POSFIN-ZERO-001', 1);
    sub.first_charge_arrears_amount = 0;
    sub.second_charge_present = 'no';

    const result = await saveIntake(
      sheets, sheetId, sub, 'main_loan', 'https://example.com/scorecard', () => true
    );

    assert.equal(result.ok, true);

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const summaryIdx = headers.indexOf('Tom Summary');
    const state = unpack(rawTab[1][summaryIdx] || '');
    assert.ok(state);

    // Explicit zero must be stored as 0, not null
    assert.strictEqual(state.answers.first_charge_arrears_amount, 0,
      'Explicit 0 must be stored as 0, not null or empty');
    // Explicit "no" must be stored
    assert.strictEqual(state.answers.second_charge_present, 'no',
      'Explicit "no" must be stored as "no", not null or empty');
  });
});

/**
 * 20-submission concurrency regression test — Section 0
 *
 * Tests cross-instance idempotency by using independent module imports
 * (cache-busting query params) that each have their own serialisation queue,
 * sharing the same in-memory mock sheet. This exercises real overlapping
 * reads and appends — not serialised same-instance calls.
 *
 * Uses node:test (zero external deps).
 *
 * Run: node --test test/intake-concurrency.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Bootstrap globals ────────────────────────────────────────────────
await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');

// Primary module import (for readCase, readTable, unpack, findRaw)
const primary = await import('../lib/clean-intake.js');
const { readTable, findRaw, unpack, RAW, CLEAN } = primary;

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
  const tabs = {
    [RAW]: [RAW_HEADERS.slice()],
    [CLEAN]: [CLEAN_HEADERS.slice()],
  };
  let writeDelay = 0;
  const delay = ms => ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve();

  return {
    _tabs: tabs,
    _setWriteDelay(ms) { writeDelay = ms; },
    spreadsheets: {
      values: {
        async get({ range }) {
          const tab = range.match(/^'([^']+)'/)?.[1] || range;
          return { data: { values: (tabs[tab] || []).map(r => [...r]) } };
        },
        async append({ range, requestBody }) {
          const tab = range.match(/^'([^']+)'/)?.[1] || range;
          if (!tabs[tab]) tabs[tab] = [];
          await delay(writeDelay);
          const rowNum = tabs[tab].length + 1;
          for (const row of requestBody.values) tabs[tab].push([...row]);
          return { data: { updates: { updatedRange: `'${tab}'!A${rowNum}:AF${tabs[tab].length}` } } };
        },
        async update({ range, requestBody }) {
          const tab = range.match(/^'([^']+)'/)?.[1] || range;
          const rowNum = Number(range.match(/!.*?(\d+)/)?.[1]);
          if (!tabs[tab]) tabs[tab] = [];
          await delay(writeDelay);
          if (rowNum && requestBody.values) {
            const idx = rowNum - 1;
            while (tabs[tab].length <= idx) tabs[tab].push([]);
            const newRow = requestBody.values[0];
            const headers = tabs[tab][0] || [];
            tabs[tab][idx] = headers.map((_, ci) => ci < newRow.length ? newRow[ci] : (tabs[tab][idx]?.[ci] || ''));
          }
          return { data: {} };
        },
        async batchUpdate({ requestBody }) {
          await delay(writeDelay);
          for (const d of requestBody.data || []) {
            const tab = d.range.match(/^'([^']+)'/)?.[1] || '';
            const rowNum = Number(d.range.match(/(\d+)$/)?.[1]);
            const colLetter = d.range.match(/!([A-Z]+)/)?.[1];
            if (!tab || !rowNum || !colLetter) continue;
            let colIdx = 0;
            for (let i = 0; i < colLetter.length; i++) colIdx = colIdx * 26 + (colLetter.charCodeAt(i) - 64);
            colIdx--;
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
}

function makeSubmission(dealRef, idx, overrides = {}) {
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
    ...overrides,
  };
}

// Get an independent module instance with its own serialisation queue.
// Each cache-busted import gives a fresh tail=Promise.resolve().
let instanceCounter = 0;
async function independentSaveIntake() {
  const mod = await import(`../lib/clean-intake.js?instance=${++instanceCounter}&t=${Date.now()}`);
  return mod.saveIntake;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Section 0 — intake column alignment & idempotency', () => {

  it('20 distinct case_refs: no data loss, correct column alignment', async () => {
    const sheets = createMockSheets();
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;

    // Use independent instances for each submission
    const tasks = [];
    for (let i = 0; i < 20; i++) {
      const save = await independentSaveIntake();
      tasks.push(save(sheets, id, makeSubmission(`POSFIN-TEST-${String(i).padStart(3, '0')}`, i), 'main_loan', 'https://example.com/scorecard', () => true));
    }
    const results = await Promise.all(tasks);

    for (const r of results) assert.equal(r.ok, true);

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const dataRows = rawTab.slice(1).filter(r => r.some(c => String(c || '').trim()));
    const refIdx = headers.indexOf('Lead Ref');

    assert.equal(dataRows.length, 20, `Expected 20 rows, got ${dataRows.length}`);
    const uniqueRefs = new Set(dataRows.map(r => r[refIdx]));
    assert.equal(uniqueRefs.size, 20);

    for (const row of dataRows) {
      assert.ok(row[headers.indexOf('Name')]);
      assert.ok(row[headers.indexOf('Phone')]);
      assert.ok(row[headers.indexOf('Email')]);
      const state = unpack(row[headers.indexOf('Tom Summary')] || '');
      assert.ok(state);
      assert.equal(state.answers.deal_ref, row[refIdx]);
    }
  });

  it('forced overlapping appends: 1 canonical row, extras marked DUPLICATE-MERGED', async () => {
    const sheets = createMockSheets();
    sheets._setWriteDelay(10); // Delay writes to force overlapping reads
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;

    // Launch 5 independent instances concurrently for the same ref
    const saves = await Promise.all(Array.from({ length: 5 }, () => independentSaveIntake()));
    const results = await Promise.allSettled(
      saves.map((save, i) => save(sheets, id, makeSubmission('POSFIN-OVERLAP', i), 'main_loan', 'https://example.com/scorecard', () => true))
    );

    const successes = results.filter(r => r.status === 'fulfilled');
    assert.ok(successes.length >= 1);

    const rawTab = sheets._tabs[RAW];
    const h = rawTab[0];
    const refIdx = h.indexOf('Lead Ref'), stageIdx = h.indexOf('Lead Stage');
    const matching = rawTab.slice(1).filter(r => r[refIdx] === 'POSFIN-OVERLAP');
    const canonical = matching.filter(r => !String(r[stageIdx] || '').startsWith('DUPLICATE-MERGED'));
    assert.equal(canonical.length, 1, `Expected 1 canonical row, got ${canonical.length}`);

    const marked = matching.filter(r => String(r[stageIdx] || '').startsWith('DUPLICATE-MERGED'));
    for (const dup of marked) {
      assert.ok(dup[refIdx], 'Duplicate row Lead Ref preserved');
      assert.match(String(dup[stageIdx]), /DUPLICATE-MERGED → row \d+/);
    }
  });

  it('merge uses updated_at: later timestamp wins, both fields preserved exactly', async () => {
    const sheets = createMockSheets();
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;
    const h = RAW_HEADERS;
    const refIdx = h.indexOf('Lead Ref'), summaryIdx = h.indexOf('Tom Summary'), stageIdx = h.indexOf('Lead Stage');

    // Manually pre-populate two rows simulating a cross-instance race.
    // Row A (row 2): earlier updated_at, has exit_strategy, no loan_purpose
    // Row B (row 3): later updated_at, has loan_purpose, no exit_strategy, arrears=0
    const START = '[POSFIN_FACTFIND_V1]', END = '[/POSFIN_FACTFIND_V1]';
    const stateA = {
      version: 'factfind-v1', updated_at: '2026-10-20T10:00:00.000Z', created_at: '2026-10-20T10:00:00.000Z',
      completed: true, declined: false, no_chase: false, progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: {
        deal_ref: 'POSFIN-MERGE-TS', first_name: 'Alice', last_name: 'Earlier',
        mobile: '07123450001', email: 'alice@example.com',
        property_address: '1 Old Street, London', property_value: 500000, loan_amount: 250000,
        first_charge_lender: 'TestBank', first_charge_balance: 200000,
        first_charge_arrears_amount: 0, second_charge_present: 'no', second_charge_balance: 0,
        exit_strategy: 'Sale of investment', loan_purpose: '',
      },
    };
    const stateB = {
      version: 'factfind-v1', updated_at: '2026-10-20T11:00:00.000Z', created_at: '2026-10-20T11:00:00.000Z',
      completed: true, declined: false, no_chase: false, progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: {
        deal_ref: 'POSFIN-MERGE-TS', first_name: 'Bob', last_name: 'Later',
        mobile: '07123450002', email: 'bob@example.com',
        property_address: '2 New Street, London', property_value: 500000, loan_amount: 250000,
        first_charge_lender: 'TestBank', first_charge_balance: 200000,
        first_charge_arrears_amount: 0, second_charge_present: 'no', second_charge_balance: 0,
        exit_strategy: '', loan_purpose: 'Debt consolidation',
      },
    };

    const rowA = h.map(() => '');
    rowA[h.indexOf('Lead Ref')] = 'POSFIN-MERGE-TS';
    rowA[h.indexOf('Name')] = 'Alice Earlier';
    rowA[h.indexOf('Phone')] = '447123450001';
    rowA[h.indexOf('Email')] = 'alice@example.com';
    rowA[summaryIdx] = START + JSON.stringify(stateA) + END;
    rowA[stageIdx] = 'FACT FIND COMPLETE';
    rowA[h.indexOf('👣 Lead Touch / Progress')] = 'FACT_FIND_COMPLETE';

    const rowB = h.map(() => '');
    rowB[h.indexOf('Lead Ref')] = 'POSFIN-MERGE-TS';
    rowB[h.indexOf('Name')] = 'Bob Later';
    rowB[h.indexOf('Phone')] = '447123450002';
    rowB[h.indexOf('Email')] = 'bob@example.com';
    rowB[summaryIdx] = START + JSON.stringify(stateB) + END;
    rowB[stageIdx] = 'FACT FIND COMPLETE';
    rowB[h.indexOf('👣 Lead Touch / Progress')] = 'FACT_FIND_COMPLETE';

    sheets._tabs[RAW].push(rowA, rowB);

    // Now call saveIntake — it should detect the duplicate, merge by updated_at,
    // and drive qualification/Clean from the merged state.
    // Keys not provided in input must not overwrite the merged values.
    const save = await independentSaveIntake();
    const sub = makeSubmission('POSFIN-MERGE-TS', 3, {
      property_address: '3 Newest Street, London',
    });
    delete sub.exit_strategy;
    delete sub.loan_purpose;
    // This submission has the latest timestamp (now) and should merge with existing
    const result = await save(sheets, id, sub, 'main_loan', 'https://example.com/scorecard', () => true);
    assert.equal(result.ok, true);

    // Find the canonical row
    const rawTab = sheets._tabs[RAW];
    const canonical = rawTab.slice(1).filter(r =>
      r[refIdx] === 'POSFIN-MERGE-TS' && !String(r[stageIdx] || '').startsWith('DUPLICATE-MERGED')
    );
    assert.equal(canonical.length, 1, `Expected 1 canonical row, got ${canonical.length}`);

    const merged = unpack(canonical[0][summaryIdx] || '');
    assert.ok(merged, 'Canonical row must have packed state');

    // The merged answers must have BOTH fields from the pre-populated rows:
    // exit_strategy from stateA (the only non-empty source) and loan_purpose from stateB
    assert.equal(merged.answers.exit_strategy, 'Sale of investment',
      'exit_strategy must come from the row that had it (A)');
    assert.equal(merged.answers.loan_purpose, 'Debt consolidation',
      'loan_purpose must come from the row that had it (B)');

    // Later updated_at fields win for shared fields
    // stateB (11:00) is later than stateA (10:00), so Bob's name wins — but then
    // the new submission (sub, with now timestamp) is even later, so Test3 wins
    assert.equal(merged.answers.first_name, 'Test3', 'Latest submission first_name wins');
    assert.equal(merged.answers.property_address, '3 Newest Street, London', 'Latest address wins');

    // Explicit 0 must survive the merge
    assert.strictEqual(merged.answers.first_charge_arrears_amount, 0,
      'Explicit 0 must survive merge, not become null');
    assert.strictEqual(merged.answers.second_charge_present, 'no',
      'Explicit "no" must survive merge');

    // Duplicate rows should be marked, data preserved
    const marked = rawTab.slice(1).filter(r =>
      r[refIdx] === 'POSFIN-MERGE-TS' && String(r[stageIdx] || '').startsWith('DUPLICATE-MERGED')
    );
    assert.ok(marked.length >= 1, 'At least 1 duplicate row should be marked');
    for (const dup of marked) {
      assert.ok(dup[refIdx], 'Duplicate Lead Ref preserved');
      assert.ok(unpack(dup[summaryIdx] || ''), 'Duplicate Tom Summary data preserved');
    }
  });

  it('merged state drives Clean projection: both complementary fields qualify', async () => {
    const sheets = createMockSheets();
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;
    const h = RAW_HEADERS;
    const START = '[POSFIN_FACTFIND_V1]', END = '[/POSFIN_FACTFIND_V1]';

    // Pre-populate two rows: A has exit but no purpose, B has purpose but no exit.
    // Neither qualifies alone. Merged: both present → qualifies → Clean row written.
    // Use property_value high enough for LTV ≤ 70% (200k+250k / 1M = 45%).
    const base = {
      deal_ref: 'POSFIN-CLEAN-MERGE', first_name: 'Qual', last_name: 'Test',
      mobile: '07123459999', email: 'qual@example.com',
      property_address: '10 Merge Lane, London', property_value: 1000000, loan_amount: 250000,
      first_charge_lender: 'TestBank', first_charge_balance: 200000,
      first_charge_arrears_amount: 0, second_charge_present: 'no', second_charge_balance: 0,
    };
    const stateA = {
      version: 'factfind-v1', updated_at: '2026-10-20T09:00:00.000Z', created_at: '2026-10-20T09:00:00.000Z',
      completed: true, declined: false, no_chase: false, progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: { ...base, exit_strategy: 'Refinance', loan_purpose: '' },
    };
    const stateB = {
      version: 'factfind-v1', updated_at: '2026-10-20T09:01:00.000Z', created_at: '2026-10-20T09:01:00.000Z',
      completed: true, declined: false, no_chase: false, progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: { ...base, exit_strategy: '', loan_purpose: 'Debt consolidation' },
    };

    for (const [st, name] of [[stateA, 'A'], [stateB, 'B']]) {
      const row = h.map(() => '');
      row[h.indexOf('Lead Ref')] = 'POSFIN-CLEAN-MERGE';
      row[h.indexOf('Name')] = `Qual Test ${name}`;
      row[h.indexOf('Tom Summary')] = START + JSON.stringify(st) + END;
      row[h.indexOf('Lead Stage')] = 'FACT FIND COMPLETE';
      sheets._tabs[RAW].push(row);
    }

    // Save triggers merge → qualification → Clean write.
    // Don't send exit/purpose — those must come from the merged state.
    const save = await independentSaveIntake();
    const sub = makeSubmission('POSFIN-CLEAN-MERGE', 99, { property_value: 1000000 });
    delete sub.exit_strategy;
    delete sub.loan_purpose;
    const result = await save(sheets, id, sub, 'main_loan', 'https://example.com/scorecard', () => true);
    assert.equal(result.ok, true);

    // Clean tab must have a row
    const cleanTab = sheets._tabs[CLEAN];
    const cleanHeaders = cleanTab[0];
    const caseIdIdx = cleanHeaders.indexOf('🔖 Case ID');
    const cleanRows = cleanTab.slice(1).filter(r => r[caseIdIdx] === 'POSFIN-CLEAN-MERGE');
    assert.equal(cleanRows.length, 1, 'Merged state should qualify and produce exactly 1 Clean row');

    // Clean row should reflect merged data
    const exitIdx = cleanHeaders.indexOf('🏠 Security address');
    assert.ok(cleanRows[0][exitIdx], 'Clean row should have security address from merged data');
  });

  it('readCase and resume work after dedup: no Ambiguous error', async () => {
    const sheets = createMockSheets();
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;
    const h = RAW_HEADERS;
    const START = '[POSFIN_FACTFIND_V1]', END = '[/POSFIN_FACTFIND_V1]';

    // Set up: 1 canonical row + 1 DUPLICATE-MERGED row
    const state1 = {
      version: 'factfind-v1', updated_at: '2026-10-20T10:00:00.000Z', created_at: '2026-10-20T10:00:00.000Z',
      completed: true, declined: false, no_chase: false, progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: {
        deal_ref: 'POSFIN-RESUME-TEST', first_name: 'Resume', last_name: 'User',
        mobile: '07111111111', email: 'resume@example.com',
        property_address: '1 Resume Road', property_value: 600000, loan_amount: 300000,
        first_charge_lender: 'ResumeBank', first_charge_balance: 250000,
        first_charge_arrears_amount: 0, second_charge_present: 'no', second_charge_balance: 0,
        exit_strategy: 'Sale', loan_purpose: 'Purchase',
      },
    };

    const canonicalRow = h.map(() => '');
    canonicalRow[h.indexOf('Lead Ref')] = 'POSFIN-RESUME-TEST';
    canonicalRow[h.indexOf('Name')] = 'Resume User';
    canonicalRow[h.indexOf('Tom Summary')] = START + JSON.stringify(state1) + END;
    canonicalRow[h.indexOf('Lead Stage')] = 'FACT FIND COMPLETE';

    const dupeRow = h.map(() => '');
    dupeRow[h.indexOf('Lead Ref')] = 'POSFIN-RESUME-TEST';
    dupeRow[h.indexOf('Name')] = 'Resume User Dupe';
    dupeRow[h.indexOf('Tom Summary')] = START + JSON.stringify({ ...state1, updated_at: '2026-10-20T09:00:00.000Z' }) + END;
    dupeRow[h.indexOf('Lead Stage')] = 'DUPLICATE-MERGED → row 2';

    sheets._tabs[RAW].push(canonicalRow, dupeRow);

    // readCase must return the canonical row, not throw
    const { readCase } = await import(`../lib/clean-intake.js?rc=${++instanceCounter}`);
    const hit = await readCase(sheets, id, 'POSFIN-RESUME-TEST');
    assert.ok(hit, 'readCase must return the canonical row');
    assert.equal(hit.state.answers.deal_ref, 'POSFIN-RESUME-TEST');
    assert.equal(hit.state.answers.first_name, 'Resume');

    // A subsequent save (resume) must succeed — no "Ambiguous" error
    const save = await independentSaveIntake();
    const result = await save(sheets, id,
      makeSubmission('POSFIN-RESUME-TEST', 5, { exit_strategy: 'Refinance instead' }),
      'main_loan', 'https://example.com/scorecard', () => true
    );
    assert.equal(result.ok, true);

    // The canonical row should now have the updated exit_strategy
    const hit2 = await readCase(sheets, id, 'POSFIN-RESUME-TEST');
    assert.ok(hit2);
    assert.equal(hit2.state.answers.exit_strategy, 'Refinance instead',
      'Resume should update canonical row');
  });

  it('header-name alignment: values land in correct columns regardless of header order', async () => {
    const reorderedHeaders = [
      'Lead Stage', 'Tom Summary', 'Email', 'Lead Ref', 'Name', 'Phone',
      'Submitted At', '👣 Lead Touch / Progress',
    ];
    const sheets = createMockSheets();
    sheets._tabs[RAW] = [reorderedHeaders];
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;

    const save = await independentSaveIntake();
    const result = await save(sheets, id,
      makeSubmission('POSFIN-REORDER-001', 1),
      'main_loan', 'https://example.com/scorecard', () => true
    );
    assert.equal(result.ok, true);

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const dataRow = rawTab[1];

    assert.equal(dataRow[headers.indexOf('Lead Ref')], 'POSFIN-REORDER-001');
    assert.equal(dataRow[headers.indexOf('Name')], 'Test1 User1');
    assert.ok(dataRow[headers.indexOf('Phone')]);
    assert.equal(dataRow[headers.indexOf('Email')], 'test1@example.com');
    assert.equal(dataRow[headers.indexOf('Lead Stage')], 'NEW — FACT FIND');
    assert.ok(unpack(dataRow[headers.indexOf('Tom Summary')]));
  });

  it('explicit zero and false survive merge and storage', async () => {
    const sheets = createMockSheets();
    const id = 'test-sheet-id';
    process.env.FACTFIND_SHEET_ID = id;

    const save = await independentSaveIntake();
    const sub = makeSubmission('POSFIN-ZERO-001', 1, {
      first_charge_arrears_amount: 0,
      second_charge_present: 'no',
    });
    const result = await save(sheets, id, sub, 'main_loan', 'https://example.com/scorecard', () => true);
    assert.equal(result.ok, true);

    const rawTab = sheets._tabs[RAW];
    const headers = rawTab[0];
    const state = unpack(rawTab[1][headers.indexOf('Tom Summary')] || '');
    assert.ok(state);

    assert.strictEqual(state.answers.first_charge_arrears_amount, 0,
      'Explicit 0 must be stored as 0');
    assert.strictEqual(state.answers.second_charge_present, 'no',
      'Explicit "no" must be stored');

    // Now merge with another row that has the same ref — 0 and "no" must survive
    const h = RAW_HEADERS;
    const START = '[POSFIN_FACTFIND_V1]', END = '[/POSFIN_FACTFIND_V1]';
    const laterState = {
      version: 'factfind-v1', updated_at: new Date(Date.now() + 60000).toISOString(),
      created_at: state.created_at, completed: true, declined: false, no_chase: false,
      progress: 'FACT_FIND_COMPLETE', product: 'main_loan',
      answers: { ...state.answers, exit_strategy: 'Updated exit' },
    };
    const dupeRow = h.map(() => '');
    dupeRow[h.indexOf('Lead Ref')] = 'POSFIN-ZERO-001';
    dupeRow[h.indexOf('Name')] = 'Test1 User1';
    dupeRow[h.indexOf('Tom Summary')] = START + JSON.stringify(laterState) + END;
    dupeRow[h.indexOf('Lead Stage')] = 'FACT FIND COMPLETE';
    rawTab.push(dupeRow);

    // Trigger merge via another save — don't send exit_strategy so merged value survives
    const save2 = await independentSaveIntake();
    const mergeSub = makeSubmission('POSFIN-ZERO-001', 1, { first_charge_arrears_amount: 0, second_charge_present: 'no' });
    delete mergeSub.exit_strategy; // Let merge preserve 'Updated exit' from the later row
    const result2 = await save2(sheets, id, mergeSub, 'main_loan', 'https://example.com/scorecard', () => true);
    assert.equal(result2.ok, true);

    const canonical = rawTab.slice(1).filter(r =>
      r[h.indexOf('Lead Ref')] === 'POSFIN-ZERO-001' &&
      !String(r[h.indexOf('Lead Stage')] || '').startsWith('DUPLICATE-MERGED')
    );
    assert.equal(canonical.length, 1);
    const mergedState = unpack(canonical[0][h.indexOf('Tom Summary')] || '');
    assert.strictEqual(mergedState.answers.first_charge_arrears_amount, 0,
      'Explicit 0 must survive merge');
    assert.strictEqual(mergedState.answers.second_charge_present, 'no',
      'Explicit "no" must survive merge');
    assert.equal(mergedState.answers.exit_strategy, 'Updated exit',
      'Later exit_strategy must win in merge');
  });
});

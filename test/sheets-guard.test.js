/**
 * Preview Sheets write gate — guard, shared writer helpers, repair script.
 *
 * In Preview a Sheets write is allowed only when FACTFIND_SHEET_ID is exactly
 * the approved staging sheet AND FACTFIND_STAGING_WRITES is exactly 'true'.
 * Production behaviour must be unchanged.
 *
 * Run: node --test test/sheets-guard.test.js
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { google as realGoogle } from 'googleapis';

await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');

const guard = await import('../lib/sheets-guard.js');
const { STAGING_SHEET_ID, SheetsWriteDenied, stagingWriteDenial, previewWriteDenial, resolveWriteTarget, assertSheetsWrite, guardSheets } = guard;
const intake = await import('../lib/clean-intake.js');
const { RAW, CLEAN, MASTER, sheetId, saveIntake, recordClick, markAlertSent, readCase, unpack } = intake;

const STAGING = '17E60hrVFtl5WJ8pqpO74dk5DY7kOvJ5R0jD0XH-GRMw';
const ENV_KEYS = ['VERCEL_ENV', 'FACTFIND_SHEET_ID', 'FACTFIND_STAGING_WRITES'];
const saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
function setEnv(vars) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
}
afterEach(() => setEnv(saved));

// Every Preview configuration that must be refused.
const DENIED = {
  'ID missing':                 { FACTFIND_STAGING_WRITES: 'true' },
  'ID empty':                   { FACTFIND_SHEET_ID: '', FACTFIND_STAGING_WRITES: 'true' },
  'ID whitespace only':         { FACTFIND_SHEET_ID: '   ', FACTFIND_STAGING_WRITES: 'true' },
  'ID with leading space':      { FACTFIND_SHEET_ID: ' ' + STAGING, FACTFIND_STAGING_WRITES: 'true' },
  'ID with trailing newline':   { FACTFIND_SHEET_ID: STAGING + '\n', FACTFIND_STAGING_WRITES: 'true' },
  'ID wrong case':              { FACTFIND_SHEET_ID: STAGING.toLowerCase(), FACTFIND_STAGING_WRITES: 'true' },
  'ID arbitrary':               { FACTFIND_SHEET_ID: 'some-other-sheet-id', FACTFIND_STAGING_WRITES: 'true' },
  'ID live master':             { FACTFIND_SHEET_ID: MASTER, FACTFIND_STAGING_WRITES: 'true' },
  'flag absent':                { FACTFIND_SHEET_ID: STAGING },
  'flag false':                 { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'false' },
  'flag empty':                 { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: '' },
  'flag TRUE':                  { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'TRUE' },
  'flag padded':                { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: ' true' },
  'flag 1':                     { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: '1' },
};
const ALLOWED = { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'true' };

// ── In-memory Sheets mock recording every call ───────────────────────
const RAW_HEADERS = ['Submitted At', 'Name', 'Phone', 'Email', 'Lead Ref', 'Tom Summary', 'Lead Stage', '👣 Lead Touch / Progress'];
const CLEAN_HEADERS = ['🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📞 Mobile / WhatsApp', '📧 Email', 'Router completed Y/N', '🏠 Security address', '📊 Stated value', '💷 Net req', '🏦 1st charge provider', '💸 1st charge £', '🚨 Arrears Y/N', '🚨 Arrears £', '🏦 2nd charge lender', '💸 2nd charge £', '🔁 Mandatory redemptions', '🚦 Status ▼', '🧑‍💼 Sales owner ▼', '🎯 Next action', '❓ Missing/open items', '⚡ Route'];

function mockSheets() {
  const tabs = { [RAW]: [RAW_HEADERS.slice()], [CLEAN]: [CLEAN_HEADERS.slice()] };
  const calls = [];
  const tabOf = range => range.match(/^'([^']+)'/)?.[1] || range;
  return {
    tabs, calls,
    writes: () => calls.filter(c => c.method !== 'values.get' && c.method !== 'get'),
    spreadsheets: {
      async get({ spreadsheetId }) { calls.push({ method: 'get', spreadsheetId }); return { data: { sheets: Object.keys(tabs).map((title, sheetId) => ({ properties: { sheetId, title } })) } }; },
      async batchUpdate({ spreadsheetId, requestBody }) {
        calls.push({ method: 'batchUpdate', spreadsheetId });
        for (const { appendCells } of requestBody.requests) {
          const t = tabs[Object.keys(tabs)[appendCells.sheetId]];
          for (const row of appendCells.rows) t.push(row.values.map(c => { const v = c.userEnteredValue || {}; return v.stringValue ?? v.numberValue ?? v.boolValue ?? ''; }));
        }
        return { data: {} };
      },
      values: {
      async get({ spreadsheetId, range }) { calls.push({ method: 'values.get', spreadsheetId }); return { data: { values: (tabs[tabOf(range)] || []).map(r => [...r]) } }; },
      async append({ spreadsheetId, range, requestBody }) {
        calls.push({ method: 'values.append', spreadsheetId });
        const t = tabs[tabOf(range)]; const n = t.length + 1;
        for (const row of requestBody.values) t.push([...row]);
        return { data: { updates: { updatedRange: `'${tabOf(range)}'!A${n}:AF${t.length}` } } };
      },
      async batchUpdate({ spreadsheetId, requestBody }) {
        calls.push({ method: 'values.batchUpdate', spreadsheetId });
        for (const d of requestBody.data) {
          const [, tab, letters, row] = d.range.match(/^'([^']+)'!([A-Z]+)(\d+)$/);
          let c = 0; for (const ch of letters) c = c * 26 + ch.charCodeAt(0) - 64;
          const r = tabs[tab][Number(row) - 1]; while (r.length < c) r.push(''); r[c - 1] = d.values[0][0];
        }
        return { data: {} };
      },
    } },
  };
}

const pack = state => `[POSFIN_FACTFIND_V1]${JSON.stringify(state)}[/POSFIN_FACTFIND_V1]`;
function seedCase(sheets, ref, state) {
  sheets.tabs[RAW].push(['2026-10-01', 'Ada Test', '447700900000', 'ada@example.com', ref, 'note\n' + pack(state), 'FACT FIND COMPLETE', 'FACT_FIND_COMPLETE']);
}
const submission = ref => ({
  deal_ref: ref, first_name: 'Ada', last_name: 'Test', mobile: '07700900000', email: 'ada@example.com',
  property_address: '1 Test Street, London', property_value: 500000, loan_amount: 250000,
  first_charge_lender: 'TestBank', first_charge_balance: 100000, first_charge_arrears_amount: 0,
  second_charge_present: 'no', second_charge_balance: 0, exit_strategy: 'Refinance', loan_purpose: 'Business',
});

// ── Guard primitives ─────────────────────────────────────────────────
describe('sheets-guard: Preview target/flag validation', () => {
  it('pins the approved staging sheet ID exactly', () => {
    assert.equal(STAGING_SHEET_ID, STAGING);
  });

  it('allows a Preview write only for the exact staging ID with flag exactly true', () => {
    const env = { VERCEL_ENV: 'preview', ...ALLOWED };
    assert.equal(stagingWriteDenial(env), null);
    assert.equal(previewWriteDenial(env), null);
    assert.equal(resolveWriteTarget(MASTER, env), STAGING);
    assert.doesNotThrow(() => assertSheetsWrite(STAGING, env));
  });

  for (const [name, vars] of Object.entries(DENIED)) {
    it(`denies Preview when ${name}`, () => {
      const env = { VERCEL_ENV: 'preview', ...vars };
      assert.ok(previewWriteDenial(env));
      assert.throws(() => resolveWriteTarget(MASTER, env), SheetsWriteDenied);
      assert.throws(() => assertSheetsWrite(STAGING, env), SheetsWriteDenied);
    });
  }

  it('denies a Preview write aimed at any sheet other than staging, even when configured', () => {
    const env = { VERCEL_ENV: 'preview', ...ALLOWED };
    for (const target of [MASTER, 'other-sheet', '', undefined, ' ' + STAGING]) {
      assert.throws(() => assertSheetsWrite(target, env), SheetsWriteDenied, String(target));
    }
  });

  it('production and non-Preview environments are untouched', () => {
    for (const VERCEL_ENV of ['production', 'development', undefined]) {
      for (const vars of [{}, ...Object.values(DENIED)]) {
        const env = { VERCEL_ENV, ...vars };
        assert.equal(previewWriteDenial(env), null);
        assert.equal(resolveWriteTarget(MASTER, env), MASTER);
        assert.doesNotThrow(() => assertSheetsWrite(MASTER, env));
      }
    }
  });
});

describe('sheets-guard: guardSheets client wrapper', () => {
  it('returns the identical client outside Preview', () => {
    const sheets = mockSheets();
    assert.equal(guardSheets(sheets, { VERCEL_ENV: 'production' }), sheets);
    assert.equal(guardSheets(sheets, {}), sheets);
  });

  it('blocks every write method on a denied Preview without reaching the client', async () => {
    const sheets = mockSheets();
    const g = guardSheets(sheets, { VERCEL_ENV: 'preview', FACTFIND_SHEET_ID: STAGING });
    await assert.rejects(async () => g.spreadsheets.values.append({ spreadsheetId: STAGING, range: `'${RAW}'!A:AF`, requestBody: { values: [[]] } }), SheetsWriteDenied);
    await assert.rejects(async () => g.spreadsheets.values.batchUpdate({ spreadsheetId: STAGING, requestBody: { data: [] } }), SheetsWriteDenied);
    assert.deepEqual(sheets.writes(), []);
    await g.spreadsheets.values.get({ spreadsheetId: STAGING, range: `'${RAW}'!A:AF` });
    assert.equal(sheets.calls.length, 1, 'reads still pass through');
  });

  it('allows staging writes and blocks other targets on an approved Preview', async () => {
    const sheets = mockSheets();
    const g = guardSheets(sheets, { VERCEL_ENV: 'preview', ...ALLOWED });
    await g.spreadsheets.values.append({ spreadsheetId: STAGING, range: `'${RAW}'!A:AF`, requestBody: { values: [['x']] } });
    await assert.rejects(async () => g.spreadsheets.values.append({ spreadsheetId: MASTER, range: `'${RAW}'!A:AF`, requestBody: { values: [['y']] } }), SheetsWriteDenied);
    assert.deepEqual(sheets.writes(), [{ method: 'values.append', spreadsheetId: STAGING }]);
  });

  // Fake client recording every call that reaches it, including copyTo.
  function recordingClient() {
    const hits = [];
    const fn = name => (...args) => { hits.push({ name, args }); return Promise.resolve({ data: {} }); };
    return { hits, spreadsheets: {
      get: fn('get'), batchUpdate: fn('batchUpdate'), create: fn('create'),
      sheets: { copyTo: fn('sheets.copyTo') },
      developerMetadata: { search: fn('developerMetadata.search') },
      values: { get: fn('values.get'), append: fn('values.append'), update: fn('values.update'), clear: fn('values.clear') },
    } };
  }
  const approved = { VERCEL_ENV: 'preview', ...ALLOWED };

  for (const [label, destinationSpreadsheetId] of Object.entries({ live: MASTER, other: 'other-sheet', missing: undefined, staging: STAGING })) {
    it(`copyTo from staging to ${label} destination is denied in Preview and never reaches the client`, () => {
      const c = recordingClient();
      const g = guardSheets(c, approved);
      const requestBody = destinationSpreadsheetId === undefined ? {} : { destinationSpreadsheetId };
      assert.throws(() => g.spreadsheets.sheets.copyTo({ spreadsheetId: STAGING, sheetId: 0, requestBody }), SheetsWriteDenied);
      assert.throws(() => g.spreadsheets.sheets.copyTo({ spreadsheetId: STAGING, sheetId: 0, resource: requestBody }), SheetsWriteDenied);
      assert.deepEqual(c.hits, []);
    });
  }

  it('copyTo is untouched in production', async () => {
    const c = recordingClient();
    await guardSheets(c, { VERCEL_ENV: 'production' }).spreadsheets.sheets.copyTo({ spreadsheetId: MASTER, sheetId: 0, requestBody: { destinationSpreadsheetId: 'x' } });
    assert.equal(c.hits.length, 1);
  });

  it('rejects request options that could redirect a write (url/rootUrl override)', () => {
    const c = recordingClient();
    const g = guardSheets(c, approved);
    const params = { spreadsheetId: STAGING, range: 'A1', requestBody: { values: [[1]] } };
    for (const opts of [{ url: `https://sheets.googleapis.com/v4/spreadsheets/${MASTER}/values/A1` }, { rootUrl: 'https://evil.example/' }, {}, null, 'x']) {
      assert.throws(() => g.spreadsheets.values.update(params, opts), SheetsWriteDenied, JSON.stringify(opts));
    }
    assert.throws(() => g.spreadsheets.values.update(params, () => {}, {}), SheetsWriteDenied);
    assert.throws(() => g.spreadsheets.values.update(() => {}), SheetsWriteDenied, 'callback-only form has no spreadsheetId');
    assert.throws(() => g.spreadsheets.create({ requestBody: {} }), SheetsWriteDenied, 'create has no staging target');
    assert.deepEqual(c.hits, []);
  });

  it('pins the checked spreadsheetId so a getter cannot swap the target after the check', () => {
    const c = recordingClient();
    const g = guardSheets(c, approved);
    let reads = 0;
    const params = { range: 'A1', requestBody: { values: [[1]] }, get spreadsheetId() { return reads++ === 0 ? STAGING : MASTER; } };
    g.spreadsheets.values.update(params);
    assert.equal(c.hits.length, 1);
    assert.equal(c.hits[0].args[0].spreadsheetId, STAGING);
    assert.equal(c.hits[0].args.length, 1);
  });

  it('permitted Preview writes: staging target, (params) or (params, callback), reach the client unchanged', () => {
    const c = recordingClient();
    const g = guardSheets(c, approved);
    const cb = () => {};
    g.spreadsheets.values.append({ spreadsheetId: STAGING, range: 'A:A', requestBody: { values: [[1]] } });
    g.spreadsheets.values.update({ spreadsheetId: STAGING, range: 'A1', requestBody: { values: [[2]] } }, cb);
    g.spreadsheets.batchUpdate({ spreadsheetId: STAGING, requestBody: { requests: [] } });
    g.spreadsheets.values.clear({ spreadsheetId: STAGING, range: 'A1' });
    g.spreadsheets.values.get({ spreadsheetId: STAGING, range: 'A1' });
    assert.deepEqual(c.hits.map(h => h.name), ['values.append', 'values.update', 'batchUpdate', 'values.clear', 'values.get']);
    assert.ok(c.hits.every(h => h.args[0].spreadsheetId === STAGING));
    assert.equal(c.hits[1].args[1], cb);
  });

  it('wraps a real googleapis client: writes denied locally before any request is built', async () => {
    const env = { VERCEL_ENV: 'preview', FACTFIND_SHEET_ID: MASTER, FACTFIND_STAGING_WRITES: 'true' };
    const real = realGoogle.sheets({ version: 'v4' });
    const g = guardSheets(real, env);
    for (const call of [
      () => g.spreadsheets.values.append({ spreadsheetId: MASTER, range: 'A:A', requestBody: { values: [[]] } }),
      () => g.spreadsheets.values.update({ spreadsheetId: MASTER, range: 'A1', requestBody: { values: [[]] } }),
      () => g.spreadsheets.values.batchUpdate({ spreadsheetId: MASTER, requestBody: {} }),
      () => g.spreadsheets.values.clear({ spreadsheetId: MASTER, range: 'A1' }),
      () => g.spreadsheets.batchUpdate({ spreadsheetId: MASTER, requestBody: {} }),
      () => g.spreadsheets.sheets.copyTo({ spreadsheetId: MASTER, sheetId: 0, requestBody: {} }),
      () => g.spreadsheets.create({ requestBody: {} }),
    ]) assert.throws(call, SheetsWriteDenied);
    // Property access itself must not trip Proxy invariants on googleapis'
    // non-configurable resource properties (reads and allowed writes need it).
    const ok = guardSheets(real, { VERCEL_ENV: 'preview', ...ALLOWED });
    assert.equal(typeof ok.spreadsheets.values.get, 'function');
    assert.equal(typeof ok.spreadsheets.values.append, 'function');
    assert.equal(typeof ok.spreadsheets.get, 'function');
    assert.equal(guardSheets(real, { VERCEL_ENV: 'production' }), real);
  });
});

// ── Shared writer helpers in lib/clean-intake.js ─────────────────────
describe('clean-intake: sheetId() target resolution', () => {
  it('Preview resolves only the exact staging sheet', () => {
    setEnv({ VERCEL_ENV: 'preview', FACTFIND_SHEET_ID: STAGING });
    assert.equal(sheetId(), STAGING);
    for (const id of [undefined, '', ' ' + STAGING, MASTER, 'arbitrary-sheet']) {
      setEnv({ VERCEL_ENV: 'preview', FACTFIND_SHEET_ID: id, FACTFIND_STAGING_WRITES: 'true' });
      assert.throws(() => sheetId(), SheetsWriteDenied, String(id));
    }
  });

  it('production behaviour is unchanged', () => {
    setEnv({ VERCEL_ENV: 'production' });
    assert.equal(sheetId(), MASTER);
    setEnv({ VERCEL_ENV: 'production', FACTFIND_SHEET_ID: 'prod-override' });
    assert.equal(sheetId(), 'prod-override');
  });
});

describe('clean-intake: shared writer fails closed in Preview', () => {
  it('valid staging write: saveIntake writes only to staging', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...ALLOWED });
    const sheets = mockSheets();
    const r = await saveIntake(sheets, STAGING, submission('POSFIN-GUARD-OK'), 'main_loan', 'https://example.test/s', () => true);
    assert.equal(r.ok, true);
    assert.ok(sheets.writes().length >= 2, 'Raw + Clean writes happened');
    assert.ok(sheets.calls.every(c => c.spreadsheetId === STAGING));
    assert.equal(sheets.tabs[RAW].length, 2);
    assert.equal(sheets.tabs[CLEAN].length, 2);
  });

  for (const [name, vars] of Object.entries(DENIED)) {
    it(`no Sheets write when ${name}`, async () => {
      setEnv({ VERCEL_ENV: 'preview', ...vars });
      const sheets = mockSheets();
      await assert.rejects(saveIntake(sheets, STAGING, submission('POSFIN-GUARD-NO'), 'main_loan', 'https://example.test/s', () => true), SheetsWriteDenied);
      assert.deepEqual(sheets.writes(), []);
      assert.equal(sheets.tabs[RAW].length, 1);
    });
  }

  it('no Sheets write when an approved Preview is handed a non-staging ID', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...ALLOWED });
    for (const id of [MASTER, 'arbitrary-sheet']) {
      const sheets = mockSheets();
      await assert.rejects(saveIntake(sheets, id, submission('POSFIN-GUARD-ID'), 'main_loan', 'https://example.test/s', () => true), SheetsWriteDenied);
      seedCase(sheets, 'POSFIN-GUARD-ID', { completed: true, answers: { deal_ref: 'POSFIN-GUARD-ID' } });
      await assert.rejects(recordClick(sheets, id, 'POSFIN-GUARD-ID'), SheetsWriteDenied);
      await assert.rejects(markAlertSent(sheets, id, 'POSFIN-GUARD-ID'), SheetsWriteDenied);
      assert.deepEqual(sheets.writes(), []);
    }
  });

  it('production regression: writes proceed to the production ID unchanged', async () => {
    setEnv({ VERCEL_ENV: 'production' });
    const sheets = mockSheets();
    const r = await saveIntake(sheets, MASTER, submission('POSFIN-GUARD-PROD'), 'main_loan', 'https://example.test/s', () => true);
    assert.equal(r.ok, true);
    assert.ok(sheets.writes().length >= 2);
    assert.ok(sheets.calls.every(c => c.spreadsheetId === MASTER));
  });
});

// readCase returns { table, r, i, state } — there is no `index`. Writing with
// hit.index (undefined) took the append branch and added a stray row.
describe('clean-intake: recordClick / markAlertSent update the existing row', () => {
  const ref = 'POSFIN-CLICK-001';
  const setup = () => {
    setEnv({ VERCEL_ENV: 'production' });
    const sheets = mockSheets();
    sheets.tabs[RAW].push(['2026-10-01', 'Other', '', '', 'POSFIN-OTHER', '', '', '']);
    seedCase(sheets, ref, { completed: true, answers: { deal_ref: ref }, progress: 'FACT_FIND_COMPLETE' });
    sheets.tabs[RAW].push(['2026-10-02', 'Later', '', '', 'POSFIN-LATER', '', '', '']);
    return sheets;
  };

  it('readCase exposes the row index as `i`', async () => {
    const hit = await readCase(setup(), MASTER, ref);
    assert.equal(hit.i, 1);
    assert.equal(hit.index, undefined);
  });

  it('recordClick updates row 3 in place, no append', async () => {
    const sheets = setup();
    assert.equal(await recordClick(sheets, MASTER, ref), true);
    assert.equal(sheets.tabs[RAW].length, 4, 'no new row');
    assert.equal(sheets.calls.filter(c => c.method === 'values.append').length, 0);
    const state = unpack(sheets.tabs[RAW][2][RAW_HEADERS.indexOf('Tom Summary')]);
    assert.ok(state.answers.whatsapp_cta_clicked_at);
    assert.equal(sheets.tabs[RAW][2][RAW_HEADERS.indexOf('Lead Ref')], ref, 'other columns untouched');
    assert.equal(unpack(sheets.tabs[RAW][1][5] || ''), null, 'neighbouring row untouched');
    // Idempotent: a second click does not write again.
    const before = sheets.writes().length;
    assert.equal(await recordClick(sheets, MASTER, ref), true);
    assert.equal(sheets.writes().length, before);
  });

  it('markAlertSent updates row 3 in place, no append', async () => {
    const sheets = setup();
    assert.equal(await markAlertSent(sheets, MASTER, ref), true);
    assert.equal(sheets.tabs[RAW].length, 4, 'no new row');
    assert.equal(sheets.calls.filter(c => c.method === 'values.append').length, 0);
    assert.ok(unpack(sheets.tabs[RAW][2][RAW_HEADERS.indexOf('Tom Summary')]).broker_alert_sent);
    const before = sheets.writes().length;
    assert.equal(await markAlertSent(sheets, MASTER, ref), true);
    assert.equal(sheets.writes().length, before);
  });

  it('recordClick in an approved Preview updates the staging row in place', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...ALLOWED });
    const sheets = mockSheets();
    seedCase(sheets, ref, { completed: true, answers: { deal_ref: ref } });
    assert.equal(await recordClick(sheets, STAGING, ref), true);
    assert.equal(sheets.tabs[RAW].length, 2);
    assert.deepEqual(sheets.writes(), [{ method: 'values.batchUpdate', spreadsheetId: STAGING }]);
  });
});

// ── Repair script requires the exact staging target ──────────────────
describe('scripts/repair-raw-leads.js target gate', () => {
  const script = fileURLToPath(new URL('../scripts/repair-raw-leads.js', import.meta.url));
  // Minimal env: no credentials, so even a passing gate cannot reach the network.
  const run = (vars, args = []) => spawnSync(process.execPath, [script, ...args], {
    env: { PATH: process.env.PATH, ...vars }, encoding: 'utf8', timeout: 30000,
  });

  for (const [name, id] of Object.entries({ missing: undefined, empty: '', whitespace: '  ', padded: STAGING + ' ', live: MASTER, arbitrary: 'arbitrary-sheet' })) {
    it(`refuses when FACTFIND_SHEET_ID is ${name}`, () => {
      const vars = id === undefined ? { FACTFIND_STAGING_WRITES: 'true' } : { FACTFIND_SHEET_ID: id, FACTFIND_STAGING_WRITES: 'true' };
      const r = run(vars, ['--apply']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /must be exactly the approved staging sheet/);
    });
  }

  it('refuses the old allowlist route to production', () => {
    const r = run({ FACTFIND_SHEET_ID: MASTER, REPAIR_STAGING_ALLOWLIST: MASTER });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must be exactly the approved staging sheet/);
  });

  for (const flag of [undefined, 'false', 'TRUE']) {
    it(`--apply refuses when FACTFIND_STAGING_WRITES is ${flag}`, () => {
      const r = run({ FACTFIND_SHEET_ID: STAGING, ...(flag === undefined ? {} : { FACTFIND_STAGING_WRITES: flag }) }, ['--apply']);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /--apply requires FACTFIND_STAGING_WRITES=true/);
    });
  }

  it('exact staging target passes the gate (dry run and --apply), stopping at missing credentials', () => {
    for (const [vars, args] of [[{ FACTFIND_SHEET_ID: STAGING }, []], [{ FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'true' }, ['--apply']]]) {
      const r = run(vars, args);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /GOOGLE_SA_B64 is required/);
    }
  });
});

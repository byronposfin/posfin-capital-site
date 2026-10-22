/**
 * Preview Sheets write gate — every API route that writes to Google Sheets.
 *
 * googleapis, docusign-esign and jose are replaced with in-process stubs via
 * module.registerHooks, and global fetch is stubbed, so nothing here can reach
 * the network. Each stub records calls so tests can prove that a denied
 * Preview creates no Sheets client, makes no Sheets call, sends no Telegram /
 * DocuSign request, and that allowed / production writes hit the right sheet.
 *
 * Run: node --test test/preview-write-routes.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';

const STAGING = '17E60hrVFtl5WJ8pqpO74dk5DY7kOvJ5R0jD0XH-GRMw';
const MASTER = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const RAW_HEADERS = ['Submitted At', 'Name', 'Phone', 'Email', 'Lead Ref', 'Tom Summary', 'Lead Stage', '👣 Lead Touch / Progress'];
const CLEAN_HEADERS = ['🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📞 Mobile / WhatsApp', '📧 Email', 'Router completed Y/N', '🏠 Security address', '📊 Stated value', '💷 Net req', '🏦 1st charge provider', '💸 1st charge £', '🚨 Arrears Y/N', '🚨 Arrears £', '🏦 2nd charge lender', '💸 2nd charge £', '🔁 Mandatory redemptions', '🚦 Status ▼', '🧑‍💼 Sales owner ▼', '🎯 Next action', '❓ Missing/open items', '⚡ Route'];

// ── Recording stubs ──────────────────────────────────────────────────
const log = { clients: 0, sheets: [], fetch: [], docusign: 0 };
let tabs;
function resetStore() {
  log.clients = 0; log.sheets = []; log.fetch = []; log.docusign = 0;
  tabs = {
    'Raw Leads': [RAW_HEADERS.slice()],
    '✨ Pipeline Clean': [CLEAN_HEADERS.slice()],
    'Website Form': [['Timestamp']],
    'PIPELINE': [['Summary']],
    'Introducers': [['Timestamp']],
  };
}
const sheetWrites = () => log.sheets.filter(c => !['get', 'values.get'].includes(c.method));

// Range parsing for the mock: 'Tab'!A2:T, 'Tab'!A:A, 'Tab'!A5:N5, 'Tab'!C7
function parseRange(range) {
  const [, tab, , r1, , r2] = range.match(/^'([^']+)'(?:!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?)?/);
  return { tab, start: r1 ? Number(r1) : 1, end: r2 ? Number(r2) : (r1 && !range.includes(':') ? Number(r1) : Infinity) };
}
const colIndex = letters => [...letters].reduce((c, ch) => c * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const record = (method, p) => log.sheets.push({ method, spreadsheetId: p?.spreadsheetId });

const client = {
  spreadsheets: {
    async get(p) {
      record('get', p);
      return { data: { sheets: Object.keys(tabs).map((title, i) => ({ properties: { sheetId: i, title, gridProperties: { rowCount: 1000, columnCount: 40 } } })) } };
    },
    async batchUpdate(p) {
      record('batchUpdate', p);
      for (const r of p.requestBody.requests || []) if (r.addSheet) tabs[r.addSheet.properties.title] = [];
      return { data: {} };
    },
    values: {
      async get(p) {
        record('values.get', p);
        const { tab, start, end } = parseRange(p.range);
        return { data: { values: (tabs[tab] || []).slice(start - 1, end === Infinity ? undefined : end).map(r => [...r]) } };
      },
      async append(p) {
        record('values.append', p);
        const { tab } = parseRange(p.range);
        tabs[tab] ||= [];
        const n = tabs[tab].length + 1;
        for (const row of p.requestBody.values) tabs[tab].push([...row]);
        return { data: { updates: { updatedRange: `'${tab}'!A${n}:AF${tabs[tab].length}` } } };
      },
      async update(p) {
        record('values.update', p);
        const { tab, start } = parseRange(p.range);
        const col = colIndex(p.range.match(/!([A-Z]+)/)[1]);
        tabs[tab] ||= [];
        while (tabs[tab].length < start) tabs[tab].push([]);
        const row = tabs[tab][start - 1];
        p.requestBody.values[0].forEach((v, i) => { while (row.length < col + i) row.push(''); row[col + i] = v; });
        return { data: {} };
      },
      async batchUpdate(p) {
        record('values.batchUpdate', p);
        for (const d of p.requestBody.data) {
          const [, tab, letters, row] = d.range.match(/^'([^']+)'!([A-Z]+)(\d+)$/);
          const r = tabs[tab][Number(row) - 1];
          const c = colIndex(letters); while (r.length <= c) r.push(''); r[c] = d.values[0][0];
        }
        return { data: {} };
      },
    },
  },
};

class DsObj { constructor(o) { Object.assign(this, o); } static constructFromObject(o) { return new this(o); } }
globalThis.__previewWriteStubs = {
  google: {
    auth: { GoogleAuth: class { constructor(o) { this.options = o; } } },
    sheets() { log.clients++; return client; },
  },
  docusign: {
    ApiClient: class { addDefaultHeader() {} },
    EnvelopesApi: class { async createEnvelope() { log.docusign++; return { envelopeId: 'env-test-1' }; } },
    Document: DsObj, Signer: DsObj, Tabs: DsObj, SignHere: DsObj, DateSigned: DsObj, EnvelopeDefinition: DsObj, Recipients: DsObj,
  },
  SignJWT: class { setProtectedHeader() { return this; } async sign() { return 'signed.jwt'; } },
};

const STUBS = {
  googleapis: 'export const google = globalThis.__previewWriteStubs.google; export default { google };',
  'docusign-esign': 'export default globalThis.__previewWriteStubs.docusign;',
  jose: 'export const SignJWT = globalThis.__previewWriteStubs.SignJWT;',
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, format: 'module', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
    return next(url, context);
  },
});

globalThis.fetch = async (url) => {
  log.fetch.push(String(url));
  return { ok: true, json: async () => ({ ok: true, access_token: 'test-token', result: { message_id: 1 } }) };
};

// ── Environment ──────────────────────────────────────────────────────
const ENV_KEYS = ['VERCEL_ENV', 'FACTFIND_SHEET_ID', 'FACTFIND_STAGING_WRITES', 'GOOGLE_SA_B64', 'SCORECARD_TOKEN_SECRET', 'TELEGRAM_BOT_TOKEN', 'FACTFIND_INTERNAL_ALERTS', 'PREFILL_ADMIN_TOKEN', 'DS_PRIVATE_KEY_B64', 'NEXT_PUBLIC_BASE_URL', 'VERCEL_URL'];
const savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const BASE_ENV = {
  // Placeholder values only; every consumer is stubbed.
  GOOGLE_SA_B64: Buffer.from(JSON.stringify({ private_key: 'test-only' })).toString('base64'),
  SCORECARD_TOKEN_SECRET: 'test-only-secret',
  DS_PRIVATE_KEY_B64: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
};
function setEnv(vars) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...vars })) if (v !== undefined) process.env[k] = v;
}
setEnv({}); // TELEGRAM_BOT_TOKEN is captured at import time by some routes: keep it unset.

await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');
const { tokenFor } = await import('../lib/scorecard-access.js');
const { unpack } = await import('../lib/clean-intake.js');
const routes = {
  lead: (await import('../api/lead.js')).default,
  factfindEvent: (await import('../api/factfind-event.js')).default,
  acquisitionLead: (await import('../api/acquisition-lead.js')).default,
  introducer: (await import('../api/introducer.js')).default,
  prefill: (await import('../api/prefill.js')).default,
  solicitorDetails: (await import('../api/solicitor-details.js')).default,
};

function call(handler, req) {
  const res = {
    statusCode: 200, body: undefined, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    end() { return this; },
  };
  return Promise.resolve(handler({ headers: {}, query: {}, ...req }, res)).then(() => res);
}

const CLICK_REF = 'POSFIN-CLICK-ROUTE';
const pack = s => `[POSFIN_FACTFIND_V1]${JSON.stringify(s)}[/POSFIN_FACTFIND_V1]`;
const seedClickCase = () => tabs['Raw Leads'].push(['2026-10-01', 'Ada Test', '447700900000', 'ada@example.com', CLICK_REF, pack({ completed: true, answers: { deal_ref: CLICK_REF } }), 'FACT FIND COMPLETE', 'FACT_FIND_COMPLETE']);

// One request per Sheets-writing route.
const CASES = {
  'POST /api/lead': {
    handler: 'lead', denyStatus: 200,
    req: () => ({ method: 'POST', body: { product: 'main_loan', deal_ref: 'POSFIN-ROUTE-0001', first_name: 'Ada', last_name: 'Test', mobile: '07700900000', email: 'ada@example.com', property_address: '1 Test Street', property_value: 500000, loan_amount: 250000, first_charge_lender: 'TestBank', first_charge_balance: 100000, first_charge_arrears_amount: 0, second_charge_present: 'no', second_charge_balance: 0, exit_strategy: 'Refinance', loan_purpose: 'Business' } }),
    wrote: () => tabs['Raw Leads'].length === 2 && tabs['Raw Leads'][1].includes('POSFIN-ROUTE-0001'),
  },
  'POST /api/factfind-event': {
    handler: 'factfindEvent', denyStatus: 200, seed: seedClickCase,
    req: () => ({ method: 'POST', body: { ref: CLICK_REF, token: tokenFor(CLICK_REF), event: 'whatsapp_cta_clicked' } }),
    wrote: () => tabs['Raw Leads'].length === 2 && !!unpack(tabs['Raw Leads'][1][5]).answers.whatsapp_cta_clicked_at,
  },
  'POST /api/acquisition-lead': {
    handler: 'acquisitionLead', denyStatus: 503,
    req: () => ({ method: 'POST', body: { name: 'Ada Test', email: 'ada@example.com', ack_later: true, ack_indicative: true } }),
    wrote: () => !!tabs['Acquisition Leads']?.some(r => r[1] === 'Ada Test'),
  },
  'POST /api/introducer': {
    handler: 'introducer', denyStatus: 503,
    req: () => ({ method: 'POST', body: { first_name: 'Ada', last_name: 'Test', email: 'ada@example.com', mobile: '07700900000' } }),
    wrote: () => tabs['Introducers'].length === 2 && tabs['Introducers'][1][3] === 'Ada Test',
  },
  'POST /api/prefill': {
    handler: 'prefill', denyStatus: 503,
    req: () => ({ method: 'POST', body: { first_name: 'Ada', mobile: '07700900000' } }),
    wrote: () => tabs['Prefill_Tokens']?.length === 2,
  },
  'GET /api/prefill': {
    handler: 'prefill', denyStatus: 503,
    seed: () => { tabs['Prefill_Tokens'] = [['Token', 'Created_At', 'Expires_At', 'Status', 'First_Name', 'Mobile', 'Email', 'Source_Channel', 'Note', 'Case_Ref', 'Route_Hint', 'Resolved_At', 'Last_Submitted_At'], ['tok123', '', '2099-01-01T00:00:00Z', 'Active', 'Ada']]; },
    req: () => ({ method: 'GET', query: { k: 'tok123' } }),
    wrote: () => !!tabs['Prefill_Tokens'][1][11],
  },
  'POST /api/solicitor-details': {
    handler: 'solicitorDetails', denyStatus: 503,
    req: () => ({ method: 'POST', body: { borrower_name: 'Ada Test', borrower_phone: '07700900000', firm_name: 'Firm LLP', firm_address: '1 Law St', firm_phone: '0200000000', acting_solicitor_name: 'Sol', acting_solicitor_email: 'sol@example.com', acting_solicitor_phone: '0200000001' } }),
    wrote: () => tabs['Website Form'].length === 2 && tabs['PIPELINE'].length === 2,
  },
};

const DENIED = {
  'ID missing':               { FACTFIND_STAGING_WRITES: 'true' },
  'ID empty':                 { FACTFIND_SHEET_ID: '', FACTFIND_STAGING_WRITES: 'true' },
  'ID whitespace':            { FACTFIND_SHEET_ID: '  ', FACTFIND_STAGING_WRITES: 'true' },
  'ID padded':                { FACTFIND_SHEET_ID: STAGING + ' ', FACTFIND_STAGING_WRITES: 'true' },
  'ID arbitrary':             { FACTFIND_SHEET_ID: 'arbitrary-sheet', FACTFIND_STAGING_WRITES: 'true' },
  'ID live master':           { FACTFIND_SHEET_ID: MASTER, FACTFIND_STAGING_WRITES: 'true' },
  'flag absent':              { FACTFIND_SHEET_ID: STAGING },
  'flag false':               { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'false' },
  'flag TRUE':                { FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'TRUE' },
};

beforeEach(resetStore);
afterEach(() => { for (const [k, v] of Object.entries(savedEnv)) v === undefined ? delete process.env[k] : process.env[k] = v; });

for (const [name, c] of Object.entries(CASES)) {
  describe(name, () => {
    for (const [label, vars] of Object.entries(DENIED)) {
      it(`Preview denied (${label}): no Sheets client, no Sheets write, no outbound side effect`, async () => {
        setEnv({ VERCEL_ENV: 'preview', TELEGRAM_BOT_TOKEN: 'test-only', FACTFIND_INTERNAL_ALERTS: 'true', ...vars });
        c.seed?.();
        const res = await call(routes[c.handler], c.req());
        assert.equal(res.statusCode, c.denyStatus, JSON.stringify(res.body));
        if (c.denyStatus === 200) assert.equal(res.body.dryRun, true);
        assert.equal(log.clients, 0, 'no Sheets client created');
        assert.deepEqual(log.sheets, []);
        assert.deepEqual(log.fetch, [], 'no Telegram / DocuSign HTTP');
        assert.equal(log.docusign, 0, 'no DocuSign envelope');
        assert.equal(c.wrote(), false);
      });
    }

    it('Preview with exact staging ID + flag true: writes land only on staging', async () => {
      setEnv({ VERCEL_ENV: 'preview', FACTFIND_SHEET_ID: STAGING, FACTFIND_STAGING_WRITES: 'true' });
      c.seed?.();
      const res = await call(routes[c.handler], c.req());
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.ok(sheetWrites().length > 0, 'a write happened');
      assert.deepEqual([...new Set(log.sheets.map(s => s.spreadsheetId))], [STAGING]);
      assert.equal(c.wrote(), true);
    });

    it('production regression: unchanged, writes reach the production sheet', async () => {
      // Deliberately "wrong" Preview settings must be irrelevant in production.
      setEnv({ VERCEL_ENV: 'production', FACTFIND_STAGING_WRITES: 'false' });
      c.seed?.();
      const res = await call(routes[c.handler], c.req());
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.ok(sheetWrites().length > 0, 'a write happened');
      assert.deepEqual([...new Set(log.sheets.map(s => s.spreadsheetId))], [MASTER]);
      assert.equal(c.wrote(), true);
    });
  });
}

describe('production regression: /api/lead honours FACTFIND_SHEET_ID override', () => {
  it('writes to the configured production sheet ID', async () => {
    setEnv({ VERCEL_ENV: 'production', FACTFIND_SHEET_ID: 'prod-configured-sheet' });
    const res = await call(routes.lead, CASES['POST /api/lead'].req());
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual([...new Set(log.sheets.map(s => s.spreadsheetId))], ['prod-configured-sheet']);
  });

  it('dry_run payload still skips writes in production', async () => {
    setEnv({ VERCEL_ENV: 'production' });
    const res = await call(routes.lead, { method: 'POST', body: { ...CASES['POST /api/lead'].req().body, dry_run: true } });
    assert.equal(res.body.dryRun, true);
    assert.equal(res.body.stagingWritesDenied, undefined);
    assert.equal(log.clients, 0);
  });
});

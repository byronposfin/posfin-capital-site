/**
 * Section 1 endpoint tests — borrower GET/PATCH, staff token, MCP service.
 *
 * Tests handler functions with mocked Supabase and req/res.
 * Covers: postcode gate, forged identity, expired/revoked tokens,
 * cross-case access, borrower-only fields, stale versions,
 * concurrent writes, idempotent replay, disabled staff auth.
 *
 * Zero live writes, no network calls.
 *
 * Run: node --test test/section-1-endpoints.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Bootstrap globals ────────────────────────────────────────────────
await import('../intake-config.js');
await import('../land-schema.js');
await import('../land-core.js');
await import('../factfind-core.js');

// ── Imports ──────────────────────────────────────────────────────────
import { setClient, generateToken, hashToken } from '../lib/supabase.js';
import { signSession } from '../lib/postcode-gate.js';
import borrowerHandler from '../api/case/[token].js';
import staffTokenHandler from '../api/case/[token]/token.js';
import mcpHandler from '../api/case-completion.js';
import pageHandler from '../api/s/[token].js';

// ── Mock Supabase ────────────────────────────────────────────────────

function createMockSupabase() {
  const tables = {
    case_completion: [],
    case_completion_audit: [],
    case_tokens: [],
    case_exports: [],
    case_gate_attempts: [],
    case_verification_codes: [],
    case_notifications: [],
  };

  function makeQuery(tableName) {
    let filters = [];
    let orderCol = null;
    let orderDir = 'asc';
    let limitN = null;
    let isMaybeSingle = false;

    const chain = {
      select() { return chain; },
      eq(col, val) { filters.push(r => r[col] === val); return chain; },
      is(col, val) { filters.push(r => r[col] === val); return chain; },
      in(col, vals) { filters.push(r => vals.includes(r[col])); return chain; },
      gte(col, val) { filters.push(r => r[col] >= val); return chain; },
      order(col, opts) { orderCol = col; orderDir = opts?.ascending === false ? 'desc' : 'asc'; return chain; },
      limit(n) { limitN = n; return chain; },
      single() { isMaybeSingle = true; return chain; },
      maybeSingle() { isMaybeSingle = true; return chain; },
      then(resolve, reject) {
        try {
          let rows = tables[tableName].filter(r => filters.every(f => f(r)));
          if (orderCol) rows.sort((a, b) => orderDir === 'asc' ? (a[orderCol] > b[orderCol] ? 1 : -1) : (a[orderCol] < b[orderCol] ? 1 : -1));
          if (limitN) rows = rows.slice(0, limitN);
          if (isMaybeSingle) { resolve({ data: rows[0] || null, error: null }); return; }
          resolve({ data: rows, error: null });
        } catch (e) { reject(e); }
      },
    };
    return chain;
  }

  function makeInsert(tableName) {
    return {
      insert(rows) {
        const arr = Array.isArray(rows) ? rows : [rows];
        const inserted = [];
        for (const row of arr) {
          const full = { id: tables[tableName].length + 1, ...row };
          tables[tableName].push(full);
          inserted.push(full);
        }
        const result = { data: null, error: null };
        result.select = () => ({ then(r) { r({ data: inserted, error: null }); } });
        result.then = (r) => { r({ data: null, error: null }); };
        return result;
      },
    };
  }

  function makeUpdate(tableName) {
    let updateData = null;
    let filters = [];
    let doSelect = false;
    const chain = {
      update(data) { updateData = data; return chain; },
      eq(col, val) { filters.push(r => r[col] === val); return chain; },
      in(col, vals) { filters.push(r => vals.includes(r[col])); return chain; },
      lt(col, val) { filters.push(r => r[col] < val); return chain; },
      select() { doSelect = true; return chain; },
      then(resolve) {
        const matched = [];
        for (const row of tables[tableName]) {
          if (filters.every(f => f(row))) { Object.assign(row, updateData); matched.push(row); }
        }
        resolve({ data: doSelect ? matched : null, error: null });
      },
    };
    return chain;
  }

  return {
    _tables: tables,
    from(table) {
      return {
        select: (...args) => makeQuery(table).select(...args),
        insert: (rows) => makeInsert(table).insert(rows),
        update: (data) => makeUpdate(table).update(data),
        eq: (...args) => makeQuery(table).eq(...args),
      };
    },
  };
}

// ── Mock req/res ─────────────────────────────────────────────────────

function mockReq({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers };
}

function mockRes() {
  const res = {
    _status: null, _json: null, _html: null, _headers: {}, _ended: false,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
    send(data) { res._html = data; return res; },
    end() { res._ended = true; return res; },
    setHeader(k, v) { res._headers[k] = v; return res; },
  };
  return res;
}

// ── Seed helpers ─────────────────────────────────────────────────────

function seedCase(client, caseId, fields = {}, version = 1) {
  client._tables.case_completion.push({
    case_id: caseId, version, fields, sections: {}, broker_only: {},
    updated_at: new Date().toISOString(), updated_by: 'system',
  });
}

function seedToken(client, caseId, opts = {}) {
  const { raw, hash } = generateToken();
  client._tables.case_tokens.push({
    token_hash: hash, case_id: caseId,
    revoked_at: opts.revoked ? new Date().toISOString() : null,
    last_used_at: null,
  });
  return { raw, hash };
}

function authedReq(method, raw, caseId, body = {}) {
  const session = signSession(caseId);
  return mockReq({ method, query: { token: raw }, headers: { cookie: `smartlink_session=${session}` }, body });
}

// ══════════════════════════════════════════════════════════════════════
// BORROWER API
// ══════════════════════════════════════════════════════════════════════

describe('Borrower GET /api/case/:token', () => {
  let client;
  beforeEach(() => { client = createMockSupabase(); setClient(client); process.env.SMARTLINK_TOKEN_SECRET = 'test-secret'; });

  it('403 gate_required without postcode or session — no personal data leaked', async () => {
    seedCase(client, 'C1', { postcode: { value: 'SW1A1AA', source: 'intake' }, first_name: { value: 'Secret', source: 'intake' } });
    const { raw } = seedToken(client, 'C1');
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw } }), res);
    assert.equal(res._status, 403);
    assert.equal(res._json.error, 'gate_required');
    assert.equal(res._json.fields, undefined, 'No fields before gate');
    assert.equal(res._json.batch, undefined, 'No batch before gate');
  });

  it('200 with borrower view after correct postcode (case-insensitive, spaces ignored)', async () => {
    seedCase(client, 'C2', { postcode: { value: 'SW1A1AA', source: 'intake' }, exit_strategy: { value: 'Sale', source: 'borrower' } });
    const { raw } = seedToken(client, 'C2');
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw, postcode: '  sw1a 1aa  ' } }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'C2');
    assert.ok(res._json.batch);
    assert.ok(res._headers['Set-Cookie']?.includes('smartlink_session='));
  });

  it('200 with valid device session cookie — no postcode needed', async () => {
    seedCase(client, 'C3', { postcode: { value: 'EC2R8AH', source: 'intake' } });
    const { raw } = seedToken(client, 'C3');
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw }, headers: { cookie: `smartlink_session=${signSession('C3')}` } }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'C3');
  });

  it('403 for incorrect postcode', async () => {
    seedCase(client, 'C4', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'C4');
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw, postcode: 'EC2R8AH' } }), res);
    assert.equal(res._status, 403);
    assert.equal(res._json.gate, 'postcode');
  });

  it('404 for unknown token', async () => {
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: 'unknown-token-value-here' } }), res);
    assert.equal(res._status, 404);
  });

  it('410 for revoked token', async () => {
    seedCase(client, 'C5');
    const { raw } = seedToken(client, 'C5', { revoked: true });
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw } }), res);
    assert.equal(res._status, 410);
    assert.match(res._json.error, /revoked/i);
  });

  it('session cookie for case A does not grant access to case B', async () => {
    seedCase(client, 'CASE-A', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    seedCase(client, 'CASE-B', { postcode: { value: 'EC2R8AH', source: 'intake' } });
    const tokenB = seedToken(client, 'CASE-B');
    // Session cookie is for CASE-A, but token resolves to CASE-B
    const sessionA = signSession('CASE-A');
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: tokenB.raw }, headers: { cookie: `smartlink_session=${sessionA}` } }), res);
    assert.equal(res._status, 403, 'Cross-case session must be rejected');
    assert.equal(res._json.error, 'gate_required');
  });

  it('expired session cookie requires fresh postcode', async () => {
    seedCase(client, 'C6', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'C6');
    // Craft an expired cookie (payload with exp in the past)
    const expiredPayload = JSON.stringify({ caseId: 'C6', exp: Date.now() - 1000 });
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', process.env.SMARTLINK_TOKEN_SECRET).update(expiredPayload).digest('base64url');
    const expiredCookie = `${Buffer.from(expiredPayload).toString('base64url')}.${sig}`;
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw }, headers: { cookie: `smartlink_session=${expiredCookie}` } }), res);
    assert.equal(res._status, 403, 'Expired session must not pass gate');
  });
});

describe('Borrower PATCH /api/case/:token', () => {
  let client;
  beforeEach(() => { client = createMockSupabase(); setClient(client); process.env.SMARTLINK_TOKEN_SECRET = 'test-secret'; });

  it('accepts borrower-owned fields, increments version, queues alert', async () => {
    seedCase(client, 'P1', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P1');
    const res = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P1', {
      expected_version: 1, idempotency_key: 'p-001',
      fields: { exit_strategy: 'Refinance', loan_purpose: 'Purchase' },
    }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
    assert.equal(res._json.version, 2);
    // Verify provenance
    const c = client._tables.case_completion.find(r => r.case_id === 'P1');
    assert.equal(c.fields.exit_strategy.source, 'borrower');
    assert.ok(c.fields.exit_strategy.confirmed_at);
  });

  it('rejects broker-only fields (proc_fee) from borrower', async () => {
    seedCase(client, 'P2', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P2');
    const res = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P2', {
      expected_version: 1, idempotency_key: 'p-002',
      fields: { proc_fee: 1500 },
    }), res);
    assert.equal(res._status, 400);
    assert.ok(res._json.rejected.includes('proc_fee'));
  });

  it('mixed borrower + broker fields: borrower accepted, broker rejected', async () => {
    seedCase(client, 'P2B', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P2B');
    const res = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P2B', {
      expected_version: 1, idempotency_key: 'p-002b',
      fields: { exit_strategy: 'Sale', proc_fee: 1500, broker_notes: 'Hacked' },
    }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.version, 2);
    assert.deepEqual(res._json.rejected, ['proc_fee', 'broker_notes']);
    const c = client._tables.case_completion.find(r => r.case_id === 'P2B');
    assert.equal(c.fields.exit_strategy.value, 'Sale');
    assert.equal(c.fields.proc_fee, undefined, 'Broker field must not be written');
    assert.equal(c.fields.broker_notes, undefined, 'Broker field must not be written');
  });

  it('409 on stale expected_version with current state and batch', async () => {
    seedCase(client, 'P3', { postcode: { value: 'SW1A1AA', source: 'intake' }, exit_strategy: { value: 'Sale', source: 'borrower' } }, 5);
    const { raw } = seedToken(client, 'P3');
    const res = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P3', {
      expected_version: 2, idempotency_key: 'p-003',
      fields: { exit_strategy: 'New' },
    }), res);
    assert.equal(res._status, 409);
    assert.equal(res._json.error, 'version_conflict');
    assert.equal(res._json.currentVersion, 5);
    assert.ok(Array.isArray(res._json.batch), '409 must include current batch');
  });

  it('replayed idempotency_key: original result, no double write, original value kept', async () => {
    seedCase(client, 'P4', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P4');
    const res1 = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P4', {
      expected_version: 1, idempotency_key: 'p-004',
      fields: { exit_strategy: 'Refinance' },
    }), res1);
    assert.equal(res1._json.version, 2);

    const res2 = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P4', {
      expected_version: 1, idempotency_key: 'p-004',
      fields: { exit_strategy: 'OVERWRITE ATTEMPT' },
    }), res2);
    assert.equal(res2._json.replayed, true);
    assert.equal(res2._json.version, 2);

    const c = client._tables.case_completion.find(r => r.case_id === 'P4');
    assert.equal(c.fields.exit_strategy.value, 'Refinance', 'Replay must not overwrite');
    assert.equal(client._tables.case_completion_audit.filter(a => a.idempotency_key === 'p-004').length, 1);
  });

  it('403 gate_required when PATCH sent without session or postcode', async () => {
    seedCase(client, 'P5', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P5');
    const res = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH', query: { token: raw },
      body: { expected_version: 1, idempotency_key: 'p-005', fields: { exit_strategy: 'X' } },
    }), res);
    assert.equal(res._status, 403);
  });

  it('concurrent writes: second writer gets 409, first write persists', async () => {
    seedCase(client, 'P6', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'P6');

    // Writer A succeeds at version 1→2
    const resA = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P6', {
      expected_version: 1, idempotency_key: 'p-006a',
      fields: { exit_strategy: 'Writer A' },
    }), resA);
    assert.equal(resA._json.version, 2);

    // Writer B tries with stale version 1 → 409
    const resB = mockRes();
    await borrowerHandler(authedReq('PATCH', raw, 'P6', {
      expected_version: 1, idempotency_key: 'p-006b',
      fields: { exit_strategy: 'Writer B' },
    }), resB);
    assert.equal(resB._status, 409);
    assert.equal(resB._json.currentVersion, 2);

    // Original value persists
    const c = client._tables.case_completion.find(r => r.case_id === 'P6');
    assert.equal(c.fields.exit_strategy.value, 'Writer A');
  });
});

// ══════════════════════════════════════════════════════════════════════
// STAFF TOKEN API — DISABLED UNTIL M365 AUTH
// ══════════════════════════════════════════════════════════════════════

describe('Staff API — POST /api/case/:id/token (M365 auth not implemented)', () => {
  let client;
  beforeEach(() => { client = createMockSupabase(); setClient(client); });

  it('returns 501 for all requests — M365 auth not yet implemented', async () => {
    seedCase(client, 'S1');
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST', query: { id: 'S1' },
      headers: { 'x-staff-user': 'Byron' },
      body: { action: 'issue' },
    }), res);
    assert.equal(res._status, 501);
    assert.match(res._json.error, /microsoft 365/i);
    assert.equal(client._tables.case_tokens.length, 0, 'No token must be created');
  });

  it('forged x-staff-user header still returns 501', async () => {
    seedCase(client, 'S2');
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST', query: { id: 'S2' },
      headers: { 'x-staff-user': 'byron' },
      body: { action: 'issue' },
    }), res);
    assert.equal(res._status, 501);
    assert.equal(client._tables.case_tokens.length, 0);
  });

  it('forged admin identity returns 501', async () => {
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST', query: { id: 'X' },
      headers: { 'x-staff-user': 'admin' },
      body: { action: 'issue' },
    }), res);
    assert.equal(res._status, 501);
  });

  it('empty header returns 501', async () => {
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST', query: { id: 'X' },
      body: { action: 'issue' },
    }), res);
    assert.equal(res._status, 501);
  });

  it('revoke also returns 501', async () => {
    seedCase(client, 'S3');
    const { hash } = seedToken(client, 'S3');
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST', query: { id: 'S3' },
      headers: { 'x-staff-user': 'Chris' },
      body: { action: 'revoke', token_hash: hash },
    }), res);
    assert.equal(res._status, 501);
  });
});

// ══════════════════════════════════════════════════════════════════════
// MCP SERVICE API
// ══════════════════════════════════════════════════════════════════════

describe('MCP API — GET/PATCH /api/case-completion', () => {
  let client;
  beforeEach(() => {
    client = createMockSupabase(); setClient(client);
    process.env.SMARTLINK_SERVICE_KEY = 'test-service-key';
  });

  it('403 without service key', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({ query: { case_id: 'X' } }), res);
    assert.equal(res._status, 403);
  });

  it('403 with wrong service key', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({ query: { case_id: 'X' }, headers: { 'x-service-key': 'wrong' } }), res);
    assert.equal(res._status, 403);
  });

  it('GET returns full case including broker_only and gaps', async () => {
    seedCase(client, 'M1', { exit_strategy: { value: 'Sale', source: 'borrower' }, product_route: { value: 'main_loan', source: 'system' } });
    client._tables.case_completion[0].broker_only = { proc_fee: 1500 };
    const res = mockRes();
    await mcpHandler(mockReq({ query: { case_id: 'M1' }, headers: { 'x-service-key': 'test-service-key' } }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'M1');
    assert.equal(res._json.broker_only.proc_fee, 1500, 'MCP must see broker_only');
    assert.ok(res._json.gaps);
  });

  it('GET 404 for unknown case', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({ query: { case_id: 'NOPE' }, headers: { 'x-service-key': 'test-service-key' } }), res);
    assert.equal(res._status, 404);
  });

  it('PATCH succeeds with valid expected_version', async () => {
    seedCase(client, 'M2', { product_route: { value: 'main_loan', source: 'system' } });
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M2', expected_version: 1, idempotency_key: 'm-001', source: 'tom', fields: { exit_strategy: 'Sale' } },
    }), res);
    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
    assert.equal(res._json.version, 2);
    assert.ok(res._json.gaps);
  });

  it('PATCH 409 on stale version with current state and gaps', async () => {
    seedCase(client, 'M3', { product_route: { value: 'main_loan', source: 'system' } }, 5);
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M3', expected_version: 2, idempotency_key: 'm-002', source: 'claude', fields: { exit_strategy: 'New' } },
    }), res);
    assert.equal(res._status, 409);
    assert.equal(res._json.currentVersion, 5);
    assert.ok(res._json.gaps);
  });

  it('PATCH replayed idempotency_key returns original result', async () => {
    seedCase(client, 'M4', { product_route: { value: 'main_loan', source: 'system' } });
    const res1 = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M4', expected_version: 1, idempotency_key: 'm-003', source: 'tom', fields: { loan_purpose: 'Original' } },
    }), res1);
    assert.equal(res1._json.version, 2);

    const res2 = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M4', expected_version: 1, idempotency_key: 'm-003', source: 'tom', fields: { loan_purpose: 'Different' } },
    }), res2);
    assert.equal(res2._json.replayed, true);
    assert.equal(res2._json.version, 2);
  });

  it('PATCH requires source field', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'X', expected_version: 1, idempotency_key: 'k' },
    }), res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /source/i);
  });

  it('PATCH requires idempotency_key', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'X', expected_version: 1, source: 'tom' },
    }), res);
    assert.equal(res._status, 400);
    assert.match(res._json.error, /idempotency/i);
  });

  it('PATCH can write broker_only fields', async () => {
    seedCase(client, 'M5', { product_route: { value: 'main_loan', source: 'system' } });
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M5', expected_version: 1, idempotency_key: 'b-001', source: 'broker', fields: {}, broker_only: { proc_fee: 2500, notes: 'Good case' } },
    }), res);
    assert.equal(res._status, 200);
    const c = client._tables.case_completion.find(r => r.case_id === 'M5');
    assert.equal(c.broker_only.proc_fee, 2500);
  });

  it('concurrent MCP writes: second gets 409', async () => {
    seedCase(client, 'M6', { product_route: { value: 'main_loan', source: 'system' } });

    const resA = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M6', expected_version: 1, idempotency_key: 'c-a', source: 'claude', fields: { exit_strategy: 'Claude A' } },
    }), resA);
    assert.equal(resA._json.version, 2);

    const resB = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH', headers: { 'x-service-key': 'test-service-key' },
      body: { case_id: 'M6', expected_version: 1, idempotency_key: 'c-b', source: 'tom', fields: { exit_strategy: 'Tom B' } },
    }), resB);
    assert.equal(resB._status, 409);

    const c = client._tables.case_completion.find(r => r.case_id === 'M6');
    assert.equal(c.fields.exit_strategy.value, 'Claude A', 'First write must persist');
  });
});

// ══════════════════════════════════════════════════════════════════════
// BORROWER PAGE — /s/:token
// ══════════════════════════════════════════════════════════════════════

describe('Borrower page — GET /s/:token', () => {
  let client;
  beforeEach(() => { client = createMockSupabase(); setClient(client); process.env.SMARTLINK_TOKEN_SECRET = 'test-secret'; });

  it('shows postcode gate when no session — HTML, no personal data', async () => {
    seedCase(client, 'PG1', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
      first_name: { value: 'Secret', source: 'intake' },
    });
    const { raw } = seedToken(client, 'PG1');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw } }), res);
    assert.equal(res._status, 403);
    assert.ok(res._html.includes('Verify your identity'), 'Must show gate');
    assert.ok(res._html.includes('postcode'), 'Must ask for postcode');
    assert.ok(!res._html.includes('Secret'), 'Must not leak personal data');
  });

  it('shows read-only view labelled "Incomplete borrower journey" — no autosave, no inputs', async () => {
    seedCase(client, 'PG2', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
      exit_strategy: { value: 'Sale', source: 'borrower' },
    });
    const { raw } = seedToken(client, 'PG2');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw, postcode: 'sw1a 1aa' } }), res);
    assert.equal(res._status, 200);
    assert.ok(res._html.includes('Incomplete borrower journey'), 'Must label as incomplete');
    assert.ok(res._html.includes('read-only view'), 'Must state read-only');
    assert.ok(res._html.includes('sl-progress'), 'Must show progress bar');
    assert.ok(!res._html.includes('<script>'), 'Must not include autosave script');
    assert.ok(!res._html.includes('<input'), 'Must not include form inputs');
    assert.ok(!res._html.includes('fetch('), 'Must not include fetch calls');
    assert.ok(res._headers['Set-Cookie']?.includes('smartlink_session='));
  });

  it('shows questionnaire with valid session cookie', async () => {
    seedCase(client, 'PG3', { postcode: { value: 'EC2R8AH', source: 'intake' } });
    const { raw } = seedToken(client, 'PG3');
    const session = signSession('PG3');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw }, headers: { cookie: `smartlink_session=${session}` } }), res);
    assert.equal(res._status, 200);
    assert.ok(res._html.includes('sl-batch'));
  });

  it('shows error for incorrect postcode', async () => {
    seedCase(client, 'PG4', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'PG4');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw, postcode: 'EC2R8AH' } }), res);
    assert.equal(res._status, 403);
    assert.ok(res._html.includes('Incorrect postcode'));
  });

  it('404 for unknown token', async () => {
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: 'unknown-token-value-here' } }), res);
    assert.equal(res._status, 404);
    assert.ok(res._html.includes('not valid'));
  });

  it('410 for revoked token', async () => {
    seedCase(client, 'PG5');
    const { raw } = seedToken(client, 'PG5', { revoked: true });
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw } }), res);
    assert.equal(res._status, 410);
    assert.ok(res._html.includes('revoked'));
  });

  it('cross-case session cookie does not bypass gate', async () => {
    seedCase(client, 'PGA', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    seedCase(client, 'PGB', { postcode: { value: 'EC2R8AH', source: 'intake' } });
    const tokenB = seedToken(client, 'PGB');
    const sessionA = signSession('PGA');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: tokenB.raw }, headers: { cookie: `smartlink_session=${sessionA}` } }), res);
    assert.equal(res._status, 403, 'Cross-case session must show gate');
    assert.ok(res._html.includes('Verify your identity'));
  });

  it('HTML contains no personal data in meta tags', async () => {
    seedCase(client, 'PG6', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
      first_name: { value: 'Alice', source: 'intake' },
      email: { value: 'alice@secret.com', source: 'intake' },
    });
    const { raw } = seedToken(client, 'PG6');
    const session = signSession('PG6');
    const res = mockRes();
    await pageHandler(mockReq({ query: { token: raw }, headers: { cookie: `smartlink_session=${session}` } }), res);
    assert.equal(res._status, 200);
    // Check meta tags don't leak data
    const metaSection = res._html.split('</head>')[0];
    assert.ok(!metaSection.includes('Alice'), 'Name must not appear in head');
    assert.ok(!metaSection.includes('alice@secret.com'), 'Email must not appear in head');
    // noindex is set
    assert.ok(metaSection.includes('noindex'));
  });
});


describe('Interactive intake privacy and feature gate', () => {
 let client;
 beforeEach(() => { client=createMockSupabase();setClient(client);process.env.SMARTLINK_TOKEN_SECRET='test-secret'; });
 it('excludes unflagged staff/unknown fields from borrower GET',async()=>{
  seedCase(client,'PRIVATE',{first_name:{value:'Alex'},proc_fee:{value:2000},assigned_broker:{value:'Chris'},internal_secret:{value:'private'}});
  const {raw}=seedToken(client,'PRIVATE'); const res=mockRes();
  await borrowerHandler(authedReq('GET',raw,'PRIVATE'),res);
  assert.equal(res._status,200); assert.deepEqual(Object.keys(res._json.fields),['first_name']);
 });
 it('interactive page is staging opt-in and retains access gate',async()=>{
  seedCase(client,'UI',{postcode:{value:'SW1A1AA'}}); const {raw}=seedToken(client,'UI');
  process.env.SMARTLINK_INTERACTIVE='staging';
  try {
   const gate=mockRes(); await pageHandler(mockReq({query:{token:raw}}),gate);assert.equal(gate._status,403);
   const page=mockRes(); await pageHandler(authedReq('GET',raw,'UI'),page);
   assert.equal(page._status,200);assert.match(page._html,/smartlink-questionnaire.js/);
  } finally {delete process.env.SMARTLINK_INTERACTIVE;}
 });
});

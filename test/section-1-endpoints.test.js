/**
 * Section 1 endpoint tests — borrower GET/PATCH, staff token, MCP service.
 *
 * Tests the actual handler functions with mocked Supabase and req/res.
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
import staffTokenHandler from '../api/case/[id]/token.js';
import mcpHandler from '../api/case-completion.js';

// ── Mock Supabase client (reused across tests) ──────────────────────

function createMockSupabase() {
  const tables = {
    case_completion: [],
    case_completion_audit: [],
    case_tokens: [],
    case_exports: [],
    case_gate_attempts: [],
    case_verification_codes: [],
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
        for (const row of arr) {
          const id = tables[tableName].length + 1;
          tables[tableName].push({ id, ...row });
        }
        return { data: null, error: null, then(r) { r({ data: null, error: null }); } };
      },
    };
  }

  function makeUpdate(tableName) {
    let updateData = null;
    let filters = [];
    const chain = {
      update(data) { updateData = data; return chain; },
      eq(col, val) { filters.push(r => r[col] === val); return chain; },
      then(resolve) {
        for (const row of tables[tableName]) {
          if (filters.every(f => f(row))) Object.assign(row, updateData);
        }
        resolve({ data: null, error: null });
      },
    };
    return chain;
  }

  const client = {
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

  return client;
}

// ── Mock req/res ─────────────────────────────────────────────────────

function mockReq({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers };
}

function mockRes() {
  const res = {
    _status: null,
    _json: null,
    _headers: {},
    _ended: false,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; },
    end() { res._ended = true; return res; },
    setHeader(k, v) { res._headers[k] = v; return res; },
  };
  return res;
}

// ── Seed a case with a token ─────────────────────────────────────────

function seedCase(client, caseId, fields = {}, version = 1) {
  client._tables.case_completion.push({
    case_id: caseId,
    version,
    fields,
    sections: {},
    broker_only: {},
    updated_at: new Date().toISOString(),
    updated_by: 'system',
  });
}

function seedToken(client, caseId) {
  const { raw, hash } = generateToken();
  client._tables.case_tokens.push({
    token_hash: hash,
    case_id: caseId,
    revoked_at: null,
    last_used_at: null,
  });
  return { raw, hash };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Borrower API — GET /api/case/:token', () => {
  let client;

  beforeEach(() => {
    client = createMockSupabase();
    setClient(client);
    process.env.SMARTLINK_TOKEN_SECRET = 'test-secret-for-endpoints';
  });

  it('returns 403 gate_required when no postcode/session provided', async () => {
    seedCase(client, 'CASE-GATE-1', { postcode: { value: 'SW1A1AA', source: 'intake' } });
    const { raw } = seedToken(client, 'CASE-GATE-1');

    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw } }), res);

    assert.equal(res._status, 403);
    assert.equal(res._json.error, 'gate_required');
    assert.equal(res._json.gate, 'postcode');
    // No personal data before gate passes
    assert.equal(res._json.fields, undefined);
    assert.equal(res._json.batch, undefined);
  });

  it('returns borrower view after correct postcode', async () => {
    seedCase(client, 'CASE-GATE-2', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
      exit_strategy: { value: 'Refinance', source: 'borrower' },
    });
    const { raw } = seedToken(client, 'CASE-GATE-2');

    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw, postcode: 'sw1a 1aa' } }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'CASE-GATE-2');
    assert.equal(res._json.version, 1);
    assert.ok(res._json.batch, 'Should include gap engine batch');
    assert.ok(res._json.progress, 'Should include progress');
    // Session cookie set
    assert.ok(res._headers['Set-Cookie']?.includes('smartlink_session='));
  });

  it('returns borrower view when valid session cookie present', async () => {
    seedCase(client, 'CASE-SESSION', {
      postcode: { value: 'EC2R8AH', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-SESSION');
    const sessionCookie = signSession('CASE-SESSION');

    const res = mockRes();
    await borrowerHandler(mockReq({
      query: { token: raw },
      headers: { cookie: `smartlink_session=${sessionCookie}` },
    }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'CASE-SESSION');
  });

  it('returns 403 for incorrect postcode', async () => {
    seedCase(client, 'CASE-WRONG-PC', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-WRONG-PC');

    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw, postcode: 'EC2R8AH' } }), res);

    assert.equal(res._status, 403);
    assert.equal(res._json.gate, 'postcode');
  });

  it('returns 404 for unknown token', async () => {
    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: 'unknown-token-value-here' } }), res);
    assert.equal(res._status, 404);
  });

  it('returns 410 for revoked token', async () => {
    seedCase(client, 'CASE-REVOKED');
    const { raw, hash } = generateToken();
    client._tables.case_tokens.push({
      token_hash: hash, case_id: 'CASE-REVOKED',
      revoked_at: new Date().toISOString(), last_used_at: null,
    });

    const res = mockRes();
    await borrowerHandler(mockReq({ query: { token: raw } }), res);
    assert.equal(res._status, 410);
  });
});

describe('Borrower API — PATCH /api/case/:token', () => {
  let client;

  beforeEach(() => {
    client = createMockSupabase();
    setClient(client);
    process.env.SMARTLINK_TOKEN_SECRET = 'test-secret-for-endpoints';
  });

  it('accepts borrower-owned fields and increments version', async () => {
    seedCase(client, 'CASE-PATCH-1', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-PATCH-1');
    const session = signSession('CASE-PATCH-1');

    const res = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      headers: { cookie: `smartlink_session=${session}` },
      body: {
        expected_version: 1,
        idempotency_key: 'patch-001',
        fields: { exit_strategy: 'Refinance', loan_purpose: 'Purchase' },
      },
    }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
    assert.equal(res._json.version, 2);
  });

  it('rejects broker-only fields from borrower', async () => {
    seedCase(client, 'CASE-PATCH-REJECT', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-PATCH-REJECT');
    const session = signSession('CASE-PATCH-REJECT');

    const res = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      headers: { cookie: `smartlink_session=${session}` },
      body: {
        expected_version: 1,
        idempotency_key: 'patch-reject',
        fields: { proc_fee: 1500 }, // broker-only
      },
    }), res);

    assert.equal(res._status, 400);
    assert.ok(res._json.rejected.includes('proc_fee'));
  });

  it('returns 409 on stale expected_version with current state', async () => {
    seedCase(client, 'CASE-409', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
      exit_strategy: { value: 'Sale', source: 'borrower' },
    }, 5);
    const { raw } = seedToken(client, 'CASE-409');
    const session = signSession('CASE-409');

    const res = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      headers: { cookie: `smartlink_session=${session}` },
      body: {
        expected_version: 2, // stale
        idempotency_key: 'stale-001',
        fields: { exit_strategy: 'New exit' },
      },
    }), res);

    assert.equal(res._status, 409);
    assert.equal(res._json.error, 'version_conflict');
    assert.equal(res._json.currentVersion, 5);
    // Should include current borrower view
    assert.ok(res._json.batch !== undefined, '409 should include current batch');
  });

  it('replayed idempotency_key returns original result without double write', async () => {
    seedCase(client, 'CASE-IDEM', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-IDEM');
    const session = signSession('CASE-IDEM');

    // First write
    const res1 = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      headers: { cookie: `smartlink_session=${session}` },
      body: {
        expected_version: 1,
        idempotency_key: 'idem-borrower-001',
        fields: { exit_strategy: 'Refinance' },
      },
    }), res1);
    assert.equal(res1._status, 200);
    assert.equal(res1._json.version, 2);

    // Replay same idempotency_key
    const res2 = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      headers: { cookie: `smartlink_session=${session}` },
      body: {
        expected_version: 1,
        idempotency_key: 'idem-borrower-001',
        fields: { exit_strategy: 'Different value' },
      },
    }), res2);
    assert.equal(res2._status, 200);
    assert.equal(res2._json.replayed, true);
    assert.equal(res2._json.version, 2);

    // Case should still have the original value
    const c = client._tables.case_completion.find(r => r.case_id === 'CASE-IDEM');
    assert.equal(c.fields.exit_strategy.value, 'Refinance');

    // Only one audit row for this key
    const audits = client._tables.case_completion_audit.filter(a => a.idempotency_key === 'idem-borrower-001');
    assert.equal(audits.length, 1);
  });

  it('requires postcode gate before PATCH', async () => {
    seedCase(client, 'CASE-PATCH-GATE', {
      postcode: { value: 'SW1A1AA', source: 'intake' },
    });
    const { raw } = seedToken(client, 'CASE-PATCH-GATE');

    const res = mockRes();
    await borrowerHandler(mockReq({
      method: 'PATCH',
      query: { token: raw },
      // No cookie, no postcode in body
      body: {
        expected_version: 1,
        idempotency_key: 'patch-nogate',
        fields: { exit_strategy: 'Refinance' },
      },
    }), res);

    assert.equal(res._status, 403);
    assert.equal(res._json.error, 'gate_required');
  });
});

describe('Staff API — POST /api/case/:id/token', () => {
  let client;

  beforeEach(() => {
    client = createMockSupabase();
    setClient(client);
  });

  it('issues a token when staff-authenticated', async () => {
    seedCase(client, 'CASE-STAFF-1');

    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST',
      query: { id: 'CASE-STAFF-1' },
      headers: { 'x-staff-user': 'Byron' },
      body: { action: 'issue' },
    }), res);

    assert.equal(res._status, 201);
    assert.equal(res._json.ok, true);
    assert.ok(res._json.token, 'Raw token must be returned');
    assert.equal(res._json.case_id, 'CASE-STAFF-1');
    // Token stored in DB
    assert.equal(client._tables.case_tokens.length, 1);
    assert.equal(client._tables.case_tokens[0].case_id, 'CASE-STAFF-1');
  });

  it('revokes a token', async () => {
    seedCase(client, 'CASE-STAFF-2');
    const { hash } = seedToken(client, 'CASE-STAFF-2');

    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST',
      query: { id: 'CASE-STAFF-2' },
      headers: { 'x-staff-user': 'Chris' },
      body: { action: 'revoke', token_hash: hash },
    }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.revoked, true);
    assert.ok(client._tables.case_tokens[0].revoked_at);
  });

  it('rejects unauthenticated requests', async () => {
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST',
      query: { id: 'CASE-X' },
      body: { action: 'issue' },
    }), res);

    assert.equal(res._status, 403);
  });

  it('rejects non-allowlisted users', async () => {
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST',
      query: { id: 'CASE-X' },
      headers: { 'x-staff-user': 'hacker' },
      body: { action: 'issue' },
    }), res);

    assert.equal(res._status, 403);
  });

  it('returns 404 for unknown case', async () => {
    const res = mockRes();
    await staffTokenHandler(mockReq({
      method: 'POST',
      query: { id: 'NONEXISTENT' },
      headers: { 'x-staff-user': 'Byron' },
      body: { action: 'issue' },
    }), res);

    assert.equal(res._status, 404);
  });
});

describe('MCP API — GET/PATCH /api/case-completion', () => {
  let client;

  beforeEach(() => {
    client = createMockSupabase();
    setClient(client);
    process.env.SMARTLINK_SERVICE_KEY = 'test-service-key';
  });

  it('rejects requests without service key', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({ query: { case_id: 'X' } }), res);
    assert.equal(res._status, 403);
  });

  it('rejects requests with wrong service key', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({
      query: { case_id: 'X' },
      headers: { 'x-service-key': 'wrong-key' },
    }), res);
    assert.equal(res._status, 403);
  });

  it('GET returns full case including broker_only and gaps', async () => {
    seedCase(client, 'CASE-MCP-1', {
      exit_strategy: { value: 'Refinance', source: 'borrower' },
      product_route: { value: 'main_loan', source: 'system' },
    });
    client._tables.case_completion[0].broker_only = { proc_fee: 1500 };

    const res = mockRes();
    await mcpHandler(mockReq({
      query: { case_id: 'CASE-MCP-1' },
      headers: { 'x-service-key': 'test-service-key' },
    }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.case_id, 'CASE-MCP-1');
    assert.equal(res._json.broker_only.proc_fee, 1500);
    assert.ok(res._json.gaps, 'Should include gap analysis');
    assert.ok(res._json.gaps.batch, 'Should include batch');
  });

  it('GET returns 404 for unknown case', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({
      query: { case_id: 'NOPE' },
      headers: { 'x-service-key': 'test-service-key' },
    }), res);
    assert.equal(res._status, 404);
  });

  it('PATCH with valid expected_version succeeds', async () => {
    seedCase(client, 'CASE-MCP-PATCH', {
      product_route: { value: 'main_loan', source: 'system' },
    });

    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'CASE-MCP-PATCH',
        expected_version: 1,
        idempotency_key: 'mcp-001',
        source: 'tom',
        fields: { exit_strategy: 'Sale' },
      },
    }), res);

    assert.equal(res._status, 200);
    assert.equal(res._json.ok, true);
    assert.equal(res._json.version, 2);
    assert.ok(res._json.gaps, 'Should include updated gaps');
  });

  it('PATCH with stale version returns 409 with current state and gaps', async () => {
    seedCase(client, 'CASE-MCP-STALE', {
      product_route: { value: 'main_loan', source: 'system' },
    }, 5);

    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'CASE-MCP-STALE',
        expected_version: 2,
        idempotency_key: 'mcp-stale',
        source: 'claude',
        fields: { exit_strategy: 'New' },
      },
    }), res);

    assert.equal(res._status, 409);
    assert.equal(res._json.error, 'version_conflict');
    assert.equal(res._json.currentVersion, 5);
    assert.ok(res._json.gaps, '409 should include gaps');
  });

  it('PATCH replayed idempotency_key returns original result', async () => {
    seedCase(client, 'CASE-MCP-IDEM', {
      product_route: { value: 'main_loan', source: 'system' },
    });

    // First write
    const res1 = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'CASE-MCP-IDEM',
        expected_version: 1,
        idempotency_key: 'mcp-idem-001',
        source: 'tom',
        fields: { loan_purpose: 'Original' },
      },
    }), res1);
    assert.equal(res1._json.version, 2);

    // Replay
    const res2 = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'CASE-MCP-IDEM',
        expected_version: 1,
        idempotency_key: 'mcp-idem-001',
        source: 'tom',
        fields: { loan_purpose: 'Different' },
      },
    }), res2);

    assert.equal(res2._status, 200);
    assert.equal(res2._json.replayed, true);
    assert.equal(res2._json.version, 2);
  });

  it('PATCH requires source', async () => {
    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'X',
        expected_version: 1,
        idempotency_key: 'k',
        // source missing
      },
    }), res);

    assert.equal(res._status, 400);
    assert.match(res._json.error, /source/i);
  });

  it('PATCH can write broker_only fields', async () => {
    seedCase(client, 'CASE-MCP-BROKER', {
      product_route: { value: 'main_loan', source: 'system' },
    });

    const res = mockRes();
    await mcpHandler(mockReq({
      method: 'PATCH',
      headers: { 'x-service-key': 'test-service-key' },
      body: {
        case_id: 'CASE-MCP-BROKER',
        expected_version: 1,
        idempotency_key: 'broker-001',
        source: 'broker',
        fields: {},
        broker_only: { proc_fee: 2500, notes: 'Good case' },
      },
    }), res);

    assert.equal(res._status, 200);
    const c = client._tables.case_completion.find(r => r.case_id === 'CASE-MCP-BROKER');
    assert.equal(c.broker_only.proc_fee, 2500);
    assert.equal(c.broker_only.notes, 'Good case');
  });
});

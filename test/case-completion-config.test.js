import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/case-completion.js';

const original = process.env.SMARTLINK_SERVICE_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.SMARTLINK_SERVICE_KEY;
  else process.env.SMARTLINK_SERVICE_KEY = original;
});

describe('case completion service configuration', () => {
  it('fails closed with 503 instead of throwing a runtime 500 when service auth is unset', async () => {
    delete process.env.SMARTLINK_SERVICE_KEY;
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ method: 'GET', query: { case_id: 'synthetic-only' }, headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: 'SmartLink service endpoint is not configured' });
  });
});

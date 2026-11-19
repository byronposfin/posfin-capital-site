import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/address-lookup.js';
import avmHandler from '../api/propertydata-avm.js';

const original = {
  PROPERTYDATA_API_KEY: process.env.PROPERTYDATA_API_KEY,
  PROPERTYDATA_KEY: process.env.PROPERTYDATA_KEY,
};
const originalFetch = globalThis.fetch;

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

describe('address lookup PropertyData environment key', () => {
  it('uses the established PROPERTYDATA_KEY when the endpoint-specific alias is absent', async () => {
    delete process.env.PROPERTYDATA_API_KEY;
    process.env.PROPERTYDATA_KEY = 'test-key';
    let requestedUrl;
    globalThis.fetch = async url => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ status: 'success', data: [] }) };
    };
    const res = response();
    await handler({ method: 'GET', query: { postcode: 'SW1A 1AA' }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrl.searchParams.get('key'), 'test-key');
    assert.equal(requestedUrl.searchParams.get('postcode'), 'SW1A1AA');
  });

  it('prefers PROPERTYDATA_API_KEY when both names are configured', async () => {
    process.env.PROPERTYDATA_API_KEY = 'specific-key';
    process.env.PROPERTYDATA_KEY = 'legacy-key';
    let requestedUrl;
    globalThis.fetch = async url => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => ({ status: 'success', data: [] }) };
    };
    const res = response();
    await handler({ method: 'GET', query: { postcode: 'SW1A 1AA' }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrl.searchParams.get('key'), 'specific-key');
  });

  it('uses PROPERTYDATA_API_KEY for the valuation proxy as well', async () => {
    delete process.env.PROPERTYDATA_KEY;
    process.env.PROPERTYDATA_API_KEY = 'shared-key';
    let requestedUrl;
    globalThis.fetch = async url => {
      requestedUrl = new URL(url);
      return { json: async () => ({ status: 'success', data: { average: 100000, '70pc_range': [90000, 110000], raw_data: [] } }) };
    };
    const res = response();
    await avmHandler({ method: 'GET', query: { postcode: 'SW1A1AA' }, headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(requestedUrl.searchParams.get('key'), 'shared-key');
  });
});

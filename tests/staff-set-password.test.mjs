import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { handleSetPassword } from '../api/staff-set-password.js';
import { STAFF_LINK_PLAN, SET_PASSWORD_REDIRECT } from '../lib/staff-auth-links.js';

const ENV = {
  STAFF_SUPABASE_URL: 'https://example.test',
  STAFF_SUPABASE_ANON_KEY: 'anon-key',
  STAFF_SUPABASE_SERVICE_KEY: 'service-key-secret',
};

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value == null ? '' : String(value); },
  };
}

test('the link plan invites Chris and Jess and recovers Byron and Aadi', () => {
  assert.deepEqual(STAFF_LINK_PLAN, [
    { action: 'invite', email: 'chris.shipton@posfincapital.com' },
    { action: 'invite', email: 'jessica@posfincapital.com' },
    { action: 'recovery', email: 'byron.hill@posfincapital.com' },
    { action: 'recovery', email: 'aadi@posfincapital.com' },
  ]);
  assert.equal(SET_PASSWORD_REDIRECT, 'https://posfincapital.com/staff/set-password');
  assert.equal(JSON.stringify(STAFF_LINK_PLAN).includes('cai@'), false);
  assert.equal(JSON.stringify(STAFF_LINK_PLAN).includes('gmail.com'), false);
  const grant = readFileSync(new URL('../supabase/proposed/20261122_staff_allowlist_grant.sql', import.meta.url), 'utf8');
  assert.match(grant, /DO NOT APPLY/);
  assert.equal(/grant select on table pipeline\.staff_allowlist/i.test(grant), false);
});

test('an invite token opens the password form and an expired link offers a new one', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: options.body, auth: options.headers.Authorization, key: options.headers.apikey });
    if (String(url).includes('/auth/v1/verify')) return response(200, { access_token: 'invite-token' });
    return response(200, [{ email: 'chris.shipton@posfincapital.com', seat_code: 'chris', role: 'case_owner' }]);
  };
  const res = mockRes();
  await handleSetPassword({
    method: 'GET',
    url: '/staff/set-password?token_hash=hash-secret&type=invite',
    headers: {},
    query: { token_hash: 'hash-secret', type: 'invite' },
  }, res, { env: ENV, fetch: fetchImpl });
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, '/staff/set-password?ready=1');
  assert.match(res.headers['set-cookie'], /pf_setup=/);
  assert.equal(res.body.includes('hash-secret'), false);
  assert.equal(calls[0].key, 'anon-key');
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);

  const expired = mockRes();
  await handleSetPassword({
    method: 'GET',
    url: '/staff/set-password?error_code=otp_expired',
    headers: {},
    query: { error_code: 'otp_expired' },
  }, expired, { env: ENV, fetch: fetchImpl });
  assert.equal(expired.statusCode, 400);
  assert.match(expired.body, /expired/);
  assert.match(expired.body, /Send me a new link/);

  const used = mockRes();
  await handleSetPassword({
    method: 'GET',
    url: '/staff/set-password?error_code=already_used',
    headers: {},
    query: { error_code: 'already_used' },
  }, used, { env: ENV, fetch: fetchImpl });
  assert.match(used.body, /already been used/);
});

test('a hash-fragment token and a matching password reach Live cases', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), method: options.method, auth: options.headers.Authorization, body: options.body });
    if (String(url).includes('/auth/v1/user')) return response(200, { email: 'jessica@posfincapital.com' });
    return response(200, [{ email: 'jessica@posfincapital.com', seat_code: 'jess', role: 'case_owner' }]);
  };
  const opened = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { action: 'fragment', access_token: 'fragment-token', type: 'recovery' },
  }, opened, { env: ENV, fetch: fetchImpl });
  assert.equal(opened.statusCode, 303);
  assert.equal(opened.body.includes('fragment-token'), false);

  const mismatch = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { cookie: 'pf_setup=fragment-token', 'content-type': 'application/json' },
    body: { action: 'set', password: 'correct-horse', confirm: 'other-horse1' },
  }, mismatch, { env: ENV, fetch: fetchImpl });
  assert.equal(mismatch.statusCode, 400);
  assert.match(mismatch.body, /do not match/);
  assert.equal(calls.some((call) => call.method === 'PUT'), false);

  const saved = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { cookie: 'pf_setup=fragment-token', 'content-type': 'application/json' },
    body: { action: 'set', password: 'correct-horse', confirm: 'correct-horse' },
  }, saved, { env: ENV, fetch: fetchImpl });
  assert.equal(saved.statusCode, 303);
  assert.equal(saved.headers.location, '/staff/cockpit/live');
  const cookies = [].concat(saved.headers['set-cookie']);
  assert.equal(cookies.some((item) => item.includes('pf_staff=sb1.fragment-token')), true);
  const update = calls.find((call) => call.method === 'PUT');
  assert.equal(update.auth, 'Bearer fragment-token');
  assert.equal(update.body.includes('correct-horse'), true);
  assert.equal(saved.body.includes('correct-horse'), false);
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);
});

test('a new link is requested only for a verified seat', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: options.body, key: options.headers.apikey });
    return response(200, {});
  };
  const ok = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { action: 'resend', email: 'chris.shipton@posfincapital.com' },
  }, ok, { env: ENV, fetch: fetchImpl });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.body, /new link is on its way/);
  const recoverUrl = new URL(calls[0].url);
  assert.equal(recoverUrl.pathname, '/auth/v1/recover');
  assert.equal(recoverUrl.searchParams.get('redirect_to'), SET_PASSWORD_REDIRECT);
  assert.equal(JSON.parse(calls[0].body).redirect_to, undefined);
  assert.equal(JSON.parse(calls[0].body).email, 'chris.shipton@posfincapital.com');
  assert.equal(calls[0].key, 'anon-key');

  for (const email of ['cai@posfincapital.com', 'vanessa@posfincapital.com']) {
    const allowed = mockRes();
    await handleSetPassword({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { action: 'resend', email },
    }, allowed, { env: ENV, fetch: fetchImpl });
    assert.equal(allowed.statusCode, 200);
  }

  const before = calls.length;
  const denied = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { action: 'resend', email: 'stranger@example.invalid' },
  }, denied, { env: ENV, fetch: fetchImpl });
  assert.equal(denied.statusCode, 400);
  assert.match(denied.body, /not on the staff list/);
  assert.equal(calls.length, before);
});

test('a signed-in seat changes its own password with that session', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), method: options.method, auth: options.headers && options.headers.Authorization, body: options.body || '' });
    if (String(url).includes('/auth/v1/user') && options.method === 'PUT') return response(200, {});
    return response(200, [{ email: 'vanessa@posfincapital.com', seat_code: 'vanessa', role: 'case_owner' }]);
  };
  const anon = mockRes();
  await handleSetPassword({
    method: 'GET',
    url: '/staff/set-password?change=1',
    headers: {},
    query: { change: '1' },
  }, anon, { env: ENV, fetch: fetchImpl });
  assert.equal(anon.statusCode, 401);
  assert.match(anon.body, /Sign in on the cockpit first/);
  assert.equal(calls.length, 0);

  const form = mockRes();
  await handleSetPassword({
    method: 'GET',
    url: '/staff/set-password?change=1',
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.user-access')}` },
    query: { change: '1' },
  }, form, { env: ENV, fetch: fetchImpl });
  assert.equal(form.statusCode, 200);
  assert.match(form.body, /Change your password/);
  assert.match(form.body, /name="change" value="1"/);

  const saved = mockRes();
  await handleSetPassword({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.user-access')}`, 'content-type': 'application/json' },
    body: { action: 'set', change: '1', password: 'correct-horse', confirm: 'correct-horse' },
  }, saved, { env: ENV, fetch: fetchImpl });
  assert.equal(saved.statusCode, 303);
  assert.equal(saved.headers.location, '/staff/cockpit');
  const update = calls.find((call) => call.method === 'PUT');
  assert.equal(update.auth, 'Bearer user-access');
  assert.equal(update.body.includes('correct-horse'), true);
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);
});

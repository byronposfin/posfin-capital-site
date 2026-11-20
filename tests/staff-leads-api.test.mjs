import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffLeadsHandler } from '../api/staff-leads.js';
import { csrfFor, encodeSession } from '../lib/staff-auth.js';

const anon = `a.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.c`;
const service = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c`;
const LEAD = '00000000-0000-4000-8000-000000000009';
const baseEnv = {
  STAFF_LEADS_SUPABASE_URL: 'http://127.0.0.1:9',
  STAFF_LEADS_ANON_KEY: 'local-anon',
};

function cookieFor(token = 'access-token') {
  return `pf_leads=${encodeURIComponent(encodeSession({ access_token: token, refresh_token: 'refresh-token', expires_at: 4_000_000_000 }))}`;
}

function harness(env, impl) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    return impl(String(url), opts, calls);
  };
  const handler = createStaffLeadsHandler({ env: { ...baseEnv, ...env }, fetch: fetchImpl, now: () => 1_700_000_000_000 });
  return {
    calls,
    async run(req) {
      let body = '';
      const res = {
        statusCode: 0,
        headers: {},
        setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
        end(value) { body = value || ''; },
      };
      await handler(req, res);
      return { status: res.statusCode, headers: res.headers, body };
    },
  };
}

function ok(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

test('anonymous visitors get the sign-in page and no lead rows', async () => {
  const app = harness({}, () => ok([]));
  const res = await app.run({ method: 'GET', headers: {}, url: '/api/staff-leads' });
  assert.equal(res.status, 200);
  assert.match(res.body, /Sign in/);
  assert.equal(res.body.includes('Ada Example'), false);
  assert.equal(app.calls.length, 0);
  assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
});

test('a staff session reads the live book with the service role kept off the page', async () => {
  const app = harness({ SUPABASE_MAIN_SERVICE_ROLE_KEY: service, STAFF_LEADS_ANON_KEY: anon, VERCEL: '1', STAFF_LEADS_SUPABASE_URL: 'https://evil.supabase.co' }, (url, opts) => {
    if (url.endsWith('/auth/v1/user')) return ok({ email: 'byron.hill@posfincapital.com' });
    if (url.includes('/crm_users')) return ok([{ email: 'byron.hill@posfincapital.com', role: 'admin' }]);
    if (url.endsWith('/staff_list_live_leads')) {
      return ok([{
        id: LEAD, created_at: '2026-11-20T09:00:00.000Z', full_name: 'Ada Example', email: 'ada@example.test',
        phone: '07000000000', status: 'statements_reviewed', assigned_to: 'byron.hill@posfincapital.com',
        source: 'web_factfind_uk', stage: 'LOR', factfind_reference: 'POSFIN-WEB-EXAMPLE', postcode: 'SW6 5AA',
      }]);
    }
    return ok([]);
  });
  const res = await app.run({ method: 'GET', headers: { cookie: cookieFor() }, url: '/staff/leads' });
  assert.equal(res.status, 200);
  assert.match(res.body, /Ada Example/);
  assert.match(res.body, /POSFIN-WEB-EXAMPLE/);
  assert.match(res.body, /SW6 5AA/);
  assert.equal(res.body.includes(service), false);
  assert.equal(res.body.includes(anon), false);
  const list = app.calls.find((call) => call.url.endsWith('/staff_list_live_leads'));
  assert.equal(list.opts.headers.Authorization, `Bearer ${service}`);
  assert.equal(list.url.startsWith('https://vgflcrfaudrvrdmxjdtl.supabase.co/'), true);
  const user = app.calls.find((call) => call.url.endsWith('/auth/v1/user'));
  assert.equal(user.opts.headers.apikey, anon);
  assert.equal(user.opts.headers.Authorization, 'Bearer access-token');
});

test('saving records the signed-in staff email and ignores an actor hidden in the form', async () => {
  const app = harness({}, (url, opts) => {
    if (url.endsWith('/auth/v1/user')) return ok({ email: 'byron.hill@posfincapital.com' });
    if (url.includes('/crm_users')) return ok([{ email: 'byron.hill@posfincapital.com', role: 'admin' }]);
    if (url.includes('/rest/v1/leads?')) return ok([{ id: LEAD, full_name: 'Ada Example', status: 'new', source: 'manual', raw_answers: {} }]);
    if (url.endsWith('/staff_apply_lead_change')) return ok({ ok: true, changed: true, id: LEAD });
    if (url.includes('/lead_activity')) return ok([]);
    return ok([]);
  });
  const token = 'access-token';
  const body = new URLSearchParams({
    action: 'save', csrf: csrfFor(token), lead: LEAD, status: 'contacted', assigned_to: 'byron.hill@posfincapital.com',
    stage: 'Pre-LOR', note: 'Spoke today.', actor: 'someone.else@posfincapital.com',
  });
  const res = await app.run({
    method: 'POST',
    headers: { cookie: cookieFor(token), 'content-type': 'application/x-www-form-urlencoded', origin: 'https://posfincapital.com', host: 'posfincapital.com' },
    url: `/api/staff-leads?lead=${LEAD}`,
    body: Object.fromEntries(body),
  });
  assert.equal(res.status, 303);
  assert.match(res.headers.location, new RegExp(`/staff/leads/${LEAD}\\?saved=1`));
  const write = app.calls.find((call) => call.url.endsWith('/staff_apply_lead_change'));
  const payload = JSON.parse(write.opts.body);
  assert.equal(payload.p_actor, 'byron.hill@posfincapital.com');
  assert.equal(payload.p_note, 'Spoke today.');
  assert.equal(payload.p_stage, 'Pre-LOR');
  assert.equal(payload.p_status, 'contacted');
  assert.equal(write.opts.headers.Authorization, 'Bearer access-token');
  assert.equal(write.opts.headers.apikey, 'local-anon');
  assert.equal(app.calls.some((call) => call.opts.method === 'DELETE'), false);
});

test('a bad stage is refused before any write', async () => {
  const app = harness({}, (url) => {
    if (url.endsWith('/auth/v1/user')) return ok({ email: 'byron.hill@posfincapital.com' });
    if (url.includes('/crm_users')) return ok([{ email: 'byron.hill@posfincapital.com', role: 'admin' }]);
    if (url.includes('/rest/v1/leads?')) return ok([{ id: LEAD, full_name: 'Ada Example', status: 'new', source: 'manual', raw_answers: {} }]);
    if (url.includes('/lead_activity')) return ok([]);
    return ok({ ok: true });
  });
  const token = 'access-token';
  const res = await app.run({
    method: 'POST',
    headers: { cookie: cookieFor(token), origin: 'https://posfincapital.com', host: 'posfincapital.com' },
    url: `/api/staff-leads?lead=${LEAD}`,
    body: { action: 'save', csrf: csrfFor(token), lead: LEAD, status: 'new', stage: 'Invented', note: '' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body, /Choose a stage/);
  assert.equal(app.calls.some((call) => call.url.endsWith('/staff_apply_lead_change')), false);
});

test('login stays on the anon key and rejects a non-staff domain before the database', async () => {
  const app = harness({}, () => ok({}));
  const res = await app.run({
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://posfincapital.com', host: 'posfincapital.com' },
    body: { action: 'login', email: 'ada@gmail.com', password: 'secret-password' },
  });
  assert.equal(res.status, 401);
  assert.equal(app.calls.length, 0);
  assert.equal(res.body.includes('secret-password'), false);
});

test('login stores an httpOnly cookie only after the staff list confirms the account', async () => {
  const app = harness({}, (url, opts) => {
    if (url.includes('grant_type=password')) {
      assert.equal(opts.headers.apikey, 'local-anon');
      assert.equal(opts.headers.Authorization, undefined);
      return ok({
        access_token: 'new-access', refresh_token: 'new-refresh', expires_at: 4_000_000_000,
        user: { email: 'byron.hill@posfincapital.com' },
      });
    }
    if (url.includes('/crm_users')) return ok([{ email: 'byron.hill@posfincapital.com', role: 'admin' }]);
    return ok({});
  });
  const res = await app.run({
    method: 'POST',
    headers: { origin: 'https://posfincapital.com', host: 'posfincapital.com' },
    body: { action: 'login', email: 'Byron.Hill@posfincapital.com', password: 'correct-horse' },
  });
  assert.equal(res.status, 303);
  assert.match(res.headers['set-cookie'], /pf_leads=/);
  assert.match(res.headers['set-cookie'], /HttpOnly/);
  assert.match(res.headers['set-cookie'], /Path=\/staff/);
  assert.equal(res.headers['set-cookie'].includes('correct-horse'), false);
  assert.equal(res.body.includes('correct-horse'), false);
});

test('delete and cross-site posts are refused', async () => {
  const app = harness({}, (url) => {
    if (url.endsWith('/auth/v1/user')) return ok({ email: 'byron.hill@posfincapital.com' });
    if (url.includes('/crm_users')) return ok([{ email: 'byron.hill@posfincapital.com', role: 'admin' }]);
    return ok([]);
  });
  const removed = await app.run({ method: 'DELETE', headers: { cookie: cookieFor() } });
  assert.equal(removed.status, 405);
  const opaque = await app.run({
    method: 'POST',
    headers: { origin: 'null', host: 'posfincapital.com', 'sec-fetch-site': 'same-origin', 'content-type': 'application/x-www-form-urlencoded' },
    body: { action: 'login', email: 'ada@gmail.com', password: 'x' },
  });
  assert.equal(opaque.status, 401);
  assert.match(opaque.body, /not recognised/);
  const cross = await app.run({
    method: 'POST',
    headers: { cookie: cookieFor(), origin: 'https://evil.example', host: 'posfincapital.com', 'sec-fetch-site': 'cross-site' },
    body: { action: 'save', lead: LEAD },
  });
  assert.equal(cross.status, 403);
  assert.equal(app.calls.some((call) => call.url.endsWith('/staff_apply_lead_change')), false);
});

test('an authenticated account that is not on the staff list sees no leads', async () => {
  const app = harness({}, (url) => {
    if (url.endsWith('/auth/v1/user')) return ok({ email: 'visitor@posfincapital.com' });
    if (url.includes('/crm_users')) return ok([]);
    return ok([{ full_name: 'Ada Example' }]);
  });
  const res = await app.run({ method: 'GET', headers: { cookie: cookieFor() }, url: '/staff/leads' });
  assert.equal(res.status, 401);
  assert.equal(res.body.includes('Ada Example'), false);
  assert.equal(app.calls.some((call) => call.url.endsWith('/staff_list_live_leads')), false);
});

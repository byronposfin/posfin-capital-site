import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import handler from '../api/factfind.js';
import { landFields } from '../lib/ff-land-fields.js';
import { visible } from '../lib/ff-land.js';
import {
  PIXEL_ID, CAPI_URL, buildLeadEvent, clientIp, eventId, eventSourceUrl,
  hashEmail, hashPhone, normaliseEmail, normaliseName, normalisePhone, safeMetaLeadFromRequest,
  sendMetaLead, splitName,
} from '../lib/meta-capi.js';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const EVENT = '11111111-1111-4111-8111-111111111111';

describe('Meta lead tracking', { concurrency: 1 }, () => {

test('contact fields are normalised to the Meta rules and then SHA-256 hashed', () => {
  assert.equal(normaliseEmail('  Mary@Example.COM '), 'mary@example.com');
  assert.equal(normaliseEmail('not-an-email'), '');
  assert.equal(normalisePhone('07700 900000'), '447700900000');
  assert.equal(normalisePhone('+44 (0) 7365 587773'), '447365587773');
  assert.equal(normalisePhone('00447700900000'), '447700900000');
  assert.equal(normalisePhone('447700900000'), '447700900000');
  assert.equal(normalisePhone(''), '');
  assert.equal(normaliseName("O'Neil"), 'oneil');
  assert.deepEqual(splitName("Mary-Jane O'Neil"), { fn: 'maryjane', ln: 'oneil' });
  assert.deepEqual(splitName('José Álvarez'), { fn: 'jose', ln: 'alvarez' });
  assert.deepEqual(splitName('Prince'), { fn: 'prince', ln: '' });
  assert.equal(hashEmail(' Mary@Example.COM '), sha('mary@example.com'));
  assert.equal(hashPhone('07700 900000'), sha('447700900000'));
  assert.equal(hashEmail(''), undefined);
  assert.equal(hashPhone('no digits'), undefined);
});

test('a Lead event keeps the browser event id and drops raw personal values', () => {
  const event = buildLeadEvent({
    now: 1700000000000,
    answers: { full_name: "Mary-Jane O'Neil", email: ' Mary@Example.COM ', phone: '07700 900000' },
    metaLead: {
      event_id: EVENT,
      event_source_url: 'https://posfincapital.com/fact-find?resume=ABCD-EFGH-JKLM',
      fbp: 'fb.1.1700000000000.9999999999',
    },
    req: {
      headers: {
        cookie: '_fbp=fb.1.1700000000000.1234567890; other=1; _fbc=fb.1.1700000000000.IwAR0test',
        'x-forwarded-for': '203.0.113.8, 10.0.0.1',
        'user-agent': 'Agent/1',
      },
    },
  });
  assert.equal(event.event_name, 'Lead');
  assert.equal(event.action_source, 'website');
  assert.equal(event.event_time, 1700000000);
  assert.equal(event.event_id, EVENT);
  assert.equal(event.event_source_url, 'https://posfincapital.com/fact-find');
  assert.equal(event.custom_data.content_name, 'Fact find');
  assert.equal(event.user_data.em, sha('mary@example.com'));
  assert.equal(event.user_data.ph, sha('447700900000'));
  assert.equal(event.user_data.fn, sha('maryjane'));
  assert.equal(event.user_data.ln, sha('oneil'));
  assert.equal(event.user_data.fbp, 'fb.1.1700000000000.1234567890');
  assert.equal(event.user_data.fbc, 'fb.1.1700000000000.IwAR0test');
  assert.equal(event.user_data.client_ip_address, '203.0.113.8');
  assert.equal(event.user_data.client_user_agent, 'Agent/1');
  const raw = JSON.stringify(event);
  assert.doesNotMatch(raw, /Mary|example\.com|07700|ABCD-EFGH|resume/);
  assert.equal(eventSourceUrl('https://evil.example/fact-find'), '');
  assert.equal(eventSourceUrl('http://127.0.0.1:3000/apply'), 'http://127.0.0.1:3000/apply');
  assert.equal(clientIp('not-an-ip'), undefined);
  assert.notEqual(eventId('not-a-uuid'), 'not-a-uuid');
  assert.match(eventId('not-a-uuid'), /^[0-9a-f-]{36}$/);
});

test('fbp and fbc from the request body are used only when the cookies are absent', () => {
  const event = buildLeadEvent({
    answers: { email: 'a@b.co' },
    metaLead: { event_id: EVENT, fbp: 'fb.1.1700000000000.1234567890', fbc: 'fb.1.1700000000000.ClickId' },
    req: { headers: {} },
  });
  assert.equal(event.user_data.fbp, 'fb.1.1700000000000.1234567890');
  assert.equal(event.user_data.fbc, 'fb.1.1700000000000.ClickId');
  const rejected = buildLeadEvent({
    answers: {},
    metaLead: { event_id: EVENT, fbp: 'not-a-cookie', fbc: '<script>' },
    req: { headers: {} },
  });
  assert.equal(rejected.user_data.fbp, undefined);
  assert.equal(rejected.user_data.fbc, undefined);
});

test('Conversions API is skipped without a token, capped on timeout, and never logs the token', async () => {
  let calls = 0;
  const skipped = await sendMetaLead({ env: {}, event: { event_id: EVENT }, fetchImpl: () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.equal(skipped.skipped, 'no_token');
  const verify = await safeMetaLeadFromRequest({
    skip: true,
    env: { META_CAPI_ACCESS_TOKEN: 'token' },
    fetchImpl: () => { calls += 1; },
  });
  assert.equal(calls, 0);
  assert.equal(verify.skipped, 'verify');

  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args.map(String).join(' '));
  try {
    const sent = await sendMetaLead({
      env: { META_CAPI_ACCESS_TOKEN: 'SUPERSECRET', META_CAPI_TEST_EVENT_CODE: 'TEST123' },
      event: { event_name: 'Lead', event_id: EVENT, action_source: 'website', user_data: {} },
      fetchImpl: async (url, opts) => {
        calls += 1;
        assert.equal(url, `${CAPI_URL}?access_token=SUPERSECRET`);
        assert.equal(opts.method, 'POST');
        const body = JSON.parse(opts.body);
        assert.equal(body.test_event_code, 'TEST123');
        assert.equal(body.data[0].event_id, EVENT);
        return { ok: false, status: 400, text: async () => '{"error":"bad"}' };
      },
    });
    assert.equal(sent.ok, false);
    assert.equal(sent.status, 400);
    const leaked = await sendMetaLead({
      env: { META_CAPI_ACCESS_TOKEN: 'SUPERSECRET' },
      event: { event_id: EVENT },
      fetchImpl: async () => { throw new Error('failed https://graph.facebook.com/events?access_token=SUPERSECRET'); },
    });
    assert.equal(leaked.error, 'network');
    const timed = await sendMetaLead({
      env: { META_CAPI_ACCESS_TOKEN: 'SUPERSECRET' },
      event: { event_id: EVENT },
      timeoutMs: 20,
      fetchImpl: (_url, opts) => new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    });
    assert.equal(timed.error, 'timeout');
  } finally {
    console.error = original;
  }
  assert.equal(logs.some((line) => line.includes('SUPERSECRET') || line.includes('mary@')), false);
  assert.match(logs.join('\n'), /"status":400/);
  assert.match(logs.join('\n'), /"error":"network"/);
  assert.match(logs.join('\n'), /"error":"timeout"/);
});

function landAnswers() {
  const answers = { asset_type: 'Land' };
  for (let pass = 0; pass < 3; pass += 1) {
    for (const field of landFields) {
      if (!visible(field, answers) || answers[field.key] !== undefined) continue;
      if (field.type === 'bool') answers[field.key] = true;
      else if (field.type === 'date') answers[field.key] = '1980-04-02';
      else if (field.options) answers[field.key] = field.options.includes('No') ? 'No' : field.options.includes('None') ? 'None' : field.options[0];
      else if (field.type === 'number') answers[field.key] = 100000;
      else answers[field.key] = 'Synthetic';
    }
  }
  return {
    ...answers,
    full_name: 'LAND API TEST',
    email: 'land@example.invalid',
    phone: '07700900000',
    property_value: 200000,
    loan_amount: 1,
    term_months: '6',
    secured_lending: 'No, it\u2019s unencumbered',
  };
}

async function submitFactFind(extraEnv, request) {
  const saved = { ...process.env };
  Object.assign(process.env, {
    FF_BACKEND: 'leads',
    FF_SUPABASE_URL: 'http://127.0.0.1:9999',
    FF_SUPABASE_KEY: 'mock',
    FF_HASH_SALT: 'mock',
    ...extraEnv,
  });
  for (const key of ['VERCEL', 'VERCEL_ENV', 'FF_ALERT_DURABLE', 'FF_SUBMIT_ALERT', 'LEAD_ALERT_EMAIL', 'LEAD_AUTOREPLY', 'LEAD_SLA_ENABLED', 'LEADS_SHEET_ENABLED', 'FF_ALERT_SERVICE_KEY']) {
    if (!(key in extraEnv)) delete process.env[key];
  }
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const target = String(url);
    calls.push({ url: target, body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (target.includes('graph.facebook.com')) {
      if (extraEnv.graph === 'throw') throw new Error('meta down');
      if (extraEnv.graph === '500') return { ok: false, status: 500, text: async () => '' };
      return { ok: true, status: 200, text: async () => '{"events_received":1}' };
    }
    return {
      ok: true,
      status: 200,
      json: async () => (target.endsWith('rate_hit') ? true : [{ reference: 'POSFIN-WEB-LN2345', status: target.endsWith('submit') ? 'submitted' : 'draft', step: 5, updated_at: '2026-11-27', submitted_at: '2026-11-27T00:00:00Z' }]),
    };
  };
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args.map(String).join(' '));
  try {
    let payload;
    const res = {
      setHeader() {},
      end(body) { payload = JSON.parse(body); },
    };
    await handler({ method: 'POST', headers: request.headers || {}, body: request.body }, res);
    return { status: res.statusCode, payload, calls, logs };
  } finally {
    globalThis.fetch = original;
    console.error = originalError;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

test('a successful fact-find submit sends one deduped Lead and still succeeds when Meta fails', async () => {
  const answers = landAnswers();
  const body = {
    action: 'submit',
    code: 'ABCD-EFGH-JKLM',
    answers,
    meta_lead: { event_id: EVENT, event_source_url: 'https://posfincapital.com/apply?resume=SECRET', fbp: 'ignored' },
  };
  const headers = {
    cookie: '_fbp=fb.1.1700000000000.1234567890',
    'x-forwarded-for': '198.51.100.4',
    'user-agent': 'FactFindTest',
  };
  const ok = await submitFactFind({ META_CAPI_ACCESS_TOKEN: 'test-token', META_CAPI_TEST_EVENT_CODE: 'TEST999' }, { headers, body });
  assert.equal(ok.payload.ok, true);
  assert.equal(ok.payload.reference, 'POSFIN-WEB-LN2345');
  assert.equal(ok.payload.event_id, undefined);
  const capi = ok.calls.filter((call) => call.url.includes('graph.facebook.com'));
  assert.equal(capi.length, 1);
  assert.match(capi[0].url, /^https:\/\/graph\.facebook\.com\/v21\.0\/24348621581470909\/events\?access_token=test-token$/);
  assert.equal(capi[0].body.test_event_code, 'TEST999');
  assert.equal(capi[0].body.data[0].event_id, EVENT);
  assert.equal(capi[0].body.data[0].action_source, 'website');
  assert.equal(capi[0].body.data[0].event_source_url, 'https://posfincapital.com/apply');
  assert.equal(capi[0].body.data[0].user_data.em, hashEmail(answers.email));
  assert.equal(capi[0].body.data[0].user_data.ph, hashPhone(answers.phone));
  assert.equal(capi[0].body.data[0].user_data.fbp, 'fb.1.1700000000000.1234567890');
  assert.equal(capi[0].body.data[0].user_data.client_ip_address, '198.51.100.4');
  assert.doesNotMatch(JSON.stringify(capi[0].body), /land@example\.invalid|07700900000|SECRET/);

  const down = await submitFactFind({ META_CAPI_ACCESS_TOKEN: 'test-token', graph: 'throw' }, { headers, body });
  assert.equal(down.payload.ok, true);
  assert.match(down.logs.join('\n'), /"error":"network"/);
  assert.doesNotMatch(down.logs.join('\n'), /test-token|land@example/);

  const http = await submitFactFind({ META_CAPI_ACCESS_TOKEN: 'test-token', graph: '500' }, { headers, body });
  assert.equal(http.payload.ok, true);
  assert.match(http.logs.join('\n'), /"status":500/);

  const silent = await submitFactFind({ META_CAPI_ACCESS_TOKEN: '' }, { headers, body });
  assert.equal(silent.payload.ok, true);
  assert.equal(silent.calls.some((call) => call.url.includes('graph.facebook.com')), false);

  const secret = '12345678901234567890123456789012';
  const synthetic = await submitFactFind(
    { META_CAPI_ACCESS_TOKEN: 'test-token', VERIFY_SECRET: secret },
    { headers: { ...headers, 'x-posfin-verify': secret }, body },
  );
  assert.equal(synthetic.payload.ok, true);
  assert.equal(synthetic.calls.some((call) => call.url.includes('graph.facebook.com')), false);
});

test('the pixel loads site-wide, ViewContent is the fact find, and Lead waits for a saved submit', () => {
  const pixel = read('meta-pixel.js');
  assert.match(pixel, new RegExp(PIXEL_ID));
  assert.match(pixel, /fbq\("track", "PageView"\)/);
  assert.match(pixel, /fbq\("track", "ViewContent"/);
  assert.match(pixel, /eventID: String\(eventId\)/);
  assert.match(pixel, /PosfinCookieConsent/);
  assert.doesNotMatch(pixel, /interest|% per|APR/i);

  const form = read('fact-find.js');
  const submitAt = form.indexOf('async function submit()');
  const clickAt = form.indexOf('$("#next").addEventListener');
  const submit = form.slice(submitAt, clickAt);
  const guard = submit.indexOf('if(!j.ok)');
  const track = submit.indexOf('trackMetaLead(metaLead.event_id)');
  assert.ok(guard > 0 && track > guard);
  assert.match(submit, /meta_lead:metaLead/);
  assert.doesNotMatch(submit.slice(submit.indexOf('} else {')), /trackMetaLead/);
  assert.doesNotMatch(form.slice(clickAt), /trackMetaLead|fbq\(/);
  assert.match(read('fact-find.html'), /07365 587773/);
  assert.match(read('fact-find.html'), /tel:\+447365587773/);
  assert.match(read('fact-find.html'), /data-posfin-page="fact-find"/);
  assert.match(read('api/factfind.js'), /safeMetaLeadFromRequest/);

  const skip = /^(staff|admin|engine|smartlink|components)(\/|$)/;
  const tag = '<script src="/meta-pixel.js" defer></script>';
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '_next' || name === '.git') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.html')) files.push(path);
    }
  };
  walk(new URL('.', root).pathname);
  assert.ok(files.length > 10);
  for (const path of files) {
    const rel = relative(new URL('.', root).pathname, path);
    const html = readFileSync(path, 'utf8');
    const publicPage = !skip.test(rel) && html.includes('</head>');
    const count = html.split(tag).length - 1;
    if (publicPage) assert.equal(count, 1, rel);
    else assert.equal(count, 0, rel);
    if (rel !== 'fact-find.html') assert.equal(html.includes('data-posfin-page="fact-find"'), false, rel);
  }
});

function runPixel({ consent, path = '/', page = null, cookie = '' } = {}) {
  const inserted = [];
  const listeners = {};
  const document = {
    cookie,
    documentElement: { getAttribute: (name) => (name === 'data-posfin-page' ? page : null) },
    createElement: () => ({ async: false, src: '' }),
    getElementsByTagName: () => [{ parentNode: { insertBefore: (el) => inserted.push(el.src) } }],
  };
  const sandbox = {
    document,
    location: { pathname: path, origin: 'https://posfincapital.com' },
    window: null,
  };
  sandbox.window = {
    document,
    location: sandbox.location,
    crypto: { randomUUID: () => EVENT },
    PosfinCookieConsent: consent,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(read('meta-pixel.js'), sandbox);
  const thaw = (value) => {
    if (typeof value !== 'object' || value === null) return typeof value === 'string' ? String(value) : value;
    return JSON.parse(JSON.stringify(value));
  };
  const calls = () => (sandbox.window.fbq ? Array.from(sandbox.window.fbq.queue, (args) => Array.from(args, thaw)) : []);
  return { window: sandbox.window, inserted, listeners, calls };
}

test('the browser pixel queues PageView, ViewContent on the fact find, and Lead only through trackLead', () => {
  const home = runPixel({ path: '/' });
  assert.deepEqual(home.inserted, ['https://connect.facebook.net/en_US/fbevents.js']);
  assert.deepEqual(home.calls().map((call) => call[1]), [PIXEL_ID, 'PageView']);
  home.window.PosfinMeta.boot();
  assert.equal(home.calls().filter((call) => call[1] === 'PageView').length, 1);

  const factFind = runPixel({ path: '/apply', page: 'fact-find', cookie: '_fbp=fb.1.1700000000000.1234567890' });
  assert.deepEqual(factFind.calls().map((call) => call[1]), [PIXEL_ID, 'PageView', 'ViewContent']);
  assert.equal(factFind.calls()[2][2].content_name, 'Fact find');
  const context = factFind.window.PosfinMeta.leadContext();
  assert.equal(context.event_id, EVENT);
  assert.equal(context.fbp, 'fb.1.1700000000000.1234567890');
  assert.equal(context.event_source_url, 'https://posfincapital.com/apply');
  factFind.window.PosfinMeta.trackLead(context.event_id);
  const lead = factFind.calls().find((call) => call[1] === 'Lead');
  assert.equal(lead[0], 'track');
  assert.equal(lead[3].eventID, EVENT);
  assert.equal(lead[3].event_id, undefined);

  const direct = runPixel({ path: '/fact-find' });
  assert.equal(direct.calls().some((call) => call[1] === 'ViewContent'), true);

  const blocked = runPixel({ consent: false, page: 'fact-find' });
  assert.equal(blocked.window.fbq, undefined);
  assert.deepEqual(blocked.inserted, []);
  blocked.window.PosfinMeta.trackLead(EVENT);
  assert.equal(blocked.window.fbq, undefined);
  blocked.listeners['posfin:cookie-consent']({ detail: { marketing: true } });
  assert.equal(blocked.calls().some((call) => call[1] === 'PageView'), true);
  assert.equal(blocked.calls().some((call) => call[1] === 'ViewContent'), true);
});

});

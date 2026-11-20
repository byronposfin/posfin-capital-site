import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildModel, ltv, resolveStage, tokenOk, validateSubmission, poaDateStatus, kycPackErrors, servedFile } from '../lib/case-portal.js';
import { renderDocument, renderExport, renderPortal, renderStaffCase } from '../lib/case-portal-html.js';
import { parseMultipart } from '../lib/case-http.js';
import handler from '../api/case-portal.js';
import submit from '../api/case-submit.js';

const TOKEN = 'a'.repeat(43);
const FORBIDDEN = [/RBS/i, /CIFAS/i, /BROKA/i, /NatWest/i, /Royal Bank/i, /\bIBAN\b/i, /sort code/i, /account number/i];

function facts(extra = {}) {
  return {
    reference: 'EXAMPLE-1',
    property_address: '1 Example Street',
    postcode: 'AB1 2CD',
    client_value: 731000,
    desktop_low: 650000,
    desktop_high: 800000,
    comparables_floor: 643000,
    loan_amount: 395000,
    equity_known: true,
    sole_name: true,
    property_type: 'Detached house',
    epc_rating: 'C (69)',
    epc_floor_m2: 500,
    neighbour_floor: '100–150',
    facility_ended: 'several years ago',
    claim_ref: 'CLAIM1',
    warrant_ref: 'WARRANT1',
    warrant_date: '2026-10-22',
    eviction_at: '2026-11-24T10:00:00+00:00',
    comparables: [{ address: '2 Example Street', sold: 'Jan 2022', indexed: 640000 }],
    existing_charge_lender: 'RBS',
    internal_note: 'CIFAS BROKA',
    ...extra,
  };
}

function record(submissions = [], extraFacts = {}) {
  return {
    case_id: 'EXAMPLE-1',
    client_name: 'Alex Example',
    facts: facts(extraFacts),
    stage: null,
    kyc: { status: 'passed' },
    submissions,
  };
}

test('basic numbers put the case on getting terms and flag every open item urgent', () => {
  const model = buildModel(record());
  assert.equal(model.stage, 'terms');
  assert.equal(model.openCount, 12);
  assert.equal(model.gaps[0].id, 'solicitor');
  assert.equal(model.gaps.every((gap) => gap.urgent), true);
  assert.equal(ltv(395000, 731000).toFixed(1), '54.0');
  assert.equal(ltv(395000, 643000).toFixed(1), '61.4');
  assert.equal(resolveStage({ client_value: 1, loan_amount: 1, equity_known: false }, null), 'gathering');
});

test('an answer closes that gap and fills the case summary', () => {
  const open = renderDocument(buildModel(record()), TOKEN);
  assert.match(open, /12<\/strong> still to answer/);
  assert.match(open, /data-gap|Redemption figure/);
  assert.match(open, /Still needed/);
  const answered = buildModel(record([{
    id: '11111111-1111-4111-8111-111111111111',
    gap_id: 'redemption',
    kind: 'text',
    text: 'About 410000, expired March 2021',
    choice: '',
    filename: '',
    created_at: '2026-11-19T18:00:00Z',
  }]));
  assert.equal(answered.openCount, 11);
  assert.equal(answered.gaps.find((gap) => gap.id === 'redemption').open, false);
  const html = renderPortal(answered, TOKEN);
  assert.match(html, /About 410000, expired March 2021/);
  assert.match(html, /11<\/strong> still to answer/);
  const at = html.indexOf('Redemption figure and expiry');
  const slot = html.slice(at, html.indexOf('</div>', at));
  assert.match(slot, /About 410000, expired March 2021/);
  assert.doesNotMatch(slot, /Still needed/);
});

test('client page is private, mobile-ready, and does not name a lender', () => {
  const html = renderDocument(buildModel(record()), TOKEN);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /We(?:'|&#39;)re getting terms now/);
  assert.match(html, /URGENT/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Just tell us in a voice note/);
  assert.match(html, /capture="environment"/);
  assert.match(html, /500 square metres/);
  assert.match(html, /<strong>Posfin Capital<\/strong>/);
  assert.match(html, /not an offer of finance/);
  assert.match(html, /54\.0%/);
  assert.match(html, /61\.4%/);
  for (const pattern of FORBIDDEN) assert.doesNotMatch(html, pattern);
  assert.doesNotMatch(html, /sb_publishable|supabase\.co|service_role/);
  const attack = renderDocument(buildModel(record([{
    id: '22222222-2222-4222-8222-222222222222',
    gap_id: 'debts',
    kind: 'text',
    text: '<script>alert(1)</script>',
    created_at: '2026-11-19T18:00:00Z',
  }])), TOKEN);
  assert.match(attack, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(attack, /<script>alert\(1\)<\/script>/);
});

test('without equity the terms banner stays off', () => {
  const html = renderDocument(buildModel(record([], { equity_known: false, client_value: null, loan_amount: null })), TOKEN);
  assert.match(html, /Gathering info/);
  assert.doesNotMatch(html, /We(?:'|&#39;)re getting terms now/);
  assert.doesNotMatch(html, /URGENT/);
});

test('staff export lists documents and can name the existing charge holder', () => {
  const model = buildModel(record([{
    id: '33333333-3333-4333-8333-333333333333',
    gap_id: 'court_papers',
    kind: 'photo',
    filename: 'warrant.jpg',
    text: '',
    created_at: '2026-11-19T18:05:00Z',
  }]));
  const html = renderExport(model, { existing_charge_lender: 'RBS' });
  assert.match(html, /warrant\.jpg/);
  assert.match(html, /Documents and answers received/);
  assert.match(html, /Existing first charge holder: RBS/);
  assert.match(html, /Posfin Capital/);
});

test('token and submission checks', () => {
  assert.equal(tokenOk('short'), false);
  assert.equal(tokenOk(TOKEN), true);
  assert.equal(tokenOk('../etc/passwd-and-more-padding-padding'), false);
  assert.equal(validateSubmission({ kind: 'text', text: '  none  ', gapId: 'debts' }).text, 'none');
  assert.equal(validateSubmission({ kind: 'text', text: '   ', gapId: 'debts' }).error, 'empty');
  assert.equal(validateSubmission({ kind: 'photo', gapId: 'kyc_id', file: { filename: 'id.jpg', mime: 'image/jpeg', bytes: Buffer.from('x') } }).kind, 'photo');
  assert.equal(validateSubmission({ kind: 'voice', gapId: 'exit', file: { filename: 'note.webm', mime: 'audio/webm;codecs=opus', bytes: Buffer.from('x') } }).kind, 'voice');
  assert.equal(validateSubmission({ kind: 'file', gapId: 'insurance', file: { filename: 'a.exe', mime: 'application/x-msdownload', bytes: Buffer.from('x') } }).error, 'bad_file');
});

test('multipart keeps the photo bytes', () => {
  const boundary = '----posfin';
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="gap_id"\r\n\r\nkyc_id\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="id.jpg"\r\nContent-Type: image/jpeg\r\n\r\nJPEGDATA\r\n` +
    `--${boundary}--\r\n`
  );
  const parsed = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);
  assert.equal(parsed.fields.gap_id, 'kyc_id');
  assert.equal(parsed.files[0].bytes.toString(), 'JPEGDATA');
});

function jsonRes(body, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), arrayBuffer: async () => Buffer.from(JSON.stringify(body)) };
}

test('text, photo and voice submissions show on the page and reduce the gap count', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  const base = record();
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body });
    if (String(url).includes('case_portal_submit')) {
      const args = JSON.parse(opts.body);
      if (args.p_kind === 'text' || args.p_kind === 'choice') {
        return jsonRes({
          ok: true,
          submission_id: '44444444-4444-4444-8444-444444444444',
          record: record([{ id: '44444444-4444-4444-8444-444444444444', gap_id: 'solicitor', kind: args.p_kind, text: args.p_text, choice: args.p_choice, created_at: '2026-11-19T18:10:00Z' }]),
        });
      }
      return jsonRes({ ok: true, pending: true, submission_id: '55555555-5555-4555-8555-555555555555', storage_path: `cases/EXAMPLE-1/55555555-5555-4555-8555-555555555555/${args.p_filename}` });
    }
    if (String(url).includes('/storage/')) return { ok: true, status: 200, text: async () => '', arrayBuffer: async () => Buffer.from('') };
    if (String(url).includes('case_portal_finalize')) {
      const args = JSON.parse(opts.body);
      const kind = calls.some((call) => String(call.body).includes('voice')) ? 'voice' : 'photo';
      return jsonRes({
        ok: true,
        submission_id: args.p_submission_id,
        record: record([{
          id: args.p_submission_id,
          gap_id: kind === 'voice' ? 'exit' : 'kyc_id',
          kind,
          filename: kind === 'voice' ? 'voice-note.webm' : 'id.jpg',
          mime: kind === 'voice' ? 'audio/webm' : 'image/jpeg',
          bytes: args.p_bytes,
          created_at: '2026-11-19T18:12:00Z',
        }]),
      });
    }
    if (String(url).includes('case_portal_open')) return jsonRes(base);
    return jsonRes(null, 404);
  };
  const resOf = () => ({ statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } });
  try {
    const page = resOf();
    await handler({ method: 'GET', headers: {}, query: { token: TOKEN } }, page);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /noindex/);
    assert.match(page.headers['X-Robots-Tag'], /noindex/);
    assert.equal(page.headers['Cache-Control'], 'private, no-store');

    const missing = resOf();
    await handler({ method: 'GET', headers: {}, query: { token: 'nope' } }, missing);
    assert.equal(missing.statusCode, 404);

    const text = resOf();
    await submit({
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      query: { token: TOKEN },
      body: { gap_id: 'solicitor', kind: 'choice', choice: 'I have a solicitor', text: 'Jane Roe, Roe & Co' },
    }, text);
    const textJson = JSON.parse(text.body);
    assert.equal(textJson.ok, true);
    assert.equal(textJson.open, 11);
    assert.match(textJson.html, /Jane Roe, Roe &amp; Co/);
    assert.match(textJson.html, /Received just now/);

    async function filePost(kind, mime, filename, gap) {
      const boundary = '----t';
      const buf = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="gap_id"\r\n\r\n${gap}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="client_ref"\r\n\r\nclientref${kind}12345678\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\nBYTES\r\n`),
        Buffer.from(`--${boundary}--\r\n`),
      ]);
      const out = resOf();
      await submit({
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': `multipart/form-data; boundary=${boundary}` },
        query: { token: TOKEN },
        body: buf,
        async *[Symbol.asyncIterator]() { yield buf; },
      }, out);
      return JSON.parse(out.body);
    }
    const photo = await filePost('photo', 'image/jpeg', 'id.jpg', 'kyc_id');
    assert.equal(photo.ok, true);
    assert.equal(photo.open, 11);
    assert.match(photo.html, /id\.jpg/);
    const voice = await filePost('voice', 'audio/webm', 'voice-note.webm', 'exit');
    assert.equal(voice.ok, true);
    assert.match(voice.html, /voice-note\.webm/);
    assert.ok(calls.some((call) => call.url.includes('/storage/v1/object/case-portal/cases/')));
  } finally {
    globalThis.fetch = saved;
  }
});

test('a terms case shows the offer and documents, and asks the client nothing', () => {
  const model = buildModel({
    case_id: 'PC-EXAMPLE',
    client_name: 'Offer Client',
    stage: 'applied',
    kyc: { status: 'passed' },
    facts: {
      ask_client: false,
      offer_issued: true,
      lender_name: 'Example Lender',
      reference: 'PC-EXAMPLE',
      property_address: '1 Example Close',
      postcode: 'AB1 2CD',
      terms: [{ label: 'Gross loan', value: '£185,000' }, { label: 'Net on day one', value: '£140,455' }],
      use_of_funds: [{ label: 'Lease extension premium', value: '£45,500' }],
      staff_only_note: 'Joe Cash desktop 60%',
    },
    submissions: [{
      id: '66666666-6666-4666-8666-666666666666',
      gap_id: null,
      kind: 'file',
      text: 'Redemption statement',
      filename: 'redemption-statement.pdf',
      mime: 'application/pdf',
      created_at: '2026-11-19T18:00:00Z',
    }],
  });
  assert.equal(model.gaps.length, 0);
  assert.equal(model.openCount, 0);
  const html = renderDocument(model, TOKEN);
  assert.match(html, /Offer issued/);
  assert.match(html, /Example Lender has issued terms/);
  assert.match(html, /Gross loan/);
  assert.match(html, /£185,000/);
  assert.match(html, /Use of funds/);
  assert.match(html, /£45,500/);
  assert.match(html, /Documents/);
  assert.match(html, /Redemption statement/);
  assert.ok(html.includes(`/case/${TOKEN}/file/66666666-6666-4666-8666-666666666666`));
  assert.doesNotMatch(html, /Still to answer|Just tell us|capture="environment"|Anything else|<textarea|Joe Cash|desktop 60%/);
  const staff = renderStaffCase(model, { staff_items: [{ title: 'Sizing', detail: 'Joe Cash desktop 60% route' }] });
  assert.match(staff, /Internal items/);
  assert.match(staff, /Joe Cash desktop 60% route/);
  assert.match(staff, /No questions are sent to the client/);
});

test('identity check dates and the pack rules', () => {
  assert.equal(poaDateStatus('2026-08-21', '2026-11-19'), 'ok');
  assert.equal(poaDateStatus('2026-08-20', '2026-11-19'), 'stale');
  assert.equal(poaDateStatus('2026-11-20', '2026-11-19'), 'future');
  assert.equal(poaDateStatus('', '2026-11-19'), 'missing');
  assert.equal(servedFile('image/svg+xml').inline, false);
  assert.equal(servedFile('image/svg+xml').mime, 'application/octet-stream');
  assert.equal(servedFile('image/jpeg').inline, true);
  assert.equal(servedFile('text/html').inline, false);
  const passport = kycPackErrors({
    idType: 'passport', fullName: 'Alex Example', address: '1 Example Street', today: '2026-11-19',
    docs: [
      { gapId: 'reg_passport', filename: 'passport.jpg', text: '', choice: '' },
      { gapId: 'reg_licence', filename: 'licence.jpg', text: '2026-11-01', choice: 'driving_licence' },
      { gapId: 'reg_poa', filename: 'bill.jpg', text: '2026-10-01', choice: 'utility_bill' },
    ],
  });
  assert.deepEqual(passport, []);
  const noPassport = kycPackErrors({
    idType: 'driving_licence', fullName: 'Alex Example', address: '1 Example Street', today: '2026-11-19',
    docs: [
      { gapId: 'reg_licence', filename: 'licence.jpg', text: '', choice: 'photo_id' },
      { gapId: 'reg_poa', filename: 'bill.jpg', text: '2026-05-01', choice: 'utility_bill' },
      { gapId: 'reg_poa', filename: 'tax.jpg', text: '2026-11-01', choice: 'council_tax' },
    ],
  });
  assert.deepEqual(noPassport, ['poa']);
});

test('the portal stays locked until the identity check is passed', () => {
  const locked = buildModel({ ...record(), kyc: { status: 'not_started' }, facts: { ...facts(), lender_name: 'SOMO', terms: [{ label: 'Gross loan', value: '£185,000' }] } });
  const html = renderDocument(locked, TOKEN);
  assert.match(html, /Open your Posfin portal/);
  assert.match(html, /Do you have a passport/);
  assert.match(html, /last 90 days/);
  assert.match(html, /Just tell us in a voice note/);
  assert.match(html, /capture="environment"/);
  assert.match(html, /send your details to lenders and ask for terms/);
  assert.doesNotMatch(html, /Still to answer|We're getting terms now|SOMO|£185,000|RBS/);
  assert.doesNotMatch(html, /type="date"[^>]*required/);
  assert.match(html, /el\.disabled = hide/);
  const waiting = renderDocument(buildModel({ ...record(), kyc: { status: 'submitted' } }), TOKEN);
  assert.match(waiting, /We've got your identity check/);
  assert.doesNotMatch(waiting, /Still to answer/);
});

test('public source does not contain the seeded client record', () => {
  const roots = ['lib', 'api', 'sql'];
  // The staff spine is the one place the Williamson pilot is allowed.
  // Client portal modules stay clear of that record.
  const staffPilot = new Set(['lib/case-spine.js', 'lib/case-spine-html.js', 'lib/case-spine-store.js']);
  const needles = ['Cooden', 'Williamson', 'K00HS552', '1A550111', 'TN39', 'Northdown', 'McDonald', 'HA4 6JZ'];
  const files = [];
  for (const root of roots) {
    for (const name of readdirSync(root)) {
      const path = join(root, name);
      if (statSync(path).isFile() && !staffPilot.has(path)) files.push(path);
    }
  }
  const haystack = files.map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const needle of needles) assert.equal(haystack.includes(needle), false, needle);
  const client = readFileSync('lib/case-portal.js', 'utf8') + readFileSync('lib/case-portal-html.js', 'utf8') + readFileSync('api/case-portal.js', 'utf8');
  assert.equal(client.includes('Cooden'), false);
  assert.equal(client.includes('Williamson'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  POINTS,
  POINT_IDS,
  freshState,
  applyAction,
  phaseOf,
  latestRound,
  normaliseState,
} from '../lib/wirral-response.js';
import { loadCase, commit } from '../lib/wirral-response-store.js';
import { renderPage, COPY } from '../lib/wirral-response-html.js';
import { handle } from '../api/wirral-waters-response.js';

const NOW = '2026-11-27T12:00:00.000Z';
const BORROWER_KEY = 'borrower-test-key-0123456789';
const REVIEW_KEY = 'review-test-key-0123456789ab';

function words(text = 'Paid and closed.') {
  return Object.fromEntries(POINT_IDS.map((id) => [id, { verbatim: `${text} ${id}`, documents: id === 'p1' ? 'HMRC letter' : '' }]));
}

function deps(extra = {}) {
  const env = {
    WIRRAL_RESPONSE_KEY: BORROWER_KEY,
    WIRRAL_REVIEW_KEY: REVIEW_KEY,
    ...(extra.env || {}),
  };
  return { memory: new Map(), now: () => NOW, ...extra, env };
}

function resOf() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.body = body || ''; },
  };
}

function jsonResponse(body, status = 200) {
  const raw = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw,
    json: async () => JSON.parse(raw),
  };
}

test('five prompts start blank and stay separate from lender wording', () => {
  const state = freshState(NOW);
  assert.equal(POINTS.length, 5);
  assert.equal(phaseOf(state), 'collecting');
  assert.equal(POINT_IDS.every((id) => state.draft[id].verbatim === ''), true);
  const missing = applyAction(state, { type: 'submit_inputs', revision: 0, inputs: { p1: { verbatim: 'Only one point.' } } }, NOW);
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'incomplete');
  assert.equal(missing.state.rounds.length, 0);

  const sent = applyAction(state, { type: 'submit_inputs', revision: 0, inputs: words('The petition was paid.') }, NOW);
  assert.equal(sent.ok, true);
  assert.equal(phaseOf(sent.state), 'awaiting_draft');
  assert.equal(sent.state.rounds[0].inputs.p1.verbatim.includes('The petition was paid.'), true);
  assert.equal(sent.state.rounds[0].proposed.p1.wording, '');
  assert.equal(sent.state.draft.p1.verbatim, '');

  const early = applyAction(sent.state, { type: 'sign_off', revision: sent.state.revision, signoff: { p1: true }, overall: true }, NOW);
  assert.equal(early.ok, false);

  const proposed = {};
  for (const id of POINT_IDS) proposed[id] = `Lender note from his words ${id}`;
  const drafted = applyAction(sent.state, { type: 'save_proposed', revision: sent.state.revision, actor: 'Byron', proposed }, NOW);
  assert.equal(drafted.ok, true);
  assert.equal(phaseOf(drafted.state), 'in_review');
  assert.equal(drafted.state.rounds[0].inputs.p1.verbatim.includes('The petition was paid.'), true);
  assert.equal(drafted.state.rounds[0].proposed.p1.wording.includes('Lender note'), true);
  assert.notEqual(drafted.state.rounds[0].inputs.p1.verbatim, drafted.state.rounds[0].proposed.p1.wording);

  const partial = applyAction(drafted.state, {
    type: 'sign_off',
    revision: drafted.state.revision,
    signoff: { p1: true, p2: true, p3: true, p4: true, p5: false },
    overall: true,
  }, NOW);
  assert.equal(partial.error, 'confirm_each');

  const ticks = Object.fromEntries(POINT_IDS.map((id) => [id, true]));
  const signed = applyAction(drafted.state, { type: 'sign_off', revision: drafted.state.revision, signoff: ticks, overall: true }, NOW);
  assert.equal(signed.ok, true);
  assert.equal(phaseOf(signed.state), 'signed_off');

  const corrected = applyAction(signed.state, {
    type: 'submit_inputs',
    revision: signed.state.revision,
    inputs: { p1: { verbatim: 'It was a payment plan, not a payment in full.' } },
  }, NOW);
  assert.equal(corrected.ok, true);
  assert.equal(corrected.state.rounds.length, 2);
  assert.equal(corrected.state.rounds[0].inputs.p1.verbatim.includes('The petition was paid.'), true);
  assert.equal(corrected.state.rounds[1].inputs.p1.verbatim.includes('payment plan'), true);
  assert.equal(corrected.state.rounds[1].inputs.p2.verbatim, corrected.state.rounds[0].inputs.p2.verbatim);
  assert.equal(corrected.state.rounds[1].proposed.p1.wording, '');
  assert.equal(phaseOf(corrected.state), 'awaiting_draft');
});

test('the page is a vertical card stack with a microphone and no invented answers', () => {
  const html = renderPage(freshState(NOW), { mode: 'borrower', storage: 'local', persisted: false });
  assert.match(html, /Wirral Waters — CrowdProperty Compliance Points/);
  assert.match(html, /Sara Nasralla at CrowdProperty raised 5 points/);
  assert.match(html, /Byron wants your own facts first/);
  assert.match(html, /Your words only/);
  assert.match(html, /we will never put words in your mouth/);
  assert.match(html, /07365 587773/);
  assert.match(html, /Tap to speak your answer/);
  assert.match(html, /SpeechRecognition/);
  assert.match(html, /webkitSpeechRecognition/);
  assert.match(html, /en-GB/);
  assert.match(html, /continuous = true/);
  assert.match(html, /interimResults = true/);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /Firefox/);
  assert.match(html, /Submit my inputs to Byron/);
  assert.match(html, /draftFlight/);
  assert.match(html, /function flushDraft/);
  assert.match(html, /High priority/);
  for (const point of POINTS) {
    assert.ok(html.includes(point.title.replaceAll('&', '&amp;')), point.id);
    assert.ok(html.includes(point.prompt), point.id);
  }
  assert.equal((html.match(/class="mic"/g) || []).length, 5);
  assert.equal((html.match(/placeholder="Your exact words"><\/textarea>/g) || []).length, 5);
  assert.doesNotMatch(html, /Send this wording back to Roy/);
  assert.doesNotMatch(html, /interest rate|\bAPR\b|per annum|%\s*p\.a\./i);
  assert.match(html, /noindex/);

  const review = renderPage(freshState(NOW), { mode: 'review' });
  assert.match(review, /Internal view for Byron and Lizzy/);
  assert.match(review, /Nothing is pre-filled/);
  assert.doesNotMatch(review, /Submit my inputs to Byron/);
});

test('review rounds show exact words beside proposed wording', () => {
  let state = freshState(NOW);
  state = applyAction(state, { type: 'submit_inputs', revision: 0, inputs: words('Exact fact') }, NOW).state;
  const proposed = Object.fromEntries(POINT_IDS.map((id) => [id, `Positioned ${id}`]));
  state = applyAction(state, { type: 'save_proposed', revision: state.revision, actor: 'Lizzy', proposed }, NOW).state;
  const html = renderPage(state, { mode: 'borrower', persisted: true, storage: 'supabase' });
  assert.match(html, /Your exact input/);
  assert.match(html, new RegExp(COPY.PROPOSED_LABEL));
  assert.match(html, /Exact fact p1/);
  assert.match(html, /Positioned p1/);
  assert.match(html, /I confirm this is accurate, complete, and ready for CrowdProperty/);
  assert.match(html, /data-phase="in_review"/);
  assert.equal((html.match(/class="mic"/g) || []).length, 5);
  const staff = renderPage(state, { mode: 'review', persisted: true, storage: 'supabase' });
  assert.match(staff, /Roy's exact input/);
  assert.match(staff, /Start from Roy's exact words/);
  assert.match(staff, /Send this wording back to Roy/);
  assert.doesNotMatch(staff, /id="storage-note"/);
});

test('a missing table still keeps the submission for this process', async () => {
  const memory = new Map();
  const calls = [];
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
  const fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET' });
    return jsonResponse({ code: 'PGRST205', message: 'Could not find the table public.compliance_voice_cases' }, 404);
  };
  const local = { env, memory, fetch, now: () => NOW };
  const saved = await commit({ type: 'submit_inputs', revision: 0, inputs: words('Held locally') }, local);
  assert.equal(saved.ok, true);
  assert.equal(saved.persisted, false);
  assert.equal(saved.storage, 'local');
  const again = await loadCase(local);
  assert.equal(again.state.rounds[0].inputs.p3.verbatim.includes('Held locally'), true);
  assert.ok(calls.length >= 1);
});

test('supabase stores verbatim and proposed wording on one document', async () => {
  let row = null;
  const fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const href = String(url);
    if (method === 'GET') return jsonResponse(row ? [row] : []);
    const body = JSON.parse(opts.body);
    if (method === 'POST') {
      if (row) return jsonResponse({ code: '23505' }, 409);
      row = { document: body.document, revision: body.revision, updated_at: body.updated_at };
      return jsonResponse([row]);
    }
    const expected = Number((/revision=eq\.(\d+)/.exec(href) || [])[1]);
    if (!row || row.revision !== expected) return jsonResponse([]);
    row = { document: body.document, revision: body.revision, updated_at: body.updated_at };
    return jsonResponse([row]);
  };
  const local = {
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' },
    memory: new Map(),
    fetch,
    now: () => NOW,
  };
  const saved = await commit({ type: 'submit_inputs', revision: 0, inputs: words('On the record') }, local);
  assert.equal(saved.persisted, true);
  assert.equal(saved.storage, 'supabase');
  const proposed = Object.fromEntries(POINT_IDS.map((id) => [id, `Draft ${id}`]));
  const drafted = await commit({ type: 'save_proposed', revision: saved.state.revision, actor: 'Byron', proposed }, local);
  assert.equal(drafted.ok, true);
  const loaded = await loadCase(local);
  assert.equal(loaded.state.rounds[0].inputs.p4.verbatim.includes('On the record'), true);
  assert.equal(loaded.state.rounds[0].proposed.p4.wording, 'Draft p4');
  assert.equal(normaliseState(row.document).revision, loaded.state.revision);

  row.revision = 50;
  const clash = await commit({ type: 'sign_off', revision: drafted.state.revision, signoff: {}, overall: false }, local);
  assert.equal(clash.ok, false);
  assert.equal(clash.error, 'conflict');
});

test('a correction drops lender wording only for the point Roy changed', () => {
  let state = applyAction(freshState(NOW), { type: 'submit_inputs', revision: 0, inputs: words('Original') }, NOW).state;
  state = applyAction(state, {
    type: 'save_proposed',
    revision: state.revision,
    actor: 'Byron',
    proposed: { p1: 'Old lender line for p1', p2: 'Keep this p2 line' },
  }, NOW).state;
  assert.equal(phaseOf(state), 'awaiting_draft');
  const corrected = applyAction(state, {
    type: 'submit_inputs',
    revision: state.revision,
    inputs: { p1: { verbatim: 'Corrected p1 fact' } },
  }, NOW);
  assert.equal(corrected.ok, true);
  assert.equal(corrected.state.rounds[0].proposed.p1.wording, '');
  assert.equal(corrected.state.rounds[0].proposed.p2.wording, 'Keep this p2 line');
  assert.match(corrected.state.rounds[0].inputs.p1.verbatim, /Corrected p1/);
  const docs = applyAction(corrected.state, {
    type: 'submit_inputs',
    revision: corrected.state.revision,
    inputs: { p2: { documents: 'Companies House printout' } },
  }, NOW);
  assert.equal(docs.ok, true);
  assert.equal(docs.state.rounds[0].proposed.p2.wording, 'Keep this p2 line');
  assert.equal(docs.state.rounds[0].inputs.p2.documents, 'Companies House printout');
});

test('the public URL stays shut without the private keys', async () => {
  const local = deps();
  const closed = resOf();
  await handle({ method: 'GET', headers: {}, query: {} }, closed, local);
  assert.equal(closed.statusCode, 404);
  assert.doesNotMatch(closed.body, /Inspired 2 Care|M3BP95NV|Liver Bird|06454085|Roy Kenny|CrowdProperty/);
  assert.equal(closed.body.includes(BORROWER_KEY), false);

  const borrower = resOf();
  await handle({ method: 'GET', headers: {}, query: { k: BORROWER_KEY, mode: 'review' } }, borrower, local);
  assert.equal(borrower.statusCode, 200);
  assert.match(borrower.body, /Wirral Waters/);
  assert.doesNotMatch(borrower.body, /Send this wording back to Roy|Internal view for Byron/);
  assert.equal(borrower.body.includes(BORROWER_KEY), false);
  assert.match(String(borrower.headers['Set-Cookie']), /pf_wirral=/);

  const staff = resOf();
  await handle({ method: 'GET', headers: {}, query: { rk: REVIEW_KEY, mode: 'review' } }, staff, local);
  assert.match(staff.body, /Internal view for Byron and Lizzy/);
  assert.doesNotMatch(staff.body, /Submit my inputs to Byron/);
  assert.equal(staff.body.includes(REVIEW_KEY), false);
});

test('the route renders and the staff wording action stays on the review link', async () => {
  const local = deps();
  const page = resOf();
  await handle({ method: 'GET', headers: {}, query: { k: BORROWER_KEY } }, page, local);
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['Cache-Control'], /no-store/);
  assert.match(page.body, /CrowdProperty Compliance Points/);
  assert.match(page.body, /data-phase="collecting"/);

  const denied = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    query: { k: BORROWER_KEY },
    body: { action: 'submit_inputs', revision: 0, inputs: words() },
  }, denied, local);
  assert.equal(denied.statusCode, 403);

  const posted = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posfin-page': 'wirral' },
    query: { k: BORROWER_KEY },
    body: { action: 'submit_inputs', revision: 0, inputs: words('From the page') },
  }, posted, local);
  assert.equal(posted.statusCode, 200);
  const payload = JSON.parse(posted.body);
  assert.equal(payload.ok, true);
  assert.match(payload.html, /From the page p2/);
  assert.doesNotMatch(payload.html, /Lender note/);

  const blocked = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posfin-page': 'wirral' },
    query: { k: BORROWER_KEY, mode: 'review' },
    body: {
      action: 'save_proposed',
      revision: payload.revision,
      actor: 'Byron',
      proposed: Object.fromEntries(POINT_IDS.map((id) => [id, `Note ${id}`])),
    },
  }, blocked, local);
  assert.equal(blocked.statusCode, 403);

  const review = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posfin-page': 'wirral' },
    query: { mode: 'review', rk: REVIEW_KEY },
    body: {
      action: 'save_proposed',
      revision: payload.revision,
      actor: 'Byron',
      proposed: Object.fromEntries(POINT_IDS.map((id) => [id, `Note ${id}`])),
    },
  }, review, local);
  assert.equal(review.statusCode, 200);
  const staff = JSON.parse(review.body);
  assert.equal(staff.phase, 'in_review');
  assert.match(staff.html, /Note p5/);
  assert.match(staff.html, /data-mode="review"/);

  const seen = resOf();
  await handle({ method: 'GET', headers: {}, query: { k: BORROWER_KEY } }, seen, local);
  assert.match(seen.body, /Your exact input/);
  assert.match(seen.body, /Note p5/);
  assert.ok(seen.body.includes(COPY.PROPOSED_LABEL));

  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(config.rewrites.some((rule) => rule.source === '/wirral-waters-response' && rule.destination === '/api/wirral-waters-response'));
  assert.ok(config.redirects.some((rule) => rule.source === '/roy-kenny' && rule.destination === '/wirral-waters-response'));
  const sql = readFileSync(new URL('../sql/20261127_wirral_waters_response.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public.compliance_voice_cases from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table public.compliance_voice_cases to service_role/);
});

test('transcription returns text only from the transcription service', async () => {
  const local = deps({ fetch: async () => { throw new Error('should not call'); } });
  const quiet = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posfin-page': 'wirral' },
    query: { k: BORROWER_KEY },
    body: { action: 'transcribe', audio: Buffer.from('hello-audio-bytes'.repeat(80)).toString('base64'), mime: 'audio/webm' },
  }, quiet, local);
  const body = JSON.parse(quiet.body);
  assert.equal(body.text, '');
  assert.match(body.message, /Type your exact words/);
  const still = await loadCase(local);
  assert.equal(still.state.rounds.length, 0);

  let called = 0;
  const live = deps({
    env: { XAI_API_KEY: 'test-key' },
    fetch: async (url) => {
      called += 1;
      assert.match(String(url), /api\.x\.ai\/v1\/stt/);
      return jsonResponse({ text: 'The hearing is listed for March.' });
    },
  });
  const spoken = resOf();
  await handle({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-posfin-page': 'wirral' },
    query: { k: BORROWER_KEY },
    body: { action: 'transcribe', audio: Buffer.from('hello-audio-bytes'.repeat(80)).toString('base64'), mime: 'audio/webm' },
  }, spoken, live);
  const heard = JSON.parse(spoken.body);
  assert.equal(heard.text, 'The hearing is listed for March.');
  assert.equal(called, 1);
  const untouched = await loadCase(live);
  assert.equal(untouched.state.rounds.length, 0);
  assert.equal(latestRound(untouched.state), null);
});

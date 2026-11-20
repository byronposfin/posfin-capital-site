import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import {
  PILOT_REF, URGENT_EVICTION_MODEL, countdown, engineMode, evaluateWaiting, modelById,
  pilotSpine, presentSpine, stageReadiness, waitingEngineFlag,
} from '../lib/case-spine.js';
import { createSpineStore } from '../lib/case-spine-store.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';

const NOW = '2026-11-20T09:00:00.000Z';
const ENV = { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' };

function response() {
  const headers = {};
  const res = {
    headers,
    body: '',
    status: 0,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body) { this.body = body || ''; },
  };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

function authed(spineStore, extra = {}) {
  return {
    env: ENV,
    spineStore,
    now: NOW,
    fetch: async () => { throw new Error('spine preview must not call the network'); },
    ...extra,
  };
}

test('the model is a template and the Williamson instance is the only pilot', () => {
  const spine = pilotSpine();
  const model = modelById(spine.modelId);
  assert.equal(model.id, 'uk_regulated_bridging_urgent_eviction');
  assert.equal(model.title, 'UK Regulated Bridging — Urgent Eviction Refinance');
  assert.equal(JSON.stringify(model).includes('Williamson'), false);
  assert.equal(JSON.stringify(model).includes(PILOT_REF), false);
  assert.deepEqual(model.stages.map((stage) => stage.title), [
    'Triage',
    'KYC & Title',
    'Packaging & LOR',
    'Indicative Terms & N244 Letter',
    'Valuation',
    'Formal Offer & Legals',
    'Redemption & Completion',
  ]);
  assert.equal(model.stages.every((stage) => stage.exit.length > 0), true);
  assert.equal(URGENT_EVICTION_MODEL.evidenceChecklist.length >= 8, true);
  assert.equal(spine.ref, 'POSFIN-WEB-EYCTQ6');
  assert.equal(spine.caseHeader.ref, 'POSFIN-WEB-EYCTQ6');
  assert.notEqual(spine.ref, 'PC-004');
});

test('Williamson facts stay on the verified LOR and title canon', () => {
  const spine = pilotSpine();
  const header = spine.caseHeader;
  assert.equal(header.borrower, 'Christopher Nicholas Williamson');
  assert.match(header.security, /204 Cooden Drive, Bexhill-on-Sea/);
  assert.match(header.security, /TN39 3AH/);
  assert.match(header.tenure, /Freehold, title absolute/);
  assert.equal(header.titleNumber, 'ESX86205');
  assert.equal(header.statedValue, '£700,000');
  assert.equal(header.loanRequested, '£455,000 gross');
  assert.match(header.ltv, /65%/);
  assert.match(header.sizingQuestion, /£511,000/);
  assert.match(header.sizingQuestion, /not a verified loan amount/);
  assert.equal(header.loanRequested.includes('511'), false);
  assert.match(header.lender, /MT Finance/);
  assert.match(header.lender, /Joe Grace/);
  assert.match(header.solicitor, /Ackroyds/);
  assert.match(header.solicitor, /Ash Nejad/);
  assert.match(header.notThisCase, /PC-004/);
  assert.match(header.notThisCase, /Edworthy/);
  const copies = spine.evidence.find((item) => item.id === 'official-copies');
  assert.equal(copies.status, 'HELD');
  assert.match(copies.detail, /28 Mar 2008/);
  assert.match(copies.detail, /0JU75100/);
  assert.match(copies.detail, /13 Apr 2012/);
  assert.match(copies.detail, /A00HS078/);
  assert.match(copies.detail, /19 Mar 2014/);
  assert.match(copies.detail, /19 Nov 2026/);
  const redemption = spine.evidence.find((item) => item.id === 'redemptions');
  assert.equal(redemption.status, 'MISSING');
  assert.match(redemption.detail, /under £400,000, figure to follow/);
  assert.equal(/£3\d\d,000/.test(redemption.detail), false);
  assert.equal(spine.evidence.find((item) => item.id === 'lor-v5').status, 'DRAFT_READY');
  assert.equal(spine.evidence.find((item) => item.id === 'ackroyds-pack').status, 'DRAFT_READY');
  assert.match(spine.evidence.find((item) => item.id === 'mt-form').detail, /36\.5%/);
  assert.equal(spine.evidence.find((item) => item.id === 'mt-form').status, 'IN_PROGRESS');
  assert.equal(spine.evidence.find((item) => item.id === 'rbs-loa').status, 'DRAFT_READY');
  assert.equal(spine.evidence.find((item) => item.id === 'driving-licence').status, 'HELD');
  assert.equal(spine.evidence.find((item) => item.id === 'kyc-gaps').status, 'MISSING');
  assert.match(spine.evidence.find((item) => item.id === 'kyc-gaps').detail, /council tax correspondence as held/);
  const comps = spine.evidence.find((item) => item.id === 'photo-comps');
  assert.equal(comps.status, 'HELD');
  assert.match(comps.detail, /£630,000/);
  assert.match(comps.detail, /£735,000/);
  assert.match(comps.detail, /640 m²/);
  assert.match(comps.detail, /300–330 m²/);
  assert.equal(spine.stageLabel, 'Packaging & Urgent Lender Terms — N244 Court Gate');
  assert.equal(spine.primaryOwner.name, 'Byron Hill');
  assert.equal(spine.deskRoles.map((role) => role.name).join(','), 'Jess,Lizzy');
  assert.equal(spine.actions.map((item) => item.owner).join(','), 'Byron,Byron,Jess,Lizzy,Byron');
  assert.equal(spine.due.primary.display, 'Tue 24 Nov 2026, 10:00 GMT');
  assert.equal(spine.due.sub.map((item) => item.date).join(','), '2026-11-20,2026-11-27');
});

test('the waiting-condition flag is off by default and the sandbox does not move the stage', () => {
  assert.equal(waitingEngineFlag({}), false);
  assert.equal(waitingEngineFlag({ STAGE2_WAITING_CONDITIONS_ENABLED: 'false' }), false);
  assert.equal(engineMode({}, { waiting: 'preview' }, 'preview'), 'preview');
  assert.equal(engineMode({}, { waiting: 'preview' }, 'supabase'), 'off');
  assert.equal(engineMode({ STAGE2_WAITING_CONDITIONS_ENABLED: 'true' }, {}, 'supabase'), 'on');
  const spine = pilotSpine();
  const parked = presentSpine(spine, {}, {}, 'preview', NOW);
  assert.equal(parked.engine, 'off');
  assert.equal(parked.readiness, null);
  assert.equal(parked.waiting.every((item) => item.met === false), true);
  assert.equal(countdown(spine.due.primary.at, NOW).label, '4 days 1 hour');
  const sand = presentSpine(spine, {}, { waiting: 'preview' }, 'preview', NOW);
  assert.equal(sand.engine, 'preview');
  assert.equal(sand.readiness.ready, false);
  assert.equal(sand.readiness.moved, false);
  assert.equal(sand.spine.stageId, 'indicative_n244');
  spine.actions.find((item) => item.id === 'ackroyds-pack').done = true;
  const after = stageReadiness(spine);
  assert.equal(after.met.includes('byron-ackroyds'), true);
  assert.equal(after.ready, false);
  assert.equal(after.stageId, spine.stageId);
});

test('the spine page shows all eight fields and refuses a send', async () => {
  const store = createSpineStore();
  const session = mintPreviewSession(ENV);
  const anon = response();
  await handleCockpit({ method: 'GET', headers: {}, query: { spine: PILOT_REF }, url: '/staff/cockpit/spine/POSFIN-WEB-EYCTQ6' }, anon, authed(store));
  assert.equal(anon.status, 401);

  const open = response();
  await handleCockpit({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { spine: PILOT_REF },
    url: '/staff/cockpit/spine/POSFIN-WEB-EYCTQ6',
  }, open, authed(store));
  assert.equal(open.status, 200);
  for (const bit of [
    'POSFIN-WEB-EYCTQ6',
    'Christopher Nicholas Williamson',
    '204 Cooden Drive',
    'ESX86205',
    '£700,000',
    '£455,000 gross',
    'Joe Grace',
    'Ash Nejad',
    'Packaging &amp; Urgent Lender Terms — N244 Court Gate',
    'Byron Hill',
    'Tue 24 Nov 2026, 10:00 GMT',
    'HELD',
    'DRAFT_READY',
    'IN_PROGRESS',
    'MISSING',
    'Waiting-condition engine: Flag OFF',
    'uk_regulated_bridging_urgent_eviction',
    'Clone blueprint',
    '4 days 1 hour',
  ]) {
    assert.match(open.body, new RegExp(bit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(/<button[^>]*value="send"/i.test(open.body), false);
  assert.equal(/<button[^>]*>\s*Send/i.test(open.body), false);
  assert.match(open.body, /@media \(min-width:960px\)/);
  assert.match(open.body, /\.grid\{display:flex;flex-direction:column/);
  assert.match(open.body, /Winslade Park \/ Mark Edworthy/);

  const wrong = response();
  await handleCockpit({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { spine: 'PC-004' },
  }, wrong, authed(store));
  assert.equal(wrong.status, 404);
  assert.match(wrong.body, /Winslade Park/);
  assert.equal(wrong.body.includes('£455,000'), false);

  const sent = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'send', spine: PILOT_REF, id: 'lor-v5', actor: 'Byron' },
  }, sent, authed(store));
  assert.equal(sent.status, 400);
  assert.equal(store.get().actions.find((item) => item.id === 'lor-v5').done, false);
});

test('marking a desk action done is audited and the sandbox still does not advance the stage', async () => {
  const store = createSpineStore();
  const session = mintPreviewSession(ENV);
  const saved = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'spine-done', spine: PILOT_REF, id: 'ackroyds-pack', actor: 'Byron', waiting: 'preview' },
  }, saved, authed(store));
  assert.equal(saved.status, 303);
  assert.equal(store.get().actions.find((item) => item.id === 'ackroyds-pack').done, true);
  assert.equal(store.get().stageId, 'indicative_n244');
  const row = store.auditFor('ackroyds-pack')[0];
  assert.equal(row.actor, 'Byron');
  assert.equal(row.oldValue, 'false');
  assert.equal(row.newValue, 'true');
  assert.equal(row.at, NOW);

  const sand = response();
  await handleCockpit({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { spine: PILOT_REF, waiting: 'preview' },
  }, sand, authed(store));
  assert.match(sand.body, /preview sandbox/);
  assert.match(sand.body, /Not ready to leave this stage/);
  assert.match(sand.body, /Satisfied in this preview/);
  assert.equal(sand.body.includes('value="send"'), false);

  const live = response();
  let called = false;
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'spine-done', spine: PILOT_REF, id: 'lor-v5', actor: 'Byron' },
  }, live, authed(store, {
    env: { ...ENV, COCKPIT_SOURCE: 'supabase' },
    fetch: async () => { called = true; throw new Error('no'); },
    sessionOk: () => true,
  }));
  assert.equal(live.status, 503);
  assert.equal(called, false);
  assert.equal(store.get().actions.find((item) => item.id === 'lor-v5').done, false);
});

test('the spine migration is review-only and keeps PC-004 out', () => {
  const sql = readFileSync(new URL('../sql/20261120_stage2_case_spine.sql', import.meta.url), 'utf8');
  assert.match(sql, /DO NOT APPLY/);
  assert.match(sql, /create table if not exists public\.case_models/);
  assert.match(sql, /create table if not exists public\.case_spine/);
  assert.match(sql, /waiting_conditions jsonb not null/);
  assert.match(sql, /case_spine_actions/);
  assert.match(sql, /case_spine_audit/);
  assert.match(sql, /case_ref <> 'PC-004'/);
  assert.match(sql, /STAGE2_WAITING_CONDITIONS_ENABLED/);
  assert.equal(/insert into public\.case_spine/i.test(sql), false);
  assert.equal(/insert into public\.case_tokens/i.test(sql), false);
  assert.equal(/case_notifications/.test(sql), false);
  const pointer = readFileSync(new URL('../sql/20261119_ops_cockpit.sql', import.meta.url), 'utf8');
  assert.match(pointer, /20261120_stage2_case_spine\.sql/);
  const blueprint = readFileSync(new URL('../docs/STAGE2_CASE_SPINE_CLONE_BLUEPRINT.md', import.meta.url), 'utf8');
  assert.match(blueprint, /uk_unregulated_bridging/);
  assert.match(blueprint, /fr_ouicap/);
  assert.match(blueprint, /fr_ulend/);
  assert.match(blueprint, /POSFIN-WEB-EYCTQ6/);
  assert.match(blueprint, /£455,000/);
});

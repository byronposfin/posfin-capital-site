import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrokaDesk } from '../api/broka-desk.js';
import { groupResults } from '../lib/broka.js';
import { listDirectory, listResults, recordResult, resetBrokaState } from '../lib/broka-state.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';

const ENV = { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' };

function response() {
  const headers = {};
  const res = {
    headers,
    body: '',
    status: 0,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(body) { this.body = body || ''; },
  };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

test('results group as X of Y known, with baseline badges and new lenders', () => {
  resetBrokaState();
  const rows = listResults('PREVIEW-NORTHGATE');
  const groups = groupResults(rows, listDirectory());
  const byName = Object.fromEntries(groups.map((group) => [group.lender, group]));
  assert.equal(byName.Invocap.label, '4 of 6 known');
  assert.equal(byName.Invocap.baseline, true);
  assert.equal(byName.Invocap.isNew, false);
  assert.equal(byName['Albatross Lending Group'].baseline, true);
  assert.equal(byName['Albatross Lending Group'].label, '5 of 6 known');
  assert.equal(byName['Albatross Capital'].baseline, false);
  assert.equal(byName['Albatross Capital'].isNew, true);
  assert.equal(byName['Harbour Bridge Co'].isNew, true);
  const harbour = listDirectory().find((item) => item.name === 'Harbour Bridge Co');
  assert.equal(harbour.contact, null);
  assert.equal(harbour.addedFromResult, true);
  assert.equal(listDirectory().some((item) => item.name === 'Albatross Capital' && item.baseline), false);
});

test('recording a result adds the lender immediately and refuses blocked names', async () => {
  resetBrokaState();
  const before = listDirectory().length;
  const saved = recordResult({ caseRef: 'PREVIEW-NORTHGATE', lender: 'Example Bridge Ltd', terms: { rate: '0.9%', net: '180000' } });
  assert.equal(saved.ok, true);
  assert.equal(saved.created, true);
  assert.equal(listDirectory().length, before + 1);
  assert.equal(listDirectory().find((item) => item.name === 'Example Bridge Ltd').contact, null);
  const blocked = recordResult({ caseRef: 'PREVIEW-NORTHGATE', lender: 'CIFAS desk', terms: { rate: '1%' } });
  assert.equal(blocked.ok, false);
  assert.equal(listDirectory().some((item) => /cifas/i.test(item.name)), false);
  const session = mintPreviewSession(ENV);
  const res = response();
  await handleBrokaDesk({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { case: 'PREVIEW-NORTHGATE' },
  }, res, { env: ENV, fetch: async () => { throw new Error('no network'); } });
  assert.match(res.body, /Invocap · 4 of 6 known/);
  assert.match(res.body, /Albatross Lending Group · 5 of 6 known/);
  assert.match(res.body, />Baseline</);
  assert.match(res.body, />New lender</);
  assert.match(res.body, /Contact UNKNOWN/);
  assert.equal(/broka\.app/i.test(res.body), false);
  const capital = res.body.slice(res.body.indexOf('Albatross Capital'), res.body.indexOf('Albatross Capital') + 280);
  assert.equal(capital.includes('Baseline'), false);
});

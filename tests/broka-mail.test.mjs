import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrokaDesk } from '../api/broka-desk.js';
import { renderOutreach } from '../lib/broka-mail.js';
import { listPrepared, prepareEmails, recordSentAt, resetBrokaState } from '../lib/broka-state.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';

const ENV = { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' };

function response() {
  const res = { headers: {}, body: '', status: 0, setHeader() {}, end(body) { this.body = body || ''; } };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

test('the outreach file is rendered without guessing a contact or copying blocked text', () => {
  const text = renderOutreach({
    caseRef: 'PREVIEW-NORTHGATE',
    lender: 'Invocap',
    contact: null,
    regulated: false,
    district: 'SW1A',
    loan: '250000',
    notes: 'internal_private CIFAS KPC MT Finance Dodds Barclays letter',
  });
  assert.match(text, /It has not been sent/);
  assert.match(text, /Contact: UNKNOWN/);
  assert.match(text, /Security district: SW1A/);
  assert.equal(/cifas|kpc|internal_private|mt finance|dodds|barclays letter/i.test(text), false);
  const scrubbed = renderOutreach({ caseRef: 'PC-1', lender: 'MT Finance', contact: 'Dodds', district: 'internal_private' });
  assert.equal(/mt finance|dodds|internal_private/i.test(scrubbed), false);
  assert.match(scrubbed, /\[removed\]/);
});

test('prepare creates one unsent row per eligible lender and only Byron stamps sent_at', async () => {
  resetBrokaState();
  const calls = [];
  const prepared = prepareEmails({ caseRef: 'PREVIEW-NORTHGATE', regulated: false, now: '2026-11-21T12:00:00.000Z' });
  assert.equal(prepared.sent, false);
  assert.equal(prepared.rows.length, 6);
  assert.equal(prepared.rows.every((row) => row.sentAt == null && row.status === 'prepared' && row.contact == null), true);
  assert.equal(new Set(prepared.rows.map((row) => row.lender)).size, 6);
  const again = prepareEmails({ caseRef: 'PREVIEW-NORTHGATE', regulated: false });
  assert.equal(again.rows.length, 0);
  const row = prepared.rows[0];
  const denied = recordSentAt({ seat: 'jess', caseRef: row.caseRef, responseId: row.id, now: '2026-11-21T13:00:00.000Z' });
  assert.equal(denied.ok, false);
  assert.equal(listPrepared('PREVIEW-NORTHGATE')[0].sentAt, null);
  const stamped = recordSentAt({ seat: 'byron', caseRef: row.caseRef, responseId: row.id, now: '2026-11-21T13:00:00.000Z' });
  assert.equal(stamped.sent, false);
  assert.equal(stamped.row.sentAt, '2026-11-21T13:00:00.000Z');
  assert.equal(stamped.row.status, 'recorded_sent');
  const session = mintPreviewSession(ENV);
  const res = response();
  await handleBrokaDesk({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { case: 'PC-003' },
    body: { action: 'prepare-emails', case_ref: 'PC-003', stage: 'contacting' },
  }, res, { env: ENV, fetch: async (url) => { calls.push(url); throw new Error('network'); } });
  assert.equal(res.status, 409);
  assert.equal(calls.length, 0);
});

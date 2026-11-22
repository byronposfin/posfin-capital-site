import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrokaJob } from '../api/broka/jobs.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';
import { jobCounts, resetBrokaState, setSearchPaused, setStandingApproval } from '../lib/broka-state.js';

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

function call(body, extra = {}, env = ENV) {
  const session = mintPreviewSession(env);
  const res = response();
  const calls = [];
  const req = {
    method: 'POST',
    headers: {
      cookie: extra.cookie === '' ? '' : `pf_staff=${encodeURIComponent(session)}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body,
  };
  return handleBrokaJob(req, res, {
    env,
    now: '2026-11-21T12:00:00.000Z',
    fetch: async (url) => {
      calls.push(String(url));
      throw new Error('network');
    },
  }).then(() => ({ res, calls, json: JSON.parse(res.body || '{}') }));
}

test('an active seat records the job and the placed run together', async () => {
  resetBrokaState();
  const first = await call({ seat: 'jess', case_ref: 'PREVIEW-NORTHGATE', regulated: 'yes', broka_case_id: 'BK-NEW' });
  assert.equal(first.res.status, 201);
  assert.equal(first.json.job.status, 'approved');
  assert.equal(first.json.job.broka_case_id || first.json.job.brokaCaseId, 'BK-PREVIEW-NORTH');
  assert.equal(first.json.placed_run.called, false);
  assert.equal(first.json.placed_run.job_id || first.json.placed_run.jobId, first.json.job.id);
  assert.equal(first.calls.length, 0);
  assert.equal(JSON.stringify(first.json).includes('BK-NEW'), false);
  assert.equal(JSON.stringify(first.json).includes('1980-01-02'), false);
  const second = await call({ seat: 'byron', case_ref: 'PREVIEW-NORTHGATE', regulated: 'no' });
  assert.equal(second.json.job.broka_case_id || second.json.job.brokaCaseId, 'BK-PREVIEW-NORTH');
  assert.notEqual(second.json.job.id, first.json.job.id);
  const counts = jobCounts();
  assert.equal(counts.jobs, counts.runs);
  assert.equal(counts.jobs, counts.events);
  assert.equal(counts.jobs, 2);
});

test('a missing fact find, an inactive seat, and a pause each keep the right status', async () => {
  resetBrokaState();
  const early = await call({ seat: 'byron', case_ref: 'PC-003', stage: 'contacting' });
  assert.equal(early.res.status, 409);
  assert.equal(early.json.error, 'factfind');
  assert.equal(jobCounts().jobs, 0);
  const stranger = await call({ seat: 'lizzy', case_ref: 'PREVIEW-NORTHGATE' });
  assert.equal(stranger.res.status, 401);
  const signedOut = await call({ seat: 'byron', case_ref: 'PREVIEW-NORTHGATE' }, { cookie: '' });
  assert.equal(signedOut.res.status, 401);
  setSearchPaused('byron', true);
  const waiting = await call({ seat: 'aadi', case_ref: 'PREVIEW-NORTHGATE' });
  assert.equal(waiting.json.job.status, 'awaiting_approval');
  setSearchPaused('byron', false);
  setStandingApproval(false);
  const noStanding = await call({ seat: 'byron', case_ref: 'PC-003', stage: 'fact_find' });
  assert.equal(noStanding.json.job.status, 'awaiting_approval');
  assert.equal(noStanding.json.job.broka_case_id || noStanding.json.job.brokaCaseId, null);
});

test('the production project is not written', async () => {
  resetBrokaState();
  const blocked = await call({ seat: 'byron', case_ref: 'PREVIEW-NORTHGATE' }, {}, {
    ...ENV,
    BROKA_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    BROKA_SUPABASE_KEY: 'not-a-real-key',
  });
  assert.equal(blocked.res.status, 409);
  assert.equal(blocked.json.error, 'production_write_blocked');
  assert.equal(blocked.calls.length, 0);
  assert.equal(jobCounts().jobs, 0);
});

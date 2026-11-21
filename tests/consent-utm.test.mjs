import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSENT_VERSION, buildMeta } from '../api/factfind.js';

test('every fact-find submit stores the consent version and the four ad UTMs', () => {
  const form = readFileSync(new URL('../fact-find.js', import.meta.url), 'utf8');
  assert.match(form, /contact_consent/);
  assert.match(form, /ai_call_consent/);
  assert.match(form, /href="\/privacy-policy"/);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) assert.match(form, new RegExp(key));
  const meta = buildMeta(
    { salt: 'salt' },
    { headers: { 'x-forwarded-for': '203.0.113.8', 'user-agent': 'test' } },
    { attribution: { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'nov-bridge', utm_content: 'video-a', landing_path: '/fact-find', b: 'bh' } },
  );
  assert.equal(meta.consent_version, CONSENT_VERSION);
  assert.equal(CONSENT_VERSION, 'uk-consent-v2-2026-11-21');
  assert.equal(meta.utm_source, 'facebook');
  assert.equal(meta.utm_medium, 'cpc');
  assert.equal(meta.utm_campaign, 'nov-bridge');
  assert.equal(meta.utm_content, 'video-a');
  assert.equal(meta.broker_tag, 'bh');
  assert.equal(meta.ip_hash.length, 64);
  assert.doesNotMatch(JSON.stringify(meta), /203\.0\.113\.8/);
});

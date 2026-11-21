import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261121_broka_bridge_p1.sql', import.meta.url), 'utf8');

test('the phase 1 migration is additive and does not touch production by itself', () => {
  assert.match(sql, /do not apply to production project vgflcrfaudrvrdmxjdtl/i);
  assert.match(sql, /create table if not exists pipeline\.broka_jobs/i);
  assert.match(sql, /create table if not exists pipeline\.broka_job_events/i);
  assert.match(sql, /create table if not exists pipeline\.placed_runs/i);
  assert.match(sql, /create table if not exists pipeline\.lender_responses/i);
  assert.match(sql, /add column if not exists broka_case_id/i);
  assert.match(sql, /create or replace view pipeline\.lender_scorecard/i);
  assert.match(sql, /insert into spine\.broka_field_map/i);
  assert.match(sql, /pipeline\.audit_log/);
  assert.match(sql, /0\.50 \* coalesce\(speed_score, 0\)/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(sql, /standing_approval/);
  assert.match(sql, /paused/);
  assert.equal(/\bdrop\b/i.test(sql), false);
  assert.equal(/\bdelete\b/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\brename\b/i.test(sql), false);
  assert.equal(/alter\s+(table|column)[^;]*\btype\b/i.test(sql), false);
  assert.equal(/broka\.app/i.test(sql), false);
  assert.equal(/service_role_key|sb_secret|BEGIN PRIVATE/i.test(sql), false);
});

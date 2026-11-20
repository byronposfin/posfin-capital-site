import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARCHIVED_SOURCE, buildListModel, compareLeads, formatPostcode, safeReturn, stageRank, statusRank, validateChange,
} from '../lib/staff-leads.js';
import { isAnonKey, isServiceKey, readStaffConfig } from '../lib/staff-auth.js';
import { renderDetail, renderList, renderLogin } from '../lib/staff-leads-html.js';

const sql = readFileSync(new URL('../sql/20261120_staff_leads.sql', import.meta.url), 'utf8');

function lead(patch) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-11-01T12:00:00.000Z',
    full_name: 'Ada Example',
    email: 'ada@example.test',
    phone: '07000000000',
    status: 'new',
    assigned_to: '',
    source: 'manual',
    stage: '',
    factfind_reference: 'POSFIN-WEB-EXAMPLE',
    postcode: 'sw65aa',
    ...patch,
  };
}

test('archived Facebook rows are a source flag and stay out of the live book', () => {
  assert.equal(ARCHIVED_SOURCE, 'facebook_archived');
  assert.match(sql, /source is distinct from 'facebook_archived'/);
  const model = buildListModel([
    lead({ id: '00000000-0000-4000-8000-000000000001', full_name: 'Live Person' }),
    lead({ id: '00000000-0000-4000-8000-000000000002', full_name: 'Old Facebook', source: 'facebook_archived', email: 'old@example.test' }),
  ], {});
  assert.equal(model.summary.total, 1);
  assert.equal(model.page.rows[0].full_name, 'Live Person');
  assert.equal(JSON.stringify(model).includes('Old Facebook'), false);
});

test('default order is the furthest status, then the newest lead', () => {
  const rows = [
    lead({ id: '00000000-0000-4000-8000-000000000001', status: 'new', created_at: '2026-11-01T00:00:00.000Z', full_name: 'Older new' }),
    lead({ id: '00000000-0000-4000-8000-000000000002', status: 'statements_reviewed', created_at: '2026-01-01T00:00:00.000Z', full_name: 'Reviewed' }),
    lead({ id: '00000000-0000-4000-8000-000000000003', status: 'new', created_at: '2026-11-20T00:00:00.000Z', full_name: 'Newer new' }),
    lead({ id: '00000000-0000-4000-8000-000000000004', status: 'declined', created_at: '2026-11-19T00:00:00.000Z', full_name: 'Declined' }),
    lead({ id: '00000000-0000-4000-8000-000000000005', status: 'statements_received', created_at: '2026-11-18T00:00:00.000Z', full_name: 'Received' }),
  ];
  const model = buildListModel(rows, {});
  assert.deepEqual(model.page.rows.map((item) => item.full_name), ['Reviewed', 'Received', 'Newer new', 'Older new', 'Declined']);
  assert.ok(statusRank('statements_reviewed') < statusRank('new'));
  assert.ok(statusRank('new') < statusRank('declined'));
  assert.equal(model.query.sort, 'status');
  assert.equal(model.query.dir, 'asc');
});

test('stage order puts a signed engagement ahead of an unset lead', () => {
  assert.ok(stageRank('Completed') < stageRank('EL Signed'));
  assert.ok(stageRank('EL Signed') < stageRank('Pre-LOR'));
  assert.ok(stageRank('Pre-LOR') < stageRank('Dead'));
  assert.ok(stageRank('Dead') < stageRank(''));
  const rows = [
    lead({ id: '00000000-0000-4000-8000-000000000001', stage: '', full_name: 'Unset' }),
    lead({ id: '00000000-0000-4000-8000-000000000002', stage: 'EL Signed', full_name: 'Signed', created_at: '2026-01-01T00:00:00.000Z' }),
    lead({ id: '00000000-0000-4000-8000-000000000003', stage: 'Dead', full_name: 'Dead' }),
  ];
  const model = buildListModel(rows, { sort: 'stage' });
  assert.deepEqual(model.page.rows.map((item) => item.full_name), ['Signed', 'Dead', 'Unset']);
});

test('filters, search and pages stay on the live rows', () => {
  const rows = [];
  for (let i = 0; i < 45; i += 1) {
    rows.push(lead({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      full_name: i === 3 ? 'Ada Example' : `Person ${i}`,
      email: i === 3 ? 'ada@example.test' : `p${i}@example.test`,
      status: i === 3 ? 'contacted' : 'new',
      source: i === 4 ? 'web_factfind_uk' : 'manual',
      assigned_to: i === 3 ? 'byron.hill@posfincapital.com' : '',
      stage: i === 3 ? 'LOR' : '',
      factfind_reference: i === 3 ? 'POSFIN-WEB-EXAMPLE' : '',
      postcode: i === 3 ? 'SW6 5AA' : '',
      created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }));
  }
  const searched = buildListModel(rows, { q: 'sw65aa ada' });
  assert.equal(searched.page.total, 1);
  assert.equal(searched.page.rows[0].factfind_reference, 'POSFIN-WEB-EXAMPLE');
  const filtered = buildListModel(rows, { status: 'contacted', assigned: 'byron.hill@posfincapital.com', source: 'manual', stage: 'LOR' });
  assert.equal(filtered.page.total, 1);
  assert.equal(filtered.summary.total, 45);
  assert.equal(filtered.summary.status.find((item) => item.id === 'contacted').n, 1);
  const page = buildListModel(rows, { sort: 'created', dir: 'asc', page: 2 });
  assert.equal(page.page.page, 2);
  assert.equal(page.page.rows.length, 5);
  assert.equal(formatPostcode('sw65aa'), 'SW6 5AA');
});

test('writes reject a bad stage and keep the actor out of the form', () => {
  assert.equal(validateChange({ status: 'new', assigned_to: '', stage: 'Not a stage', note: ' hello ', setStatus: true, currentStatus: 'new' }).ok, false);
  const ok = validateChange({ status: 'contacted', assigned_to: 'byron.hill@posfincapital.com', stage: 'EL Signed', note: ' Called. ', setStatus: true, currentStatus: 'new' });
  assert.equal(ok.ok, true);
  assert.equal(ok.note, 'Called.');
  assert.equal(ok.stage, 'EL Signed');
  const kept = validateChange({ status: 'legacy', assigned_to: '', stage: '', note: '', setStatus: true, currentStatus: 'legacy' });
  assert.equal(kept.ok, true);
  assert.equal(safeReturn('https://evil.example/staff/leads'), '/staff/leads');
  assert.equal(safeReturn('/staff/leads?status=new'), '/staff/leads?status=new');
});

test('migration is additive and the activity log cannot be rewritten', () => {
  assert.match(sql, /add column if not exists stage text/i);
  assert.match(sql, /create table if not exists public\.lead_activity/i);
  assert.match(sql, /lead_activity is append-only/);
  assert.match(sql, /before update or delete on public\.lead_activity/i);
  assert.equal(/\bdelete\s+from\b/i.test(sql), false);
  assert.equal(/\btruncate\b/i.test(sql), false);
  assert.equal(/\bdrop\s+column\b/i.test(sql), false);
  assert.equal(/\bdrop\s+table\b/i.test(sql), false);
  assert.equal((sql.match(/update public\.leads/gi) || []).length, 3);
  for (const match of sql.match(/update public\.leads[\s\S]*?;/gi) || []) assert.match(match, /where id = v_lead\.id/i);
  for (const stage of ['Pre-LOR', 'LOR', 'EL Offered', 'EL Signed', 'Completed', 'Dead']) assert.match(sql, new RegExp(stage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(sql, /revoke all on table public\.lead_activity from public, anon, authenticated, service_role/i);
  assert.match(sql, /leads_require_posfin_staff/);
  assert.equal(/\bgrant\s+.*\bto\s+anon\b/i.test(sql), false);
});

test('server config pins production and refuses a service key in the anon slot', () => {
  const anon = `a.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.c`;
  const service = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c`;
  assert.equal(isAnonKey(anon), true);
  assert.equal(isServiceKey(service), true);
  assert.equal(isAnonKey(service), false);
  const prod = readStaffConfig({ FF_SUPABASE_KEY: anon, SUPABASE_MAIN_SERVICE_ROLE_KEY: service, VERCEL: '1', STAFF_LEADS_SUPABASE_URL: 'https://example.supabase.co' });
  assert.equal(prod.ok, true);
  assert.equal(prod.url, 'https://vgflcrfaudrvrdmxjdtl.supabase.co');
  assert.equal(readStaffConfig({ FF_SUPABASE_KEY: service, VERCEL: '1' }).ok, false);
  assert.equal(readStaffConfig({ STAFF_LEADS_ANON_KEY: anon, STAFF_LEADS_SERVICE_ROLE_KEY: anon, VERCEL: '1' }).ok, false);
});

test('pages escape lead text and do not echo a server key', () => {
  const service = 'super-secret-service-role';
  const model = buildListModel([lead({ full_name: '<script>alert(1)</script>' })], {});
  const html = renderList(model, { email: 'byron.hill@posfincapital.com', token: 'token' });
  assert.equal(html.includes('<script>alert'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes(service), false);
  const detail = renderDetail({
    id: '00000000-0000-4000-8000-000000000001',
    full_name: 'Ada Example',
    status: 'new',
    raw_answers: { _factfind_reference: 'POSFIN-WEB-EXAMPLE', note: '</pre><script>' },
  }, [{ kind: 'note', body: '<b>called</b>', actor_email: 'byron.hill@posfincapital.com', created_at: '2026-11-20T12:00:00.000Z' }], { email: 'byron.hill@posfincapital.com', token: 'token' }, { returnTo: '/staff/leads' });
  assert.equal(detail.includes('</pre><script>'), false);
  assert.match(detail, /&lt;b&gt;called&lt;\/b&gt;/);
  assert.match(renderLogin(''), /Sign in/);
  assert.equal(compareLeads(lead({ full_name: 'A' }), lead({ full_name: 'B' }), 'name', 'asc') < 0, true);
});

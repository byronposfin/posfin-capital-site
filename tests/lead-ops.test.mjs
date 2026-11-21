import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slaDue, slaColour, ageLabel } from '../lib/lead-sla.js';
import { nextSeat, DEFAULT_SEATS, staffWriteAllowed } from '../lib/lead-assign.js';
import { applicantReplyMessage, staffAlertMessage, deliveryDecision } from '../lib/lead-notify.js';
import { leadEmailConfig, drainLeadOps } from '../lib/lead-ops.js';
import { presentLead } from '../lib/lead-lane.js';
import handler from '../api/factfind-alert-worker.js';
import lane from '../api/staff-new-leads.js';

const sql = readFileSync(new URL('../sql/20261120_lead_ops_v1.sql', import.meta.url), 'utf8');
const at = (iso) => new Date(iso);

test('working-time SLA is Monday to Friday, 09:00 to 18:00 London', () => {
  assert.equal(slaDue(at('2026-11-20T09:00:00Z')).toISOString(), '2026-11-20T09:15:00.000Z');
  assert.equal(slaDue(at('2026-11-20T08:00:00Z')).toISOString(), '2026-11-20T09:15:00.000Z');
  assert.equal(slaDue(at('2026-11-20T07:40:00Z')).toISOString(), '2026-11-20T09:15:00.000Z');
  assert.equal(slaDue(at('2026-11-20T17:50:00Z')).toISOString(), '2026-11-23T09:05:00.000Z');
  assert.equal(slaDue(at('2026-11-20T18:00:00Z')).toISOString(), '2026-11-23T09:15:00.000Z');
  assert.equal(slaDue(at('2026-11-21T10:00:00Z')).toISOString(), '2026-11-23T09:15:00.000Z');
  assert.equal(slaDue(at('2026-11-22T15:00:00Z')).toISOString(), '2026-11-23T09:15:00.000Z');
  assert.equal(slaDue(at('2026-07-15T11:00:00Z')).toISOString(), '2026-07-15T11:15:00.000Z');
  assert.equal(slaDue(at('2026-03-28T19:50:00Z')).toISOString(), '2026-03-30T08:15:00.000Z');
});

test('SLA colour is a label as well as a colour', () => {
  const now = at('2026-11-20T10:00:00Z');
  assert.deepEqual(slaColour({ contacted_at: '2026-11-20T09:50:00Z', sla_due_at: '2026-11-20T09:40:00Z' }, now), { colour: 'done', label: 'Contacted' });
  assert.equal(slaColour({ sla_due_at: '2026-11-20T10:20:00Z' }, now).colour, 'green');
  assert.equal(slaColour({ sla_due_at: '2026-11-20T10:04:00Z' }, now).label, 'Due soon');
  assert.equal(slaColour({ sla_due_at: '2026-11-20T09:59:00Z' }, now).colour, 'red');
  assert.equal(ageLabel('2026-11-20T09:40:00Z', now), '20 min');
});

test('Byron owns new leads, Jessica is the backup, and round-robin is behind a flag', () => {
  assert.equal(nextSeat(DEFAULT_SEATS, 0).seat_code, 'byron');
  assert.equal(nextSeat(DEFAULT_SEATS, 3).seat_code, 'byron');
  const byronOff = DEFAULT_SEATS.map((seat) => seat.seat_code === 'byron' ? { ...seat, active: false } : seat);
  assert.equal(nextSeat(byronOff, 0).seat_code, 'jess');
  const names = [0, 1, 2, 3, 4].map((index) => nextSeat(DEFAULT_SEATS, index, '', { roundRobin: true }).seat_code);
  assert.deepEqual(names, ['jess', 'aadi', 'cai', 'chris', 'jess']);
  assert.equal(nextSeat(DEFAULT_SEATS, 0, 'bh').seat_code, 'byron');
  assert.equal(nextSeat(DEFAULT_SEATS, 0, 'chris').seat_code, 'chris');
  const chrisOff = DEFAULT_SEATS.map((seat) => seat.seat_code === 'chris' ? { ...seat, active: false } : seat);
  assert.equal(nextSeat(chrisOff, 0, 'chris', { roundRobin: true }).seat_code, 'jess');
  const cai = DEFAULT_SEATS.find((seat) => seat.seat_code === 'cai');
  assert.equal(cai.email, 'cai@posfincapital.com');
  assert.equal(cai.role, 'case_owner');
  assert.equal(cai.pronouns, 'she/her');
  assert.equal(DEFAULT_SEATS.find((seat) => seat.seat_code === 'byron').role, 'principal');
  assert.equal(DEFAULT_SEATS.find((seat) => seat.backup).seat_code, 'jess');
});

test('writes are limited by role', () => {
  assert.equal(staffWriteAllowed('read_only', { contacted_at: true }), false);
  assert.equal(staffWriteAllowed('analyst', { status: 'contacted' }), false);
  assert.equal(staffWriteAllowed('case_owner', { status: 'contacted', contacted_at: true }), true);
  assert.equal(staffWriteAllowed('case_owner', { status: 'closed_won' }), false);
  assert.equal(staffWriteAllowed('case_owner', { email: 'a@b.c' }), false);
  assert.equal(staffWriteAllowed('case_owner', { next_action: 'Call back', staff_note: 'Left a message' }), true);
  assert.equal(staffWriteAllowed('principal', { assigned_seat: 'jess', status: 'qualified', next_action: 'Call back' }), true);
  assert.equal(staffWriteAllowed('principal', { answers: {} }), false);
});

test('applicant reply is the final Lizzy note and does not send for a test row', () => {
  const lead = {
    reference: 'POSFIN-WEB-ABC234', full_name: 'Byron Hill', address: '1 Test Street', postcode: 'SW1A 1AA',
    contact_consent: true, ai_call_consent: false, no_chase: false, is_test: false, email: 'byron.hill@posfincapital.com',
  };
  const message = applicantReplyMessage(lead);
  assert.equal(message.subject, "We've received your enquiry");
  assert.equal(message.text, [
    'Hello Byron,',
    '',
    "Thank you. We've received your enquiry about 1 Test Street, SW1A 1AA.",
    '',
    'Someone from Posfin Capital will be in touch shortly, within our working hours, Monday to Friday, 09:00 to 18:00 UK time.',
    '',
    'If you would like a quick AI call now, reply to this email and say so. Byron will speak with you personally.',
    '',
    'Lizzy',
    'on behalf of Byron Hill',
    'Posfin Capital',
    '',
    'Posfin Capital Ltd is authorised and regulated by the Financial Conduct Authority (FRN 913022) and is a member of the NACFB.',
  ].join('\n'));
  assert.equal(applicantReplyMessage({ full_name: 'Byron Hill' }).text.includes('about your property'), true);
  assert.doesNotMatch(`${message.subject}\n${message.text}`, /DRAFT|would you like us to stay in touch|%|approv/i);
  const cfg = { production: true, autoreply: false, autoreplyOnly: '', onlyAlert: '' };
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: lead.email, payload: lead }, cfg).reason, 'autoreply_off');
  const on = { ...cfg, autoreply: true };
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: lead.email, payload: { ...lead, contact_consent: false } }, on).reason, 'no_consent');
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: lead.email, payload: { ...lead, no_chase: true } }, on).reason, 'no_chase');
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: lead.email, payload: { ...lead, is_test: true } }, on).reason, 'is_test');
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: 'TEST-WEB-ABC234', recipient_email: lead.email, payload: { ...lead, is_test: true } }, on).reason, 'synthetic');
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: 'other@example.com', payload: lead }, on).reason, 'recipient_mismatch');
  assert.equal(deliveryDecision({ kind: 'applicant_reply', reference: lead.reference, recipient_email: lead.email, payload: lead }, on).suppress, false);
});

test('staff alert names the owner and the consent flags', () => {
  const text = staffAlertMessage({
    reference: 'TEST-WEB-ABC234', is_test: true, no_chase: true, contact_consent: false, ai_call_consent: false,
    owner_name: 'Cai', full_name: 'Byron Hill', email: 'byron.hill@posfincapital.com', phone: '07000000000',
  }).text;
  assert.match(text, /Owner: Cai/);
  assert.match(text, /SYNTHETIC TEST/);
  assert.match(text, /DO NOT CHASE/);
  assert.match(text, /NO CONTACT CONSENT/);
  assert.match(text, /NO AI-CALL CONSENT/);
  assert.match(text, /credit broker, not the lender/);
});

test('email sender stays off unless the flag, database and provider are all set for this project', () => {
  const base = {
    LEAD_ALERT_EMAIL: 'true', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
    FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
    LEAD_EMAIL_PROVIDER: 'resend', LEAD_EMAIL_API_KEY: 're_test', LEAD_EMAIL_FROM: 'Posfin Capital <byron.hill@posfincapital.com>',
  };
  assert.equal(leadEmailConfig(base).ok, true);
  for (const off of [{ LEAD_ALERT_EMAIL: 'false' }, { VERCEL_ENV: 'preview' }, { FF_SUPABASE_URL: 'https://imcqwhccwsuglkzaxazg.supabase.co' }, { LEAD_EMAIL_API_KEY: '' }, { LEAD_ALERT_ONLY_EMAIL: 'not-an-email' }]) {
    assert.equal(leadEmailConfig({ ...base, ...off }).ok, false);
  }
  const resend = leadEmailConfig({
    LEAD_AUTOREPLY: 'true', LEAD_ALERT_EMAIL: 'false', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
    FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
    RESEND_API_KEY: 're_live_test', LEAD_EMAIL_FROM: 'Posfin Capital <hello@posfincapital.com>',
  });
  assert.equal(resend.ok, true);
  assert.equal(resend.provider, 'resend');
  assert.equal(resend.apiKey, 're_live_test');
  assert.equal(resend.autoreply, true);
});

test('drain sends the staff alert with an idempotency key and suppresses other recipients when the allowlist is Byron', async () => {
  const env = {
    LEAD_ALERT_EMAIL: 'true', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
    FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
    LEAD_EMAIL_PROVIDER: 'resend', LEAD_EMAIL_API_KEY: 're_test_secret', LEAD_EMAIL_FROM: 'Posfin Capital <byron.hill@posfincapital.com>',
    LEAD_ALERT_ONLY_EMAIL: 'byron.hill@posfincapital.com', LEAD_SLA_ENABLED: 'true',
  };
  const payload = { reference: 'POSFIN-WEB-ABC234', owner_name: 'Jess', contact_consent: true, ai_call_consent: false, no_chase: false, is_test: true, full_name: 'Byron Hill', email: 'byron.hill@posfincapital.com', phone: '07000000000' };
  const rows = [
    { id: '1', reference: 'POSFIN-WEB-ABC234', kind: 'staff_alert', recipient_email: 'byron.hill@posfincapital.com', lease_id: 'lease-1', attempts: 1, idempotency_key: 'idem-1', created_at: new Date().toISOString(), payload },
    { id: '2', reference: 'POSFIN-WEB-ABC234', kind: 'staff_alert', recipient_email: 'jessica@posfincapital.com', lease_id: 'lease-2', attempts: 1, idempotency_key: 'idem-2', created_at: new Date().toISOString(), payload },
  ];
  let claim = 0;
  const sent = [];
  const finished = [];
  const result = await drainLeadOps(env, async (url, opts) => {
    if (url.endsWith('web_lead_email_raise_alarms')) return { ok: true, status: 200, json: async () => 0 };
    if (url.endsWith('web_lead_sla_escalate')) return { ok: true, status: 200, json: async () => 1 };
    if (url.endsWith('web_lead_email_claim')) {
      claim++;
      return { ok: true, status: 200, json: async () => claim === 1 ? rows : [] };
    }
    if (url.endsWith('web_lead_email_finish')) { finished.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => true }; }
    sent.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({ id: 'msg_1' }) };
  }, { sla: true });
  assert.equal(result.sent, 1);
  assert.equal(result.suppressed, 1);
  assert.equal(result.escalations, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].headers['Idempotency-Key'], 'idem-1');
  assert.equal(sent[0].body.to[0], 'byron.hill@posfincapital.com');
  assert.match(sent[0].body.text, /Owner: Jess/);
  assert.equal(finished.find((row) => row.p_id === '2').p_result, 'suppressed');
  assert.equal(finished.find((row) => row.p_id === '1').p_provider_id, 'msg_1');
  assert.doesNotMatch(JSON.stringify(result), /re_test_secret|service-key/);
});

test('an unconfigured worker does not call Telegram or the email provider', async () => {
  const previous = { ...process.env };
  const secret = 's'.repeat(40);
  process.env.FF_ALERT_WORKER_SECRET = secret;
  process.env.LEAD_ALERT_EMAIL = 'false';
  process.env.FF_ALERT_DURABLE = 'false';
  const original = global.fetch;
  global.fetch = async () => { throw Error('must not fetch'); };
  try {
    let status, body;
    await handler({ method: 'POST', headers: { authorization: `Bearer ${secret}` } }, {
      setHeader() {},
      set statusCode(value) { status = value; },
      end(payload) { body = JSON.parse(payload); },
    });
    assert.equal(status, 200);
    assert.equal(body.telegram, 'not_configured');
    assert.equal(body.email, 'not_configured');
    assert.doesNotMatch(JSON.stringify(body), new RegExp(secret));
  } finally {
    global.fetch = original;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('the new-leads API requires a staff token and does not return the fact-find blob', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, { FF_BACKEND: 'leads', FF_SUPABASE_URL: 'http://127.0.0.1:9999', FF_SUPABASE_KEY: 'publishable', FF_HASH_SALT: 'salt' });
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  const original = global.fetch;
  const now = Date.now();
  global.fetch = async (url, opts) => {
    const fn = String(url).split('/').pop();
    const body = JSON.parse(opts.body || '{}');
    if (fn === 'staff_new_web_leads_v2') {
      assert.equal(body.p_include_tests, false);
      return { ok: true, status: 200, json: async () => [{ id: '11111111-1111-1111-1111-111111111111', reference: 'TEST-WEB-ABC234', submitted_at: new Date(now - 2 * 60 * 1000).toISOString(), full_name: 'Byron Hill', email: 'byron.hill@posfincapital.com', phone: '07000000000', owner_name: 'Jess', sla_due_at: new Date(now + 30 * 60 * 1000).toISOString(), contact_consent: true, ai_call_consent: false, no_chase: false, is_test: true, status: 'new', next_action: 'Call back', answers: { secret: true } }] };
    }
    if (fn === 'web_lead_staff_patch') {
      assert.equal(body.p_id, '11111111-1111-1111-1111-111111111111');
      assert.equal(body.p_patch.assigned_seat, 'jess');
      assert.equal(body.p_patch.next_action, 'Call Byron');
      assert.equal(body.p_patch.email, undefined);
      return { ok: true, status: 200, json: async () => ({ ok: true, reference: 'TEST-WEB-ABC234' }) };
    }
    assert.equal(fn, 'web_lead_mark_contacted');
    assert.equal(body.p_id, '11111111-1111-1111-1111-111111111111');
    return { ok: true, status: 200, json: async () => ({ ok: true, reference: 'TEST-WEB-ABC234' }) };
  };
  const respond = () => { let status, payload; return { res: { setHeader() {}, end(value) { payload = JSON.parse(value); }, set statusCode(value) { status = value; } }, read: () => ({ status, payload }) }; };
  try {
    const denied = respond();
    await lane({ method: 'GET', headers: {} }, denied.res);
    assert.equal(denied.read().status, 401);
    const listed = respond();
    await lane({ method: 'GET', headers: { authorization: 'Bearer staff-access-token-value' } }, listed.res);
    const lead = listed.read().payload.leads[0];
    assert.equal(lead.ownerName, 'Jess');
    assert.equal(lead.age, '2 min');
    assert.equal(lead.slaLabel, 'Within SLA');
    assert.equal(lead.answers, undefined);
    assert.equal(lead.nextAction, 'Call back');
    assert.equal(presentLead({ submitted_at: '2026-11-20T09:00:00Z', sla_due_at: '2026-11-20T09:15:00Z' }, at('2026-11-20T09:00:00Z')).age, 'under 1 min');
    const marked = respond();
    await lane({ method: 'POST', headers: { authorization: 'Bearer staff-access-token-value' }, body: { action: 'mark_contacted', id: '11111111-1111-1111-1111-111111111111' } }, marked.res);
    assert.equal(marked.read().status, 200);
    assert.equal(listed.read().payload.seats.some((seat) => seat.code === 'byron'), true);
    const bad = respond();
    await lane({ method: 'POST', headers: { authorization: 'Bearer staff-access-token-value' }, body: { action: 'mark_contacted', id: 'nope' } }, bad.res);
    assert.equal(bad.read().status, 400);
    const patched = respond();
    await lane({ method: 'POST', headers: { authorization: 'Bearer staff-access-token-value' }, body: { action: 'patch', id: '11111111-1111-1111-1111-111111111111', assigned_seat: 'jess', next_action: 'Call Byron' } }, patched.res);
    assert.equal(patched.read().status, 200);
  } finally {
    global.fetch = original;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('the migration is additive, leaves Telegram alone, and does not invent Cai\'s email', () => {
  assert.doesNotMatch(sql, /drop table|truncate|delete from|drop column/i);
  assert.match(sql, /email_alerts_armed_at/);
  assert.match(sql, /autoreply_armed_at/);
  assert.match(sql, /contact_consent/);
  assert.match(sql, /no_chase/);
  assert.match(sql, /interval '2 minutes'/);
  assert.match(sql, /expired_lease/);
  assert.match(sql, /byron\.hill@posfincapital\.com/);
  assert.match(sql, /jessica@posfincapital\.com/);
  assert.doesNotMatch(sql, /cai@/i);
  assert.match(sql, /web_lead_alert_claim/);
  assert.doesNotMatch(sql, /drop function public\.web_lead_alert_claim/);
  assert.match(sql, /has_role\(array\['principal','crm_operator','case_owner','analyst','read_only'\]\)/);
  const page = readFileSync(new URL('../staff/new-leads.html', import.meta.url), 'utf8');
  assert.match(page, /Mark contacted/);
  assert.match(page, /Next action/);
  assert.match(page, /credit broker, not a lender/);
  assert.match(page, /Monday to Friday, 09:00 to 18:00/);
  assert.match(page, /textContent/);
  assert.doesNotMatch(page, /service_role|LEAD_EMAIL_API_KEY/);
  const v1 = readFileSync(new URL('../sql/20261121_lead_pipeline_v1.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(v1, /drop table|truncate|delete from|drop column/i);
  assert.match(v1, /round_robin_enabled boolean not null default false/);
  assert.match(v1, /sheet_armed_at/);
  assert.match(v1, /time '09:00'/);
  assert.match(v1, /time '18:00'/);
  assert.match(v1, /backup = true/);
  assert.match(v1, /on conflict \(lead_id\) do nothing/);
  assert.doesNotMatch(v1, /insert into pipeline\.web_lead_sheet_outbox[\s\S]{0,200}from pipeline\.web_leads/i);
  assert.match(v1, /web_lead_sheet_raise_alarms/);
  assert.match(v1, /note_added/);
  assert.match(v1, /cai@posfincapital\.com/);
  assert.match(v1, /she\/her/);
  assert.match(v1, /new\.is_test is not true/);
  assert.doesNotMatch(v1, /set autoreply_allowlist/);
  assert.match(v1, /staff_new_web_leads_service/);
  assert.match(v1, /grant execute on function public\.staff_new_web_leads_service\(boolean\) to service_role/);
  assert.doesNotMatch(v1, /grant execute on function public\.staff_new_web_leads_service\(boolean\) to anon/);
  assert.match(v1, /interval '2 minutes'/);
});

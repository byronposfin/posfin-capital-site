// New-leads lane for the staff cockpit. Preview cards are fixtures.
// A live read uses the service-role RPC and only runs after the cockpit session is checked.
import { esc } from './case-portal.js';

const NOTE = 'Preview cards for the fact-find queue. Nothing here is a live applicant. Owner, status and mark-contacted are saved on /staff/new-leads, where each seat’s role is checked. This page does not email or call anyone.';

export const FIXTURE_LEADS = [
  {
    reference: 'TEST-WEB-BYRON1',
    ownerName: 'Byron Hill',
    age: '4 min',
    slaLabel: 'Within SLA',
    slaColour: 'green',
    fullName: 'Byron Hill',
    email: 'byron.hill@posfincapital.com',
    status: 'new',
    nextAction: 'Call Byron back',
    aiCall: false,
  },
  {
    reference: 'TEST-WEB-BYRON2',
    ownerName: 'Byron Hill',
    age: '16 min',
    slaLabel: 'Overdue',
    slaColour: 'red',
    fullName: 'Byron Hill',
    email: 'byron.hill@posfincapital.com',
    status: 'new',
    nextAction: '',
    aiCall: false,
  },
  {
    reference: 'TEST-WEB-BYRON3',
    ownerName: 'Jess',
    age: '1 h',
    slaLabel: 'Contacted',
    slaColour: 'done',
    fullName: 'Byron Hill',
    email: 'byron.hill@posfincapital.com',
    status: 'contacted',
    nextAction: 'Waiting on documents',
    aiCall: true,
  },
];

function ageLabel(submittedAt, now) {
  const start = new Date(submittedAt);
  if (Number.isNaN(start.getTime())) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h`;
}

function slaColour(row, now) {
  if (row.contacted_at) return { colour: 'done', label: 'Contacted' };
  const due = row.sla_due_at ? new Date(row.sla_due_at) : null;
  if (!due || Number.isNaN(due.getTime())) return { colour: 'amber', label: 'SLA not set' };
  const left = due.getTime() - now.getTime();
  if (left <= 0) return { colour: 'red', label: 'Overdue' };
  if (left <= 5 * 60 * 1000) return { colour: 'amber', label: 'Due soon' };
  return { colour: 'green', label: 'Within SLA' };
}

export function presentQueueLead(row, now = new Date()) {
  const sla = slaColour(row, now);
  return {
    reference: row.reference || '',
    ownerName: row.owner_name || 'Unassigned',
    age: ageLabel(row.submitted_at, now),
    slaLabel: sla.label,
    slaColour: sla.colour,
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    dateOfBirth: row.applicant_dob || '',
    status: row.status || '',
    nextAction: row.next_action || '',
    aiCall: row.ai_call_consent === true,
  };
}

function card(lead) {
  const flags = lead.aiCall ? '' : '<p class="meta">No AI caller</p>';
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(lead.dateOfBirth || '') ? lead.dateOfBirth.slice(8) + '/' + lead.dateOfBirth.slice(5, 7) + '/' + lead.dateOfBirth.slice(0, 4) : '';
  const reference = lead.reference
    ? `<a href="/staff/new-leads#${encodeURIComponent(lead.reference)}">${esc(lead.reference)}</a>`
    : 'Fact find';
  return `<article class="card" data-lane="new-leads"><div class="row" style="display:flex;justify-content:space-between;gap:12px"><h3>${reference}</h3><span class="pill ${esc(lead.slaColour)}">${esc(lead.slaLabel)}</span></div><p>Owner: ${esc(lead.ownerName)}</p><p class="meta">Waiting: ${esc(lead.age || '—')}</p><p>Status: ${esc(lead.status || 'new')}</p><p>${esc(lead.fullName)}</p>${lead.phone ? `<p>${esc(lead.phone)}</p>` : ''}${dob ? `<p>Date of birth: ${esc(dob)}</p>` : ''}<p>${esc(lead.email)}</p><p class="meta">Next action: ${esc(lead.nextAction || '—')}</p>${flags}</article>`;
}

export function renderNewLeadsLane(leads, note = NOTE) {
  const cards = leads.length ? leads.map(card).join('') : '<p class="empty">No open fact finds.</p>';
  return `<section class="lane new_leads" data-section="new_leads"><p class="kicker">Fact finds</p><h2>New leads</h2><p class="meta">${esc(note)}</p><div class="cards">${cards}</div></section>`;
}

export function previewNewLeadsHtml() {
  return renderNewLeadsLane(FIXTURE_LEADS, NOTE);
}

export async function loadNewLeads(env = process.env, fetcher = fetch, now = new Date()) {
  const url = String(env.FF_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.FF_ALERT_SERVICE_KEY || '');
  if (!url || !key) return { ok: false, reason: 'not_configured', leads: [] };
  const include = env.FF_TEST_RUN === 'true' && env.VERCEL_ENV !== 'production';
  let response = await fetcher(`${url}/rest/v1/rpc/staff_new_web_leads_service_v2`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_include_tests: include }),
  });
  if (!response.ok) {
    response = await fetcher(`${url}/rest/v1/rpc/staff_new_web_leads_service`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_include_tests: include }),
    });
  }
  if (!response.ok) return { ok: false, reason: 'unavailable', leads: [] };
  const rows = await response.json();
  const list = Array.isArray(rows) ? rows : [];
  return {
    ok: true,
    leads: list.map((row) => presentQueueLead(row, now)),
  };
}

export async function newLeadsHtml(mode, env = process.env, fetcher = fetch) {
  if (mode !== 'supabase') return previewNewLeadsHtml();
  try {
    const loaded = await loadNewLeads(env, fetcher);
    if (!loaded.ok) {
      return renderNewLeadsLane([], 'The fact-find queue is not available on this database yet. It appears after the lead migration is applied.');
    }
    return renderNewLeadsLane(loaded.leads, 'Submitted fact finds from web_leads. Change owner, status, or mark contacted on /staff/new-leads. This page does not email or call anyone.');
  } catch {
    return renderNewLeadsLane([], 'The fact-find queue could not be loaded.');
  }
}

import {
  assignChoices, contactLine, formatWhen, listHref, nextSort, stageChoices, stageLabel, statusChoices, statusLabel,
} from './staff-leads.js';
import { csrfFor } from './staff-auth.js';

const CSS = `
:root { color-scheme: light; --ink:#142033; --muted:#5c6b7b; --line:#e4dccb; --paper:#faf8f3; --card:#fff; --teal:#086b66; --soft:#e7f4f3; --bad:#8d2b2b; --warn:#8a4b08; }
* { box-sizing: border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.45 "Segoe UI", system-ui, sans-serif; }
a { color:var(--teal); }
header, main { width:min(1180px, calc(100% - 24px)); margin:0 auto; }
header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 0; flex-wrap:wrap; }
header form { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; margin:0; }
header img { height:32px; width:auto; }
.who { color:var(--muted); font-size:14px; }
button, .btn { appearance:none; border:0; border-radius:10px; background:var(--teal); color:#fff; font:inherit; font-weight:650; min-height:44px; padding:10px 14px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; }
button.ghost, a.ghost { background:transparent; color:var(--ink); border:1px solid var(--line); }
h1 { font-size:1.55rem; line-height:1.2; margin:0 0 4px; }
.sub { color:var(--muted); margin:0 0 14px; }
.panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:14px; margin:0 0 14px; }
.groups { display:grid; gap:12px; }
.groups h2 { margin:0 0 6px; font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
.chips { display:flex; flex-wrap:wrap; gap:8px; }
.chip { display:flex; gap:8px; align-items:baseline; text-decoration:none; color:var(--ink); background:#f6f3ec; border:1px solid var(--line); border-radius:999px; padding:7px 10px; min-height:36px; max-width:100%; overflow-wrap:anywhere; }
.chip strong { font-variant-numeric:tabular-nums; }
.chip[aria-current="true"] { background:var(--soft); border-color:var(--teal); color:var(--teal); }
form.filters, form.editor { display:grid; gap:10px; }
.filters { grid-template-columns:repeat(4, minmax(0, 1fr)); }
label { display:grid; gap:4px; font-size:13px; color:var(--muted); font-weight:650; }
input, select, textarea { width:100%; border:1px solid var(--line); border-radius:10px; background:#fff; color:var(--ink); font:inherit; min-height:44px; padding:8px 10px; }
textarea { min-height:96px; resize:vertical; }
.search { grid-column:1 / -1; }
.actions { display:flex; flex-wrap:wrap; gap:8px; align-items:end; }
.table-wrap { overflow:auto; }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
th a { color:inherit; text-decoration:none; }
th[aria-sort] a { color:var(--teal); }
.name { font-weight:700; }
.muted { color:var(--muted); }
.badge { display:inline-block; margin-left:6px; border-radius:999px; background:#f8e7cf; color:var(--warn); font-size:12px; padding:1px 6px; }
.pager { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-top:12px; }
.note { background:#fff6f5; color:var(--bad); border-radius:10px; padding:10px 12px; }
.ok { background:var(--soft); color:var(--teal); border-radius:10px; padding:10px 12px; }
dl { display:grid; grid-template-columns:minmax(140px, 220px) 1fr; gap:6px 12px; margin:0; }
dt { color:var(--muted); }
dd { margin:0; overflow-wrap:anywhere; }
pre { white-space:pre-wrap; overflow:auto; background:#142033; color:#f4f0e6; border-radius:12px; padding:12px; font-size:13px; }
.timeline { display:grid; gap:10px; }
.event { border-left:3px solid var(--teal); padding:2px 0 2px 10px; }
@media (max-width: 760px) {
  .filters { grid-template-columns:1fr; }
  .table-wrap { overflow:visible; }
  table, tbody, tr, td { display:block; width:100%; }
  thead { display:none; }
  tr { background:var(--card); border:1px solid var(--line); border-radius:14px; margin:0 0 10px; padding:6px 0; }
  td { display:grid; grid-template-columns:minmax(92px, 38%) minmax(0, 1fr); gap:8px; align-items:start; border:0; padding:7px 12px; }
  td::before { content:attr(data-label); color:var(--muted); font-size:12px; }
  dl { grid-template-columns:1fr; }
}
`;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function page(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function shell(email, body) {
  const who = email
    ? `<form method="post" action="/staff/leads"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="${esc(csrfFor(email.token))}"><span class="who">${esc(email.email)}</span> <button class="ghost" type="submit">Log out</button></form>`
    : '';
  return `<header><a href="/staff/leads"><img src="/logo.png" alt="Posfin Capital"></a>${who}</header><main>${body}</main>`;
}

export function renderLogin(message) {
  const note = message ? `<p class="note">${esc(message)}</p>` : '';
  return page('Staff sign in', shell(null, `<h1>Leads desk</h1><p class="sub">Posfin staff only. Personal financial data stays on this page.</p><section class="panel"><form method="post" action="/staff/leads">${note}<label>Email<input name="email" type="email" autocomplete="username" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><input type="hidden" name="action" value="login"><div class="actions"><button type="submit">Sign in</button></div></form></section>`));
}

export function renderUnavailable() {
  return page('Leads desk', shell(null, `<h1>Leads desk</h1><p class="note">This desk is not available until the server credentials are set. Nothing was read.</p>`));
}

export function renderMessage(title, text) {
  return page(title, shell(null, `<h1>${esc(title)}</h1><p class="sub">${esc(text)}</p><p><a class="btn" href="/staff/leads">Back to leads</a></p>`));
}

function chip(href, label, n, current) {
  return `<a class="chip" href="${esc(href)}"${current ? ' aria-current="true"' : ''}><strong>${n}</strong> ${esc(label)}</a>`;
}

function group(title, items) {
  return `<section><h2>${esc(title)}</h2><div class="chips">${items}</div></section>`;
}

function sortLink(query, column, label) {
  const next = nextSort(query, column);
  const active = query.sort === column;
  const arrow = !active ? '' : query.dir === 'asc' ? ' ↑' : ' ↓';
  const aria = active ? ` aria-sort="${query.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
  return `<th${aria}><a href="${esc(listHref(query, next))}">${esc(label)}${arrow}</a></th>`;
}

export function renderList(model, session) {
  const { query, summary, page: list } = model;
  const clear = query.status || query.assigned || query.source || query.stage || query.q
    ? `<a class="ghost" href="/staff/leads">Clear</a>` : '';
  const statusChips = summary.status.map((item) => chip(
    listHref(query, { status: query.status === item.id ? '' : item.id, page: 1 }),
    statusLabel(item.id),
    item.n,
    query.status === item.id,
  )).join('');
  const assignedChips = summary.assigned.map((item) => chip(
    listHref(query, { assigned: query.assigned === item.id ? '' : item.id, page: 1 }),
    item.label,
    item.n,
    query.assigned === item.id,
  )).join('');
  const sourceChips = summary.source.map((item) => chip(
    listHref(query, { source: query.source === item.id ? '' : item.id, page: 1 }),
    item.label,
    item.n,
    query.source === item.id,
  )).join('');
  const stageChips = summary.stage.map((item) => chip(
    listHref(query, { stage: query.stage === item.id ? '' : item.id, page: 1 }),
    item.id === '__unset__' ? 'Not set' : stageLabel(item.id),
    item.n,
    query.stage === item.id,
  )).join('');
  const options = (items, selected) => items.map((item) => `<option value="${esc(item.id)}"${item.id === selected ? ' selected' : ''}>${esc(item.label)}</option>`).join('');
  const sources = [{ id: '', label: 'All sources' }, ...summary.source.map((item) => ({ id: item.id, label: item.label }))];
  const rows = list.rows.map((lead) => `<tr>
    <td data-label="Created">${esc(formatWhen(lead.created_at))}</td>
    <td data-label="Name"><a class="name" href="/staff/leads/${esc(lead.id)}?return=${encodeURIComponent(listHref(query))}">${esc(lead.full_name)}</a></td>
    <td data-label="Status">${esc(statusLabel(lead.status))}</td>
    <td data-label="Assigned">${esc(lead.assigned_to || 'Unassigned')}</td>
    <td data-label="Source">${esc(lead.source || '—')}${lead.test ? '<span class="badge">Test</span>' : ''}</td>
    <td data-label="Stage">${esc(stageLabel(lead.stage))}</td>
    <td data-label="Fact find">${esc(lead.factfind_reference || '—')}</td>
    <td data-label="Contact">${esc(contactLine(lead) || '—')}</td>
    <td data-label="Postcode">${esc(lead.postcode || '—')}</td>
  </tr>`).join('');
  const empty = rows ? '' : '<p class="sub">No leads match these filters.</p>';
  const prev = list.page > 1 ? `<a class="btn ghost" href="${esc(listHref(query, { page: list.page - 1 }))}">Previous</a>` : '<span></span>';
  const next = list.page < list.pages ? `<a class="btn ghost" href="${esc(listHref(query, { page: list.page + 1 }))}">Next</a>` : '<span></span>';
  const banner = model.notice ? `<p class="ok">${esc(model.notice)}</p>` : '';
  return page('Leads', shell(session, `${banner}<h1>Leads</h1><p class="sub">${summary.total} live leads. Archived Facebook rows are not on this desk. Showing ${list.start}–${list.end} of ${list.total}.</p>
  <section class="panel groups">${group('Status', statusChips)}${group('Assignment', assignedChips)}${group('Source', sourceChips)}${group('Stage', stageChips)}</section>
  <form class="panel filters" method="get" action="/staff/leads">
    <label class="search">Search name, reference, postcode or email<input name="q" value="${esc(query.q)}" placeholder="Name, reference, postcode or email"></label>
    <label>Status<select name="status"><option value="">All statuses</option>${options(statusChoices('').map((item) => item), query.status)}</select></label>
    <label>Assigned<select name="assigned"><option value="">Anyone</option><option value="__unassigned__"${query.assigned === '__unassigned__' ? ' selected' : ''}>Unassigned</option>${options(assignChoices('').filter((item) => item.id), query.assigned)}</select></label>
    <label>Source<select name="source">${options(sources, query.source)}</select></label>
    <label>Stage<select name="stage"><option value="">All stages</option><option value="__unset__"${query.stage === '__unset__' ? ' selected' : ''}>Not set</option>${options(stageChoices().filter((item) => item.id), query.stage)}</select></label>
    <input type="hidden" name="sort" value="${esc(query.sort)}"><input type="hidden" name="dir" value="${esc(query.dir)}">
    <div class="actions"><button type="submit">Apply</button>${clear}</div>
  </form>
  <div class="table-wrap"><table><thead><tr>${sortLink(query, 'created', 'Created')}${sortLink(query, 'name', 'Name')}${sortLink(query, 'status', 'Status')}${sortLink(query, 'assigned', 'Assigned')}${sortLink(query, 'source', 'Source')}${sortLink(query, 'stage', 'Stage')}${sortLink(query, 'ref', 'Fact find')}${sortLink(query, 'contact', 'Contact')}${sortLink(query, 'postcode', 'Postcode')}</tr></thead><tbody>${rows}</tbody></table>${empty}</div>
  <div class="pager">${prev}<span class="muted">Page ${list.page} of ${list.pages}</span>${next}</div>`));
}

const SCALAR = [
  ['created_at', 'Created'], ['updated_at', 'Updated'], ['full_name', 'Name'], ['email', 'Email'], ['phone', 'Phone'],
  ['company_name', 'Company'], ['companies_house_number', 'Companies House'], ['is_ltd', 'Limited company'],
  ['status', 'Status'], ['stage', 'Stage'], ['assigned_to', 'Assigned to'], ['source', 'Source'],
  ['tier', 'Tier'], ['score', 'Score'], ['notes', 'Existing notes'], ['loan_amount_band', 'Loan band'],
  ['turnover_band', 'Turnover band'], ['ccj_status', 'CCJ'], ['existing_facilities', 'Existing facilities'],
  ['property_pg_strength', 'Property / PG'], ['registered_office_address', 'Registered office'],
  ['company_status', 'Company status'], ['date_of_creation', 'Incorporated'], ['sic_codes', 'SIC'],
  ['market', 'Market'], ['consent_source', 'Consent source'], ['consent_at', 'Consent at'],
  ['contact_hold_reason', 'Contact hold'], ['contact_hold_by', 'Hold by'], ['contact_hold_at', 'Hold at'],
  ['fb_form_name', 'Facebook form'], ['fb_campaign_name', 'Facebook campaign'], ['fb_created_time', 'Facebook created'],
];

function fieldValue(lead, key) {
  const value = lead[key];
  if (value == null || value === '') return '—';
  if (key === 'status') return statusLabel(value);
  if (key === 'stage') return stageLabel(value);
  if (key === 'email') return `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
  if (key === 'phone') return `<a href="tel:${esc(String(value).replace(/\s/g, ''))}">${esc(value)}</a>`;
  if (Array.isArray(value)) return esc(value.join(', '));
  if (typeof value === 'object') return esc(JSON.stringify(value));
  if (/_at$|_time$/.test(key)) return esc(formatWhen(value));
  return esc(value);
}

export function renderDetail(lead, activity, session, extras) {
  const back = extras.returnTo || '/staff/leads';
  const notice = extras.notice ? `<p class="${extras.noticeOk === false ? 'note' : 'ok'}">${esc(extras.notice)}</p>` : '';
  const fields = SCALAR.map(([key, label]) => `<dt>${esc(label)}</dt><dd>${fieldValue(lead, key)}</dd>`).join('');
  const reference = lead.raw_answers && lead.raw_answers._factfind_reference;
  const postcode = lead.raw_answers && (lead.raw_answers.security_postcode || '');
  const events = activity.length ? activity.map((item) => {
    const change = item.kind === 'note'
      ? esc(item.body)
      : `${esc(item.field || item.kind)}: ${esc(item.old_value || '—')} → ${esc(item.new_value || '—')}`;
    return `<article class="event"><div class="muted">${esc(formatWhen(item.created_at))} · ${esc(item.actor_email)}</div><div>${change}</div></article>`;
  }).join('') : '<p class="muted">No notes or changes yet.</p>';
  const hidden = `<input type="hidden" name="action" value="save"><input type="hidden" name="csrf" value="${esc(csrfFor(session.token))}"><input type="hidden" name="lead" value="${esc(lead.id)}"><input type="hidden" name="return" value="${esc(back)}">`;
  return page(lead.full_name || 'Lead', shell(session, `${notice}<p><a href="${esc(back)}">← Leads</a></p><h1>${esc(lead.full_name || 'Unnamed lead')}</h1><p class="sub">${esc(statusLabel(lead.status))} · ${esc(stageLabel(lead.stage))}${reference ? ` · ${esc(reference)}` : ''}${postcode ? ` · ${esc(postcode)}` : ''}</p>
  <form class="panel editor" method="post" action="/staff/leads/${esc(lead.id)}">
    ${hidden}
    <label>Status<select name="status">${statusChoices(lead.status).map((item) => `<option value="${esc(item.id)}"${item.id === lead.status ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
    <label>Assigned to<select name="assigned_to">${assignChoices(lead.assigned_to || '').map((item) => `<option value="${esc(item.id)}"${item.id === (lead.assigned_to || '') ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
    <label>Stage<select name="stage">${stageChoices().map((item) => `<option value="${esc(item.id)}"${item.id === (lead.stage || '') ? ' selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
    <label>Add a note<textarea name="note" maxlength="4000" placeholder="What happened, and what is next"></textarea></label>
    <div class="actions"><button type="submit">Save progress</button></div>
  </form>
  <section class="panel"><h2>Progress</h2><div class="timeline">${events}</div></section>
  <section class="panel"><h2>Lead</h2><dl>${fields}<dt>Fact-find reference</dt><dd>${esc(reference || '—')}</dd><dt>Postcode</dt><dd>${esc(postcode || '—')}</dd></dl></section>
  <section class="panel"><h2>Raw answers</h2><pre>${esc(JSON.stringify(lead.raw_answers || {}, null, 2))}</pre></section>`));
}

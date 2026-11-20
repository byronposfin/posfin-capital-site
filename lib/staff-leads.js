export const PRODUCTION_URL = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';
export const ARCHIVED_SOURCE = 'facebook_archived';
export const PAGE_SIZE = 40;
export const STAGES = ['Pre-LOR', 'LOR', 'EL Offered', 'EL Signed', 'Completed', 'Dead'];
export const STATUSES = [
  { id: 'statements_reviewed', label: 'Statements reviewed', rank: 0 },
  { id: 'statements_received', label: 'Statements received', rank: 1 },
  { id: 'call_slot_selected', label: 'Call slot selected', rank: 2 },
  { id: 'contacted', label: 'Contacted', rank: 3 },
  { id: 'new', label: 'New', rank: 4 },
  { id: 'declined', label: 'Declined', rank: 5 },
];
export const ASSIGN_OPTIONS = [
  'byron.hill@posfincapital.com',
  'byron@posfincapital.com',
  'chris.shipton@posfincapital.com',
  'aadi@posfincapital.com',
  'vanessa@posfincapital.com',
];
export const SORTS = ['status', 'created', 'name', 'assigned', 'source', 'stage', 'ref', 'contact', 'postcode'];
const STAFF_EMAIL = /^[^@\s]+@posfincapital\.com$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

const statusById = new Map(STATUSES.map((item) => [item.id, item]));

export function isStaffEmail(email) {
  return STAFF_EMAIL.test(String(email || '').trim().toLowerCase());
}

export function isUuid(value) {
  return UUID.test(String(value || ''));
}

export function statusRank(status) {
  return statusById.get(status)?.rank ?? 3.5;
}

export function statusLabel(status) {
  return statusById.get(status)?.label || String(status || 'Unknown');
}

const STAGE_RANK = { Completed: 0, 'EL Signed': 1, 'EL Offered': 2, LOR: 3, 'Pre-LOR': 4, Dead: 5 };

export function stageRank(stage) {
  if (!stage) return 7;
  return STAGE_RANK[stage] ?? 6;
}

export function stageLabel(stage) {
  return stage || 'Not set';
}

export function formatPostcode(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!POSTCODE.test(compact)) return String(value || '').trim();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function normaliseLead(row) {
  const email = String(row.email || '').trim();
  const phone = String(row.phone || '').trim();
  return {
    id: String(row.id || ''),
    created_at: row.created_at || '',
    full_name: String(row.full_name || '').trim() || 'Unnamed lead',
    email,
    phone,
    status: String(row.status || '').trim(),
    assigned_to: String(row.assigned_to || '').trim(),
    source: String(row.source || '').trim(),
    stage: row.stage ? String(row.stage) : '',
    factfind_reference: String(row.factfind_reference || '').trim(),
    postcode: formatPostcode(row.postcode),
    test: /test/i.test(String(row.source || '')),
  };
}

export function contactLine(lead) {
  return lead.email || lead.phone || '';
}

function cmpText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'en-GB', { sensitivity: 'base', numeric: true });
}

function timeOf(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}

export function compareLeads(a, b, sort, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  let primary = 0;
  switch (sort) {
    case 'status': primary = statusRank(a.status) - statusRank(b.status); break;
    case 'stage': primary = stageRank(a.stage) - stageRank(b.stage); break;
    case 'created': primary = timeOf(a.created_at) - timeOf(b.created_at); break;
    case 'name': primary = cmpText(a.full_name, b.full_name); break;
    case 'assigned': primary = cmpText(a.assigned_to, b.assigned_to); break;
    case 'source': primary = cmpText(a.source, b.source); break;
    case 'ref': primary = cmpText(a.factfind_reference, b.factfind_reference); break;
    case 'contact': primary = cmpText(contactLine(a), contactLine(b)); break;
    case 'postcode': primary = cmpText(a.postcode, b.postcode); break;
    default: primary = statusRank(a.status) - statusRank(b.status);
  }
  primary *= sign;
  if (primary !== 0) return primary;
  const created = timeOf(b.created_at) - timeOf(a.created_at);
  if (created !== 0) return created;
  return cmpText(a.id, b.id);
}

export function parseListQuery(input = {}) {
  const sort = SORTS.includes(input.sort) ? input.sort : 'status';
  const dir = input.dir === 'desc' ? 'desc' : 'asc';
  const page = Math.max(1, Number.parseInt(input.page, 10) || 1);
  return {
    status: String(input.status || ''),
    assigned: String(input.assigned || ''),
    source: String(input.source || ''),
    stage: String(input.stage || ''),
    q: String(input.q || '').trim().slice(0, 80),
    sort,
    dir,
    page,
    returnTo: safeReturn(input.return),
  };
}

export function safeReturn(value) {
  const text = String(value || '');
  if (!text.startsWith('/staff/leads')) return '/staff/leads';
  if (text.startsWith('//') || text.includes('\\') || text.includes('://') || text.includes('\n')) return '/staff/leads';
  return text.slice(0, 500);
}

function searchBlob(lead) {
  return [lead.full_name, lead.email, lead.phone, lead.factfind_reference, lead.postcode, lead.postcode.replace(/\s/g, '')]
    .join('\n')
    .toLowerCase();
}

export function filterLeads(leads, query) {
  const tokens = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  return leads.filter((lead) => {
    if (lead.source === ARCHIVED_SOURCE) return false;
    if (query.status && lead.status !== query.status) return false;
    if (query.source && lead.source !== query.source) return false;
    if (query.assigned === '__unassigned__' && lead.assigned_to) return false;
    if (query.assigned && query.assigned !== '__unassigned__' && lead.assigned_to !== query.assigned) return false;
    if (query.stage === '__unset__' && lead.stage) return false;
    if (query.stage && query.stage !== '__unset__' && lead.stage !== query.stage) return false;
    if (tokens.length) {
      const blob = searchBlob(lead);
      if (!tokens.every((token) => blob.includes(token))) return false;
    }
    return true;
  });
}

export function summarise(leads) {
  const count = (items, key, labelFor, emptyId, emptyLabel) => {
    const map = new Map();
    for (const lead of items) {
      const id = lead[key] || emptyId;
      const current = map.get(id) || { id, label: lead[key] ? labelFor(lead[key]) : emptyLabel, n: 0 };
      current.n += 1;
      map.set(id, current);
    }
    return [...map.values()].sort((a, b) => b.n - a.n || cmpText(a.label, b.label));
  };
  return {
    total: leads.length,
    status: count(leads, 'status', statusLabel, '', 'Unknown'),
    assigned: count(leads, 'assigned_to', (value) => value, '__unassigned__', 'Unassigned'),
    source: count(leads, 'source', (value) => value, '', 'Unknown'),
    stage: count(leads, 'stage', stageLabel, '__unset__', 'Not set'),
  };
}

export function paginate(leads, page, pageSize = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(leads.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    pageSize,
    total: leads.length,
    start: leads.length ? start + 1 : 0,
    end: Math.min(start + pageSize, leads.length),
    rows: leads.slice(start, start + pageSize),
  };
}

export function listHref(query, patch = {}) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  for (const key of ['status', 'assigned', 'source', 'stage', 'q', 'sort', 'dir', 'page']) {
    const value = next[key];
    if (value === undefined || value === null || value === '' || (key === 'page' && Number(value) <= 1)) continue;
    if (key === 'sort' && value === 'status' && (!next.dir || next.dir === 'asc')) continue;
    if (key === 'dir' && value === 'asc') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/staff/leads?${qs}` : '/staff/leads';
}

export function nextSort(query, column) {
  if (!SORTS.includes(column)) return { sort: query.sort, dir: query.dir };
  if (query.sort !== column) return { sort: column, dir: column === 'created' ? 'desc' : 'asc', page: 1 };
  return { sort: column, dir: query.dir === 'asc' ? 'desc' : 'asc', page: 1 };
}

export function buildListModel(rows, input) {
  const query = parseListQuery(input);
  const leads = rows.map(normaliseLead).filter((lead) => lead.source !== ARCHIVED_SOURCE);
  const summary = summarise(leads);
  const filtered = filterLeads(leads, query).sort((a, b) => compareLeads(a, b, query.sort, query.dir));
  return { query, summary, page: paginate(filtered, query.page), filtered: filtered.length };
}

export function validateChange(input) {
  const status = String(input.status ?? '').trim();
  const assigned = String(input.assigned_to ?? '').trim();
  const stage = String(input.stage ?? '').trim();
  const note = String(input.note ?? '').trim();
  const errors = [];
  if (input.setStatus && status && !statusById.has(status) && status !== input.currentStatus) errors.push('bad_status');
  if (input.setStatus && !status) errors.push('bad_status');
  if (assigned.length > 120 || /[\u0000-\u001f]/.test(assigned)) errors.push('bad_assigned');
  if (stage && !STAGES.includes(stage)) errors.push('bad_stage');
  if (note.length > 4000) errors.push('bad_note');
  return {
    ok: errors.length === 0,
    errors,
    status,
    assigned_to: assigned,
    stage,
    note,
  };
}

export function statusChoices(current) {
  const choices = STATUSES.map((item) => ({ id: item.id, label: item.label }));
  if (current && !statusById.has(current)) choices.push({ id: current, label: statusLabel(current) });
  return choices;
}

export function assignChoices(current) {
  const choices = [{ id: '', label: 'Unassigned' }, ...ASSIGN_OPTIONS.map((id) => ({ id, label: id }))];
  if (current && !ASSIGN_OPTIONS.includes(current)) choices.push({ id: current, label: current });
  return choices;
}

export function stageChoices() {
  return [{ id: '', label: 'Not set' }, ...STAGES.map((id) => ({ id, label: id }))];
}

export function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

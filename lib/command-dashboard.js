// Staff command dashboard. Session checks use the existing Supabase staff helper.
// Snapshot reads use SUPABASE_SERVICE_ROLE_KEY only after that check succeeds.
// Finance and private cases are Byron's seat only. No borrower data is stored here.

import { readCookie } from './case-http.js';
import { staffActorFromToken, staffSupabaseUrl, supabaseAccessToken } from './staff-auth.js';

export const PUBLIC_SECTIONS = ['overview', 'roster', 'pipeline', 'tasks', 'lenders', 'files'];
export const BYRON_SECTIONS = ['finance_byron_only', 'pipeline_private_byron'];

export const THREAD_TARGETS = new Set([
  'all',
  'lizzy',
  'team-lizzy',
  'team lizzy',
  'byron',
  'chris',
  'jess',
  'aadi',
  'cai',
  'vanessa',
  'april',
  'social',
  'lizzy-byron',
  'lizzy-chris',
  'lizzy-jess',
  'lizzy-cai',
  'lizzy-aadi',
  'lizzy-vanessa',
]);

const BLOCKED_TARGET = /\b(tom|openclaw|gateway)\b/i;
const ROUTING_KEYS = ['to_agent', 'to', 'target', 'route', 'recipient', 'routing'];
const SENSITIVE = /(\/secure\/|\/raw\/|\.env\b|password|secret|credential|api[_-]?key|service[_-]?role|\btoken\b)/i;

const CASE_TEXT_MAX = 400;
const FINANCE_NOTICE = 'QuickBooks, CVA, VAT, and corporation tax are excluded pending Byron\'s separate figures.';

function exclusionNotice(value) {
  const notice = text(value, 1000);
  const covers = /quickbooks/i.test(notice) && /\bcva\b/i.test(notice) && /\bvat\b/i.test(notice) && /corporation tax/i.test(notice);
  if (covers) return notice;
  return [notice, FINANCE_NOTICE].filter(Boolean).join(' ');
}

const MONTH_KEYS = [
  'month',
  'fee_receipts_cash',
  'fee_lender_paid',
  'fee_via_solicitors',
  'fee_client_direct',
  'business_operating_costs',
  'introducer_case_client_payments',
  'cost_advertising',
  'cost_software',
  'cost_staff',
  'cost_professional',
  'cost_telecoms',
  'operating_cash_after_pay',
];

const CASH_KEYS = [
  'fee_receipts_cash',
  'business_operating_costs',
  'introducer_case_client_payments',
  'operating_cash_after_pay',
];

const KPI_KEYS = [
  'total_open_non_private',
  'live_deals',
  'urgent_emergency',
  'cai_assigned_live',
  'jess_assigned_live',
  'tasks_total',
  'open_decisions',
  'active_lenders',
  'lender_timing_metrics_available',
];

export function commandSupabaseUrl(env = process.env) {
  const set = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (set) return set;
  return staffSupabaseUrl({ ...env, STAFF_AUTH_MODE: env.STAFF_AUTH_MODE || 'supabase' });
}

export function commandServiceKey(env = process.env) {
  return String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function pipelineSeatMatch(item, seat) {
  if (!item || !seat) return false;
  if (Array.isArray(item.assigned_seats)) return item.assigned_seats.includes(seat);
  return String(item.assigned_seat || '').split('+').includes(seat);
}

export function taskSeatMatch(item, seat) {
  if (!item || !seat) return false;
  return String(item.assigned_seat || '').split('+').includes(seat);
}

export function normaliseTarget(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function blockedTarget(value) {
  return BLOCKED_TARGET.test(String(value || ''));
}

export function validateThreadPost(body) {
  const message = String(body?.message || body?.text || '').trim();
  if (!message) return { ok: false, error: 'Write a message before posting.' };
  if (message.length > 2000) return { ok: false, error: 'Write a message of 2,000 characters or fewer.' };
  for (const key of ROUTING_KEYS) {
    if (body?.[key] == null || !String(body[key]).trim()) continue;
    if (blockedTarget(body[key])) {
      return { ok: false, error: 'Tom, the gateway and OpenClaw are not connected.' };
    }
  }
  const chosen = body?.to_agent == null && body?.to == null ? 'all' : (body.to_agent ?? body.to);
  const toAgent = normaliseTarget(chosen);
  if (blockedTarget(toAgent)) {
    return { ok: false, error: 'Tom, the gateway and OpenClaw are not connected.' };
  }
  if (!THREAD_TARGETS.has(toAgent)) return { ok: false, error: 'Choose a team recipient.' };
  return { ok: true, to_agent: toAgent, message };
}

export function sectionGuard(section, seat) {
  const value = String(section || '').trim().toLowerCase();
  if (!value) return { ok: true, narrow: '' };
  if (value.includes('finance') || value.includes('private')) {
    if (seat !== 'byron') return { ok: false, status: 403 };
    if (value === 'finance' || value === 'finance_byron_only') return { ok: true, narrow: 'finance' };
  }
  return { ok: true, narrow: '' };
}

export function sectionsForSeat(seat, narrow = '') {
  if (narrow === 'finance') return { sections: ['finance_byron_only'], thread: false };
  if (narrow === 'thread') return { sections: [], thread: true };
  const sections = seat === 'byron' ? PUBLIC_SECTIONS.concat(BYRON_SECTIONS) : PUBLIC_SECTIONS.slice();
  return { sections, thread: true };
}

function accessFromRequest(req) {
  const header = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  const match = /^Bearer\s+(\S+)/i.exec(header);
  if (match) {
    const raw = match[1].trim();
    if (!raw || raw.length > 4000) return '';
    return supabaseAccessToken(raw) || raw;
  }
  return supabaseAccessToken(readCookie(req, 'pf_staff'));
}

export async function resolveCommandActor(req, deps = {}) {
  const env = deps.env || process.env;
  const access = accessFromRequest(req);
  if (!access) return { ok: false, status: 401 };
  if (access === commandServiceKey(env)) return { ok: false, status: 401 };
  const actor = await staffActorFromToken(access, { ...deps, env });
  if (!actor.ok || !actor.seat?.code) return { ok: false, status: 401 };
  return {
    ok: true,
    seat: actor.seat.code,
    email: actor.email,
    displayName: actor.seat.name,
    role: actor.role || actor.seat.role,
  };
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, max = 500) {
  if (value == null) return '';
  const clean = String(value).replace(/\u0000/g, '').trim();
  return clean.slice(0, max);
}

function strings(value, max = 40, length = 300) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, length)).filter(Boolean).slice(0, max);
}

function num(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bool(value) {
  if (value === true || value === false) return value;
  if (value === 'true' || value === 'Y' || value === 'y') return true;
  if (value === 'false' || value === 'N' || value === 'n') return false;
  return null;
}

function metric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return text(value, 80);
  return null;
}

function pickNumbers(source, keys) {
  const row = asObject(source);
  const out = {};
  for (const key of keys) out[key] = num(row[key]);
  return out;
}

function payloadOf(indexed, section) {
  const row = indexed[section];
  if (!row) return {};
  return asObject(row.payload);
}

function freshnessOf(indexed, section) {
  const row = indexed[section];
  if (!row) return null;
  return row.source_updated_at || row.updated_at || asObject(row.payload).generated_at || null;
}

function presentSeatList(value) {
  if (!Array.isArray(value)) return null;
  return value.map((item) => text(item, 40).toLowerCase()).filter((item) => /^[a-z][a-z0-9_]{0,30}$/.test(item)).slice(0, 8);
}

export function presentCase(row) {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id || row.case_id || row.case_ref, 80);
  const name = text(row.name || row.case_name || row.label, 160);
  if (!id && !name) return null;
  const assigned = presentSeatList(row.assigned_seats);
  return {
    id,
    name,
    lane: text(row.lane, 80),
    stage: text(row.stage, 80),
    owner: text(row.owner, 80),
    urgent: text(row.urgent || row.urgent_level, 40),
    needs_byron: bool(row.needs_byron ?? row.needsByron),
    loan: text(row.loan, CASE_TEXT_MAX),
    fee: text(row.fee, 120),
    el_status: text(row.el_status, 80),
    last_message_date: text(row.last_message_date, 40),
    days_since_last_message: num(row.days_since_last_message),
    next_action: text(row.next_action || row.next, 500),
    next_action_owner: text(row.next_action_owner, 80),
    as_of: text(row.as_of, 40),
    product: text(row.product, 80),
    assigned_seat: text(row.assigned_seat, 80).toLowerCase(),
    assigned_seats: assigned,
    whatsapp_assigned: bool(row.whatsapp_assigned),
  };
}

function presentCases(value) {
  if (!Array.isArray(value)) return [];
  return value.map(presentCase).filter(Boolean).slice(0, 500);
}

function presentOverview(raw) {
  const source = asObject(raw);
  const kpisIn = asObject(source.kpis);
  const kpis = {};
  for (const key of KPI_KEYS) {
    kpis[key] = key === 'lender_timing_metrics_available' ? bool(kpisIn[key]) : num(kpisIn[key]);
  }
  const rules = Array.isArray(source.standing_rules) ? source.standing_rules : [];
  return {
    generated_at: text(source.generated_at, 40) || null,
    kpis,
    standing_rules: rules.slice(0, 12).map((rule) => {
      const item = asObject(rule);
      return {
        id: text(item.id, 40),
        title: text(item.title, 160),
        set_by: text(item.set_by, 80),
        set_at: text(item.set_at, 80),
        text: text(item.text, 2000),
        applied: text(item.applied, 2000),
      };
    }).filter((rule) => rule.id || rule.text),
    highlights: strings(source.highlights, 12, 400),
  };
}

function hiddenAgent(agent) {
  return blockedTarget(`${agent.id || ''} ${agent.name || ''} ${agent.lane || ''}`);
}

function presentRoster(raw) {
  const source = asObject(raw);
  const agents = Array.isArray(source.agents) ? source.agents : [];
  return {
    generated_at: text(source.generated_at, 40) || null,
    note: text(source.note, 1000),
    agents: agents.slice(0, 40).map((agent) => {
      const item = asObject(agent);
      return {
        id: text(item.id, 80),
        name: text(item.name, 120),
        lane: text(item.lane, 240),
        status: text(item.status, 80),
      };
    }).filter((agent) => agent.name && !hiddenAgent(agent)),
  };
}

function presentPipeline(raw, seat) {
  const source = asObject(raw);
  const rule = asObject(source.rule_r001);
  const totals = asObject(source.totals);
  const rows = Array.isArray(source.cases) ? source.cases : [];
  const visible = seat === 'byron'
    ? rows
    : rows.filter((row) => row?.private !== true && row?.private !== 'Y' && row?.byron_only !== true);
  return {
    generated_at: text(source.generated_at, 40) || null,
    rule_r001: {
      cai_count: num(rule.cai_count),
      jess_count: num(rule.jess_count),
      rule_text: text(rule.rule_text, 2000),
      applied: text(rule.applied, 2000),
    },
    totals: {
      open: num(totals.open),
      live_deals: num(totals.live_deals),
      urgent_emergency: num(totals.urgent_emergency),
    },
    cases: presentCases(visible),
  };
}

function presentTaskCard(row) {
  const item = asObject(row);
  if (!item.case && !item.need && item.n == null && !item.case_id) return null;
  return {
    n: num(item.n),
    case: text(item.case, 160),
    need: text(item.need, 500),
    context: text(item.context || item.ctx, 1000),
    action: text(item.action || item.act, 500),
    urgency: text(item.urgency || item.urg, 40),
    case_id: text(item.case_id, 80),
    assigned_seat: text(item.assigned_seat, 80).toLowerCase(),
  };
}

function presentTasks(raw) {
  const source = asObject(raw);
  const cards = Array.isArray(source.cards) ? source.cards : [];
  const decisions = Array.isArray(source.byron_decisions) ? source.byron_decisions : [];
  const moves = Array.isArray(source.byron_next_move_deals) ? source.byron_next_move_deals : [];
  return {
    generated_at: text(source.generated_at, 40) || null,
    sheet_title: text(source.sheet_title, 180),
    cards: cards.map(presentTaskCard).filter(Boolean).slice(0, 200),
    private_cards_withheld: num(source.private_cards_withheld),
    byron_decisions: decisions.slice(0, 40).map((item) => {
      const row = asObject(item);
      return { title: text(row.title, 200), detail: text(row.detail, 4000) };
    }).filter((item) => item.title || item.detail),
    byron_next_move_deals: moves.slice(0, 80).map((item) => {
      const row = asObject(item);
      return {
        id: text(row.id, 80),
        name: text(row.name, 160),
        urgent: text(row.urgent, 40),
        next_action: text(row.next_action, 500),
        assigned_seat: text(row.assigned_seat, 80).toLowerCase(),
      };
    }).filter((item) => item.id || item.name),
  };
}

function presentContacts(value) {
  if (typeof value === 'string') return text(value, 240);
  if (!Array.isArray(value)) return null;
  return value.slice(0, 8).map((item) => {
    if (typeof item === 'string') return text(item, 120);
    const row = asObject(item);
    return [text(row.name, 80), text(row.role, 80)].filter(Boolean).join(' · ');
  }).filter(Boolean);
}

function presentOpenItems(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return text(value, 240);
  if (Array.isArray(value)) return value.map((item) => text(typeof item === 'string' ? item : asObject(item).name, 120)).filter(Boolean).slice(0, 12);
  return null;
}

function presentDiveLender(row) {
  const item = asObject(row);
  const name = text(item.name || item.lender, 160);
  if (!name && !item.id) return null;
  return {
    id: text(item.id, 80),
    name,
    legal_entity: text(item.legal_entity, 180),
    domain: text(item.domain, 120),
    group: text(item.group, 80),
    status: text(item.status, 80),
    contacts: presentContacts(item.contacts),
    role: text(item.role, 120),
    response: metric(item.response),
    broka_median_h: metric(item.broka_median_h),
    days_to_offer: metric(item.days_to_offer),
    offer_to_completion: metric(item.offer_to_completion),
    dead_air: metric(item.dead_air),
    live_cases: num(item.live_cases),
    open_items: presentOpenItems(item.open_items),
  };
}

function presentLoose(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((item) => {
    if (typeof item === 'string') return { name: text(item, 160), status: '', note: '' };
    const row = asObject(item);
    const name = text(row.name || row.lender || row.id, 160);
    if (!name) return null;
    return { name, status: text(row.status, 80), note: text(row.note || row.reason, 240) };
  }).filter(Boolean);
}

function presentLenders(raw) {
  const source = asObject(raw);
  const status = asObject(source.source_status);
  const active = Array.isArray(source.active_case_lenders) ? source.active_case_lenders : [];
  const dive = asObject(source.deep_dive_metrics);
  const diveLenders = Array.isArray(dive.lenders) ? dive.lenders.map(presentDiveLender).filter(Boolean).slice(0, 80) : [];
  const hasDive = Boolean(dive.as_of || dive.method || diveLenders.length || dive.schema);
  return {
    generated_at: text(source.generated_at, 40) || null,
    source_status: {
      deep_dive_file: text(status.deep_dive_file, 180).split('/').pop(),
      deep_dive_present: bool(status.deep_dive_present),
      note: text(status.note, 1000),
    },
    active_case_lenders: active.slice(0, 80).map((item) => {
      const row = asObject(item);
      return {
        lender: text(row.lender, 160),
        open_cases: num(row.open_cases),
        case_ids: strings(row.case_ids, 80, 80),
        median_days_since_last_case_message: num(row.median_days_since_last_case_message),
        max_days_since_last_case_message: num(row.max_days_since_last_case_message),
      };
    }).filter((item) => item.lender),
    deep_dive_metrics: hasDive ? {
      schema: text(dive.schema, 80),
      as_of: text(dive.as_of, 40),
      timezone: text(dive.timezone, 80),
      internal_only: bool(dive.internal_only),
      method: text(dive.method, 1000),
      lenders: diveLenders,
      other_active: presentLoose(dive.other_active),
      prospects_not_active: presentLoose(dive.prospects_not_active),
      declined_recent: presentLoose(dive.declined_recent),
    } : null,
  };
}

function safeLabel(value) {
  const raw = text(value, 180);
  if (!raw || SENSITIVE.test(raw)) return '';
  return raw.split('/').pop();
}

function presentFiles(raw) {
  const source = asObject(raw);
  const sheets = Array.isArray(source.key_sheets) ? source.key_sheets : [];
  const recent = Array.isArray(source.recent_outputs) ? source.recent_outputs : [];
  return {
    generated_at: text(source.generated_at, 40) || null,
    key_sheets: sheets.slice(0, 40).map((item) => {
      const row = asObject(item);
      const name = safeLabel(row.name || row.label);
      if (!name) return null;
      return {
        label: safeLabel(row.label) || name,
        name,
        folder: safeLabel(row.folder),
        description: text(row.description, 400),
        present: bool(row.present),
        updated_at: text(row.updated_at, 40),
      };
    }).filter(Boolean),
    recent_outputs: recent.slice(0, 40).map((item) => {
      const row = asObject(item);
      const name = safeLabel(row.name);
      if (!name) return null;
      return {
        name,
        folder: safeLabel(row.folder),
        category: text(row.category, 80),
        updated_at: text(row.updated_at, 40),
        size_kb: num(row.size_kb),
      };
    }).filter(Boolean),
  };
}

export function presentFinance(raw) {
  const source = asObject(raw);
  const november = asObject(source.november_2026_to_22nd);
  return {
    generated_at: text(source.generated_at, 40) || null,
    basis: text(source.basis, 1000),
    excluded_notice: exclusionNotice(source.excluded_notice),
    last_12_months: {
      period: text(asObject(source.last_12_months).period, 80),
      fee_receipts_cash: num(asObject(source.last_12_months).fee_receipts_cash),
    },
    october_2026: pickNumbers(source.october_2026, CASH_KEYS),
    november_2026_to_22nd: {
      ...pickNumbers(november, CASH_KEYS),
      partial: bool(november.partial),
    },
    balances: {
      main_gbp_22_nov_2026: num(asObject(source.balances).main_gbp_22_nov_2026),
      card_declines_insufficient_balance_oct_nov_2026: num(asObject(source.balances).card_declines_insufficient_balance_oct_nov_2026),
    },
    months: (Array.isArray(source.months) ? source.months : []).slice(0, 36).map((item) => {
      const row = pickNumbers(item, MONTH_KEYS.filter((key) => key !== 'month'));
      row.month = text(asObject(item).month, 20);
      return row;
    }),
    not_included: strings(source.not_included, 20, 300),
    sources: strings(source.sources, 20, 180).map(safeLabel).filter(Boolean),
  };
}

function indexRows(rows, seat) {
  const indexed = {};
  for (const row of rows || []) {
    if (!row || typeof row.section !== 'string') continue;
    const byronOnly = row.byron_only === true || row.byron_only === 'true' || row.byron_only === 't';
    if ((byronOnly || BYRON_SECTIONS.includes(row.section)) && seat !== 'byron') continue;
    indexed[row.section] = row;
  }
  return indexed;
}

function presentThread(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 100).map((row) => {
    const item = asObject(row);
    const toAgent = text(item.to_agent, 80);
    const fromAgent = text(item.from_agent, 80);
    if (blockedTarget(toAgent) || blockedTarget(fromAgent)) return null;
    const message = text(item.message, 2000);
    if (!message) return null;
    return {
      id: num(item.id),
      created_at: text(item.created_at, 40),
      from_agent: fromAgent,
      to_agent: toAgent,
      seat: text(item.seat, 40).toLowerCase(),
      message,
    };
  }).filter(Boolean).reverse();
}

export function presentDashboard({ seat, email, displayName, rows, thread }) {
  const indexed = indexRows(rows, seat);
  const byron = seat === 'byron';
  const pipeline = presentPipeline(payloadOf(indexed, 'pipeline'), seat);
  const dashboard = {
    ok: true,
    seat,
    email,
    displayName,
    canViewFinance: byron,
    finance: byron ? presentFinance(payloadOf(indexed, 'finance_byron_only')) : null,
    freshness: {
      overview: freshnessOf(indexed, 'overview'),
      roster: freshnessOf(indexed, 'roster'),
      pipeline: freshnessOf(indexed, 'pipeline'),
      tasks: freshnessOf(indexed, 'tasks'),
      lenders: freshnessOf(indexed, 'lenders'),
      files: freshnessOf(indexed, 'files'),
      finance: byron ? freshnessOf(indexed, 'finance_byron_only') : null,
    },
    overview: presentOverview(payloadOf(indexed, 'overview')),
    roster: presentRoster(payloadOf(indexed, 'roster')),
    pipeline,
    tasks: presentTasks(payloadOf(indexed, 'tasks')),
    lenders: presentLenders(payloadOf(indexed, 'lenders')),
    files: presentFiles(payloadOf(indexed, 'files')),
    thread: presentThread(thread),
  };
  if (byron) {
    const privatePayload = payloadOf(indexed, 'pipeline_private_byron');
    dashboard.privateCases = presentCases(privatePayload.cases);
    dashboard.freshness.privateCases = freshnessOf(indexed, 'pipeline_private_byron');
  }
  return dashboard;
}

export function buildAskContext(dashboard) {
  const context = {
    seat: dashboard.seat,
    display_name: dashboard.displayName,
    kpis: dashboard.overview?.kpis || null,
    standing_rules: dashboard.overview?.standing_rules || [],
    highlights: dashboard.overview?.highlights || [],
    roster: dashboard.roster || null,
    pipeline: dashboard.pipeline || null,
    tasks: dashboard.tasks || null,
    lenders: dashboard.lenders || null,
    files: dashboard.files || null,
    not_connected: ['Tom', 'OpenClaw gateway', 'external systems'],
  };
  if (dashboard.seat === 'byron' && dashboard.canViewFinance === true) {
    context.finance = dashboard.finance || null;
    context.private_cases = dashboard.privateCases || [];
  }
  return context;
}

export const ASK_SYSTEM_PROMPT = [
  'You are Lizzy, the Posfin Capital staff assistant, answering inside the Team Lizzy and Posfin Command Dashboard.',
  'Answer only from the JSON context. If a figure is not in the context, say it is not on the dashboard.',
  'Never invent figures, lender timings, or cash totals. Use British English and be concise.',
  'Tom, the OpenClaw gateway, and external systems are not connected. Do not claim that they are.',
  'QuickBooks, CVA, VAT, and corporation tax are excluded from this dashboard.',
].join(' ');

async function readJson(response) {
  const body = typeof response.text === 'function' ? await response.text() : '';
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function supabaseRest(env, fetcher, path, options = {}) {
  const url = commandSupabaseUrl(env);
  const key = commandServiceKey(env);
  if (!url || !key) {
    const error = new Error('not_configured');
    error.code = 'not_configured';
    throw error;
  }
  const response = await fetcher(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Accept-Profile': 'pipeline',
      'Content-Profile': 'pipeline',
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error('unavailable');
    error.code = response.status === 404 ? 'schema_pending' : 'unavailable';
    throw error;
  }
  return payload;
}

export async function loadCommandRows(env, fetcher, seat, narrow = '') {
  const plan = sectionsForSeat(seat, narrow);
  const fetchImpl = fetcher || fetch;
  const snapshots = plan.sections.length
    ? supabaseRest(
      env,
      fetchImpl,
      `command_dashboard_snapshots?select=section,byron_only,payload,source_updated_at,updated_at&section=in.(${plan.sections.join(',')})`,
    )
    : Promise.resolve([]);
  const thread = plan.thread
    ? supabaseRest(
      env,
      fetchImpl,
      'command_dashboard_thread?select=id,created_at,from_agent,to_agent,seat,message&order=created_at.desc&limit=100',
    )
    : Promise.resolve([]);
  const [rows, messages] = await Promise.all([snapshots, thread]);
  return {
    rows: Array.isArray(rows) ? rows : [],
    thread: Array.isArray(messages) ? messages : [],
  };
}

export async function readMeetingProgress(env, fetcher) {
  try {
    const rows = await supabaseRest(
      env,
      fetcher || fetch,
      'command_meeting_progress?select=meeting_id,payload,updated_at,updated_by',
    );
    return { storage: 'supabase', rows: Array.isArray(rows) ? rows : [] };
  } catch (error) {
    if (error.code === 'not_configured' || error.code === 'schema_pending') return { storage: 'browser', rows: [] };
    throw error;
  }
}

export async function writeMeetingProgress(env, fetcher, row) {
  try {
    await supabaseRest(env, fetcher || fetch, 'command_meeting_progress?on_conflict=meeting_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    return { storage: 'supabase', persisted: true };
  } catch (error) {
    if (error.code === 'not_configured' || error.code === 'schema_pending') return { storage: 'browser', persisted: false };
    throw error;
  }
}

export async function insertThreadMessage(env, fetcher, { seat, toAgent, message }) {
  const created = await supabaseRest(env, fetcher || fetch, 'command_dashboard_thread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      from_agent: seat,
      to_agent: toAgent,
      seat,
      message,
    }),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return presentThread([row])[0] || row;
}

export async function askLizzy(question, dashboard, env = process.env, fetcher = fetch) {
  const key = String(env.XAI_API_KEY || '').trim();
  if (!key) {
    const error = new Error('missing_key');
    error.code = 'missing_key';
    throw error;
  }
  const response = await fetcher('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'grok-3-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: ASK_SYSTEM_PROMPT },
        { role: 'user', content: `Context JSON:\n${JSON.stringify(buildAskContext(dashboard))}\n\nQuestion: ${question}` },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error('upstream');
    error.code = 'upstream';
    throw error;
  }
  const answer = payload?.choices?.[0]?.message?.content;
  if (!answer) {
    const error = new Error('empty');
    error.code = 'upstream';
    throw error;
  }
  return { answer: String(answer).slice(0, 6000), model: 'grok-3-mini' };
}

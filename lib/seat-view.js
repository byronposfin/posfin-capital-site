export const SEATS = [
  { code: 'byron', name: 'Byron Hill', role: 'principal' },
  { code: 'jess', name: 'Jess', role: 'case_owner' },
  { code: 'aadi', name: 'Aadi', role: 'case_owner' },
  { code: 'cai', name: 'Cai', role: 'case_owner' },
  { code: 'chris', name: 'Chris Shipton', role: 'case_owner' },
  { code: 'geri', name: 'Geri', role: 'case_owner' },
];

const ACTORS = SEATS.map((seat) => seat.name);
const FEE_KEY = /fee|procuration|commission|gross_facility|net_loan|valuation|gdv|ltv/i;
const SUBMITTED_SOURCES = new Set(['web_factfind_uk', 'web_factfind_test']);
const STARTED_STATUSES = new Set(['statements_received', 'statements_reviewed', 'call_slot_selected', 'contacted']);

export function seatByCode(code) {
  const value = String(code || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(value)) return null;
  return SEATS.find((seat) => seat.code === value) || null;
}

export function londonDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function factFindStand(lead = {}, fact = null) {
  const status = String(fact?.status || lead?.status || '').toLowerCase();
  const form = String(fact?.form_stage || lead?.form_stage || '').toLowerCase();
  const stage = String(lead?.stage || '').toLowerCase();
  const source = String(lead?.source || fact?.source || '');
  if (status === 'fact_find_complete' || form === 'completed' || stage === 'fact_find_complete') return 'completed';
  if (form === 'submitted' || fact?.submitted_at || lead?.submitted_at) return 'submitted';
  if (SUBMITTED_SOURCES.has(source)) return 'submitted';
  if (form === 'partial' || Number(fact?.form_step || lead?.form_step) > 0) return 'started';
  if (STARTED_STATUSES.has(status)) return 'started';
  return 'not started';
}

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function ownerOf(row, fact) {
  return clean(row?.assigned_seat || row?.owner || row?.assigned_to || fact?.assigned_seat || '', 80);
}

export function assembleLeads(rawLeads = [], factFinds = []) {
  const byId = new Map();
  const byEmail = new Map();
  for (const row of factFinds) {
    if (row?.id) byId.set(String(row.id), row);
    const email = String(row?.email || '').trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, row);
  }
  const seen = new Set();
  const leads = [];
  function push(row, fact) {
    if (fact?.id) seen.add(String(fact.id));
    const arrivedAt = row?.fb_created_time || row?.created_at || fact?.created_at || '';
    const email = clean(row?.email || fact?.email || '', 160);
    leads.push({
      id: String(row?.id || fact?.id || ''),
      name: clean(row?.full_name || row?.name || fact?.full_name || 'Unnamed lead', 140),
      email,
      source: clean(row?.source || fact?.source || '', 80),
      stand: factFindStand(row, fact),
      owner: ownerOf(row, fact),
      nextAction: clean(row?.next_action || row?.nextAction || fact?.next_action || '', 400),
      reference: clean(fact?.reference || row?.reference || '', 40),
      arrivedAt,
      day: londonDate(arrivedAt),
      test: row?.is_test === true || fact?.is_test === true || /_test$/.test(String(row?.source || fact?.source || '')),
    });
  }
  for (const row of rawLeads) {
    const email = String(row?.email || '').trim().toLowerCase();
    const fact = byId.get(String(row?.id || '')) || (email ? byEmail.get(email) : null) || null;
    push(row, fact);
  }
  for (const fact of factFinds) {
    if (fact?.id && seen.has(String(fact.id))) continue;
    const email = String(fact?.email || '').trim().toLowerCase();
    if (email && leads.some((lead) => lead.email.toLowerCase() === email)) continue;
    push(fact, fact);
  }
  leads.sort((a, b) => String(b.arrivedAt).localeCompare(String(a.arrivedAt)) || a.name.localeCompare(b.name));
  return leads;
}

export function filterLeads(leads, query = {}) {
  const source = String(query.source || 'all');
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(query.from || '')) ? query.from : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(query.to || '')) ? query.to : '';
  return leads.filter((lead) => {
    if (source && source !== 'all' && lead.source !== source) return false;
    if (from && lead.day && lead.day < from) return false;
    if (to && lead.day && lead.day > to) return false;
    if ((from || to) && !lead.day) return false;
    return true;
  });
}

export function lenderAliases(names) {
  const unique = [...new Set(names.map((name) => String(name || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const map = new Map();
  unique.forEach((name, index) => {
    map.set(name, index < 4 ? `Lender ${'ABCD'[index]}` : 'Other lender');
  });
  return map;
}

export function publicCase(row, aliases) {
  const lenderRaw = clean(row?.existing_lender_label || row?.lender || '', 120);
  return {
    id: String(row?.id || row?.case_ref || row?.caseRef || ''),
    caseRef: clean(row?.case_ref || row?.caseRef || '', 64),
    label: clean(row?.case_label || row?.label || row?.case_ref || 'Case', 160),
    stage: clean(row?.stage || '', 40),
    status: clean(row?.status || '', 40),
    owner: clean(row?.case_owner_label || row?.owner_label || row?.owner || '', 80),
    nextAction: clean(row?.next_action_summary || row?.nextAction || '', 400),
    seedSource: clean(row?.seed_source || row?.seedSource || '', 80),
    lender: lenderRaw ? (aliases.get(lenderRaw) || 'Other lender') : '',
    arrivedAt: row?.created_at || row?.arrivedAt || '',
  };
}

export function ownedBy(seat, owner) {
  const value = String(owner || '').trim().toLowerCase();
  if (!seat || !value) return false;
  const name = seat.name.toLowerCase();
  const first = name.split(' ')[0];
  return value === seat.code || value === name || value === first;
}

export function buildTasks(seat, leads, cases, today) {
  const tasks = [];
  for (const item of cases) {
    if (!ownedBy(seat, item.owner)) continue;
    tasks.push({
      id: `${seat.code}:case:${item.caseRef}:${today}`,
      kind: 'case',
      subjectId: item.caseRef,
      title: item.label,
      prompt: item.nextAction || 'Review this case',
      owner: item.owner,
      today,
    });
  }
  for (const item of leads) {
    if (!ownedBy(seat, item.owner) || !item.nextAction) continue;
    tasks.push({
      id: `${seat.code}:lead:${item.id}:${today}`,
      kind: 'lead',
      subjectId: item.id,
      title: item.name,
      prompt: item.nextAction,
      owner: item.owner,
      today,
    });
  }
  return tasks;
}

export function applyAnswers(tasks, answers) {
  const map = new Map((answers || []).filter((row) => row?.id).map((row) => [row.id, row]));
  return tasks.map((task) => {
    const saved = map.get(task.id);
    if (!saved) return { ...task, answer: '', editedText: '', answeredBy: '', originalPrompt: task.prompt };
    const edited = clean(saved.editedText || saved.edited_text || '', 400);
    return {
      ...task,
      answer: saved.answer === 'yes' || saved.answer === 'no' || saved.answer === 'edit' ? saved.answer : '',
      editedText: edited,
      prompt: saved.answer === 'edit' && edited ? edited : task.prompt,
      originalPrompt: task.prompt,
      answeredBy: clean(saved.answeredBy || saved.answered_by || '', 80),
    };
  });
}

export function presentSeat(input) {
  const seat = input.seat;
  const today = londonDate(input.now || new Date().toISOString());
  const query = input.query || {};
  const joined = assembleLeads(input.rawLeads, input.factFinds);
  const aliases = lenderAliases((input.cases || []).map((row) => row?.existing_lender_label || row?.lender || ''));
  const ownOnly = input.source === 'live';
  let cases = (input.cases || [])
    .map((row) => publicCase(row, aliases))
    .filter((row) => row.caseRef)
    .sort((a, b) => String(b.arrivedAt).localeCompare(String(a.arrivedAt)) || a.caseRef.localeCompare(b.caseRef));
  if (ownOnly) cases = cases.filter((row) => ownedBy(seat, row.owner));
  const leadsAll = filterLeads(joined, query);
  const leads = ownOnly ? leadsAll.filter((lead) => ownedBy(seat, lead.owner)) : leadsAll;
  const tasks = applyAnswers(buildTasks(seat, joined, cases, today), input.answers || []);
  return {
    seat,
    today,
    leads,
    completed: leads.filter((lead) => lead.stand === 'submitted' || lead.stand === 'completed'),
    cases,
    tasks,
    sources: [...new Set(joined.map((lead) => lead.source).filter(Boolean))].sort(),
    query: {
      from: /^\d{4}-\d{2}-\d{2}$/.test(String(query.from || '')) ? query.from : '',
      to: /^\d{4}-\d{2}-\d{2}$/.test(String(query.to || '')) ? query.to : '',
      source: String(query.source || 'all'),
      edit: String(query.edit || ''),
    },
    source: input.source || 'fixtures',
    warning: input.warning || '',
    leadsAvailable: input.leadsAvailable !== false,
    casesAvailable: input.casesAvailable !== false,
    schemaPending: input.schemaPending === true,
    editing: String(query.edit || ''),
  };
}

export function recordAnswer(tasks, input) {
  const task = (tasks || []).find((item) => item.id === String(input.taskId || ''));
  if (!task) return { error: 'task' };
  const action = String(input.action || '');
  if (action === 'send' || action === 'release' || action === 'notify') return { error: 'refused' };
  if (!ACTORS.includes(String(input.actor || ''))) return { error: 'actor' };
  if (action === 'edit') return { ok: true, editing: task.id };
  if (action !== 'yes' && action !== 'no' && action !== 'save-edit') return { error: 'action' };
  const editedText = action === 'save-edit' ? clean(input.editedText, 400) : '';
  if (action === 'save-edit' && editedText.length < 2) return { error: 'text' };
  return {
    ok: true,
    row: {
      id: task.id,
      seat: input.seat,
      kind: task.kind,
      subjectId: task.subjectId,
      taskDate: task.today,
      prompt: task.originalPrompt || task.prompt,
      answer: action === 'save-edit' ? 'edit' : action,
      editedText,
      answeredBy: input.actor,
      at: input.now,
    },
  };
}

export function fixtureBook() {
  return {
    rawLeads: [
      {
        id: 'lead-not-started',
        full_name: 'Pat Example',
        email: 'pat.example@example.invalid',
        source: 'facebook',
        status: 'new',
        created_at: '2026-11-21T09:00:00.000Z',
        assigned_seat: 'chris',
        next_action: 'Call the example contact',
      },
      {
        id: 'lead-started',
        full_name: 'Sam Fixture',
        email: 'sam.fixture@example.invalid',
        source: 'web_landing_uk',
        status: 'new',
        created_at: '2026-11-20T09:00:00.000Z',
        assigned_seat: 'jess',
      },
      {
        id: 'lead-submitted',
        full_name: 'Alex Fixture',
        email: 'alex.fixture@example.invalid',
        source: 'web_factfind_uk',
        status: 'new',
        created_at: '2026-11-18T11:00:00.000Z',
        assigned_seat: 'chris',
      },
      {
        id: 'lead-completed',
        full_name: 'Jo Fixture',
        email: 'jo.fixture@example.invalid',
        source: 'manual',
        status: 'fact_find_complete',
        created_at: '2026-11-17T11:00:00.000Z',
        assigned_seat: 'chris',
        next_action: 'Read the example note',
      },
      {
        id: 'lead-older',
        full_name: 'Robin Example',
        email: 'robin.example@example.invalid',
        source: 'manual',
        status: 'new',
        created_at: '2026-10-01T11:00:00.000Z',
      },
    ],
    factFinds: [
      {
        id: 'ff-started',
        full_name: 'Sam Fixture',
        email: 'sam.fixture@example.invalid',
        source: 'web_landing_uk',
        status: 'new',
        form_stage: 'partial',
        form_step: 2,
        created_at: '2026-11-20T09:30:00.000Z',
      },
      {
        id: 'ff-submitted',
        full_name: 'Alex Fixture',
        email: 'alex.fixture@example.invalid',
        source: 'web_landing_uk',
        status: 'new',
        form_stage: 'submitted',
        submitted_at: '2026-11-18T12:00:00.000Z',
        created_at: '2026-11-18T11:00:00.000Z',
        reference: 'TEST-WEB-ALEX01',
      },
      {
        id: 'ff-completed',
        full_name: 'Jo Fixture',
        email: 'jo.fixture@example.invalid',
        source: 'web_landing_uk',
        status: 'fact_find_complete',
        form_stage: 'submitted',
        submitted_at: '2026-11-17T12:00:00.000Z',
        created_at: '2026-11-17T11:00:00.000Z',
        reference: 'TEST-WEB-JO0001',
      },
    ],
    cases: [
      {
        case_ref: 'TEST-SEAT-001',
        case_label: 'Hale — example file',
        stage: 'factfind',
        status: 'open',
        owner_label: 'Chris Shipton',
        next_action_summary: 'Call the example contact',
        seed_source: 'migration_20261122',
        existing_lender_label: 'Example Harbour',
        broker_fee_pct: 1.25,
        created_at: '2026-11-22T08:00:00.000Z',
      },
      {
        case_ref: 'TEST-SEAT-002',
        case_label: 'Quay — example redemption',
        stage: 'enquiry',
        status: 'open',
        owner_label: 'Jess',
        next_action_summary: 'Hold the example chaser',
        seed_source: 'migration_20261122',
        existing_lender_label: 'Example North',
        broker_fee_pct: 2,
        created_at: '2026-11-21T08:00:00.000Z',
      },
      {
        case_ref: 'TEST-SEAT-003',
        case_label: 'Northgate — example terms',
        stage: 'packaging',
        status: 'open',
        owner_label: 'Chris Shipton',
        next_action_summary: 'Read the example note',
        seed_source: 'migration_20261122',
        existing_lender_label: '',
        created_at: '2026-11-20T08:00:00.000Z',
      },
    ],
  };
}

export function hiddenCaseKeys(row) {
  return Object.keys(row || {}).filter((key) => FEE_KEY.test(key));
}

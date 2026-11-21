export const OWNERS = ['Byron', 'Jess', 'Aadi', 'Cai', 'Chris Shipton', 'Tom', 'Lizzy'];

export const SECTIONS = [
  { id: 'do_now', title: 'Do now', kicker: 'Live cases' },
  { id: 'today', title: 'Today', kicker: "Byron's review" },
  { id: 'build', title: 'Build', kicker: 'Systems' },
  { id: 'strategic', title: 'Strategic thought', kicker: 'Keep warm' },
  { id: 'done', title: 'Completed today', kicker: 'Cleared' },
];

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'build', label: 'Build-systems' },
  { id: 'done', label: 'Done' },
];

export const STATUSES = [
  'URGENT · EVICTION 24TH',
  'AWAITING REPLY',
  'BYRON REVIEW GATE',
  'TEST ONLY',
  'REVIEW TOMORROW',
  'KEEP WARM',
];

export const RELEASE_LINE = 'Tom releases borrower links on SmartLink. This cockpit cannot release or send one.';

const EDITABLE = ['status', 'owner', 'nextAction', 'note', 'dueOn', 'done', 'draftMessage'];
const FORBIDDEN = ['send', 'release', 'token', 'notify', 'password', 'secret'];

export function previewSeed() {
  return [
    card({
      id: 'preview-hale',
      kind: 'case',
      title: 'Hale — example eviction file',
      section: 'do_now',
      status: 'URGENT · EVICTION 24TH',
      description: 'Preview case. A worked eviction date of the 24th, not a live client and not a possession instruction.',
      owner: 'Byron',
      nextAction: 'Read the example warrant note on the staff case desk.',
      knownDone: 'Example papers are listed as links. Nothing has been filed.',
      dueOn: '2026-11-24',
      evidence: [
        { kind: 'case', label: 'UK case desk', href: '/staff/cases' },
        { kind: 'document', label: 'Example warrant note', href: '/staff/cases' },
        { kind: 'email', label: 'Desk note (example address)', href: 'mailto:desk@example.invalid' },
      ],
    }),
    card({
      id: 'preview-quay',
      kind: 'case',
      title: 'Quay Cottage — example redemption',
      section: 'do_now',
      status: 'AWAITING REPLY',
      description: 'Preview case. Waiting on a redemption figure that does not exist outside this fixture.',
      owner: 'Jess',
      nextAction: 'Hold the chaser until Lizzy has a draft she is happy with.',
      knownDone: 'The staff case link is the evidence. No borrower has been written to.',
      dueOn: '2026-11-20',
      evidence: [
        { kind: 'case', label: 'UK case desk', href: '/staff/cases' },
        { kind: 'email', label: 'Redemption query (example address)', href: 'mailto:redemption@example.invalid' },
      ],
    }),
    card({
      id: 'preview-lizzy',
      kind: 'case',
      title: 'Example Quay — Lizzy’s chaser',
      section: 'do_now',
      status: 'AWAITING REPLY',
      description: 'Preview case on Lizzy’s queue. The wording below is a draft. It is not addressed to a real borrower.',
      owner: 'Lizzy',
      nextAction: 'Keep the draft on this card until Tom says a borrower link may go out.',
      knownDone: 'Draft text only. No send control on this page.',
      dueOn: '2026-11-21',
      draftMessage: 'Hello, this is a draft for a fictional case. We still need the redemption figure. Nothing is sent from the cockpit.',
      evidence: [
        { kind: 'case', label: 'UK case desk', href: '/staff/cases' },
        { kind: 'url', label: 'France training desk', href: '/staff/france' },
      ],
    }),
    card({
      id: 'preview-northgate',
      kind: 'case',
      title: 'Northgate — example terms pack',
      section: 'today',
      status: 'BYRON REVIEW GATE',
      description: 'Preview case for Byron’s review. The terms summary is a fixture, not an offer.',
      owner: 'Byron',
      nextAction: 'Byron reads the summary and leaves a note.',
      knownDone: 'The pack link points at the staff desk, not a borrower page.',
      dueOn: '2026-11-19',
      evidence: [
        { kind: 'case', label: 'UK case desk', href: '/staff/cases' },
        { kind: 'pr', label: 'Smart-link portal pull request', href: 'https://github.com/byronposfin/posfin-capital-site/pull/8' },
      ],
    }),
    card({
      id: 'preview-shipton',
      kind: 'case',
      title: 'Shipton lane — test file',
      section: 'today',
      status: 'TEST ONLY',
      description: 'Preview test card for Chris Shipton. It is not a client file.',
      owner: 'Chris Shipton',
      nextAction: 'Leave it on the test lane.',
      knownDone: 'Marked test only.',
      evidence: [
        { kind: 'pr', label: 'France desk pull request', href: 'https://github.com/byronposfin/posfin-capital-site/pull/9' },
      ],
    }),
    card({
      id: 'task-schema',
      kind: 'task',
      title: 'Cockpit tables, waiting on schema approval',
      section: 'build',
      status: 'REVIEW TOMORROW',
      description: 'Systems task. The proposal is sql/20261119_ops_cockpit.sql. It has not been applied.',
      owner: 'Tom',
      nextAction: 'Tom reviews the migration before anyone runs it on the smartlink project.',
      knownDone: 'The preview board runs from fixtures, not from those tables.',
      dueOn: '2026-11-20',
      evidence: [
        { kind: 'pr', label: 'Portal branch', href: 'https://github.com/byronposfin/posfin-capital-site/pull/8' },
        { kind: 'url', label: 'Staff cases', href: '/staff/cases' },
      ],
    }),
    card({
      id: 'task-gate',
      kind: 'task',
      title: 'Keep the SmartLink release gate on Tom',
      section: 'build',
      status: 'BYRON REVIEW GATE',
      description: 'Systems task. Borrower links stay on SmartLink. This cockpit has no release control.',
      owner: 'Aadi',
      nextAction: 'Confirm the cockpit save path never calls a token or notification function.',
      knownDone: 'Release line is text. There is no release button.',
      evidence: [
        { kind: 'pr', label: 'Smart-link portal pull request', href: 'https://github.com/byronposfin/posfin-capital-site/pull/8' },
      ],
    }),
    card({
      id: 'task-france',
      kind: 'task',
      title: 'France desk, keep warm',
      section: 'strategic',
      status: 'KEEP WARM',
      description: 'Strategic note. Vanessa’s training desk is a separate staff page. These cards are not her live cases.',
      owner: 'Cai',
      nextAction: 'Leave the France desk on its own training fixtures.',
      knownDone: 'Link only. No message is sent from here.',
      evidence: [
        { kind: 'url', label: 'France desk', href: '/staff/france' },
      ],
    }),
    card({
      id: 'task-handoff',
      kind: 'task',
      title: 'Morning board snapshot filed',
      section: 'today',
      status: 'REVIEW TOMORROW',
      description: 'Preview item already ticked. Reopen puts it back on its lane.',
      owner: 'Byron',
      nextAction: 'Nothing further on this fixture.',
      knownDone: 'Filed as a preview completed card.',
      done: true,
      note: 'Cleared on the fixture board.',
    }),
  ];
}

function card(input) {
  return {
    preview: true,
    added: false,
    draftMessage: '',
    note: '',
    dueOn: '',
    done: false,
    knownDone: '',
    releaseLine: RELEASE_LINE,
    evidence: [],
    ...input,
  };
}

export function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function canon(field, value) {
  if (field === 'done') return value === true || value === '1' || value === 'true' || value === 'on';
  if (field === 'dueOn') {
    const text = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }
  return String(value ?? '').trim();
}

export function placedSection(item) {
  if (item.done) return 'done';
  return item.section === 'done' ? 'done' : item.section;
}

export function matchesFilter(item, filter) {
  const section = placedSection(item);
  if (filter === 'todo') return section !== 'done';
  if (filter === 'urgent') return section !== 'done' && /URGENT/i.test(item.status || '');
  if (filter === 'build') return section === 'build';
  if (filter === 'done') return section === 'done';
  return true;
}

export function groupBoard(cards, filter = 'all') {
  const chosen = FILTERS.some((item) => item.id === filter) ? filter : 'all';
  return SECTIONS.map((section) => ({
    ...section,
    cards: cards.filter((item) => placedSection(item) === section.id && matchesFilter(item, chosen)),
  })).filter((section) => chosen === 'all' || section.cards.length);
}

export function lizzyQueue(cards) {
  const active = cards.filter((item) => item.owner === 'Lizzy' && placedSection(item) !== 'done' && item.kind === 'case');
  const activeIds = new Set(active.map((item) => item.id));
  const otherDrafts = cards.filter((item) => String(item.draftMessage || '').trim() && !activeIds.has(item.id));
  return { active, otherDrafts };
}

export function pillClass(status) {
  const text = String(status || '').toUpperCase();
  if (text.includes('URGENT')) return 'urgent';
  if (text.includes('AWAITING')) return 'wait';
  if (text.includes('TEST')) return 'test';
  if (text.includes('TOMORROW') || text.includes('KEEP')) return 'later';
  if (text.includes('REVIEW') || text.includes('BYRON')) return 'review';
  return 'plain';
}

export function safeHref(href) {
  const value = String(href || '');
  if (value.startsWith('/staff/') && !value.includes('//') && !value.includes('..')) return value;
  if (value.startsWith('https://github.com/byronposfin/posfin-capital-site/')) return value;
  if (/^mailto:[a-z0-9._-]+@example\.invalid$/i.test(value)) return value;
  return '';
}

function statusOk(status, current) {
  const text = clean(status, 80);
  if (!text) return '';
  if (STATUSES.includes(text) || text === current) return text;
  return '';
}

export function applyEdit(item, patch, actor) {
  if (!item) return { error: 'not_found' };
  if (!OWNERS.includes(actor)) return { error: 'bad_actor' };
  const keys = Object.keys(patch || {});
  if (keys.some((key) => FORBIDDEN.includes(String(key).toLowerCase()))) return { error: 'refused' };
  if (keys.some((key) => !EDITABLE.includes(key))) return { error: 'refused' };
  const next = { ...item };
  const changes = [];
  for (const field of EDITABLE) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    let value = canon(field, patch[field]);
    if (field === 'owner' && !OWNERS.includes(value)) return { error: 'bad_owner' };
    if (field === 'status') {
      value = statusOk(value, item.status);
      if (!value) return { error: 'bad_status' };
    }
    if (field === 'nextAction') value = clean(value, 400);
    if (field === 'note' || field === 'draftMessage') value = clean(value, 2000);
    if (field === 'dueOn' && patch[field] && !value) return { error: 'bad_date' };
    const previous = canon(field, item[field]);
    const stored = field === 'done' ? value : value;
    if (stored !== previous) {
      next[field] = stored;
      changes.push({ field, oldValue: String(previous), newValue: String(stored) });
    }
  }
  return { ok: true, card: next, changes };
}

export function diffFromSource(current, source) {
  const changes = [];
  for (const field of EDITABLE) {
    const previous = canon(field, current[field]);
    const restored = canon(field, source[field]);
    if (previous !== restored) changes.push({ field, oldValue: String(previous), newValue: String(restored) });
  }
  return changes;
}

export function evictionPill(value) {
  const text = String(value || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return 'URGENT · EVICTION';
  return `URGENT · EVICTION ${Number(match[3])}${daySuffix(Number(match[3]))}`.toUpperCase();
}

function daySuffix(day) {
  return 'TH';
}

export function cardFromStaff(row, record) {
  const facts = (record && record.facts) || row.facts || {};
  const eviction = facts.eviction_at ? evictionPill(facts.eviction_at) : '';
  const kyc = row.kyc_status || (record && record.kyc && record.kyc.status) || 'not_started';
  const status = eviction || (kyc !== 'passed' ? 'AWAITING REPLY' : 'BYRON REVIEW GATE');
  const section = status.startsWith('URGENT') ? 'do_now' : (row.stage === 'applied' || facts.offer_issued === true ? 'today' : 'do_now');
  const caseId = String(row.case_id || '');
  const evidence = [];
  if (/^[A-Za-z0-9-]{6,48}$/.test(caseId)) {
    evidence.push({ kind: 'case', label: 'Staff case', href: `/staff/cases/${caseId}` });
    const files = Array.isArray(record && record.submissions) ? record.submissions : [];
    for (const file of files) {
      if (!file || !file.filename || !file.id) continue;
      evidence.push({
        kind: 'document',
        label: clean(file.filename, 120),
        href: `/staff/cases/${caseId}/file/${file.id}`,
      });
    }
  }
  return {
    id: caseId,
    kind: 'case',
    preview: false,
    added: false,
    title: clean(row.client_name || 'Case', 120),
    section,
    status,
    description: [facts.property_address, facts.postcode].filter(Boolean).join(', ') || 'Case from the smart-link portal.',
    owner: 'Byron',
    nextAction: kyc === 'passed' ? 'Review the latest answer on the staff case.' : 'Identity check is not passed. The client portal stays locked.',
    knownDone: '',
    releaseLine: RELEASE_LINE,
    dueOn: facts.eviction_at ? String(facts.eviction_at).slice(0, 10) : '',
    note: '',
    done: false,
    draftMessage: '',
    evidence,
  };
}

export function cardsFromRemote(payload) {
  const cases = Array.isArray(payload && payload.cases) ? payload.cases : [];
  const tasks = Array.isArray(payload && payload.tasks) ? payload.tasks : [];
  const fromCases = cases.map((row) => {
    const base = cardFromStaff(row, { facts: row.facts, submissions: row.evidence });
    return applyOverlay(base, row.overlay);
  });
  const fromTasks = tasks.map((row) => ({
    id: row.id,
    kind: 'task',
    preview: false,
    added: false,
    title: clean(row.title, 140),
    section: row.section || 'build',
    status: row.status || 'REVIEW TOMORROW',
    description: clean(row.description, 500),
    owner: OWNERS.includes(row.owner) ? row.owner : 'Tom',
    nextAction: clean(row.next_action, 400),
    knownDone: clean(row.known_done, 400),
    releaseLine: clean(row.release_line, 400) || RELEASE_LINE,
    dueOn: row.due_on ? String(row.due_on).slice(0, 10) : '',
    note: clean(row.note, 2000),
    done: row.done === true,
    draftMessage: clean(row.draft_message, 2000),
    evidence: [],
  }));
  return fromCases.concat(fromTasks);
}

function applyOverlay(base, overlay) {
  if (!overlay) return base;
  const next = { ...base };
  if (overlay.status) next.status = overlay.status;
  if (overlay.owner && OWNERS.includes(overlay.owner)) next.owner = overlay.owner;
  if (overlay.next_action != null) next.nextAction = overlay.next_action;
  if (overlay.note != null) next.note = overlay.note;
  if (overlay.due_on) next.dueOn = String(overlay.due_on).slice(0, 10);
  if (overlay.done === true || overlay.done === false) next.done = overlay.done === true;
  if (overlay.draft_message != null) next.draftMessage = overlay.draft_message;
  return next;
}

export function remotePatch(patch) {
  const out = {};
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.owner !== undefined) out.owner = patch.owner;
  if (patch.nextAction !== undefined) out.next_action = patch.nextAction;
  if (patch.note !== undefined) out.note = patch.note;
  if (patch.dueOn !== undefined) out.due_on = patch.dueOn;
  if (patch.done !== undefined) out.done = canon('done', patch.done);
  if (patch.draftMessage !== undefined) out.draft_message = patch.draftMessage;
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.section !== undefined) out.section = patch.section;
  if (patch.description !== undefined) out.description = patch.description;
  return out;
}

export function auditRows(entries, id) {
  return (entries || []).filter((row) => row.subjectId === id || row.subject_id === id);
}

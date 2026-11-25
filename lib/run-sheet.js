// Run sheet: one continuous list of today's task cards and live case cards, ordered by priority.
// Storage is pipeline.run_sheet_entries (append-only). Pure helpers here; I/O lives in run-sheet-store.js.
import { placedSection } from './cockpit.js';
import { presentMeetingList } from './meetings.js';

export const URGENCY = ['Emergency', 'Urgent', 'Watch', 'Normal'];
export const DECISIONS = ['yes', 'no', 'edit'];
export const POPUP_OPS = ['yes', 'no', 'edit', 'done', 'reopen', 'owner', 'due', 'note', 'partial', 'draft', 'add', 'next', 'ask', 'thread', 'meeting'];
export const POPUP_OWNERS = ['Byron', 'Chris', 'Aadi', 'Jess', 'Cai', 'Vanessa', 'Lizzy', 'Tom'];
export const DRAFT_CHANNELS = ['borrower', 'email', 'whatsapp'];
export const QUICK = 'about 15 seconds';
export const MINUTE = 'under 1 minute';

export function popupEnabled(env = process.env) {
  if (String(env.RUN_SHEET_POPUP || '') !== '1') return false;
  return String(env.VERCEL_ENV || '').toLowerCase() !== 'production';
}

export function isDailyRef(ref) {
  return /^B\d{8}-\d{2}$/.test(String(ref || ''));
}

export function batchClientId(date, ref) {
  if (!isDailyRef(ref) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  return `batch-${date}-${ref}`;
}

export function urgencyRank(value) {
  const i = URGENCY.indexOf(String(value || 'Normal'));
  return i === -1 ? URGENCY.length : i;
}

export function quickRank(t) {
  return /15\s*sec/i.test(String(t || '')) ? 0 : 1;
}

// Lower sorts first: urgency, then due date (none last), then 15 s before 1 min, then card number.
export function priorityKey(item) {
  const due = item.due && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : '9999-12-31';
  return [urgencyRank(item.urg), due, quickRank(item.t), Number(item.n) || 9999];
}

export function comparePriority(a, b) {
  const x = priorityKey(a);
  const y = priorityKey(b);
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return 0;
}

export function urgencyFromStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s.includes('URGENT') || s.includes('EVICTION')) return 'Urgent';
  if (s.includes('REVIEW GATE') || s.includes('AWAITING')) return 'Watch';
  return 'Normal';
}

export function safeLink(href) {
  const h = String(href || '').trim();
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (/^https:\/\//i.test(h)) return h;
  if (/^mailto:[^\s"'<>]+$/i.test(h)) return h;
  return '';
}

export function linkKind(kind) {
  if (kind === 'email') return 'Email';
  if (kind === 'document') return 'Document';
  if (kind === 'pr') return 'Pull request';
  if (kind === 'url') return 'Link';
  return 'Case';
}

export function isSampleRef(ref) {
  const id = String(ref || '').toLowerCase();
  return id.includes('preview-hale') || id.startsWith('preview-') || id.startsWith('case-preview');
}

export function isSampleCard(card) {
  if (!card) return false;
  if (card.preview === true) return true;
  return isSampleRef(card.id) || isSampleRef(card.ref);
}

// Do now, Today, and cards whose status is waiting on Byron. Sample fixtures never qualify.
export function onPopupCase(card) {
  if (!card || card.done || isSampleCard(card)) return false;
  const section = placedSection(card);
  if (section === 'done') return false;
  if (section === 'do_now' || section === 'today') return true;
  return /BYRON/.test(String(card.status || '').toUpperCase());
}

// Live cockpit case cards (Do now / Today) become run sheet items.
export function itemFromCase(card) {
  const caseId = String(card.id || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 70);
  return {
    ref: `case-${caseId}`,
    source: 'case',
    kind: 'case',
    caseId,
    n: null,
    case: card.title,
    need: card.nextAction || card.description || '',
    ctx: [card.description, card.knownDone ? `Known done: ${card.knownDone}` : ''].filter(Boolean).join(' '),
    act: card.nextAction || 'Leave a note on the next step.',
    next_action: card.nextAction || '',
    t: MINUTE,
    urg: urgencyFromStatus(card.status),
    due: card.dueOn || '',
    status: card.status || '',
    owner: card.owner || '',
    knownDone: card.knownDone || '',
    releaseLine: card.releaseLine || '',
    private: card.private === true || /\bkurdi\b/i.test(`${card.title || ''} ${card.id || ''}`),
    links: (card.evidence || []).map((e) => ({ kind: e.kind, label: e.label, href: e.href })),
    closed: card.done === true,
  };
}

function blankItem(ref) {
  return { ref, source: 'task', kind: 'task', history: [], voice: [], links: [], closed: false };
}

function applyAnswer(it, p, row) {
  const op = String(p.op || p.decision || '').toLowerCase();
  const at = row.created_at;
  const by = row.actor_email || '';
  const text = String(p.edit_text || p.text || p.note || '');
  if (op === 'yes' || op === 'no' || op === 'edit') {
    it.answer = { decision: op, edit: p.edit_text || '', by, at };
    it.closed = true;
    it.closedAt = at;
    it.history.push({ at, by, what: op === 'edit' ? `Edit: ${p.edit_text || ''}` : op.toUpperCase() });
    return;
  }
  if (op === 'done') {
    it.closed = true;
    it.closedAt = at;
    it.history.push({ at, by, what: 'DONE' });
    return;
  }
  if (op === 'reopen') {
    it.closed = false;
    it.history.push({ at, by, what: 'REOPEN' });
    return;
  }
  if (op === 'owner') {
    it.owner = String(p.owner || text);
    it.history.push({ at, by, what: `Owner: ${it.owner}` });
    return;
  }
  if (op === 'due') {
    it.due = String(p.due || '');
    it.history.push({ at, by, what: `Due: ${it.due || 'cleared'}` });
    return;
  }
  if (op === 'note') {
    it.note = text;
    it.history.push({ at, by, what: `Note: ${text}` });
    return;
  }
  if (op === 'partial') {
    it.partial = p.partial !== false && p.partial !== '0' && p.partial !== 'false';
    it.history.push({ at, by, what: it.partial ? 'Part done' : 'Part cleared' });
    return;
  }
  if (op === 'draft') {
    const channel = DRAFT_CHANNELS.includes(p.channel) ? p.channel : 'borrower';
    it.drafts = { ...(it.drafts || {}), [channel]: { text, subject: String(p.subject || '') } };
    it.history.push({ at, by, what: `Draft ${channel}` });
    return;
  }
  if (op === 'add') {
    it.history.push({ at, by, what: 'Added' });
    return;
  }
  if (op === 'next' || op === 'ask' || op === 'thread' || op === 'meeting') {
    if (op === 'next') it.nextFlag = String(p.text || text || 'Lizzy to generate next');
    it.history.push({ at, by, what: `${op.toUpperCase()}: ${text}`.trim() });
  }
}

// Fold entries (oldest first) into items with their latest answer, voice notes and history.
export function foldEntries(rows, extraItems = []) {
  const items = new Map();
  for (const it of extraItems) items.set(it.ref, { ...blankItem(it.ref), ...it, history: it.history || [], voice: it.voice || [] });
  for (const row of rows || []) {
    const ref = row.item_ref;
    const p = row.payload || {};
    if (row.entry_kind === 'item') {
      const prev = items.get(ref) || blankItem(ref);
      items.set(ref, {
        ...prev,
        ...p,
        ref,
        source: p.source || prev.source || 'task',
        kind: p.kind || prev.kind || 'task',
        history: prev.history,
        voice: prev.voice,
        closed: prev.closed || false,
        drafts: prev.drafts,
      });
      continue;
    }
    if (row.entry_kind === 'answer' && String(p.op || p.decision || '').toLowerCase() === 'add' && !items.has(ref)) {
      items.set(ref, {
        ...blankItem(ref),
        ref,
        source: p.source || 'task',
        kind: p.kind || 'task',
        case: p.case || p.title || p.edit_text || 'New task',
        need: p.need || '',
        ctx: p.ctx || '',
        act: p.act || p.need || '',
        next_action: p.next_action || p.act || '',
        urg: URGENCY.includes(p.urg) ? p.urg : 'Normal',
        t: p.t || MINUTE,
        due: p.due || '',
        owner: p.owner || '',
        assignees: p.assignees,
        caseId: p.caseId || '',
        private: p.private === true,
        finance: p.finance === true,
      });
    }
    const it = items.get(ref);
    if (!it) continue;
    if (row.sheet_date && !it.sheetDate) it.sheetDate = row.sheet_date;
    if (row.entry_kind === 'retire') { it.retired = true; continue; }
    if (row.entry_kind === 'answer') applyAnswer(it, p, row);
    else if (row.entry_kind === 'voice' || row.entry_kind === 'transcript') {
      const v = { at: row.created_at, by: row.actor_email || '', transcript: p.transcript || '', status: p.transcript_status || '', id: row.id };
      it.voice.push(v);
      it.history.push({ at: v.at, by: v.by, what: `Voice note${v.transcript ? `: ${v.transcript}` : ''}` });
    }
  }
  const list = [...items.values()].filter((it) => !it.retired);
  const open = list.filter((it) => !it.closed).sort(comparePriority);
  const done = list.filter((it) => it.closed).sort((a, b) => String(b.closedAt || (b.answer && b.answer.at) || '').localeCompare(String(a.closedAt || (a.answer && a.answer.at) || '')));
  return { open, done };
}

// Unanswered, unretired cards from earlier dates. Sample fixtures are dropped.
export function carryOpen(rows) {
  return foldEntries(rows).open.filter((it) => !isSampleRef(it.ref)).map((it) => ({ ...it, carried: true }));
}

export function cleanAnswer(input, options = {}) {
  const popup = options.popup === true;
  const posted = String((input && input.op) || '').toLowerCase();
  const decision = String((input && input.decision) || '').toLowerCase();
  // The existing run sheet posts op "answer" and puts yes/no/edit in decision.
  const op = !posted || posted === 'answer' ? decision : posted;
  const allowed = popup ? POPUP_OPS : DECISIONS;
  if (!allowed.includes(op)) return { error: 'bad_decision' };
  let ref = String((input && input.ref) || '');
  if (op === 'add' && !ref) ref = `add-${Date.now().toString(36)}`.slice(0, 80);
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: 'bad_ref' };
  const edit = String((input && (input.edit_text || input.text || input.note)) || '').slice(0, 4000);
  if ((op === 'edit' || op === 'note' || op === 'ask' || op === 'thread') && !edit.trim()) return { error: 'edit_empty' };
  if (op === 'add' && !String((input && (input.case || input.title || edit)) || '').trim()) return { error: 'edit_empty' };
  if (op === 'owner' && !POPUP_OWNERS.includes(String(input.owner || ''))) return { error: 'bad_owner' };
  if (op === 'due' && input.due && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.due))) return { error: 'bad_due' };
  if (op === 'draft' && !DRAFT_CHANNELS.includes(String(input.channel || 'borrower'))) return { error: 'bad_draft' };
  if (op === 'draft' && !edit.trim()) return { error: 'edit_empty' };
  if (op === 'meeting' && !/^[a-z0-9-]{1,80}$/.test(String(input.meeting_id || ''))) return { error: 'bad_ref' };
  const clientId = /^[A-Za-z0-9_-]{8,80}$/.test(String(input.client_id || '')) ? String(input.client_id) : null;
  return {
    ok: true,
    ref,
    decision: DECISIONS.includes(op) ? op : '',
    op,
    edit,
    clientId,
    owner: String(input.owner || ''),
    due: String(input.due || ''),
    partial: input.partial !== false && input.partial !== '0' && input.partial !== 'false',
    channel: DRAFT_CHANNELS.includes(String(input.channel || '')) ? String(input.channel) : 'borrower',
    subject: String(input.subject || '').slice(0, 200),
    meetingId: String(input.meeting_id || ''),
  };
}

export function parisDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Seat filtering. assignees is a list of seat codes; 'all' shares a card with every seat.
const OWNER_SEAT = { byron: 'byron', jess: 'jess', aadi: 'aadi', cai: 'cai', chris: 'chris', 'chris shipton': 'chris', vanessa: 'vanessa', tom: 'tom', lizzy: 'lizzy' };

export function seatOfOwner(owner) {
  return OWNER_SEAT[String(owner || '').trim().toLowerCase()] || '';
}

export function assigneesOf(item) {
  const list = Array.isArray(item.assignees) ? item.assignees.map((s) => String(s).toLowerCase()) : [];
  if (list.length) return list;
  const o = seatOfOwner(item.owner);
  return o ? [o] : ['byron'];
}

export function byronOnlyCard(item) {
  if (!item) return false;
  if (item.private === true || item.finance === true || item.byron_only === true) return true;
  if (item.kind === 'finance' || item.kind === 'private') return true;
  return /\bkurdi\b/i.test(`${item.case || ''} ${item.ref || ''} ${item.need || ''}`);
}

export function forSeat(folded, seat) {
  if (!seat) return folded;
  const mine = (it) => {
    if (byronOnlyCard(it) && seat !== 'byron') return false;
    const a = assigneesOf(it);
    return a.includes('all') || a.includes(seat);
  };
  return { ...folded, open: folded.open.filter(mine), done: folded.done.filter(mine) };
}

const ITEM_FIELDS = ['n', 'case', 'need', 'ctx', 'act', 't', 'urg', 'due', 'owner', 'status', 'knownDone', 'releaseLine', 'links', 'assignees', 'source', 'kind', 'private', 'finance', 'byron_only', 'next_action', 'caseId'];

export function cleanItem(input) {
  const ref = String(input.ref || '');
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: 'bad_ref' };
  const p = {};
  for (const k of ITEM_FIELDS) if (input[k] !== undefined) p[k] = input[k];
  if (p.case !== undefined) p.case = String(p.case).slice(0, 200);
  for (const k of ['need', 'ctx', 'act']) if (p[k] !== undefined) p[k] = String(p[k]).slice(0, 2000);
  if (p.urg !== undefined && !URGENCY.includes(p.urg)) return { error: 'bad_urg' };
  if (p.due && !/^\d{4}-\d{2}-\d{2}$/.test(p.due)) return { error: 'bad_due' };
  if (p.links !== undefined) p.links = (Array.isArray(p.links) ? p.links : []).slice(0, 12).map((l) => ({ kind: String(l.kind || 'case'), label: String(l.label || '').slice(0, 120), href: safeLink(l.href) })).filter((l) => l.href);
  if (p.assignees !== undefined) p.assignees = (Array.isArray(p.assignees) ? p.assignees : [p.assignees]).map((s) => String(s).toLowerCase()).filter((s) => /^[a-z][a-z0-9_]{1,30}$/.test(s)).slice(0, 10);
  if (!p.source) p.source = 'task';
  if (p.kind !== undefined && !['task', 'case', 'decision', 'meeting', 'private', 'finance'].includes(p.kind)) return { error: 'bad_kind' };
  if (p.private !== undefined) p.private = p.private === true;
  if (p.finance !== undefined) p.finance = p.finance === true;
  if (p.byron_only !== undefined) p.byron_only = p.byron_only === true;
  if (p.next_action !== undefined) p.next_action = String(p.next_action).slice(0, 500);
  if (p.caseId !== undefined) p.caseId = String(p.caseId).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 70);
  return { ok: true, ref, payload: p, retire: input.retire === true };
}

const WITHHELD = /(?:\bcifas\b|(?:\biban\b|\bsort code\b|\baccount number\b)\s*[:#-]?\s*[A-Za-z0-9 -]{0,34})/ig;

export function redactText(value) {
  return String(value ?? '').replace(WITHHELD, '[withheld]');
}

export function staffLink(href) {
  const h = String(href || '').trim();
  if (h.startsWith('/staff/') && !h.includes('//') && !h.includes('..')) return h;
  if (h.startsWith('https://github.com/byronposfin/posfin-capital-site/')) return h;
  return '';
}

export function redactCard(item) {
  const copy = { ...item };
  for (const key of ['case', 'need', 'ctx', 'act', 'note', 'status', 'knownDone', 'releaseLine', 'next_action', 'nextFlag', 'owner']) {
    if (typeof copy[key] === 'string') copy[key] = redactText(copy[key]);
  }
  if (copy.drafts) {
    copy.drafts = Object.fromEntries(Object.entries(copy.drafts).map(([channel, draft]) => [channel, {
      text: redactText(draft && draft.text),
      subject: redactText(draft && draft.subject),
    }]));
  }
  copy.links = (copy.links || []).map((link) => ({ ...link, href: staffLink(link.href), label: redactText(link.label) })).filter((link) => link.href);
  delete copy.loan;
  delete copy.fee;
  return copy;
}

export function autoNext(item, op) {
  if (op !== 'yes' && op !== 'done') return { kind: 'none' };
  if (!item || String(item.ref || '').endsWith('-next')) return { kind: 'flag', text: 'Lizzy to generate next' };
  const step = String(item.next_action || item.act || '').trim();
  if (!step || /nothing further|leave a note|lizzy to generate|no next/i.test(step)) {
    return { kind: 'flag', text: 'Lizzy to generate next' };
  }
  const ref = `${item.ref}-next`.slice(0, 80);
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { kind: 'flag', text: 'Lizzy to generate next' };
  return {
    kind: 'card',
    text: step,
    item: {
      ref,
      source: 'task',
      kind: item.kind || 'task',
      case: item.case || 'Next step',
      need: step,
      act: step,
      next_action: '',
      ctx: `Next step after ${item.ref}`,
      urg: item.urg || 'Normal',
      t: item.t || MINUTE,
      due: item.due || '',
      owner: item.owner || 'Byron',
      assignees: assigneesOf(item),
      caseId: item.caseId || '',
      private: item.private === true,
    },
  };
}

function ownerSeatName(owner) {
  const text = String(owner || '').toLowerCase();
  if (text.includes('byron')) return 'byron';
  if (text.includes('jess')) return 'jess';
  if (text.includes('aadi')) return 'aadi';
  if (text.includes('cai')) return 'cai';
  if (text.includes('chris')) return 'chris';
  if (text.includes('vanessa')) return 'vanessa';
  if (text.includes('lizzy')) return 'lizzy';
  if (text === 'tom' || text.startsWith('tom ')) return 'tom';
  return '';
}

function londonDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function londonWeekday(now) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(now);
}

function progressFromMeeting(meeting) {
  const items = {};
  for (const section of meeting.sections || []) {
    for (const item of section.items || []) items[item.id] = { status: item.status || 'open', notes: item.notes || '' };
  }
  const actions = {};
  const extra = [];
  for (const action of meeting.actions || []) {
    if (action.extra) extra.push({ id: action.id, text: action.text, owner: action.owner, done: action.done === true });
    else actions[action.id] = { done: action.done === true };
  }
  return { items, actions, extra_actions: extra };
}

export function meetingItems(progressRows, seat, now = new Date()) {
  const meetings = presentMeetingList(progressRows, now);
  const weekday = !['Sat', 'Sun'].includes(londonWeekday(now));
  const today = londonDay(now);
  const rows = [];
  for (const meeting of meetings) {
    if (meeting.tentative || meeting.when?.recurrence === 'tbc') continue;
    const starts = meeting.when?.starts_at ? londonDay(new Date(meeting.when.starts_at)) : '';
    const todayMeeting = (meeting.when?.recurrence === 'weekdays' && weekday) || (meeting.when?.recurrence === 'once' && starts === today);
    if (!todayMeeting) continue;
    const progress = progressFromMeeting(meeting);
    const push = (entry, kind) => {
      if (ownerSeatName(entry.owner) !== seat) return;
      const closed = kind === 'action' ? entry.done === true : entry.status === 'actioned';
      const ref = `meet-${meeting.id}-${entry.id}`.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
      rows.push({
        ref,
        source: 'meeting',
        kind: 'meeting',
        case: entry.title || entry.text || 'Meeting action',
        need: entry.detail || entry.text || meeting.title,
        ctx: meeting.title,
        act: entry.detail || entry.text || 'Tick the action or leave a note.',
        next_action: '',
        t: MINUTE,
        urg: 'Normal',
        owner: entry.owner || '',
        assignees: [seat],
        meetingId: meeting.id,
        meetingKey: entry.id,
        meetingKind: kind,
        meetingProgress: progress,
        note: entry.notes || '',
        closed,
        closedAt: closed ? (meeting.saved_at || '') : '',
        history: [],
        voice: [],
        links: [{ kind: 'url', label: 'Meetings', href: '/staff/command' }],
      });
    };
    for (const section of meeting.sections || []) for (const item of section.items || []) push(item, 'item');
    for (const action of meeting.actions || []) push(action, 'action');
  }
  return rows;
}

function slugRef(prefix, value) {
  const body = String(value || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 60) || 'x';
  return `${prefix}-${body}`.slice(0, 80);
}

export function itemFromDecision(row, index) {
  return {
    ref: slugRef('decision', row.title || index),
    source: 'decision',
    kind: 'decision',
    case: row.title || 'Byron decision',
    need: row.detail || '',
    ctx: 'Command dashboard decision',
    act: row.detail || 'Decide, then tap Yes or No.',
    next_action: row.detail || '',
    t: MINUTE,
    urg: 'Urgent',
    owner: 'Byron',
    assignees: ['byron'],
    history: [],
    voice: [],
    links: [{ kind: 'url', label: 'Command dashboard', href: '/staff/command' }],
  };
}

export function itemFromMove(row) {
  const seat = seatOfOwner(row.assigned_seat) || 'byron';
  return {
    ref: slugRef('move', row.id || row.name),
    source: 'decision',
    kind: 'decision',
    case: row.name || row.id || 'Next move',
    need: row.next_action || '',
    ctx: 'Byron next move',
    act: row.next_action || 'Leave the next step.',
    next_action: row.next_action || '',
    t: MINUTE,
    urg: /urgent/i.test(row.urgent || '') ? 'Urgent' : 'Watch',
    owner: 'Byron',
    assignees: [...new Set(['byron', seat])],
    caseId: row.id || '',
    history: [],
    voice: [],
    links: [],
  };
}

export function itemFromPrivate(row) {
  return {
    ref: slugRef('private', row.id || row.name),
    source: 'case',
    kind: 'private',
    private: true,
    caseId: row.id || '',
    case: row.name || 'Private case',
    need: row.next_action || '',
    ctx: row.stage || '',
    act: row.next_action || 'Leave a note on the next step.',
    next_action: row.next_action || '',
    t: MINUTE,
    urg: /urgent/i.test(row.urgent || '') ? 'Urgent' : 'Watch',
    owner: 'Byron',
    assignees: ['byron'],
    history: [],
    voice: [],
    links: row.id ? [{ kind: 'case', label: 'Open case file', href: `/staff/cases/${String(row.id).replace(/[^A-Za-z0-9-]/g, '')}` }] : [],
  };
}

export function buildPopupModel({ seat, viewer, date, todayRows, earlierRows, cases, decisions, moves, privateCases, meetingRows, canSave, storeOk }) {
  const touched = new Set((todayRows || []).map((row) => row.item_ref));
  const seeds = [];
  const seen = new Set();
  const seed = (item) => {
    if (!item || !item.ref || seen.has(item.ref) || isSampleRef(item.ref) || isSampleRef(item.caseId)) return;
    seen.add(item.ref);
    seeds.push(item);
  };
  for (const card of cases || []) {
    if (isSampleCard(card)) continue;
    const item = itemFromCase(card);
    if (onPopupCase(card) || (card.done && touched.has(item.ref))) seed(item);
  }
  carryOpen(earlierRows).forEach((item) => seed({ ...item, carried: true }));
  if (seat === 'byron') {
    (decisions || []).forEach((row, index) => seed(itemFromDecision(row, index)));
    (privateCases || []).forEach((row) => seed(itemFromPrivate(row)));
  }
  (moves || []).forEach((row) => seed(itemFromMove(row)));
  (meetingRows || []).forEach((row) => seed(row));
  const folded = foldEntries(todayRows, seeds);
  const seated = forSeat(folded, seat);
  const real = (item) => !isSampleRef(item.ref) && !isSampleRef(item.caseId);
  return {
    open: seated.open.filter(real).map(redactCard),
    done: seated.done.filter(real).map(redactCard),
    date,
    seat: seat || '',
    viewer: viewer || seat || '',
    canSave: canSave === true,
    storeOk: storeOk !== false,
    transcription: 'no_key',
    popup: true,
  };
}

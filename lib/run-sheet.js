// Run sheet: one continuous list of today's task cards and live case cards, ordered by priority.
// Storage is pipeline.run_sheet_entries (append-only). Pure helpers here; I/O lives in run-sheet-store.js.

export const URGENCY = ['Emergency', 'Urgent', 'Watch', 'Normal'];
export const DECISIONS = ['yes', 'no', 'edit'];
export const QUICK = 'about 15 seconds';
export const MINUTE = 'under 1 minute';

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

// Live cockpit case cards (Do now / Today) become run sheet items.
export function itemFromCase(card) {
  return {
    ref: `case-${String(card.id).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 70)}`,
    source: 'case',
    n: null,
    case: card.title,
    need: card.nextAction || card.description || '',
    ctx: [card.description, card.knownDone ? `Known done: ${card.knownDone}` : ''].filter(Boolean).join(' '),
    act: card.nextAction || 'Leave a note on the next step.',
    t: MINUTE,
    urg: urgencyFromStatus(card.status),
    due: card.dueOn || '',
    status: card.status || '',
    owner: card.owner || '',
    knownDone: card.knownDone || '',
    releaseLine: card.releaseLine || '',
    links: (card.evidence || []).map((e) => ({ kind: e.kind, label: e.label, href: e.href })),
  };
}

// Fold entries (oldest first) into items with their latest answer, voice notes and history.
export function foldEntries(rows, extraItems = []) {
  const items = new Map();
  for (const it of extraItems) items.set(it.ref, { ...it, history: [], voice: [] });
  for (const row of rows || []) {
    const ref = row.item_ref;
    const p = row.payload || {};
    if (row.entry_kind === 'item') {
      const prev = items.get(ref) || { history: [], voice: [] };
      items.set(ref, { ...prev, ...p, ref, source: p.source || 'task', history: prev.history, voice: prev.voice });
      continue;
    }
    const it = items.get(ref);
    if (!it) continue;
    if (row.entry_kind === 'retire') { it.retired = true; continue; }
    const at = row.created_at;
    const by = row.actor_email || '';
    if (row.entry_kind === 'answer') {
      it.answer = { decision: p.decision, edit: p.edit_text || '', by, at };
      it.history.push({ at, by, what: p.decision === 'edit' ? `Edit: ${p.edit_text || ''}` : String(p.decision || '').toUpperCase() });
    } else if (row.entry_kind === 'voice' || row.entry_kind === 'transcript') {
      const v = { at, by, transcript: p.transcript || '', status: p.transcript_status || '', id: row.id };
      it.voice.push(v);
      it.history.push({ at, by, what: `Voice note${v.transcript ? `: ${v.transcript}` : ''}` });
    }
  }
  const list = [...items.values()].filter((it) => !it.retired);
  const open = list.filter((it) => !it.answer || !it.answer.decision).sort(comparePriority);
  const done = list.filter((it) => it.answer && it.answer.decision).sort((a, b) => String(b.answer.at).localeCompare(String(a.answer.at)));
  return { open, done };
}

export function cleanAnswer(input) {
  const decision = String(input.decision || '').toLowerCase();
  if (!DECISIONS.includes(decision)) return { error: 'bad_decision' };
  const ref = String(input.ref || '');
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return { error: 'bad_ref' };
  const edit = String(input.edit_text || '').slice(0, 4000);
  if (decision === 'edit' && !edit.trim()) return { error: 'edit_empty' };
  const clientId = /^[A-Za-z0-9_-]{8,80}$/.test(String(input.client_id || '')) ? String(input.client_id) : null;
  return { ok: true, ref, decision, edit, clientId };
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

export function forSeat(folded, seat) {
  if (!seat) return folded;
  const mine = (it) => { const a = assigneesOf(it); return a.includes('all') || a.includes(seat); };
  return { ...folded, open: folded.open.filter(mine), done: folded.done.filter(mine) };
}

const ITEM_FIELDS = ['n', 'case', 'need', 'ctx', 'act', 't', 'urg', 'due', 'owner', 'status', 'knownDone', 'releaseLine', 'links', 'assignees', 'source'];

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
  return { ok: true, ref, payload: p, retire: input.retire === true };
}

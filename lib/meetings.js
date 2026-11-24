// Staff meeting agendas. The seed is api/_meetings/seed.json.
// Live ticks are overlaid from Supabase and are not written back to the seed.

import { readMeetingsFile } from '../api/_meetings/load.js';

export const MEETING_STATUSES = ['open', 'discussed', 'actioned', 'parked'];
const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
const EXTRA_ID = /^extra-[a-z0-9-]{4,40}$/;

const STORAGE_NOTE = {
  supabase: 'Ticks, notes and actions are saved for the team.',
  browser: 'Ticks, notes and actions are saved in this browser only. The meetings table is not on Supabase yet, so another signed-in device will not see them.',
};

let cachedFile = null;

function cleanText(value, max) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function londonParts(date) {
  const map = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    weekday: map.weekday,
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function londonDayNumber(date) {
  const parts = londonParts(date);
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

export function londonWhen(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function nextWeekday(now) {
  const parts = londonParts(now);
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset, 12, 0, 0));
    if (WEEKDAYS.has(londonParts(date).weekday)) return date;
  }
  return new Date(now.getTime());
}

function minutesOf(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 180) return null;
  return number;
}

function normaliseItem(item) {
  const id = cleanText(item?.id, 80);
  const title = cleanText(item?.title, 160);
  if (!id || !title) return null;
  return {
    id,
    title,
    detail: cleanText(item?.detail, 500),
    owner: cleanText(item?.owner, 80) || 'Unassigned',
    status: 'open',
    notes: '',
  };
}

function normaliseAction(action) {
  const id = cleanText(action?.id, 80);
  const text = cleanText(action?.text, 240);
  if (!id || !text) return null;
  return {
    id,
    text,
    owner: cleanText(action?.owner, 80) || 'Unassigned',
    done: false,
    extra: false,
  };
}

function normaliseMeeting(raw) {
  const id = cleanText(raw?.id, 80);
  const title = cleanText(raw?.title, 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !title) return null;
  const when = raw?.when && typeof raw.when === 'object' ? raw.when : {};
  const recurrence = ['weekdays', 'once', 'tbc'].includes(when.recurrence) ? when.recurrence : 'once';
  const sections = [];
  const seenItems = new Set();
  for (const section of Array.isArray(raw?.sections) ? raw.sections : []) {
    const sectionId = cleanText(section?.id, 80);
    const sectionTitle = cleanText(section?.title, 160);
    if (!sectionId || !sectionTitle) continue;
    const items = [];
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      const next = normaliseItem(item);
      if (!next || seenItems.has(next.id)) continue;
      seenItems.add(next.id);
      items.push(next);
    }
    sections.push({
      id: sectionId,
      title: sectionTitle,
      minutes: minutesOf(section?.minutes),
      items,
    });
  }
  const seenActions = new Set();
  const actions = [];
  for (const action of Array.isArray(raw?.actions) ? raw.actions : []) {
    const next = normaliseAction(action);
    if (!next || seenActions.has(next.id) || seenItems.has(next.id)) continue;
    seenActions.add(next.id);
    actions.push(next);
  }
  const starts = cleanText(when.starts_at, 40);
  return {
    id,
    title,
    party: cleanText(raw?.party, 160) || title,
    attendees: (Array.isArray(raw?.attendees) ? raw.attendees : []).map((name) => cleanText(name, 80)).filter(Boolean).slice(0, 20),
    purpose: cleanText(raw?.purpose, 500),
    purpose_tbc: raw?.purpose_tbc === true,
    tentative: raw?.tentative === true,
    when: {
      label: cleanText(when.label, 80) || 'Time to be set',
      recurrence,
      duration_minutes: minutesOf(when.duration_minutes),
      allow_minutes: minutesOf(when.allow_minutes),
      starts_at: starts || null,
      timezone: cleanText(when.timezone, 80) || 'Europe/London',
      note: cleanText(when.note, 240),
    },
    sections,
    actions,
  };
}

export function loadMeetingsSeed() {
  if (!cachedFile) cachedFile = readMeetingsFile();
  return (Array.isArray(cachedFile.meetings) ? cachedFile.meetings : []).map(normaliseMeeting).filter(Boolean);
}

function durationLabel(meeting) {
  const planned = meeting.when.duration_minutes;
  const allow = meeting.when.allow_minutes;
  if (planned && allow && allow !== planned) return `${planned} minutes, allow ${allow}`;
  if (planned) return `${planned} minutes`;
  const boxed = meeting.sections.reduce((sum, section) => sum + (section.minutes || 0), 0);
  if (boxed) return `${boxed} minutes across the sections`;
  return '';
}

function scheduleOf(meeting, now) {
  if (meeting.tentative || meeting.when.recurrence === 'tbc') {
    return { group: 2, at: Number.MAX_SAFE_INTEGER, next_label: 'Time TBC' };
  }
  if (meeting.when.recurrence === 'weekdays') {
    const next = nextWeekday(now);
    return { group: 0, at: next.getTime(), next_label: `Next: ${londonWhen(next)}` };
  }
  if (meeting.when.starts_at) {
    const at = Date.parse(meeting.when.starts_at);
    if (!Number.isNaN(at)) {
      const past = londonDayNumber(new Date(at)) < londonDayNumber(now);
      return {
        group: past ? 3 : 0,
        at,
        next_label: londonWhen(new Date(at)),
      };
    }
  }
  return { group: 1, at: Number.MAX_SAFE_INTEGER - 1, next_label: meeting.when.label || 'Time to be set' };
}

export function sortMeetings(meetings, now = new Date()) {
  return meetings.map((meeting, index) => ({ meeting, index, schedule: scheduleOf(meeting, now) }))
    .sort((left, right) => left.schedule.group - right.schedule.group || left.schedule.at - right.schedule.at || left.index - right.index)
    .map((row) => ({ ...row.meeting, schedule: row.schedule }));
}

function knownIds(meeting) {
  const items = new Set();
  for (const section of meeting.sections) {
    for (const item of section.items) items.add(item.id);
  }
  const actions = new Set(meeting.actions.map((action) => action.id));
  return { items, actions };
}

export function normaliseProgress(meeting, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'The meeting update could not be read.' };
  }
  const known = knownIds(meeting);
  const items = {};
  const sourceItems = input.items && typeof input.items === 'object' && !Array.isArray(input.items) ? input.items : {};
  for (const [id, value] of Object.entries(sourceItems)) {
    if (!known.items.has(id) || !value || typeof value !== 'object') continue;
    const status = cleanText(value.status, 20) || 'open';
    if (!MEETING_STATUSES.includes(status)) return { ok: false, error: 'Choose open, discussed, actioned or parked.' };
    items[id] = { status, notes: cleanText(value.notes, 500) };
  }
  const actions = {};
  const sourceActions = input.actions && typeof input.actions === 'object' && !Array.isArray(input.actions) ? input.actions : {};
  for (const [id, value] of Object.entries(sourceActions)) {
    if (!known.actions.has(id) || !value || typeof value !== 'object') continue;
    actions[id] = { done: value.done === true };
  }
  const extra = [];
  const seen = new Set();
  for (const action of Array.isArray(input.extra_actions) ? input.extra_actions : []) {
    const id = cleanText(action?.id, 48);
    const text = cleanText(action?.text, 240);
    const owner = cleanText(action?.owner, 80);
    if (!text && !owner) continue;
    if (!EXTRA_ID.test(id)) return { ok: false, error: 'That action could not be saved.' };
    if (!text) return { ok: false, error: 'Write the action before adding it.' };
    if (!owner) return { ok: false, error: 'Name an owner for the action.' };
    if (seen.has(id) || known.items.has(id) || known.actions.has(id)) continue;
    seen.add(id);
    extra.push({ id, text, owner, done: action?.done === true });
    if (extra.length >= 30) break;
  }
  return { ok: true, progress: { items, actions, extra_actions: extra } };
}

export function applyProgress(meeting, progress, meta = {}) {
  const savedItems = progress?.items || {};
  const savedActions = progress?.actions || {};
  const sections = meeting.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const saved = savedItems[item.id];
      if (!saved) return { ...item };
      return {
        ...item,
        status: MEETING_STATUSES.includes(saved.status) ? saved.status : 'open',
        notes: cleanText(saved.notes, 500),
      };
    }),
  }));
  const actions = meeting.actions.map((action) => ({
    ...action,
    done: savedActions[action.id]?.done === true,
  }));
  for (const extra of progress?.extra_actions || []) {
    actions.push({
      id: extra.id,
      text: cleanText(extra.text, 240),
      owner: cleanText(extra.owner, 80) || 'Unassigned',
      done: extra.done === true,
      extra: true,
    });
  }
  return {
    ...meeting,
    sections,
    actions,
    saved_at: meta.updated_at || '',
    saved_by: meta.updated_by || '',
  };
}

function counts(meeting) {
  let itemCount = 0;
  let actioned = 0;
  for (const section of meeting.sections) {
    for (const item of section.items) {
      itemCount += 1;
      if (item.status === 'actioned') actioned += 1;
    }
  }
  const openActions = meeting.actions.filter((action) => !action.done).length;
  return { item_count: itemCount, actioned_count: actioned, open_actions: openActions };
}

export function presentMeeting(meeting, progress, meta, now) {
  const schedule = meeting.schedule || scheduleOf(meeting, now);
  const full = applyProgress(meeting, progress, meta);
  return {
    ...full,
    schedule: undefined,
    when_label: meeting.when.label,
    when_note: meeting.when.note,
    next_label: schedule.next_label,
    duration_label: durationLabel(meeting),
    ...counts(full),
  };
}

export function presentMeetingList(rows, now = new Date()) {
  const byId = new Map();
  for (const row of rows || []) {
    if (!row?.meeting_id) continue;
    byId.set(String(row.meeting_id), row);
  }
  return sortMeetings(loadMeetingsSeed(), now).map((meeting) => {
    const row = byId.get(meeting.id);
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
    return presentMeeting(meeting, payload, row || {}, now);
  });
}

export function meetingsPayload(rows, { storage, id = '', now = new Date() } = {}) {
  const meetings = presentMeetingList(rows, now);
  const wanted = cleanText(id, 80);
  return {
    ok: true,
    storage,
    persisted: storage === 'supabase',
    note: STORAGE_NOTE[storage] || STORAGE_NOTE.browser,
    meetings,
    meeting: wanted ? meetings.find((item) => item.id === wanted) || null : null,
  };
}

export function meetingById(id) {
  const wanted = cleanText(id, 80);
  return loadMeetingsSeed().find((meeting) => meeting.id === wanted) || null;
}

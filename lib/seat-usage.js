// Seat-usage snapshot for the staff Command Dashboard.
// Shares only. A value under 1% stays "<1%" and is never rewritten as 0.

import { readSeatUsageFile } from '../api/_seat-usage/load.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, max = 240) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function trimNumber(value) {
  return String(Math.round(Number(value) * 1000) / 1000);
}

function readShare(value) {
  const row = asObject(value);
  if (row.below != null) {
    const n = Number(row.below);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
    return { kind: 'below', n };
  }
  if (row.about != null) {
    const n = Number(row.about);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
    return { kind: 'about', n };
  }
  if (row.percent != null) {
    const n = Number(row.percent);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return { kind: 'percent', n };
  }
  return null;
}

export function shareLabel(share) {
  if (!share) return '';
  if (share.kind === 'below') return `<${trimNumber(share.n)}%`;
  if (share.kind === 'about') return `about ${trimNumber(share.n)}%`;
  return `${trimNumber(share.n)}%`;
}

function shareWeight(share) {
  if (!share) return -1;
  if (share.kind === 'percent') return share.n;
  if (share.kind === 'about') return share.n - 1e-6;
  return -1;
}

function dayParts(iso) {
  const match = DAY.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return { iso, year, month, day, weekday: WEEKDAYS[utc.getUTCDay()] };
}

function dayLabel(parts, size) {
  if (!parts) return '';
  if (size === 'short') return `${parts.weekday} ${parts.day}`;
  return `${parts.weekday} ${parts.day} ${MONTHS[parts.month - 1]}`;
}

function eachDate(from, to) {
  const start = dayParts(from);
  const end = dayParts(to);
  if (!start || !end || start.iso > end.iso) return [];
  const dates = [];
  let cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  for (let i = 0; i < 16; i += 1) {
    const iso = cursor.toISOString().slice(0, 10);
    const parts = dayParts(iso);
    if (!parts) break;
    dates.push(parts);
    if (iso === end.iso) break;
    cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  }
  return dates;
}

function rangeLabel(dates) {
  if (!dates.length) return '';
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first.year === last.year && first.month === last.month) {
    return `${first.day}–${last.day} ${MONTHS[first.month - 1]} ${first.year}`;
  }
  if (first.year === last.year) {
    return `${first.day} ${MONTHS[first.month - 1]}–${last.day} ${MONTHS[last.month - 1]} ${first.year}`;
  }
  return `${dayLabel(first, 'full')} ${first.year}–${dayLabel(last, 'full')} ${last.year}`;
}

function zoneWord(zone) {
  if (zone === 'Europe/Paris') return 'Paris';
  if (zone === 'Europe/London') return 'UK';
  return zone || 'Paris';
}

function stampLabel(iso, zone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return text(iso, 40);
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone || 'Europe/Paris',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
  } catch {
    return text(iso, 40);
  }
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${zoneWord(zone)}`;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function presentPoint(raw) {
  const row = asObject(raw);
  const parts = dayParts(text(row.date, 10));
  const share = readShare(row);
  if (!parts || !share) return null;
  return {
    date: parts.iso,
    label: shareLabel(share),
    bar: share.kind === 'below' ? null : share.n,
    below: share.kind === 'below',
  };
}

function presentSeat(raw) {
  const row = asObject(raw);
  const id = text(row.id, 80);
  const name = text(row.name, 160);
  const share = readShare(row.share);
  if (!SLUG.test(id) || !name || !share) return null;
  const seen = new Set();
  const daily = [];
  for (const point of Array.isArray(row.daily) ? row.daily : []) {
    const next = presentPoint(point);
    if (!next || seen.has(next.date)) continue;
    seen.add(next.date);
    daily.push(next);
    if (daily.length >= 31) break;
  }
  const bot = text(row.bot_name, 160);
  return {
    id,
    name,
    role: text(row.role, 160),
    bot_name: bot && bot !== name ? bot : '',
    label: shareLabel(share),
    bar: share.kind === 'below' ? null : share.n,
    below: share.kind === 'below',
    weight: shareWeight(share),
    daily: daily.length ? daily : null,
  };
}

function presentPlan(raw) {
  const row = asObject(raw);
  const used = Number(row.weekly_limit_used_percent);
  const usedPercent = Number.isFinite(used) && used >= 0 && used <= 100 ? used : null;
  const onDemand = row.on_demand === true;
  return {
    used_percent: usedPercent,
    used_label: usedPercent == null ? '' : `${trimNumber(usedPercent)}%`,
    shared: row.limit_shared_with_other_apps === true,
    shared_note: text(row.limit_note, 240),
    resets_at: text(row.resets_at, 40),
    resets_label: text(row.resets_label, 80),
    on_demand: onDemand,
    on_demand_label: onDemand ? 'On-demand usage on' : 'On-demand usage off',
  };
}

export function presentSeatUsage(raw) {
  const source = asObject(raw);
  const seats = [];
  const seen = new Set();
  for (const row of Array.isArray(source.seats) ? source.seats : []) {
    const seat = presentSeat(row);
    if (!seat || seen.has(seat.id)) continue;
    seen.add(seat.id);
    seats.push(seat);
    if (seats.length >= 40) break;
  }
  if (!seats.length) {
    const error = new Error('snapshot');
    error.code = 'snapshot';
    throw error;
  }
  let best = -1;
  for (const seat of seats) best = Math.max(best, seat.weight);
  const winners = best < 0 ? [] : seats.filter((seat) => seat.weight === best);
  for (const seat of seats) {
    seat.heaviest = winners.length > 0 && winners.includes(seat);
    delete seat.weight;
  }
  const window = asObject(source.window);
  const dates = eachDate(text(window.from, 10), text(window.to, 10));
  const zone = text(window.timezone, 80) || 'UTC';
  const windowName = text(window.label, 80) || 'Last 7 days';
  const span = rangeLabel(dates);
  const windowLabel = span ? `${windowName} · ${span} (${zone})` : windowName;
  const byDate = (seat) => new Map((seat.daily || []).map((point) => [point.date, point]));
  const series = seats.filter((seat) => seat.daily).map((seat) => {
    const points = byDate(seat);
    return {
      id: seat.id,
      name: seat.name,
      points: dates.map((day) => points.get(day.iso) || { date: day.iso, label: '—', bar: null, below: false }),
    };
  });
  let peak = 0;
  for (const item of series) {
    for (const point of item.points) {
      if (Number.isFinite(point.bar)) peak = Math.max(peak, point.bar);
    }
  }
  const undated = seats.filter((seat) => !seat.daily).map((seat) => seat.name);
  const captionParts = [`Daily share of all Grok Bot usage${span ? `, ${span} (${zone})` : ''}.`];
  if (undated.length) {
    captionParts.push(`${joinNames(undated)} ${undated.length === 1 ? 'has' : 'have'} no day-by-day split in this snapshot.`);
  }
  captionParts.push('Shares under 1% are shown as <1% in the table. A 0% day had no share in this snapshot.');
  const capturedZone = text(source.captured_timezone, 80) || 'Europe/Paris';
  const captured = text(source.captured_at, 40);
  const version = Number.isInteger(source.version) && source.version > 0 ? source.version : 1;
  const account = text(source.account, 80) || 'Byron';
  const heaviest = winners.length === 1 ? {
    id: winners[0].id,
    name: winners[0].name,
    role: winners[0].role,
    label: winners[0].label,
  } : null;
  return {
    ok: true,
    version,
    schema: text(source.schema, 80) || 'posfin.seat-usage.v1',
    as_of: captured,
    as_of_label: stampLabel(captured, capturedZone),
    account,
    measure_label: `Shares of all Grok Bot usage on ${account}'s account`,
    window_label: windowLabel,
    hand_note: `Hand-maintained snapshot, version ${version}.`,
    notes: (Array.isArray(source.notes) ? source.notes : []).map((item) => text(item, 500)).filter(Boolean).slice(0, 8),
    plan: presentPlan(source.plan),
    heaviest,
    seats: seats.map(({ daily, ...seat }) => seat),
    chart: {
      axis_max: Math.max(10, Math.ceil(peak / 10) * 10),
      caption: captionParts.join(' '),
      days: dates.map((day) => ({
        date: day.iso,
        weekday: day.weekday,
        short: dayLabel(day, 'short'),
        full: dayLabel(day, 'full'),
      })),
      series,
    },
  };
}

export function loadSeatUsage() {
  return presentSeatUsage(readSeatUsageFile());
}

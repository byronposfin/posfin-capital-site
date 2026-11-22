// Working-time SLA. Keep in step with pipeline.web_lead_sla_due in sql/20261121_lead_pipeline_v1.sql.
// 15 minutes inside Monday–Friday 09:00–18:00 Europe/London.
// Minutes left at 18:00 carry to 09:00 on the next weekday. Weekends wait until Monday.

const LONDON = 'Europe/London';
const OPEN = 9 * 3600;
const CLOSE = 18 * 3600;
const LIMIT = 15 * 60;

function londonParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    year: Number(bag.year), month: Number(bag.month), day: Number(bag.day),
    hour: Number(bag.hour) % 24, minute: Number(bag.minute), second: Number(bag.second),
  };
}

function weekdayIndex(wall) {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}

function nextWeekdayOpen(wall) {
  let cursor = new Date(Date.UTC(wall.year, wall.month - 1, wall.day) + 86400000);
  for (let i = 0; i < 8; i++) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      return {
        year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate(),
        hour: 9, minute: 0, second: 0,
      };
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return null;
}

function atOpen(wall) {
  return { ...wall, hour: 9, minute: 0, second: 0 };
}

export function zonedToUtc(year, month, day, hour, minute, second) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const got = londonParts(new Date(utc));
    const delta = Date.UTC(year, month - 1, day, hour, minute, second)
      - Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

function seconds(wall) {
  return wall.hour * 3600 + wall.minute * 60 + wall.second;
}

export function slaDue(submittedAt) {
  const start = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  if (Number.isNaN(start.getTime())) return null;
  let wall = londonParts(start);
  let remain = LIMIT;
  for (let guard = 0; guard < 12; guard++) {
    const day = weekdayIndex(wall);
    const now = seconds(wall);
    if (day === 0 || day === 6 || now >= CLOSE) {
      wall = nextWeekdayOpen(wall);
      if (!wall) return null;
      continue;
    }
    if (now < OPEN) wall = atOpen(wall);
    const available = CLOSE - seconds(wall);
    if (remain <= available) {
      const total = seconds(wall) + remain;
      return zonedToUtc(wall.year, wall.month, wall.day, Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60);
    }
    remain -= available;
    wall = nextWeekdayOpen(wall);
    if (!wall) return null;
  }
  return null;
}

export function slaColour(lead, now = new Date()) {
  if (lead && lead.contacted_at) return { colour: 'done', label: 'Contacted' };
  const due = lead && lead.sla_due_at ? new Date(lead.sla_due_at) : null;
  if (!due || Number.isNaN(due.getTime())) return { colour: 'amber', label: 'SLA not set' };
  const left = due.getTime() - now.getTime();
  if (left <= 0) return { colour: 'red', label: 'Overdue' };
  if (left <= 5 * 60 * 1000) return { colour: 'amber', label: 'Due soon' };
  return { colour: 'green', label: 'Within SLA' };
}

export function ageLabel(submittedAt, now = new Date()) {
  const start = new Date(submittedAt);
  if (Number.isNaN(start.getTime())) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const hourRest = hours % 24;
  return hourRest ? `${days} d ${hourRest} h` : `${days} d`;
}

// UK contact checks shared by the fact find and the land journey.
// Dates are calendar dates in UTC. A date of birth is never logged by these helpers.

export function ukMobileError(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Enter a UK mobile, starting 07 or +44.';
  const compact = raw.replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return 'Enter a UK mobile, starting 07 or +44.';
  let national = compact.startsWith('+') ? compact.slice(1) : compact;
  if (national.startsWith('0044')) national = national.slice(4);
  else if (national.startsWith('44')) national = national.slice(2);
  else if (national.startsWith('0')) national = national.slice(1);
  else return 'Enter a UK mobile, starting 07 or +44.';
  if (!/^7\d{9}$/.test(national)) return 'Enter a UK mobile, starting 07 or +44.';
  return '';
}

export function calendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function dobError(value, now = new Date(), minAge = 18) {
  const dob = calendarDate(value);
  if (!dob) return 'Enter a real date of birth.';
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dob > today) return 'Enter a real date of birth.';
  const adult = new Date(Date.UTC(today.getUTCFullYear() - minAge, today.getUTCMonth(), today.getUTCDate()));
  const oldest = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()));
  if (dob > adult || dob < oldest) return 'Enter a date of birth. Applicants need to be 18 or over.';
  return '';
}

export function ukDob(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

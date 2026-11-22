const ON = new Set(['1', 'true', 'on', 'yes']);

export function seatFlagName(code) {
  return `FEATURE_SEAT_VIEW_${String(code || '').trim().toUpperCase()}`;
}

export function seatViewEnabled(env = process.env, code = 'chris') {
  if (String(env?.VERCEL_ENV || '').trim().toLowerCase() === 'production') return false;
  return ON.has(String(env?.[seatFlagName(code)] ?? '').trim().toLowerCase());
}

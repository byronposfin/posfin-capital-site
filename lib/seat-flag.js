const ON = new Set(['1', 'true', 'on', 'yes']);

export function seatFlagName(code) {
  return `FEATURE_SEAT_VIEW_${String(code || '').trim().toUpperCase()}`;
}

export function seatViewEnabled(env = process.env, code = 'chris') {
  return ON.has(String(env?.[seatFlagName(code)] ?? '').trim().toLowerCase());
}

const SEAT_LINKS = [
  { code: 'chris', label: "Chris's seat" },
  { code: 'byron', label: "Byron's seat" },
];

export function enabledSeatLinks(env = process.env) {
  return SEAT_LINKS.filter((seat) => seatViewEnabled(env, seat.code)).map((seat) => ({
    code: seat.code,
    href: `/staff/cockpit/seat/${seat.code}`,
    label: seat.label,
  }));
}

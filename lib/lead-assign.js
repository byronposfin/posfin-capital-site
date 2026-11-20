// Default roster. The live rule is pipeline.staff_seats; this mirror is what the tests lock.
// Round-robin is Jess, Aadi, Cai, Chris. Byron is the fallback and is not in the ring.
// A ?b=bh or ?b=chris link pins that seat when it is active.

export const DEFAULT_SEATS = [
  { seat_code: 'byron', display_name: 'Byron Hill', email: 'byron.hill@posfincapital.com', role: 'principal', round_robin: false, fallback: true, active: true, alert_copy: true },
  { seat_code: 'jess', display_name: 'Jess', email: 'jessica@posfincapital.com', role: 'case_owner', round_robin: true, round_robin_order: 1, fallback: false, active: true, alert_copy: true },
  { seat_code: 'aadi', display_name: 'Aadi', email: 'aadi@posfincapital.com', role: 'case_owner', round_robin: true, round_robin_order: 2, fallback: false, active: true, alert_copy: false },
  { seat_code: 'cai', display_name: 'Cai', email: null, role: 'case_owner', round_robin: true, round_robin_order: 3, fallback: false, active: true, alert_copy: false },
  { seat_code: 'chris', display_name: 'Chris Shipton', email: 'chris.shipton@posfincapital.com', role: 'case_owner', round_robin: true, round_robin_order: 4, fallback: false, active: true, alert_copy: false },
];

function ring(seats) {
  return seats
    .filter((seat) => seat.active !== false && seat.round_robin)
    .slice()
    .sort((a, b) => (a.round_robin_order - b.round_robin_order) || a.seat_code.localeCompare(b.seat_code));
}

export function nextSeat(seats, index, brokerTag) {
  const active = seats.filter((seat) => seat.active !== false);
  const pinned = brokerTag === 'bh' ? 'byron' : brokerTag === 'chris' ? 'chris' : '';
  if (pinned) {
    const seat = active.find((item) => item.seat_code === pinned);
    if (seat) return seat;
  }
  const cycle = ring(active);
  if (cycle.length) {
    const at = ((Number(index) % cycle.length) + cycle.length) % cycle.length;
    return cycle[at];
  }
  return active.find((seat) => seat.fallback) || null;
}

const CASE_OWNER_FIELDS = ['status', 'contacted_at', 'closed_at', 'updated_at', 'updated_by'];
const PRINCIPAL_FIELDS = CASE_OWNER_FIELDS.concat(['assigned_to', 'assigned_seat', 'owner_assigned_at']);

export function staffWriteAllowed(role, changes) {
  if (!role || role === 'read_only' || role === 'analyst') return false;
  const allowed = new Set(role === 'principal' ? PRINCIPAL_FIELDS : (role === 'case_owner' || role === 'crm_operator') ? CASE_OWNER_FIELDS : []);
  if (!allowed.size) return false;
  for (const field of Object.keys(changes || {})) {
    if (!allowed.has(field)) return false;
    if (field === 'status' && role !== 'principal' && changes[field] !== 'contacted') return false;
  }
  return true;
}

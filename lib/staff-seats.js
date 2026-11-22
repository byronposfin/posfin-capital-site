// Seat directory for individual staff sign-in.
// Emails are the ones already written in lib/lead-assign.js and sql/20261120_lead_ops_v1.sql.
// Cai's address is not invited: that SQL leaves it null and says the mailbox was not on file.
// A seat never borrows another seat's email.

export const STAFF_SEATS = [
  {
    code: 'byron',
    name: 'Byron Hill',
    email: 'byron.hill@posfincapital.com',
    role: 'principal',
    verified: true,
    aliases: ['byron', 'byron hill', 'bh'],
  },
  {
    code: 'chris',
    name: 'Chris Shipton',
    email: 'chris.shipton@posfincapital.com',
    role: 'case_owner',
    verified: true,
    aliases: ['chris', 'chris shipton', 'shipton'],
  },
  {
    code: 'jess',
    name: 'Jess',
    email: 'jessica@posfincapital.com',
    role: 'case_owner',
    verified: true,
    aliases: ['jess', 'jessica'],
  },
  {
    code: 'aadi',
    name: 'Aadi',
    email: 'aadi@posfincapital.com',
    role: 'case_owner',
    verified: true,
    aliases: ['aadi'],
  },
  {
    code: 'cai',
    name: 'Cai',
    email: '',
    role: 'case_owner',
    verified: false,
    aliases: ['cai'],
  },
];

export function verifiedSeats() {
  return STAFF_SEATS.filter((seat) => seat.verified && seat.email);
}

export function seatByCode(code) {
  const key = String(code || '').trim().toLowerCase();
  return STAFF_SEATS.find((seat) => seat.code === key) || null;
}

export function ownerSeat(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  return STAFF_SEATS.find((seat) => {
    if (seat.code === text || seat.name.toLowerCase() === text) return true;
    if (seat.aliases.includes(text)) return true;
    return Boolean(seat.email) && seat.email.toLowerCase() === text;
  }) || null;
}

export function sameSeat(left, right) {
  const a = ownerSeat(left);
  const b = ownerSeat(right);
  if (!a || !b) return false;
  return a.code === b.code;
}

export function seatEmail(code) {
  const seat = seatByCode(code) || ownerSeat(code);
  if (!seat || !seat.verified || !seat.email) return '';
  return seat.email;
}

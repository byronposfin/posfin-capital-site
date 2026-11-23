// Plan only. scripts/staff-auth-links.mjs sends nothing unless it is run with --send.
// Byron and Aadi already have Auth accounts, so they get a recovery link.
// Chris and Jess are invited and then set their own password.

export const SET_PASSWORD_REDIRECT = 'https://posfincapital.com/staff/set-password';

export const STAFF_LINK_PLAN = [
  { action: 'invite', email: 'chris.shipton@posfincapital.com' },
  { action: 'invite', email: 'jessica@posfincapital.com' },
  { action: 'recovery', email: 'byron.hill@posfincapital.com' },
  { action: 'recovery', email: 'aadi@posfincapital.com' },
];

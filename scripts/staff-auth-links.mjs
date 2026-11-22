// Sends staff invite and recovery emails. Dry run unless --send is present.
// Do not run this until Byron says the set-password page is live and the
// Supabase redirect allow-list contains https://posfincapital.com/staff/set-password.
//
// Requires STAFF_SUPABASE_URL and STAFF_SUPABASE_SERVICE_KEY in the environment.
// The key is not printed. This script is not part of the site and is not run by CI.

import { SET_PASSWORD_REDIRECT, STAFF_LINK_PLAN } from '../lib/staff-auth-links.js';

const send = process.argv.includes('--send');

console.log(send ? 'Sending staff links.' : 'Dry run. No email is sent.');
for (const row of STAFF_LINK_PLAN) {
  console.log(`${row.action} ${row.email} → ${SET_PASSWORD_REDIRECT}`);
}
if (!send) process.exit(0);

const url = String(process.env.STAFF_SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.STAFF_SUPABASE_SERVICE_KEY || '').trim();
if (!url || !key) {
  console.error('STAFF_SUPABASE_URL and STAFF_SUPABASE_SERVICE_KEY are required. Nothing was sent.');
  process.exit(1);
}

for (const row of STAFF_LINK_PLAN) {
  const path = row.action === 'invite' ? '/auth/v1/invite' : '/auth/v1/recover';
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: row.email, redirect_to: SET_PASSWORD_REDIRECT }),
  });
  console.log(`${row.action} ${row.email} ${response.status}`);
  if (!response.ok) process.exitCode = 1;
}

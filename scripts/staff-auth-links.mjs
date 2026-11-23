// Operator-only invite and recovery sender. Dry run unless --send is present.
// This is the only staff-desk tool that reads a full-access Supabase key.
// The website never reads that key. Run this on the operator's own machine.
//
// The key is taken from SUPABASE_REVOLUT_API_KEY, or STAFF_SUPABASE_SERVICE_KEY
// if that is unset. It is not printed. Delete the key in Supabase after the
// invites have been sent. Do not put it in Vercel.
//
// Do not run --send until the set-password page is live and
// https://posfincapital.com/staff/set-password is on the Auth redirect list.

import { SET_PASSWORD_REDIRECT, STAFF_LINK_PLAN } from '../lib/staff-auth-links.js';

const send = process.argv.includes('--send');

console.log(send ? 'Sending staff links.' : 'Dry run. No email is sent.');
for (const row of STAFF_LINK_PLAN) {
  console.log(`${row.action} ${row.email} → ${SET_PASSWORD_REDIRECT}`);
}
if (!send) process.exit(0);

const url = String(process.env.STAFF_SUPABASE_URL || '').replace(/\/+$/, '');
const key = String(process.env.SUPABASE_REVOLUT_API_KEY || process.env.STAFF_SUPABASE_SERVICE_KEY || '').trim();
if (!url || !key) {
  console.error('STAFF_SUPABASE_URL and a local full-access key are required. Nothing was sent.');
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

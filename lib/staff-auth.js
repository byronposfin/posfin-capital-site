// Individual staff login against the main Supabase project.
// The preview password is refused once STAFF_AUTH_MODE=supabase, including on Production.
// Requests use the anon key and the signed-in staff access token.

import { ownerSeat, seatByCode } from './staff-seats.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

export function staffAuthMode(env = process.env) {
  return String(env.STAFF_AUTH_MODE || '').trim().toLowerCase() === 'supabase' ? 'supabase' : 'preview';
}

export function previewPasswordAllowed(env = process.env) {
  return staffAuthMode(env) !== 'supabase';
}

export function staffSupabaseUrl(env = process.env) {
  const set = String(env.STAFF_SUPABASE_URL || env.FF_SUPABASE_URL || '').replace(/\/+$/, '');
  if (set) return set;
  if (staffAuthMode(env) === 'supabase' || env.VERCEL_ENV === 'production') return MAIN;
  return '';
}

function anonKey(env) {
  return String(env.STAFF_SUPABASE_ANON_KEY || '').trim();
}

function callerRow(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload && typeof payload === 'object') return payload;
  return null;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function postCaller(url, key, access, profile, fetcher) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${access}`,
    'Content-Type': 'application/json',
  };
  if (profile) {
    headers['Accept-Profile'] = profile;
    headers['Content-Profile'] = profile;
  }
  return fetcher(`${url}/rest/v1/rpc/staff_caller`, {
    method: 'POST',
    headers,
    body: '{}',
  });
}

// The user's own session calls pipeline.staff_caller(). The service role is not used.
export async function callerFromToken(access, deps = {}) {
  const env = deps.env || process.env;
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  const token = String(access || '').trim();
  if (!url || !key || !token) return { ok: false, error: 'not_configured' };
  const fetcher = deps.fetch || fetch;
  let response = await postCaller(url, key, token, 'pipeline', fetcher);
  let body = await readJson(response);
  const missing = response.status === 404 || String(body && (body.code || body.message) || '').includes('PGRST');
  if (missing) {
    response = await postCaller(url, key, token, '', fetcher);
    body = await readJson(response);
  }
  if (response.status === 404) return { ok: false, error: 'schema_pending' };
  if (response.status === 401 || response.status === 403) return { ok: false, error: 'not_allowed' };
  if (!response.ok) return { ok: false, error: 'unavailable' };
  const row = callerRow(body);
  if (!row || !row.email || !row.seat_code) return { ok: false, error: 'not_allowed' };
  const email = String(row.email).trim().toLowerCase();
  const seat = seatByCode(row.seat_code);
  if (!seat || !seat.email || seat.email.toLowerCase() !== email) return { ok: false, error: 'not_allowed' };
  return { ok: true, seat, role: row.role || seat.role, email };
}

export async function staffActorFromToken(token, deps = {}) {
  const env = deps.env || process.env;
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  const access = String(token || '').trim();
  if (!url || !key || !access) return { ok: false, error: 'not_configured' };
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${access}` },
  });
  if (response.status === 401 || response.status === 403) return { ok: false, error: 'password' };
  if (!response.ok) return { ok: false, error: 'unavailable' };
  const user = await readJson(response);
  const email = String(user && user.email || '').trim().toLowerCase();
  if (!email || !ownerSeat(email)) return { ok: false, error: 'not_allowed' };
  const listed = await callerFromToken(access, deps);
  if (!listed.ok) return listed;
  if (listed.email !== email) return { ok: false, error: 'not_allowed' };
  return { ok: true, email, seat: listed.seat, role: listed.role };
}

export async function supabasePasswordLogin(email, password, deps = {}) {
  const env = deps.env || process.env;
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  const address = String(email || '').trim().toLowerCase();
  const secret = String(password || '');
  if (!url || !key) return { ok: false, error: 'not_configured' };
  if (!address || !secret) return { ok: false, error: 'email' };
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password: secret }),
  });
  if (response.status === 400 || response.status === 401) return { ok: false, error: 'password' };
  if (!response.ok) return { ok: false, error: 'unavailable' };
  const body = await readJson(response);
  const access = body && body.access_token;
  if (!access) return { ok: false, error: 'password' };
  const actor = await staffActorFromToken(access, deps);
  if (!actor.ok) return { ok: false, error: actor.error || 'not_allowed' };
  return { ok: true, session: `sb1.${access}`, preview: false, seat: actor.seat.code, email: actor.email };
}

export function supabaseAccessToken(session) {
  const value = String(session || '');
  return value.startsWith('sb1.') ? value.slice(4) : '';
}

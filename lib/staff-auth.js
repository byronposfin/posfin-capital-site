import { createHmac, timingSafeEqual } from 'node:crypto';
import { isStaffEmail, PRODUCTION_URL } from './staff-leads.js';

export const COOKIE = 'pf_leads';

function jwtRole(key) {
  const parts = String(key || '').split('.');
  if (parts.length !== 3) return '';
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role || ''; }
  catch { return ''; }
}

export function isAnonKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  return jwtRole(key) === 'anon';
}

export function isServiceKey(key) {
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return true;
  return jwtRole(key) === 'service_role';
}

export function readStaffConfig(env = process.env) {
  const requested = String(env.STAFF_LEADS_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const local = !env.VERCEL && /^http:\/\/127\.0\.0\.1:\d+$/.test(requested);
  const url = local ? requested : PRODUCTION_URL;
  const anonKey = String(env.STAFF_LEADS_ANON_KEY || env.FF_SUPABASE_KEY || '').trim();
  const serviceKey = String(env.STAFF_LEADS_SERVICE_ROLE_KEY || env.SUPABASE_MAIN_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const missing = [];
  if (!local && !isAnonKey(anonKey)) missing.push('STAFF_LEADS_ANON_KEY');
  if (serviceKey && !isServiceKey(serviceKey)) missing.push('SUPABASE_MAIN_SERVICE_ROLE_KEY');
  if (anonKey && serviceKey && anonKey === serviceKey) missing.push('key_collision');
  return {
    ok: missing.length === 0 && !!anonKey,
    reason: missing.length ? 'missing_env' : (!anonKey ? 'missing_env' : null),
    missing,
    url,
    anonKey,
    serviceKey: isServiceKey(serviceKey) ? serviceKey : '',
    local,
  };
}

export function encodeSession(session) {
  return Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || 0,
  })).toString('base64url');
}

export function decodeSession(value) {
  try {
    const parsed = JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookie(value, secure) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'HttpOnly', 'Path=/staff', 'SameSite=Lax', 'Max-Age=43200'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(secure) {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'Path=/staff', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function csrfFor(accessToken) {
  return createHmac('sha256', String(accessToken || '')).update('posfin-staff-leads').digest('base64url');
}

export function csrfOk(accessToken, presented) {
  const expected = Buffer.from(csrfFor(accessToken));
  const got = Buffer.from(String(presented || ''));
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

async function authFetch(cfg, path, opts, fetchImpl, ms = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetchImpl(`${cfg.url}${path}`, { ...opts, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createStaffAuth(cfg, fetchImpl) {
  async function userFrom(accessToken) {
    const response = await authFetch(cfg, '/auth/v1/user', {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${accessToken}` },
    }, fetchImpl);
    if (!response.ok) return null;
    const user = await response.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (!isStaffEmail(email)) return null;
    return { email, access_token: accessToken };
  }

  async function refresh(refreshToken) {
    const response = await authFetch(cfg, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }, fetchImpl);
    if (!response.ok) return null;
    const body = await response.json();
    if (!body?.access_token || !body?.refresh_token) return null;
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: Number(body.expires_at) || Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600),
    };
  }

  return {
    async login(email, password) {
      const normalised = String(email || '').trim().toLowerCase();
      if (!isStaffEmail(normalised) || !password) return { ok: false };
      const response = await authFetch(cfg, '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalised, password: String(password) }),
      }, fetchImpl);
      if (!response.ok) return { ok: false };
      const body = await response.json();
      const userEmail = String(body?.user?.email || normalised).trim().toLowerCase();
      if (!body?.access_token || !body?.refresh_token || !isStaffEmail(userEmail)) return { ok: false };
      return {
        ok: true,
        email: userEmail,
        session: {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: Number(body.expires_at) || Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600),
        },
      };
    },
    async establish(rawCookie, now = Date.now()) {
      const saved = decodeSession(rawCookie);
      if (!saved) return null;
      let session = saved;
      let renewed = false;
      if (!session.expires_at || session.expires_at * 1000 < now + 60_000) {
        const next = await refresh(session.refresh_token);
        if (!next) return null;
        session = next;
        renewed = true;
      }
      const user = await userFrom(session.access_token);
      if (!user) return null;
      return { email: user.email, session, renewed };
    },
  };
}

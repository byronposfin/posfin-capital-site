// Invite and recovery landing. The access token stays in an HttpOnly cookie.
// pipeline.staff_caller() is called with that same user session.

import { callerFromToken } from './staff-auth.js';
import { verifiedSeats } from './staff-seats.js';

export const PASSWORD_MIN = 12;
export const SET_PASSWORD_PATH = '/staff/set-password';
export const SET_PASSWORD_REDIRECT = 'https://posfincapital.com/staff/set-password';
const LINK_TYPES = new Set(['invite', 'recovery']);

const COPY = {
  expired: 'This link has expired. Send yourself a new one.',
  used: 'This link has already been used. Send yourself a new one.',
  not_allowed: 'That email is not on the staff list.',
  mismatch: 'Those passwords do not match.',
  short: `Use at least ${PASSWORD_MIN} characters.`,
  weak: 'That password was not accepted. Choose a different one.',
  not_configured: 'Staff login is not configured on this server yet. Nothing was sent.',
  unavailable: 'The sign-in service did not answer. Try again in a moment.',
  sent: 'If that seat can sign in, a new link is on its way. It opens this page.',
  ready: 'Choose a password for this seat. You will then go to Live cases.',
  sign_in: 'Sign in on the cockpit first, then come back to change your password. Or send yourself a new link.',
  changed: 'Your password is saved.',
};

export function passwordMessage(code) {
  return COPY[code] || COPY.unavailable;
}

export function linkError(status, body) {
  const code = String(body && (body.error_code || body.error || '') || '').toLowerCase();
  const description = String(body && (body.error_description || body.msg || body.message || '') || '').toLowerCase();
  const text = `${code} ${description}`;
  if (status === 400 || status === 401 || status === 403 || status === 422) {
    if (/used|consumed|already/.test(text) && !/expired/.test(text)) return 'used';
    return 'expired';
  }
  return 'unavailable';
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

function authHeaders(env, token) {
  const key = String(env.STAFF_SUPABASE_ANON_KEY || '').trim();
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { key, headers };
}

function projectUrl(env) {
  return String(env.STAFF_SUPABASE_URL || env.FF_SUPABASE_URL || 'https://vgflcrfaudrvrdmxjdtl.supabase.co').replace(/\/+$/, '');
}

export async function sessionFromLink(input, deps = {}) {
  const env = deps.env || process.env;
  const { key, headers } = authHeaders(env, '');
  const url = projectUrl(env);
  if (!key || !url) return { ok: false, error: 'not_configured' };
  const fetcher = deps.fetch || fetch;
  const type = String(input.type || '').trim().toLowerCase();
  const tokenHash = String(input.tokenHash || '').trim();
  const code = String(input.code || '').trim();
  const accessToken = String(input.accessToken || '').trim();
  let access = '';
  if (tokenHash) {
    if (!LINK_TYPES.has(type)) return { ok: false, error: 'used' };
    const response = await fetcher(`${url}/auth/v1/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, token_hash: tokenHash }),
    });
    const body = await readJson(response);
    if (!response.ok || !body || !body.access_token) return { ok: false, error: linkError(response.status, body) };
    access = body.access_token;
  } else if (code) {
    const response = await fetcher(`${url}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ auth_code: code }),
    });
    const body = await readJson(response);
    if (!response.ok || !body || !body.access_token) return { ok: false, error: linkError(response.status, body) };
    access = body.access_token;
  } else if (accessToken) {
    if (type && !LINK_TYPES.has(type)) return { ok: false, error: 'used' };
    access = accessToken;
  } else {
    return { ok: false, error: 'expired' };
  }
  const actor = await callerFromToken(access, deps);
  if (!actor.ok) return { ok: false, error: actor.error === 'schema_pending' ? 'unavailable' : 'not_allowed' };
  return { ok: true, access, email: actor.email, seat: actor.seat.code };
}

export function passwordChoice(password, confirm) {
  const next = String(password || '');
  const again = String(confirm || '');
  if (next.length < PASSWORD_MIN) return { ok: false, error: 'short' };
  if (next !== again) return { ok: false, error: 'mismatch' };
  return { ok: true, password: next };
}

export async function savePassword(access, password, confirm, deps = {}) {
  const choice = passwordChoice(password, confirm);
  if (!choice.ok) return choice;
  const env = deps.env || process.env;
  const actor = await callerFromToken(access, deps);
  if (!actor.ok) return { ok: false, error: actor.error === 'schema_pending' ? 'unavailable' : 'not_allowed' };
  const { key, headers } = authHeaders(env, access);
  if (!key) return { ok: false, error: 'not_configured' };
  const fetcher = deps.fetch || fetch;
  const response = await fetcher(`${projectUrl(env)}/auth/v1/user`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: choice.password }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    const code = String(body && (body.error_code || body.error || body.msg) || '').toLowerCase();
    if (code.includes('weak') || code.includes('password')) return { ok: false, error: 'weak' };
    return { ok: false, error: 'unavailable' };
  }
  return { ok: true, session: `sb1.${access}`, email: actor.email, seat: actor.seat.code };
}

export async function requestNewLink(email, deps = {}) {
  const address = String(email || '').trim().toLowerCase();
  const seat = verifiedSeats().find((item) => item.email.toLowerCase() === address);
  if (!seat) return { ok: false, error: 'not_allowed' };
  const env = deps.env || process.env;
  const { key, headers } = authHeaders(env, '');
  if (!key) return { ok: false, error: 'not_configured' };
  const fetcher = deps.fetch || fetch;
  const redirectTo = encodeURIComponent(SET_PASSWORD_REDIRECT);
  const response = await fetcher(`${projectUrl(env)}/auth/v1/recover?redirect_to=${redirectTo}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: address }),
  });
  if (!response.ok && response.status !== 200) {
    const body = await readJson(response);
    if (response.status === 400 || response.status === 422) return { ok: false, error: linkError(response.status, body) };
    return { ok: false, error: 'unavailable' };
  }
  return { ok: true, error: 'sent' };
}

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title}</title><style>
body{font-family:"DM Sans",-apple-system,sans-serif;background:#F6F4EF;color:#13113A;margin:0}
main{max-width:32rem;margin:0 auto;padding:32px 16px}
h1{font-family:Georgia,serif;font-weight:500}
form,p{margin:0 0 16px}
label{display:block;font-weight:700;margin:8px 0 4px}
input{width:100%;box-sizing:border-box;min-height:48px;padding:12px;border:1px solid #E4DFD4;border-radius:12px}
button{min-height:48px;border:0;border-radius:999px;padding:12px 16px;background:#1C184F;color:#fff;font-weight:700}
.err{background:#FDECEC;color:#9F1239;padding:12px;border-radius:12px}
</style></head><body><main>${inner}</main>
<script>
const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
const token = hash.get('access_token');
const type = hash.get('type') || '';
if (token) {
  history.replaceState(null, '', location.pathname);
  const form = document.createElement('form');
  form.method = 'post';
  form.action = ${JSON.stringify(SET_PASSWORD_PATH)};
  for (const [name, value] of [['action', 'fragment'], ['access_token', token], ['type', type]]) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
</script></body></html>`;
}

function resendForm(email = '') {
  return `<form method="post" action="${SET_PASSWORD_PATH}"><input type="hidden" name="action" value="resend"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username" value="${escapeHtml(email)}" required><button type="submit">Send me a new link</button></form>`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function renderSetPassword(state = {}) {
  const notice = state.error === 'sent'
    ? `<p role="status">${escapeHtml(passwordMessage('sent'))}</p>`
    : (state.error ? `<p class="err" role="alert">${escapeHtml(passwordMessage(state.error))}</p>` : '');
  if (state.mode === 'choose' || state.mode === 'change') {
    const changing = state.mode === 'change';
    const hidden = changing ? '<input type="hidden" name="change" value="1">' : '';
    const title = changing ? 'Change your password' : 'Choose your password';
    const button = changing ? 'Save password' : 'Save and open Live cases';
    const lead = changing ? 'Choose a new password for this seat.' : passwordMessage('ready');
    return page(`${title} — Posfin`, `<h1>${title}</h1><p>${escapeHtml(lead)}</p>${notice}<form method="post" action="${SET_PASSWORD_PATH}">${hidden}<input type="hidden" name="action" value="set"><label for="password">New password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="${PASSWORD_MIN}" required><label for="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="${PASSWORD_MIN}" required><button type="submit">${button}</button></form>`);
  }
  const intro = notice || '<p>Open the link from your email, or send a new one to your seat address.</p>';
  return page('Staff link — Posfin', `<h1>Staff sign-in link</h1>${intro}${resendForm(state.email)}${state.mode === 'fragment' ? '' : ''}`);
}

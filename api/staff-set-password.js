import { readCookie, readFields, redirect, setPrivate } from '../lib/case-http.js';
import { renderSetPassword, requestNewLink, savePassword, sessionFromLink, SET_PASSWORD_PATH } from '../lib/staff-set-password.js';

function secureCookie(req) {
  return req.headers?.['x-forwarded-proto'] === 'https' || !!process.env.VERCEL;
}

function setupCookie(req, token) {
  const bits = [`pf_setup=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/staff/set-password', 'SameSite=Lax', 'Max-Age=900'];
  if (secureCookie(req)) bits.push('Secure');
  return bits.join('; ');
}

function clearSetup(req) {
  const bits = ['pf_setup=', 'HttpOnly', 'Path=/staff/set-password', 'SameSite=Lax', 'Max-Age=0'];
  if (secureCookie(req)) bits.push('Secure');
  return bits.join('; ');
}

function staffCookie(req, session) {
  const bits = [`pf_staff=${encodeURIComponent(session)}`, 'HttpOnly', 'Path=/staff', 'SameSite=Lax', 'Max-Age=43200'];
  if (secureCookie(req)) bits.push('Secure');
  return bits.join('; ');
}

function sendPage(res, status, html, cookies) {
  res.statusCode = status;
  if (cookies) res.setHeader('Set-Cookie', cookies);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(html);
}

function queryOf(req) {
  if (req.query && (req.query.token_hash || req.query.type || req.query.code || req.query.ready || req.query.error || req.query.error_code)) {
    return req.query;
  }
  try {
    return Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch {
    return req.query || {};
  }
}

export async function handleSetPassword(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const depsEnv = { ...deps, env };
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      const action = String(fields.action || '');
      if (action === 'fragment') {
        const opened = await sessionFromLink({ accessToken: fields.access_token, type: fields.type }, depsEnv);
        if (!opened.ok) return sendPage(res, 400, renderSetPassword({ error: opened.error, mode: 'link' }));
        res.setHeader('Set-Cookie', setupCookie(req, opened.access));
        return redirect(res, `${SET_PASSWORD_PATH}?ready=1`);
      }
      if (action === 'resend') {
        const sent = await requestNewLink(fields.email, depsEnv);
        const status = sent.ok ? 200 : (sent.error === 'not_allowed' ? 400 : 503);
        return sendPage(res, status, renderSetPassword({ error: sent.ok ? 'sent' : sent.error, email: fields.email, mode: 'link' }));
      }
      if (action === 'set') {
        const access = readCookie(req, 'pf_setup');
        if (!access) return sendPage(res, 400, renderSetPassword({ error: 'expired', mode: 'link' }));
        const saved = await savePassword(access, fields.password, fields.confirm, depsEnv);
        if (!saved.ok) {
          const mode = saved.error === 'not_allowed' || saved.error === 'unavailable' || saved.error === 'not_configured' ? 'link' : 'choose';
          return sendPage(res, 400, renderSetPassword({ error: saved.error, mode }));
        }
        res.setHeader('Set-Cookie', [staffCookie(req, saved.session), clearSetup(req)]);
        return redirect(res, '/staff/cockpit/live');
      }
      return sendPage(res, 400, renderSetPassword({ error: 'used', mode: 'link' }));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendPage(res, 405, renderSetPassword({ error: 'unavailable', mode: 'link' }));
    }
    const query = queryOf(req);
    if (query.error || query.error_code) {
      const code = String(query.error_code || query.error || '').toLowerCase();
      const error = /used|consumed/.test(code) && !/expired/.test(code) ? 'used' : 'expired';
      return sendPage(res, 400, renderSetPassword({ error, mode: 'link' }));
    }
    if (query.token_hash || query.code) {
      const opened = await sessionFromLink({
        tokenHash: query.token_hash,
        type: query.type,
        code: query.code,
      }, depsEnv);
      if (!opened.ok) return sendPage(res, 400, renderSetPassword({ error: opened.error, mode: 'link' }));
      res.setHeader('Set-Cookie', setupCookie(req, opened.access));
      return redirect(res, `${SET_PASSWORD_PATH}?ready=1`);
    }
    if (query.ready === '1' && readCookie(req, 'pf_setup')) {
      return sendPage(res, 200, renderSetPassword({ mode: 'choose' }));
    }
    if (query.ready === '1') return sendPage(res, 400, renderSetPassword({ error: 'expired', mode: 'link' }));
    return sendPage(res, 200, renderSetPassword({ mode: 'link' }));
  } catch {
    return sendPage(res, 503, renderSetPassword({ error: 'unavailable', mode: 'link' }));
  }
}

export default function handler(req, res) {
  return handleSetPassword(req, res, {});
}

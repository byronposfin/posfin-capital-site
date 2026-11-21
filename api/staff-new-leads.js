// Staff-only new-leads lane. The browser sends the person's Supabase access token.
// The service-role key is never accepted here and never sent to the browser.
import { readConfig } from './factfind.js';
import { presentLead } from '../lib/lead-lane.js';
import { DEFAULT_SEATS, LEAD_STATUSES } from '../lib/lead-assign.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(JSON.stringify(body));
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  const token = value.startsWith('Bearer ') ? value.slice(7).trim() : '';
  if (token.length < 20 || token.length > 4000) return '';
  return token;
}

async function userRpc(cfg, token, fn, body) {
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (response.status === 401) return { status: 401, error: 'auth' };
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403 || text.includes('not_allowed') || text.includes('42501')) return { status: 403, error: 'forbidden' };
    return { status: 502, error: 'unavailable' };
  }
  return { status: 200, data: await response.json() };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { ok: false, error: 'method_not_allowed' });
  const cfg = readConfig();
  if (!cfg.ok || cfg.backendName !== 'leads') return send(res, 503, { ok: false, error: 'not_configured' });
  const token = bearer(req);
  if (!token) return send(res, 401, { ok: false, error: 'auth' });
  try {
    if (req.method === 'GET') {
      const includeTests = process.env.FF_TEST_RUN === 'true' && process.env.VERCEL_ENV !== 'production';
      const result = await userRpc(cfg, token, 'staff_new_web_leads_v2', { p_include_tests: includeTests });
      if (result.error) return send(res, result.status, { ok: false, error: result.error });
      const rows = Array.isArray(result.data) ? result.data : [];
      const seats = DEFAULT_SEATS.filter((seat) => seat.active !== false).map((seat) => ({
        code: seat.seat_code, name: seat.display_name, role: seat.role,
      }));
      return send(res, 200, { ok: true, leads: rows.map((row) => presentLead(row)), seats, statuses: LEAD_STATUSES, capped: rows.length === 100 });
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!UUID.test(String(body.id || ''))) return send(res, 400, { ok: false, error: 'bad_input' });
    if (body.action === 'mark_contacted') {
      const result = await userRpc(cfg, token, 'web_lead_mark_contacted', { p_id: body.id });
      if (result.error) return send(res, result.status, { ok: false, error: result.error });
      return send(res, 200, { ok: true, reference: result.data && result.data.reference });
    }
    if (body.action !== 'patch') return send(res, 400, { ok: false, error: 'bad_input' });
    const patch = {};
    if (typeof body.assigned_seat === 'string' && /^[a-z][a-z0-9_]{1,30}$/.test(body.assigned_seat)) patch.assigned_seat = body.assigned_seat;
    if (typeof body.status === 'string' && LEAD_STATUSES.includes(body.status)) patch.status = body.status;
    if (typeof body.next_action === 'string') patch.next_action = body.next_action.slice(0, 240);
    if (typeof body.staff_note === 'string') patch.staff_note = body.staff_note.slice(0, 1000);
    if (!Object.keys(patch).length) return send(res, 400, { ok: false, error: 'bad_input' });
    const result = await userRpc(cfg, token, 'web_lead_staff_patch', { p_id: body.id, p_patch: patch });
    if (result.error) return send(res, result.status, { ok: false, error: result.error });
    return send(res, 200, { ok: true, reference: result.data && result.data.reference });
  } catch {
    return send(res, 502, { ok: false, error: 'unavailable' });
  }
}

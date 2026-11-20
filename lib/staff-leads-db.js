const TIMEOUT_MS = 8000;

export class StaffDbError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status || 0;
  }
}

function headersFor(cfg, session) {
  if (cfg.serviceKey) {
    return { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, mode: 'service' };
  }
  return { apikey: cfg.anonKey, Authorization: `Bearer ${session.access_token}`, mode: 'user' };
}

async function call(cfg, session, path, opts, fetchImpl, retry) {
  const { mode, ...auth } = headersFor(cfg, session);
  void mode;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${cfg.url}${path}`, {
      ...opts,
      signal: ac.signal,
      headers: {
        ...auth,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
    });
    if (response.status >= 500 && retry) return call(cfg, session, path, opts, fetchImpl, false);
    return { response, mode: auth.mode };
  } catch (error) {
    if (retry) return call(cfg, session, path, opts, fetchImpl, false);
    throw new StaffDbError(error?.name === 'AbortError' ? 'timeout' : 'network', 503);
  } finally {
    clearTimeout(timer);
  }
}

function knownCode(message) {
  const text = String(message || '');
  for (const code of ['staff_actor_required', 'lead_not_found', 'lead_archived', 'bad_status', 'bad_assigned', 'bad_stage', 'bad_note']) {
    if (text.includes(code)) return code;
  }
  return 'store';
}

export function createStaffDb(cfg, fetchImpl) {
  return {
    async isStaff(session, email) {
      const encoded = encodeURIComponent(email);
      const { response } = await call(cfg, session, `/rest/v1/crm_users?select=email,role&email=eq.${encoded}`, {}, fetchImpl, true);
      if (!response.ok) throw new StaffDbError('staff_lookup_failed', response.status);
      const rows = await response.json();
      return Array.isArray(rows) && rows.some((row) => String(row.email || '').toLowerCase() === email);
    },
    async listLive(session) {
      const { response } = await call(cfg, session, '/rest/v1/rpc/staff_list_live_leads', { method: 'POST', body: '{}' }, fetchImpl, true);
      if (response.status === 404) throw new StaffDbError('schema_pending', 404);
      if (!response.ok) throw new StaffDbError('list_failed', response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new StaffDbError('list_failed', 502);
      return rows;
    },
    async getLead(session, id) {
      const { response } = await call(cfg, session, `/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=*`, {}, fetchImpl, true);
      if (!response.ok) throw new StaffDbError('read_failed', response.status);
      const rows = await response.json();
      const lead = Array.isArray(rows) ? rows[0] : null;
      if (!lead || lead.source === 'facebook_archived') return null;
      return lead;
    },
    async listActivity(session, id) {
      const { response } = await call(
        cfg,
        session,
        `/rest/v1/lead_activity?lead_id=eq.${encodeURIComponent(id)}&select=id,created_at,actor_email,kind,body,field,old_value,new_value&order=created_at.desc`,
        {},
        fetchImpl,
        true,
      );
      if (response.status === 404) return [];
      if (!response.ok) throw new StaffDbError('activity_failed', response.status);
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    },
    async applyChange(session, change) {
      const { response } = await call(cfg, session, '/rest/v1/rpc/staff_apply_lead_change', {
        method: 'POST',
        body: JSON.stringify({
          p_lead_id: change.id,
          p_actor: change.actor,
          p_status: change.status,
          p_assigned_to: change.assigned_to,
          p_stage: change.stage,
          p_note: change.note,
          p_set_status: true,
          p_set_assigned: true,
          p_set_stage: true,
        }),
      }, fetchImpl, false);
      if (response.ok) return response.json();
      let code = 'store';
      try { code = knownCode((await response.json())?.message); }
      catch { code = 'store'; }
      throw new StaffDbError(code, response.status);
    },
  };
}

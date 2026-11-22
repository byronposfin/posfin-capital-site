const NAMES = ['highlevel', 'lender_email', 'broka', 'telegram'];

export function sendsAreMock(env = process.env) {
  const preview = env.COCKPIT_SOURCE !== 'supabase'
    || env.VERCEL_ENV === 'preview'
    || env.VERCEL_ENV === 'development'
    || String(env.EL_LOR_FORCE_MOCK || '').toLowerCase() === 'on';
  if (preview) return true;
  return String(env.EL_LOR_LIVE_SENDS || 'off').trim().toLowerCase() !== 'on';
}

function mockResult(name, payload) {
  if (name === 'highlevel') {
    return {
      ok: true,
      mode: 'mock',
      network: false,
      docId: `HL-TEST-${payload.case_ref}-v${payload.version}`,
      status: 'sent',
    };
  }
  return { ok: true, mode: 'mock', network: false, status: 'sent', count: (payload.lenders || []).length };
}

export function dispatchAdapter(name, payload, env = process.env, hooks = {}) {
  if (!NAMES.includes(name)) return { ok: false, error: 'adapter', network: false };
  const sink = hooks.sink;
  if (sendsAreMock(env)) {
    const result = mockResult(name, payload || {});
    if (sink) sink.push({ name, mode: 'mock', network: false });
    return result;
  }
  const approval = payload && payload.approval;
  const approved = approval && approval.status === 'approved' && (approval.action_type === 'send_external' || approval.action_type === 'sign');
  if (!approved) return { ok: false, error: 'approval', mode: 'live', network: false };
  if (String(env.EL_LOR_LIVE_SENDS || 'off').trim().toLowerCase() !== 'on') {
    return { ok: false, error: 'live_off', mode: 'live', network: false };
  }
  if (typeof hooks.transport !== 'function') {
    return { ok: false, error: 'live_not_configured', mode: 'live', network: false };
  }
  return hooks.transport(payload);
}

import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { buildCases, groupColumns, loadMasterIndex, selectLeads, windowDays } from '../lib/pipeline.js';
import { renderPipeline, renderPipelineLogin } from '../lib/pipeline-html.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

export function pipelineConfig(env = process.env) {
  return {
    url: String(env.PIPELINE_SUPABASE_URL || env.FF_SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(env.PIPELINE_SUPABASE_KEY || env.FF_SUPABASE_KEY || '').trim(),
    days: windowDays(env),
  };
}

export async function fetchLeads(cfg, fetcher = fetch, now = Date.now()) {
  if (!cfg.url || !cfg.key || cfg.url !== MAIN) return { rows: [], blocked: cfg.url && cfg.url !== MAIN ? 'not_main_project' : 'missing_key' };
  const since = new Date(now - cfg.days * 86400000).toISOString();
  const query = [
    'select=id,full_name,email,phone,status,source,loan_amount_band,assigned_to,created_at,fb_created_time',
    `or=(and(fb_created_time.gte.${encodeURIComponent(since)}),and(fb_created_time.is.null,created_at.gte.${encodeURIComponent(since)}),status.neq.new)`,
    'limit=2000',
  ].join('&');
  const res = await fetcher(`${cfg.url}/rest/v1/leads?${query}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) return { rows: [], blocked: 'read_failed' };
  const rows = await res.json();
  return { rows: Array.isArray(rows) ? rows : [], blocked: '' };
}

export function boardFrom(leads, now, days) {
  const cases = buildCases(loadMasterIndex());
  const intake = selectLeads(leads, now, days);
  const caseNames = new Set(cases.map((card) => card.name.toLowerCase()));
  const leadsOnly = intake.filter((card) => !caseNames.has(String(card.name || '').toLowerCase()));
  return groupColumns(cases.concat(leadsOnly));
}

export default async function handler(req, res) {
  setPrivate(res);
  const env = process.env;
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      if (fields.password && !fields.action) {
        const login = await establishSession(String(fields.password), { env });
        if (!login.ok) return sendHtml(res, 401, renderPipelineLogin());
        writeStaffCookie(res, req, login.session);
        return redirect(res, '/staff/cockpit/pipeline');
      }
      if (fields.action === 'move') {
        return sendHtml(res, 409, renderPipeline(boardFrom([], Date.now(), windowDays(env)), {
          banner: 'Move refused. pipeline_stage_history is not on the database. No lead, deal, or sheet row was changed.',
        }));
      }
    }
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, { env })) return sendHtml(res, 401, renderPipelineLogin());
    const now = Date.now();
    const cfg = pipelineConfig(env);
    const loaded = await fetchLeads(cfg, fetch, now);
    const board = boardFrom(loaded.rows, now, cfg.days);
    const leadCount = board.columns.slice(0, 4).reduce((sum, column) => sum + column.cards.length, 0) + board.parked.filter((card) => card.source === 'supabase-leads').length;
    const banner = loaded.blocked
      ? `Lead rows were not read (${loaded.blocked}). Case cards are the 14 Nov index with the 20 Nov stage on top. Set PIPELINE_SUPABASE_KEY to the main project read key. Nothing was written.`
      : `${leadCount} intake cards from public.leads, last ${cfg.days} days plus older non-new leads. No rows were updated or deleted.`;
    return sendHtml(res, 200, renderPipeline(board, { banner }));
  } catch (error) {
    console.error('[pipeline]', error.code || 'pipeline_failed');
    return sendHtml(res, 503, renderPipeline(boardFrom([], Date.now(), 60), { banner: 'The pipeline could not be read. Nothing was written.' }));
  }
}

/**
 * Authenticated HTTP endpoints for Tom's MCP service.
 *
 * GET  /api/case-completion?case_id=... — Full view including broker_only.
 * PATCH /api/case-completion — Same validation as borrower path but allows
 *   any source (broker, claude, tom). expected_version + source +
 *   idempotency_key required.
 *
 * Auth: x-service-key header checked against SMARTLINK_SERVICE_KEY env var.
 */

import { getCase, patchCase } from '../lib/supabase.js';
import { analyseGaps } from '../lib/gap-engine.js';

function authenticateService(req) {
  const key = process.env.SMARTLINK_SERVICE_KEY;
  if (!key) throw new Error('SMARTLINK_SERVICE_KEY not configured');
  const provided = String(req.headers['x-service-key'] || '');
  if (!provided || provided !== key) return false;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authenticateService(req)) {
    return res.status(403).json({ error: 'Service authentication required' });
  }

  try {
    const client = await (await import('../lib/supabase.js')).supabase();

    // ── GET: full view including broker_only ────────────────────────
    if (req.method === 'GET') {
      const caseId = String(req.query.case_id || '');
      if (!caseId) return res.status(400).json({ error: 'case_id required' });

      const caseData = await getCase(client, caseId);
      if (!caseData) return res.status(404).json({ error: 'Case not found' });

      const product = caseData.fields?.product_route?.value || 'main_loan';
      const gaps = analyseGaps(caseData, product);

      return res.status(200).json({
        ...caseData,
        gaps,
      });
    }

    // ── PATCH: service-authenticated write ──────────────────────────
    const { case_id, expected_version, idempotency_key, source, actor, fields, broker_only } = req.body || {};

    if (!case_id) return res.status(400).json({ error: 'case_id required' });
    if (typeof expected_version !== 'number') return res.status(400).json({ error: 'expected_version (number) required' });
    if (!idempotency_key) return res.status(400).json({ error: 'idempotency_key required' });
    if (!source) return res.status(400).json({ error: 'source required (intake, crm_import, borrower, broker, claude, tom)' });

    const caseData = await getCase(client, case_id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const result = await patchCase(client, case_id, {
      expectedVersion: expected_version,
      fields: fields || {},
      source,
      actor: actor || source,
      idempotencyKey: idempotency_key,
      brokerOnly: broker_only,
    });

    if (result.replayed) {
      return res.status(200).json({ ok: true, replayed: true, version: result.version });
    }

    if (result.conflict) {
      const product = caseData.fields?.product_route?.value || 'main_loan';
      return res.status(409).json({
        error: 'version_conflict',
        currentVersion: result.currentVersion,
        currentFields: result.currentFields,
        gaps: analyseGaps({ ...caseData, fields: result.currentFields }, product),
      });
    }

    const updated = await getCase(client, case_id);
    const product = updated.fields?.product_route?.value || 'main_loan';
    return res.status(200).json({
      ok: true,
      version: result.version,
      ...updated,
      gaps: analyseGaps(updated, product),
    });

  } catch (err) {
    console.error('[Case Completion API]', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

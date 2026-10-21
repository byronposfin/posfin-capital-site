/**
 * Staff-only token management
 *
 * POST /api/case/:id/token — Issue or revoke a SmartLink token.
 *   Body: { action: 'issue' | 'revoke', token_hash? (for revoke) }
 *   Auth: Staff allowlist (Byron, Chris, Jess, Aadi) via Posfin work account.
 *
 * Issuing a token NEVER sends a message.
 */

import { generateToken, getCase } from '../../../lib/supabase.js';

const STAFF_ALLOWLIST = ['byron', 'chris', 'jess', 'aadi'];

function authenticateStaff(req) {
  // Staff auth via x-staff-user header (set by upstream auth middleware).
  // In production this would be validated against Posfin work-account sign-in.
  const user = String(req.headers['x-staff-user'] || '').trim().toLowerCase();
  if (!user || !STAFF_ALLOWLIST.includes(user)) return null;
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const staffUser = authenticateStaff(req);
  if (!staffUser) return res.status(403).json({ error: 'Staff authentication required' });

  try {
    const caseId = String(req.query.id || '');
    if (!caseId) return res.status(400).json({ error: 'Case ID required' });

    const client = await (await import('../../../lib/supabase.js')).supabase();
    const caseData = await getCase(client, caseId);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    const { action, token_hash } = req.body || {};

    if (action === 'issue') {
      const { raw, hash } = generateToken();
      await client.from('case_tokens').insert({
        token_hash: hash,
        case_id: caseId,
      });
      // Return the raw token ONCE. It is never stored or logged.
      return res.status(201).json({
        ok: true,
        token: raw,
        case_id: caseId,
        message: 'Token issued. This is the only time the raw token is shown. Issuing does not send any message.',
      });
    }

    if (action === 'revoke') {
      if (!token_hash) return res.status(400).json({ error: 'token_hash required for revoke' });
      const { error } = await client
        .from('case_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', token_hash)
        .eq('case_id', caseId);
      if (error) throw error;
      return res.status(200).json({ ok: true, revoked: true });
    }

    return res.status(400).json({ error: 'action must be "issue" or "revoke"' });

  } catch (err) {
    console.error('[Staff Token API]', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

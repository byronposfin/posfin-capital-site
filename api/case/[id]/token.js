/**
 * Staff-only token management
 *
 * POST /api/case/:id/token — Issue or revoke a SmartLink token.
 *   Body: { action: 'issue' | 'revoke', token_hash? (for revoke) }
 *   Auth: Microsoft 365 work-account sign-in (NOT YET IMPLEMENTED).
 *   Staff allowlist: Byron, Chris, Jess, Aadi.
 *
 * Issuing a token NEVER sends a message.
 *
 * STATUS: Token issuing is DISABLED until Microsoft 365 authentication is
 * wired. The trusted x-staff-user header is not sufficient for production.
 * Revocation is also gated on the same auth.
 */

import { generateToken, getCase } from '../../../lib/supabase.js';

const STAFF_ALLOWLIST = ['byron', 'chris', 'jess', 'aadi'];

// When M365 auth is implemented, this function should:
// 1. Validate the M365 bearer token from the Authorization header
// 2. Extract the user principal name (UPN) or email
// 3. Match against STAFF_ALLOWLIST
// 4. Return the verified identity or null
//
// Until then, all requests are rejected with 501.
const M365_AUTH_IMPLEMENTED = false;

function authenticateStaff(req) {
  if (!M365_AUTH_IMPLEMENTED) return null;
  // Placeholder for M365 token validation — never reached while disabled
  const user = String(req.headers['x-staff-user'] || '').trim().toLowerCase();
  if (!user || !STAFF_ALLOWLIST.includes(user)) return null;
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!M365_AUTH_IMPLEMENTED) {
    return res.status(501).json({
      error: 'Staff token management is disabled until Microsoft 365 authentication is implemented.',
      status: 'NOT_IMPLEMENTED',
    });
  }

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

// Exported for testing only — allows tests to temporarily enable the gate
export { M365_AUTH_IMPLEMENTED, STAFF_ALLOWLIST };

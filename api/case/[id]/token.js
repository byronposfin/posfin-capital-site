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
 * STATUS: This endpoint returns 501 for ALL requests until Microsoft 365
 * authentication is implemented. There is no fallback header or bypass.
 */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // M365 auth is not implemented. Reject everything.
  return res.status(501).json({
    error: 'Staff token management is disabled until Microsoft 365 authentication is implemented.',
    status: 'NOT_IMPLEMENTED',
  });
}

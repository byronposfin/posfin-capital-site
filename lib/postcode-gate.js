/**
 * Postcode gate — borrower access control.
 *
 * - Normalise and compare home postcode (ignore case/spaces).
 * - 30-day device session via signed cookie.
 * - Lockout: 5 failed attempts → 15-minute cooldown.
 * - 6-digit code fallback (WhatsApp/email) via verification-code.js.
 * - No personal data shown before the gate is passed.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DAYS = 30;

/** Normalise a postcode for comparison: uppercase, no spaces. */
export function normalisePostcode(pc) {
  return String(pc || '').replace(/\s+/g, '').toUpperCase();
}

/** Check if the borrower is locked out. */
export async function isLockedOut(client, caseId) {
  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const { data, error } = await client
    .from('case_gate_attempts')
    .select('id')
    .eq('case_id', caseId)
    .eq('success', false)
    .gte('attempted_at', cutoff);
  if (error) throw error;
  return (data || []).length >= LOCKOUT_THRESHOLD;
}

/** Record a gate attempt (success or failure). */
export async function recordAttempt(client, caseId, success, ipHash) {
  await client.from('case_gate_attempts').insert({
    case_id: caseId,
    success,
    ip_hash: ipHash || null,
  });
}

/** Verify the postcode. Returns { passed, locked, needsCode }. */
export async function verifyPostcode(client, caseId, submittedPostcode, storedPostcode) {
  if (await isLockedOut(client, caseId)) {
    return { passed: false, locked: true, needsCode: false };
  }

  const submitted = normalisePostcode(submittedPostcode);
  const stored = normalisePostcode(storedPostcode);

  if (!stored) {
    // No postcode on file — require verification code
    return { passed: false, locked: false, needsCode: true };
  }

  const match = submitted.length === stored.length &&
    timingSafeEqual(Buffer.from(submitted), Buffer.from(stored));

  await recordAttempt(client, caseId, match);

  if (match) return { passed: true, locked: false, needsCode: false };

  // Check if we just hit the threshold
  if (await isLockedOut(client, caseId)) {
    return { passed: false, locked: true, needsCode: false };
  }

  return { passed: false, locked: false, needsCode: false };
}

// ── Device session cookie ────────────────────────────────────────────

function sessionSecret() {
  const s = process.env.SMARTLINK_TOKEN_SECRET;
  if (!s) throw new Error('SMARTLINK_TOKEN_SECRET is required');
  return s;
}

/** Sign a session payload. */
export function signSession(caseId) {
  const payload = JSON.stringify({ caseId, exp: Date.now() + SESSION_DAYS * 86400_000 });
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** Verify and decode a session cookie. Returns { caseId } or null. */
export function verifySession(cookie) {
  if (!cookie) return null;
  try {
    const [payloadB64, sig] = cookie.split('.');
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const { caseId, exp } = JSON.parse(payload);
    if (Date.now() > exp) return null;
    return { caseId };
  } catch { return null; }
}

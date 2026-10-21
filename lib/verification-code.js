/**
 * 6-digit verification code — fallback when postcode gate fails.
 *
 * Code generation, validation, expiry and lockout are implemented.
 * Delivery is STUBBED — actual WhatsApp delivery goes via WATI (not
 * Telegram). Email delivery TBD. The stub logs the code to the outbox
 * for Tom/operator to inspect during staging.
 */

import { randomInt, createHash } from 'node:crypto';

const CODE_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

/** Generate a 6-digit code. Returns { code, hash }. */
export function generateCode() {
  const code = String(randomInt(100000, 999999));
  const hash = createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

/** Hash a code for lookup. */
export function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex');
}

/**
 * Issue a verification code for a case.
 * Stores the hash in case_verification_codes; STUB-delivers the code.
 * Returns { issued: true, channel, expiresAt } or { issued: false, reason }.
 */
export async function issueCode(client, caseId, channel, contactValue) {
  if (!['whatsapp', 'email'].includes(channel)) {
    return { issued: false, reason: 'Invalid channel' };
  }

  const { code, hash } = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60_000).toISOString();

  await client.from('case_verification_codes').insert({
    case_id: caseId,
    code_hash: hash,
    channel,
    expires_at: expiresAt,
  });

  // STUB: log to console for staging/operator inspection.
  // Production delivery will use WATI (WhatsApp) or email service.
  console.log(`[VerificationCode] STUB delivery — case=${caseId} channel=${channel} contact=${contactValue} code=${code} expires=${expiresAt}`);

  return { issued: true, channel, expiresAt };
}

/**
 * Verify a submitted code.
 * Returns { verified: true } or { verified: false, reason, attemptsRemaining }.
 */
export async function verifyCode(client, caseId, submittedCode) {
  const submittedHash = hashCode(submittedCode);

  // Find the most recent unexpired, unused code for this case
  const { data: codes, error } = await client
    .from('case_verification_codes')
    .select('*')
    .eq('case_id', caseId)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!codes || codes.length === 0) {
    return { verified: false, reason: 'No active code. Request a new one.' };
  }

  const codeRow = codes[0];

  if (codeRow.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { verified: false, reason: 'Too many attempts. Request a new code.' };
  }

  // Increment attempts
  await client
    .from('case_verification_codes')
    .update({ attempts: codeRow.attempts + 1 })
    .eq('id', codeRow.id);

  if (codeRow.code_hash !== submittedHash) {
    const remaining = MAX_VERIFY_ATTEMPTS - codeRow.attempts - 1;
    return { verified: false, reason: 'Incorrect code.', attemptsRemaining: remaining };
  }

  // Mark as used
  await client
    .from('case_verification_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('id', codeRow.id);

  return { verified: true };
}

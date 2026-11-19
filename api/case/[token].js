/**
 * SmartLink borrower API
 *
 * GET  /api/case/:token — Borrower view: postcode gate, then outstanding
 *   batch, completed sections, exports. Borrower-only fields.
 *
 * PATCH /api/case/:token — Submit answers. Body: { expected_version,
 *   idempotency_key, postcode, fields }. Borrower-owned fields only.
 *   Stale version → 409 with current state. Replayed idempotency_key
 *   returns original result.
 */

import { hashToken, resolveToken, getCase, patchCase } from '../../lib/supabase.js';
import { verifyPostcode, verifySession, signSession, normalisePostcode } from '../../lib/postcode-gate.js';
import { issueCode, verifyCode } from '../../lib/verification-code.js';
import { analyseGaps, borrowerAllowlist } from '../../lib/gap-engine.js';
import { formatCaseAlert } from '../../lib/notify.js';

function parseCookies(header) {
  const cookies = {};
  for (const pair of String(header || '').split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  }
  return cookies;
}

/**
 * Build the borrower-safe view (never includes broker_only).
 */
function borrowerView(caseData, product) {
  const gaps = analyseGaps(caseData, product || 'main_loan');
  const borrowerFields = {};
  for (const [key, entry] of Object.entries(caseData.fields || {})) {
    // Exclude broker-only fields from borrower view
    if (entry.source === 'broker' && entry._broker_only) continue;
    borrowerFields[key] = { value: entry.value, confirmed: !!entry.confirmed_at };
  }
  return {
    case_id: caseData.case_id,
    version: caseData.version,
    fields: borrowerFields,
    batch: gaps.batch.map(f => ({ key: f.key, label: f.label, type: f.type, choices: f.choices })),
    remaining: gaps.remaining,
    sections: gaps.sections,
    progress: gaps.progress,
    unmapped: gaps.unmapped,
  };
}

export default async function handler(req, res) {
  // Security headers — no personal data in metadata
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawToken = String(req.query.token || '');
    if (!rawToken || rawToken.length < 10) return res.status(400).json({ error: 'Invalid token' });

    // Resolve token → case_id
    const client = await (await import('../../lib/supabase.js')).supabase();
    const tokenResult = await resolveToken(client, hashToken(rawToken));

    if (!tokenResult) return res.status(404).json({ error: 'Token not found' });
    if (tokenResult.revoked) return res.status(410).json({ error: 'This link has been revoked' });

    const caseId = tokenResult.case_id;
    const caseData = await getCase(client, caseId);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });

    // ── Postcode gate ──────────────────────────────────────────────
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(cookies.smartlink_session);
    const sessionValid = session?.caseId === caseId;

    if (!sessionValid) {
      // Check if postcode was submitted in query/body
      const submittedPostcode = req.method === 'GET'
        ? req.query.postcode
        : req.body?.postcode;
      const submittedCode = req.method === 'GET'
        ? req.query.code
        : req.body?.code;

      // Get stored postcode from fields
      const storedPostcode = caseData.fields?.postcode?.value
        || caseData.fields?.home_postcode?.value
        || '';

      if (submittedCode) {
        // Verification code path
        const codeResult = await verifyCode(client, caseId, submittedCode);
        if (!codeResult.verified) {
          return res.status(403).json({
            error: 'gate_required',
            gate: 'code',
            reason: codeResult.reason,
            attemptsRemaining: codeResult.attemptsRemaining,
          });
        }
        // Code verified — create session
        res.setHeader('Set-Cookie', `smartlink_session=${signSession(caseId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}`);
      } else if (submittedPostcode) {
        const gateResult = await verifyPostcode(client, caseId, submittedPostcode, storedPostcode);
        if (gateResult.locked) {
          return res.status(429).json({
            error: 'gate_locked',
            message: 'Too many attempts. Try again in 15 minutes, or request a verification code.',
          });
        }
        if (!gateResult.passed) {
          if (gateResult.needsCode) {
            return res.status(403).json({
              error: 'gate_required',
              gate: 'code',
              message: 'Verification code required.',
            });
          }
          return res.status(403).json({
            error: 'gate_required',
            gate: 'postcode',
            message: 'Incorrect postcode.',
          });
        }
        // Postcode correct — create session
        res.setHeader('Set-Cookie', `smartlink_session=${signSession(caseId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}`);
      } else {
        // No postcode or code submitted — return gate challenge
        // Never show personal data before gate is passed
        return res.status(403).json({
          error: 'gate_required',
          gate: 'postcode',
          case_id: caseId, // OK to show — it's in the token already
        });
      }
    }

    // ── GET: borrower view ─────────────────────────────────────────
    if (req.method === 'GET') {
      const product = caseData.fields?.product_route?.value || 'main_loan';
      return res.status(200).json(borrowerView(caseData, product));
    }

    // ── PATCH: submit answers ──────────────────────────────────────
    const { expected_version, idempotency_key, fields } = req.body || {};

    if (typeof expected_version !== 'number') {
      return res.status(400).json({ error: 'expected_version (number) is required' });
    }
    if (!idempotency_key || typeof idempotency_key !== 'string') {
      return res.status(400).json({ error: 'idempotency_key (string) is required' });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return res.status(400).json({ error: 'fields (object) is required' });
    }

    // Filter to borrower-owned fields only
    const product = caseData.fields?.product_route?.value || 'main_loan';
    const allowlist = borrowerAllowlist(product);
    const filteredFields = {};
    const rejected = [];
    for (const [key, value] of Object.entries(fields)) {
      if (allowlist.has(key)) {
        filteredFields[key] = value;
      } else {
        rejected.push(key);
      }
    }

    if (Object.keys(filteredFields).length === 0) {
      return res.status(400).json({ error: 'No valid borrower-owned fields in request', rejected });
    }

    // Notification intent committed atomically with case+audit via RPC.
    // No separate enqueueAlert call — if the RPC succeeds, notification
    // rows exist. If it fails, nothing is committed.
    const alertMsg = formatCaseAlert(caseId, 'Borrower submitted answers', {
      fieldsUpdated: Object.keys(filteredFields).join(', '),
      version: expected_version + 1,
    });

    const result = await patchCase(client, caseId, {
      expectedVersion: expected_version,
      fields: filteredFields,
      source: 'borrower',
      actor: 'borrower',
      idempotencyKey: idempotency_key,
      notifyMessage: alertMsg,
      notifyRecipients: ['1750758657', '8634157536'],
    });

    if (result.replayed) {
      return res.status(200).json({ ok: true, replayed: true, version: result.version });
    }

    if (result.conflict) {
      return res.status(409).json({
        error: 'version_conflict',
        currentVersion: result.currentVersion,
        ...borrowerView({ ...caseData, version: result.currentVersion, fields: result.currentFields }, product),
      });
    }

    // Return updated view
    const updated = await getCase(client, caseId);
    return res.status(200).json({
      ok: true,
      version: result.version,
      rejected: rejected.length ? rejected : undefined,
      ...borrowerView(updated, product),
    });

  } catch (err) {
    console.error('[SmartLink Case API]', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}

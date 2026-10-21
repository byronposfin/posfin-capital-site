/**
 * Supabase client — service-role only, server-side.
 * No client-side Supabase. All access through Vercel serverless functions.
 *
 * Env vars (names only, never values in code):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

let _client = null;

export function supabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  // Lazy import to avoid requiring the dep when not used
  return import('@supabase/supabase-js').then(({ createClient }) => {
    _client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return _client;
  });
}

// For tests: inject a mock client
export function setClient(mock) { _client = mock; }

// ── Token helpers ────────────────────────────────────────────────────

import { randomBytes, createHash } from 'node:crypto';

/** Generate an opaque 128-bit random token. Returns { raw, hash }. */
export function generateToken() {
  const raw = randomBytes(16).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/** Hash a raw token for lookup. */
export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

// ── Version-gated write helpers ──────────────────────────────────────

/**
 * Get a case by ID. Returns null if not found.
 */
export async function getCase(client, caseId) {
  const { data, error } = await client
    .from('case_completion')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Patch a case with version gating and idempotency.
 * Returns { ok, case, conflict } where conflict is set on version mismatch.
 */
export async function patchCase(client, caseId, { expectedVersion, fields, source, actor, idempotencyKey, brokerOnly }) {
  // Check idempotency first
  if (idempotencyKey) {
    const { data: existing } = await client
      .from('case_completion_audit')
      .select('*')
      .eq('case_id', caseId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) return { ok: true, replayed: true, version: existing.version };
  }

  // Read current state
  const current = await getCase(client, caseId);
  if (!current) throw new Error(`Case ${caseId} not found`);

  // Version check
  if (current.version !== expectedVersion) {
    return { ok: false, conflict: true, currentVersion: current.version, currentFields: current.fields };
  }

  // Merge fields with provenance
  const now = new Date().toISOString();
  const newFields = { ...current.fields };
  const diff = {};
  for (const [key, value] of Object.entries(fields || {})) {
    const old = newFields[key];
    newFields[key] = {
      value,
      source,
      confirmed_at: now,
      confirmed_by: actor,
    };
    diff[key] = { old: old?.value ?? null, new: value };
  }

  const newVersion = current.version + 1;
  const updates = {
    version: newVersion,
    fields: newFields,
    updated_at: now,
    updated_by: actor,
  };
  if (brokerOnly !== undefined) {
    updates.broker_only = { ...current.broker_only, ...brokerOnly };
  }

  // CAS write: update only if version still matches. Use .select() to get
  // the matched rows back — an empty array means the version was stale and
  // another writer won the race. Do NOT insert an audit row on a lost race.
  const { data: updated, error: updateError } = await client
    .from('case_completion')
    .update(updates)
    .eq('case_id', caseId)
    .eq('version', expectedVersion)
    .select('case_id');
  if (updateError) throw updateError;

  // Zero rows matched = version was stale (another writer incremented it
  // between our read and our write). Re-read and return 409.
  if (!updated || updated.length === 0) {
    const latest = await getCase(client, caseId);
    return { ok: false, conflict: true, currentVersion: latest?.version, currentFields: latest?.fields };
  }

  // Audit row — only after a confirmed successful CAS update
  const { error: auditError } = await client.from('case_completion_audit').insert({
    case_id: caseId,
    version: newVersion,
    actor,
    source,
    idempotency_key: idempotencyKey || null,
    diff,
  });
  if (auditError) throw new Error(`Audit write failed after successful CAS update: ${auditError.message}`);

  return { ok: true, version: newVersion };
}

/**
 * Resolve a token hash to a case_id. Returns null if not found or revoked.
 * Updates last_used_at.
 */
export async function resolveToken(client, tokenHash) {
  const { data, error } = await client
    .from('case_tokens')
    .select('case_id, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.revoked_at) return { revoked: true, case_id: data.case_id };

  // Update last_used_at
  await client
    .from('case_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  return { case_id: data.case_id };
}

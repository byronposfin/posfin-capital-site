import { readFileSync } from 'node:fs';
import { PRODUCTS, STAGE_CHECK } from './el-lor-config.js';

const FIXTURE_URL = new URL('../fixtures/el-lor-test-seed.json', import.meta.url);

const EMAIL = /^[^@\s]+@example\.invalid$/i;

export function readFixtureSeed() {
  return JSON.parse(readFileSync(FIXTURE_URL, 'utf8'));
}

function bad(path, message) {
  return { ok: false, error: `${path}: ${message}` };
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function validateSeed(input, { committed = false } = {}) {
  if (!isObject(input)) return bad('root', 'object');
  if (input.schema !== 'posfin.el-lor-seed/v1') return bad('schema', 'version');
  if (!Array.isArray(input.cases)) return bad('cases', 'array');
  const cases = [];
  for (let i = 0; i < input.cases.length; i += 1) {
    const row = input.cases[i];
    const path = `cases[${i}]`;
    if (!isObject(row)) return bad(path, 'object');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(String(row.case_ref || ''))) return bad(`${path}.case_ref`, 'shape');
    if (typeof row.is_test !== 'boolean') return bad(`${path}.is_test`, 'boolean');
    if (committed) {
      if (row.is_test !== true) return bad(`${path}.is_test`, 'fixtures are TEST only');
      if (!String(row.case_ref).startsWith('TEST-')) return bad(`${path}.case_ref`, 'TEST- prefix');
      if (!EMAIL.test(String(row.email || ''))) return bad(`${path}.email`, 'example.invalid');
      for (const signer of row.signatories || []) {
        if (!EMAIL.test(String(signer.email || ''))) return bad(`${path}.signatories`, 'example.invalid');
      }
    }
    if (!row.label || !row.stage || !row.db_stage || !row.owner) return bad(path, 'identity');
    if (!PRODUCTS.includes(row.product)) return bad(`${path}.product`, 'product');
    if (committed && !STAGE_CHECK.includes(row.db_stage)) return bad(`${path}.db_stage`, 'stage check');
    if (!Array.isArray(row.signatories) || !row.signatories.length) return bad(`${path}.signatories`, 'required');
    if (!isObject(row.money)) return bad(`${path}.money`, 'object');
    if (![row.money.gross, row.money.retentions, row.money.net_release].every((value) => Number.isFinite(Number(value)))) {
      return bad(`${path}.money`, 'numbers');
    }
    if (!Array.isArray(row.eligible_lenders) || !Array.isArray(row.lender_exclusions) || !Array.isArray(row.flags)) {
      return bad(path, 'lists');
    }
    if (!isObject(row.el) || !isObject(row.lor)) return bad(path, 'documents');
    cases.push(row);
  }
  return { ok: true, cases };
}

export async function loadSeed(env = process.env, fetchImpl = globalThis.fetch) {
  const fixture = validateSeed(readFixtureSeed(), { committed: true });
  if (!fixture.ok) return { cases: [], source: 'fixtures', warning: 'TEST fixtures failed their own schema.' };
  const url = String(env.EL_LOR_SEED_JSON_URL || '').trim();
  if (!url) {
    return { cases: fixture.cases, source: 'fixtures', warning: 'EL_LOR_SEED_JSON_URL is unset. TEST cases only.' };
  }
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(4000) });
    if (!response || !response.ok) {
      return { cases: fixture.cases, source: 'fixtures', warning: 'Seed URL failed. TEST cases only.' };
    }
    const json = await response.json();
    const remote = validateSeed(json, { committed: false });
    if (!remote.ok) {
      return { cases: fixture.cases, source: 'fixtures', warning: 'Seed failed schema. TEST cases only.' };
    }
    const seen = new Set(fixture.cases.map((row) => row.case_ref));
    const extra = remote.cases.filter((row) => !seen.has(row.case_ref));
    return { cases: fixture.cases.concat(extra), source: 'remote', warning: '' };
  } catch {
    return { cases: fixture.cases, source: 'fixtures', warning: 'Seed URL unreachable. TEST cases only.' };
  }
}

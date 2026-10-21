/**
 * Gap engine — "only ask what's missing"
 *
 * Takes a case_completion record and a field map, returns the next batch
 * of questions for the borrower. Broker-owned gaps are listed as blockers.
 *
 * Rules:
 * - Borrower-owned and null → becomes a question.
 * - Broker-owned and null → listed as a blocker. Never asked of the borrower.
 * - Conflict (two sources disagree) → shown to broker to resolve.
 * - Explicit 0/false/"no" → answered, not asked again.
 * - Any field not in an approved map → UNMAPPED.
 * - Batches: ≤ 6 questions, ordered by section priority.
 */

import mainBridging, { SECTIONS as MAIN_SECTIONS } from './field-maps/main-bridging.js';

const FIELD_MAPS = {
  main_loan: mainBridging,
  bank_bridge: mainBridging,
  speed_loan: mainBridging,
  equitable_charges: mainBridging,
  purchase_refurb: mainBridging,
  acquisition_finance: mainBridging,
  back_to_back: mainBridging,
  // Stubs — declared as UNMAPPED until approved field lists are provided
  development_finance: [],
  development_exit_finance: [],
  pa_land: [],
  trade_finance: [],
};

const BATCH_SIZE = 6;

/**
 * Determine if a field value counts as "answered" (not missing).
 * null = missing. undefined = missing. '' = missing.
 * 0 = answered. false = answered. 'no' = answered. '0' = answered.
 */
function isAnswered(fieldEntry) {
  if (!fieldEntry) return false;
  const v = fieldEntry.value;
  if (v === null || v === undefined || v === '') return false;
  return true;
}

/**
 * Check if two field entries conflict (different sources, different values).
 */
function hasConflict(fieldEntry) {
  if (!fieldEntry || !fieldEntry._conflict) return false;
  return true;
}

/**
 * Get the gap analysis for a case.
 *
 * @param {object} caseData - case_completion row (fields, sections, broker_only)
 * @param {string} product - product route key
 * @returns {{ batch, blockers, conflicts, unmapped, sections, progress }}
 */
export function analyseGaps(caseData, product) {
  const fieldMap = FIELD_MAPS[product];
  if (!fieldMap || fieldMap.length === 0) {
    return {
      batch: [],
      blockers: [],
      conflicts: [],
      unmapped: [`Product "${product}" has no approved field map. All fields are UNMAPPED.`],
      sections: {},
      progress: { total: 0, answered: 0, pct: 0 },
    };
  }

  const fields = caseData.fields || {};
  const borrowerQuestions = [];
  const brokerBlockers = [];
  const conflicts = [];
  const unmapped = [];

  let total = 0;
  let answered = 0;
  const sectionStatus = {};

  for (const field of fieldMap) {
    if (field.owner === 'broker') {
      // Broker-owned: check if missing → blocker
      const entry = fields[field.key];
      if (!isAnswered(entry)) {
        brokerBlockers.push({ key: field.key, label: field.label, section: field.section });
      }
      continue;
    }

    total++;
    const entry = fields[field.key];

    if (hasConflict(entry)) {
      conflicts.push({ key: field.key, label: field.label, section: field.section, entry });
      continue;
    }

    if (isAnswered(entry)) {
      answered++;
      continue;
    }

    // Borrower-owned and null → question
    borrowerQuestions.push(field);
  }

  // Sort by priority (lower = first) then stable order
  borrowerQuestions.sort((a, b) => a.priority - b.priority);

  // Compute section statuses
  for (const section of (MAIN_SECTIONS || [])) {
    const sectionFields = fieldMap.filter(f => f.section === section && f.owner === 'borrower');
    const sectionAnswered = sectionFields.filter(f => isAnswered(fields[f.key])).length;
    const sectionTotal = sectionFields.length;
    if (sectionTotal === 0) continue;
    sectionStatus[section] = {
      status: sectionAnswered === sectionTotal ? 'complete' : sectionAnswered > 0 ? 'in_progress' : 'not_started',
      total: sectionTotal,
      answered: sectionAnswered,
    };
  }

  // Check for fields in the case that aren't in the map
  for (const key of Object.keys(fields)) {
    if (!fieldMap.some(f => f.key === key)) {
      unmapped.push(key);
    }
  }

  return {
    batch: borrowerQuestions.slice(0, BATCH_SIZE),
    remaining: borrowerQuestions.length - Math.min(BATCH_SIZE, borrowerQuestions.length),
    blockers: brokerBlockers,
    conflicts,
    unmapped,
    sections: sectionStatus,
    progress: {
      total,
      answered,
      pct: total > 0 ? Math.round((answered / total) * 100) : 0,
    },
  };
}

/**
 * Get the borrower-allowed field keys for a product.
 * Used to filter PATCH requests — only borrower-owned fields accepted.
 */
export function borrowerAllowlist(product) {
  const fieldMap = FIELD_MAPS[product] || [];
  return new Set(fieldMap.filter(f => f.owner === 'borrower').map(f => f.key));
}

export { FIELD_MAPS };

import { readFileSync } from 'node:fs';

const FILE = new URL('../data/flow/cases.fixture.json', import.meta.url);

export const FLOW_STAGES = [
  ['lead', 'Lead in'],
  ['fact_find', 'Fact find'],
  ['qualified', 'Qualified'],
  ['lender_match', 'Lender match'],
  ['lor', 'LOR'],
  ['sent', 'Sent to lender'],
  ['offer', 'Offer/EL'],
  ['legals', 'Legals'],
  ['completed', 'Completed'],
];

let cached = null;

export function loadFlowCases() {
  if (cached) return cached;
  const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
  cached = parsed.cases.map((item) => ({ ...item, existing_charges: item.existing_charges || [], comparables: item.comparables || [] }));
  return cached;
}

export function resetFlowCaseCache() {
  cached = null;
}

export function listCases() {
  return loadFlowCases();
}

export function getCase(ref) {
  const key = String(ref || '').trim();
  return loadFlowCases().find((item) => item.ref === key) || null;
}

export function matchInput(flowCase) {
  return {
    property_value: flowCase.property_value,
    existing_charges: (flowCase.existing_charges || []).map((item) => ({ holder: item.holder, balance: item.balance })),
    net_ask: flowCase.net_ask,
    charge_type: flowCase.charge_type,
    regulated: flowCase.regulated === true,
    product_type: flowCase.product_type,
  };
}

export function stageCounts(cases = loadFlowCases()) {
  const counts = Object.fromEntries(FLOW_STAGES.map(([id]) => [id, 0]));
  for (const item of cases) {
    if (counts[item.stage] != null) counts[item.stage] += 1;
  }
  return FLOW_STAGES.map(([id, label]) => ({ id, label, count: counts[id] }));
}

export function pounds(value) {
  const number = Math.round(Number(value) || 0);
  const sign = number < 0 ? '-' : '';
  const body = Math.abs(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}£${body}`;
}

export function versionLabel(flowCase) {
  const version = Number(flowCase.figures_version) || 1;
  return `v${String(version).padStart(3, '0')}`;
}

export function lenderSlug(name) {
  const slug = String(name || 'lender')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (slug || 'lender').slice(0, 48);
}

export function chargePhrase(flowCase) {
  return flowCase.charge_type === 'second' ? 'second charge' : 'first charge';
}

export function netHeadline(flowCase) {
  return `Looking for ${pounds(flowCase.net_ask)} net, ${chargePhrase(flowCase)}, ${flowCase.term}, subject to status`;
}

export function feeAmounts(flowCase) {
  const gross = Number(flowCase.indicative_gross) || 0;
  const pct = (rate) => Math.round(gross * (Number(rate) || 0)) / 100;
  return {
    gross,
    broker: pct(flowCase.broker_fee_pct),
    success: pct(flowCase.success_fee_pct),
    procuration: pct(flowCase.procuration_fee_pct),
  };
}

export function fundingStack(flowCase) {
  const redemptions = (flowCase.existing_charges || []).filter((item) => item.mandatory);
  const redemptionTotal = redemptions.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
  const subtotal = (Number(flowCase.net_ask) || 0) + redemptionTotal;
  const legals = Number(flowCase.legals) || 0;
  const buffer = Number(flowCase.buffer) || 0;
  return {
    redemptions,
    subtotal,
    legals,
    buffer,
    netRequired: subtotal + legals + buffer,
  };
}

export function existingBalance(flowCase) {
  return (flowCase.existing_charges || []).reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
}

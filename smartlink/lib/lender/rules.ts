/**
 * Decline-feedback loop: live-deal declines become PROPOSED rule changes on a lender's PLACED profile.
 * Nothing changes PLACED until a human approves with evidence (Byron's rule):
 *   1. verify against current written criteria OR a confirmed BDM response,
 *   2. record the source and its date,
 *   3. approve (reviewer) — and, per the v003 operating handover, a second human before it goes live.
 * Old rule versions are kept with effective dates; nothing is deleted.
 */
import { DECLINE_REASONS } from "./catalog";

export type EvidenceType = "written_criteria" | "bdm_confirmed" | "none";
export type ProposalStatus = "proposed" | "evidence_attached" | "approved" | "active" | "rejected" | "superseded";

export interface LenderDecline {
  lender_id: string;
  case_ref: string;
  product_key?: string;
  reason_keys: string[]; // DECLINE_REASONS keys
  quote: string; // the lender's own words
  received_at: string; // ISO
  channel: "email" | "phone" | "portal" | "whatsapp" | "other";
  /** Case facts that triggered the decline, e.g. { ltv: 72, asset: "hmo_large", hair: ["ccj_recent"] } */
  facts: { ltv?: number; loan?: number; asset?: string; hair?: string[]; region?: string; term_months?: number };
  logged_by: string;
}

export interface RuleProposal {
  id: string;
  lender_id: string;
  rule_path: string; // e.g. "product.bridge_resi.ltv.HMO / MUFB.1st charge" | "hair.ccj_recent" | "asset.hmo_large"
  current_value: string | null;
  proposed_value: string;
  rationale: string;
  trigger: { kind: "decline" | "case_study" | "sheet_conflict" | "bdm_update"; case_ref?: string; quote?: string; received_at: string };
  evidence: { type: EvidenceType; source_ref?: string; source_date?: string; captured_by?: string };
  status: ProposalStatus;
  proposed_by: string;
  reviewer?: string;
  reviewed_at?: string;
  second_approver?: string;
  approved_at?: string;
  effective_from?: string;
  version?: number;
  supersedes?: string;
}

/** Turn a decline into draft proposals. Capacity declines create none. */
export function proposalsFromDecline(d: LenderDecline, current: (path: string) => string | null, newId: () => string): RuleProposal[] {
  const out: RuleProposal[] = [];
  const base = (rule_path: string, proposed_value: string, rationale: string): RuleProposal => ({
    id: newId(), lender_id: d.lender_id, rule_path, current_value: current(rule_path), proposed_value, rationale,
    trigger: { kind: "decline", case_ref: d.case_ref, quote: d.quote, received_at: d.received_at },
    evidence: { type: "none" }, status: "proposed", proposed_by: d.logged_by,
  });
  for (const r of d.reason_keys) {
    if (!DECLINE_REASONS.some((x) => x.key === r)) continue;
    if (r === "capacity") continue;
    if (r === "ltv" && d.product_key && d.facts.ltv !== undefined)
      out.push(base(`product.${d.product_key}.max_ltv`, `< ${d.facts.ltv}%`, `Declined at ${d.facts.ltv}% LTV`));
    else if (r === "asset" && d.facts.asset) out.push(base(`asset.${d.facts.asset}`, "Decline", "Declined on asset type"));
    else if ((r === "credit" || r === "borrower" || r === "structure") && d.facts.hair?.length)
      for (const h of d.facts.hair) out.push(base(`hair.${h}`, "Decline", `Declined: ${r}`));
    else if (r === "location" && d.facts.region) out.push(base("profile.regions", `exclude ${d.facts.region}`, "Declined on location"));
    else if (r === "loan_size" && d.product_key && d.facts.loan !== undefined) out.push(base(`product.${d.product_key}.loan_range`, `exclude £${d.facts.loan}`, "Declined on loan size"));
    else if (r === "term" && d.product_key && d.facts.term_months !== undefined) out.push(base(`product.${d.product_key}.term_max`, `< ${d.facts.term_months}`, "Declined on term"));
    else out.push(base(`manual.${r}`, "review", `Decline reason "${r}" needs a manual rule`));
  }
  return out;
}

export function attachEvidence(p: RuleProposal, e: { type: Exclude<EvidenceType, "none">; source_ref: string; source_date: string; captured_by: string }): RuleProposal {
  return { ...p, evidence: e, status: "evidence_attached" };
}

export interface ApprovalPolicy { requireSecondApprover: boolean }
export const DEFAULT_POLICY: ApprovalPolicy = { requireSecondApprover: true };

/** Returns the reasons a proposal cannot be approved yet (empty = OK). */
export function approvalBlockers(p: RuleProposal, reviewer: string, policy: ApprovalPolicy = DEFAULT_POLICY, secondApprover?: string): string[] {
  const b: string[] = [];
  if (p.evidence.type === "none") b.push("No evidence: attach current written criteria or a confirmed BDM response.");
  if (!p.evidence.source_ref) b.push("Evidence source is not recorded.");
  if (!p.evidence.source_date || Number.isNaN(Date.parse(p.evidence.source_date))) b.push("Evidence date is not recorded.");
  if (!reviewer) b.push("A named reviewer is required.");
  if (policy.requireSecondApprover) {
    if (!secondApprover) b.push("A second human approver is required before the rule goes live.");
    else if (secondApprover === reviewer) b.push("The second approver must be a different person.");
  }
  if (p.status === "rejected" || p.status === "superseded") b.push(`Proposal is ${p.status}.`);
  return b;
}

export function approve(p: RuleProposal, reviewer: string, at: string, policy: ApprovalPolicy = DEFAULT_POLICY, secondApprover?: string, version = 1): RuleProposal {
  const blockers = approvalBlockers(p, reviewer, policy, secondApprover);
  if (blockers.length) throw new Error(blockers.join(" "));
  return { ...p, status: "approved", reviewer, reviewed_at: at, second_approver: secondApprover, approved_at: at, effective_from: at, version };
}

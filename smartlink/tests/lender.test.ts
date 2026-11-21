import { describe, expect, it } from "vitest";
import { evalCond } from "@/lib/engine/conditions";
import { flattenAnswers } from "@/lib/engine/flatten";
import { lenderSchema } from "@/lib/forms/lender";
import { DEMO_LENDER } from "@/lib/demo";
import { buildLender, gapCheck, placedProductRows } from "@/lib/lender/summary";
import { approvalBlockers, approve, attachEvidence, proposalsFromDecline, type LenderDecline } from "@/lib/lender/rules";

const ctx = { flags: {} };
let n = 0;
const id = () => `p${++n}`;
const decline = (reason_keys: string[]): LenderDecline => ({
  lender_id: "L1", case_ref: "PC-TEST", product_key: "bridge_resi", reason_keys, quote: "Too high", received_at: "2026-11-19T10:00:00Z",
  channel: "email", facts: { ltv: 72, asset: "hmo_large", hair: ["ccj_recent"] }, logged_by: "staff_a",
});

describe("lender gap check", () => {
  const g = gapCheck(DEMO_LENDER);
  it("flags guide/form conflicts and guide-only values", () => {
    expect(g.conflicts).toBeGreaterThanOrEqual(2);
    expect(g.fromGuide).toBeGreaterThanOrEqual(1);
    expect(g.items.some((i) => i.status === "conflict" && /term_max/.test(i.path))).toBe(true);
  });
  it("blank form is all missing, no conflicts", () => {
    const b = gapCheck({});
    expect(b.conflicts).toBe(0);
    expect(b.missing).toBeGreaterThan(0);
  });
});

describe("engine additions", () => {
  it("includes condition works on multi-selects", () => {
    expect(evalCond({ field: "x", includes: "Mezzanine" } as never, { x: ["Bridging", "Mezzanine"] }, ctx)).toBe(true);
    expect(evalCond({ field: "x", includes: "Mezzanine" } as never, { x: ["Bridging"] }, ctx)).toBe(false);
  });
  it("flattens grid cells to <id>__row__col keys", () => {
    const flat = flattenAnswers(lenderSchema, DEMO_LENDER, ctx);
    expect(Object.keys(flat).some((k) => /^p_bridge_resi_ltv__.+__.+/.test(k))).toBe(true);
  });
});

describe("decline-feedback loop", () => {
  it("capacity declines create no proposal", () => {
    expect(proposalsFromDecline(decline(["capacity"]), () => null, id)).toHaveLength(0);
  });
  it("LTV decline creates a proposal that cannot be approved without evidence and two people", () => {
    const [p] = proposalsFromDecline(decline(["ltv"]), () => "75%", id);
    expect(p.status).toBe("proposed");
    expect(p.rule_path).toBe("product.bridge_resi.max_ltv");
    expect(approvalBlockers(p, "rev_a", undefined, "rev_b").length).toBeGreaterThan(0);
    expect(() => approve(p, "rev_a", "2026-11-19")).toThrow();
    const withEv = attachEvidence(p, { type: "bdm_confirmed", source_ref: "email 19 Nov from BDM", source_date: "2026-11-19", captured_by: "staff_a" });
    expect(approvalBlockers(withEv, "rev_a", undefined, "rev_a")).toContain("The second approver must be a different person.");
    expect(approve(withEv, "rev_a", "2026-11-19", undefined, "rev_b").status).toBe("approved");
  });
});

describe("PLACED export", () => {
  it("rows use the PLACED research columns and stay unverified", () => {
    const rows = placedProductRows(buildLender(DEMO_LENDER), { lender_id: "TEST", checked_date: "2026-11-19" });
    expect(rows.length).toBe(6);
    for (const k of ["research_lender_id", "lender", "product", "max_ltv_first", "max_ltv_second", "ltv_basis"]) expect(rows[0]).toHaveProperty(k);
  });
  it("partnership carries both investment routes", () => {
    const pt = buildLender(DEMO_LENDER).partnership;
    expect(pt.loan_notes.appetite).toBe("Yes, interested");
    expect(pt.pref_shares.response).toBe("Yes, with a variation");
    expect(pt.pref_shares.illustrative).toMatch(/75\/25/);
  });
});

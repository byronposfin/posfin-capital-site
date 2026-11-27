import { describe, expect, it } from "vitest";
import { COST_LINES } from "@/lib/costs";
import { demoEnvelope } from "@/lib/demo";
import { buildBorrowerPortal, serializeBorrowerPayload, valuationRoute } from "@/lib/portal-data";
import { progressPct } from "@/lib/tasks";

const options = {
  vertical: "posfin-capital",
  mode: "live" as const,
  example: false,
  now: new Date("2026-11-26T12:00:00.000Z"),
};

describe("server-side fee stripping", () => {
  it("drops broker fees, proc fees, BROKA and charge jargon before serialization", () => {
    const json = serializeBorrowerPayload(
      {
        borrower_name: "Sam Example",
        case_ref: "PF-100",
        deck_ready: true,
        updated_at: "2026-11-26T12:00:00.000Z",
        source: {
          property: { address: "1 Example Street", summary: "Noted for BROKA on a 2nd charge." },
          loan: { amount: 250000, purpose: "Works", term_months: 12, regulated: false },
          valuation: { avm: 500000, works: "none" },
          broker_fee: 424242,
          broker_fee_pct: 2,
          proc_fee: 131313,
          procuration_fee: 999001,
          commission_amount: 777001,
          commission_split: { broker: 70, lender: 30 },
          success_fee_amount: 888001,
          introducer_fee: 555001,
          broka: "BROKA",
          broka_ref: "B-9",
          staff_notes: "internal staff note stays hidden",
          charge_rank: "1st charge",
          notes: "Place as a 1st/2nd charge with BROKA",
          lenders: [
            {
              name: "Example Lender",
              headline: "From 0.9% per month",
              term: "12 months",
              note: "BROKA 1st charge. Broker fee £15,000 (2%).",
              proc_fee: "1%",
              broker_fee: 424242,
            },
          ],
        },
        register: {
          broker_fee_pct: 3,
          gross_facility: 250000,
          external_refs: { broka: "BROKA", fee_owed_gbp: 424242 },
          stage: "placement",
        },
      },
      options,
    );

    expect(json).not.toMatch(/\bBROKA\b/);
    expect(json).not.toMatch(/\b(?:1st|2nd)\s+charge\b/i);
    expect(json).not.toMatch(/\b1st\s*\/\s*2nd\s+charge\b/i);
    expect(json).not.toMatch(/\bproc(?:uration)?(?:[\s_-]*fees?)?\b/i);
    expect(json).not.toMatch(/\bbroker[\s_-]*fees?\b/i);
    expect(json).not.toMatch(/\bcommissions?\b/i);
    expect(json).not.toMatch(/\bsuccess[\s_-]*fees?\b/i);
    expect(json).not.toMatch(/"broker_fee"|"proc_fee"|"broka"|"charge_rank"|"staff_notes"/i);
    expect(json).not.toContain("424242");
    expect(json).not.toContain("131313");
    expect(json).not.toContain("999001");
    expect(json).not.toContain("777001");
    expect(json).not.toContain("888001");
    expect(json).not.toContain("555001");
    expect(json).not.toContain("internal staff note");
    expect(json).toContain("existing mortgage");
    expect(json).toContain("Example Lender");
    expect(json).toContain("£250,000");
    expect(json).toContain("0.9%");
    expect(json).not.toContain("15,000");
    expect(json).not.toContain("2%");

    const portal = JSON.parse(json);
    expect(portal.deckReady).toBe(true);
    expect(portal.progressPct).toBeGreaterThanOrEqual(0);
    expect(portal.progressPct).toBeLessThanOrEqual(100);
    expect(portal.solicitor).toBeNull();
  });

  it("keeps an ordinary valuation figure and drops amounts that sat next to a fee", () => {
    const json = serializeBorrowerPayload(
      {
        borrower_name: "Sam Example",
        case_ref: "PF-200",
        deck_ready: false,
        source: {
          property: { address: "2 Example Street", summary: "Estimated at £123,456." },
          loan: { amount: 100000, purpose: "Purchase", term_months: 12, regulated: false },
          valuation: { avm: 200000, works: "none" },
          lenders: [{ name: "Example Lender", headline: "From 0.9% per month", term: "12 months", note: "Proc fee 1 percent, 15000, 15,000 and 15k." }],
        },
      },
      options,
    );
    expect(json).toContain("£123,456");
    expect(json).toContain("0.9%");
    expect(json).not.toContain("15000");
    expect(json).not.toContain("15,000");
    expect(json).not.toContain("15k");
    expect(json).not.toContain("1 percent");
    expect(json).not.toMatch(/\bproc/i);
  });

  it("keeps example decks labelled and free of internal fields", () => {
    for (const vertical of ["posfin-capital", "placed"]) {
      const portal = buildBorrowerPortal(demoEnvelope(vertical), {
        vertical,
        mode: "demo",
        example: true,
        now: new Date("2026-11-26T12:00:00.000Z"),
      });
      const json = JSON.stringify(portal);
      expect(portal.example).toBe(true);
      expect(portal.deckReady).toBe(true);
      expect(portal.borrowerName).toMatch(/Example/);
      expect(json).not.toMatch(/\bBROKA\b/);
      expect(json).not.toMatch(/\b(?:1st|2nd)\s+charge\b/i);
      expect(progressPct(portal.tasks)).toBe(portal.progressPct);
    }
  });

  it("chooses AVM or a full valuation from loan-to-value and works", () => {
    expect(valuationRoute(50, "light")).toBe("avm");
    expect(valuationRoute(72, "light")).toBe("full");
    expect(valuationRoute(40, "heavy")).toBe("full");
    expect(valuationRoute(40, "build")).toBe("full");
  });
});

describe("borrower cost copy", () => {
  it("states the discontinued upfront fee and the processing costs without internal jargon", () => {
    const text = COST_LINES.map((line) => `${line.title} ${line.body}`).join("\n");
    expect(text).toMatch(/No upfront broker fees/);
    expect(text).toMatch(/£500/);
    expect(text).toMatch(/Front Runner/);
    expect(text).toMatch(/£26k–£100k/);
    expect(text).toMatch(/£1,560/);
    expect(text).toMatch(/SOMO/);
    expect(text).toMatch(/£700/);
    expect(text).toMatch(/Gateway/);
    expect(text).not.toMatch(/\bBROKA\b/);
    expect(text).not.toMatch(/\b(?:1st|2nd)\s+charge\b/i);
    expect(text).not.toMatch(/\bproc(?:uration)?(?:[\s_-]*fees?)?\b/i);
  });
});

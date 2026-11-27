/** Fictional cases. Every name, address and figure is an example. */

const POSFIN_DEMO = {
  case_ref: "EXAMPLE-PC",
  borrower_name: "Alex Example",
  deck_ready: true,
  updated_at: "2026-11-26T18:00:00.000Z",
  borrower_state: {},
  source: {
    property: {
      address: "18 Example Gardens, Highgate, London",
      postcode: "EX4 1MP",
      type: "Detached house",
      beds: "5",
      tenure: "Freehold",
      summary:
        "An example detached house. The owners do not live there. A light kitchen and bathroom refresh is planned. Every figure on this page is fictional.",
    },
    loan: {
      amount: 725000,
      purpose: "Refinance an existing mortgage and a light refurbishment",
      term_months: 12,
      regulated: false,
    },
    valuation: { avm: 1450000, estimate: 1450000, works: "light" },
    ltv_pct: 50,
    redemption: { amount: 410000, as_of: "20 Nov 2026" },
    tasks: {
      fact_find: "done",
      kyc: "current",
      solicitor: "todo",
      valuation: "done",
      terms: "todo",
      legals: "todo",
      completion: "todo",
    },
    timeline: [
      { id: "enquiry", label: "Enquiry received", detail: "12 Nov 2026", state: "done" },
      { id: "fact_find", label: "Fact find", detail: "14 Nov 2026", state: "done" },
      { id: "avm", label: "Automated valuation", detail: "£1,450,000", state: "done" },
      { id: "deck", label: "Deck prepared", detail: "Ready for lender placement", state: "done" },
      { id: "completion", label: "Target completion", detail: "18 Dec 2026", state: "current" },
    ],
    lenders: [
      {
        name: "Specialist bridging lender",
        headline: "From 0.85% per month",
        term: "12 months",
        note: "An automated valuation is usually accepted at this loan-to-value. Illustrative only.",
      },
      {
        name: "Refurbishment lender",
        headline: "Terms follow the works",
        term: "12 months",
        note: "Light works can stay on an automated valuation. Illustrative only.",
      },
    ],
  },
};

const PLACED_DEMO = {
  case_ref: "EXAMPLE-PL",
  borrower_name: "Jordan Example",
  deck_ready: true,
  updated_at: "2026-11-26T18:00:00.000Z",
  borrower_state: {
    kyc: {
      photo_id: { done: true, filename: "example-passport.pdf" },
      proof_of_address: { done: true, filename: "example-council-tax.pdf" },
    },
  },
  source: {
    property: {
      address: "4 Example Wharf, Manchester",
      postcode: "M0 0EX",
      type: "Apartment",
      beds: "2",
      tenure: "Leasehold",
      summary:
        "An example home the buyer would live in, with a single-storey extension. Every figure on this page is fictional.",
    },
    loan: {
      amount: 540000,
      purpose: "Buy a home and build an extension",
      term_months: 18,
      regulated: true,
    },
    valuation: { avm: 750000, estimate: 750000, works: "heavy" },
    tasks: {
      fact_find: "done",
      kyc: "done",
      solicitor: "current",
      valuation: "todo",
      terms: "todo",
      legals: "todo",
      completion: "todo",
    },
    timeline: [
      { id: "enquiry", label: "Enquiry received", detail: "20 Nov 2026", state: "done" },
      { id: "fact_find", label: "Fact find", detail: "22 Nov 2026", state: "done" },
      { id: "kyc", label: "Identity check", detail: "Example documents", state: "done" },
      { id: "valuation", label: "Full valuation", detail: "To be instructed", state: "current" },
      { id: "completion", label: "Target completion", detail: "To be agreed", state: "todo" },
    ],
    lenders: [
      {
        name: "Homeowner bridge",
        headline: "From 0.95% per month",
        term: "Up to 18 months",
        note: "A full valuation is needed because of the works and the loan-to-value. Illustrative only.",
      },
      {
        name: "Specialist lender",
        headline: "Headline terms once the valuation returns",
        term: "12 to 18 months",
        note: "Illustrative only. A lender decides after assessment.",
      },
    ],
  },
};

export function demoEnvelope(vertical: string): Record<string, unknown> {
  const source = vertical === "placed" ? PLACED_DEMO : POSFIN_DEMO;
  return structuredClone(source) as Record<string, unknown>;
}

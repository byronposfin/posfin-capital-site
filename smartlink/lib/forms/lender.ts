import type { Field, FormSchema, Node, Step } from "@/lib/engine/types";
import { ASSETS, BORROWER_TYPES, CASE_STUDIES, FAMILY_LABEL, HAIR, LENDER_TYPES, PRODUCTS, REGIONS, type ProductDef } from "@/lib/lender/catalog";

/**
 * LENDER CRITERIA intake — the reverse of the borrower fact-find.
 * White-label: copy never names the broker brand (brand chrome comes from lib/brands.ts) and never names
 * other lenders. Title insurance is deliberately one neutral option among several legal questions.
 */
const H = (id: string, title: string, body = ""): Node => ({ kind: "notice", id, tone: "heading", title, body });
const tol = (id: string, label: string, help?: string): Field => ({ id, label, type: "tolerance", help, options: ["Accept", "Case by case", "Decline"] });

/** Products that carry rollover / extension questions: everything short-term (not term loans or equity). */
export const hasRollover = (p: ProductDef) => !p.equity && p.family !== "term";

export function productFields(p: ProductDef): Node[] {
  const k = (s: string) => `p_${p.key}_${s}`;
  const nodes: Node[] = [];
  nodes.push(H(k("h_size"), "Size & leverage"));
  nodes.push({ id: k("min_loan"), label: p.equity ? "Minimum ticket" : "Minimum loan", type: "money", half: true });
  nodes.push({ id: k("max_loan"), label: p.equity ? "Maximum ticket" : "Maximum loan", type: "money", half: true, required: true });
  if (p.charges.length > 1) nodes.push({ id: k("charges"), label: "Positions you take", type: "multi", options: p.charges });
  if (p.equity) {
    nodes.push({ id: k("min_sponsor_equity"), label: "Minimum sponsor equity (% of costs)", type: "percent", half: true });
    nodes.push({ id: k("max_cost_pct"), label: "Max share of total costs you fund", type: "percent", half: true });
    nodes.push({ id: k("profit_share"), label: "Typical profit share", type: "percent", half: true });
    nodes.push({ id: k("pref_return"), label: "Preferred return (if any, % p.a.)", type: "percent", half: true });
    nodes.push({ id: k("ltv"), label: "Max total leverage including senior debt", type: "grid", rows: p.ltvRows, cols: ["LTV", "LTGDV"], unit: "%", placeholder: "Asset" });
  } else if (p.subordinate) {
    nodes.push({ id: k("ltv"), label: "Maximum leverage, including the senior loan", type: "grid", rows: p.ltvRows, cols: ["Total LTV", "Total LTGDV", "Senior max"], unit: "%", placeholder: "Scheme", help: "Senior max = the most senior debt you'll sit behind." });
    nodes.push({ id: k("intercreditor"), label: "Intercreditor / deed of priority", type: "choice", options: ["Will agree with any senior lender", "Approved senior lenders only", "Case by case"] });
  } else if (p.dev) {
    nodes.push({ id: k("ltv"), label: "Maximum leverage", type: "grid", rows: p.ltvRows, cols: ["Day 1", "LTGDV", "LTC"], unit: "%", placeholder: "Scheme" });
  } else {
    nodes.push({ id: k("ltv"), label: "Maximum LTV by asset type and charge", type: "grid", rows: p.ltvRows, cols: p.charges.filter((c) => /charge/.test(c)), unit: "%", placeholder: "Asset", help: "Leave a cell blank if you don’t offer it." });
  }
  if (!p.equity) nodes.push({ id: k("ltv_basis"), label: "LTV basis", type: "choice", options: ["Gross", "Net", "Either"], half: true });
  if (p.family === "specialist") nodes.push({ id: k("value_basis"), label: "Valuation basis", type: "choice", options: ["Bricks & mortar", "Trading (going concern)", "Either"], half: true });
  if (p.works) {
    nodes.push(H(k("h_works"), "Works funding"));
    nodes.push({ id: k("works_funding"), label: "How are works funded?", type: "choice", options: ["Day 1", "In arrears (drawdowns)", "Either"] });
    nodes.push({ id: k("works_max_pct"), label: "Works funded up to (% of cost)", type: "percent", half: true });
    nodes.push({ id: k("min_experience"), label: "Experience needed", type: "choice", options: ["None", "1+ similar project", "3+ similar projects", "Case by case"], half: true });
  }

  nodes.push(H(k("h_term"), "Term & early repayment"));
  nodes.push({ id: k("term_min"), label: "Minimum term (months)", type: "number", half: true });
  nodes.push({ id: k("term_max"), label: "Maximum term (months)", type: "number", half: true });
  if (!p.equity) {
    nodes.push({ id: k("min_interest_type"), label: "Minimum interest period", type: "choice", options: ["None — interest for days used only", "A fixed number of months", "A percentage of the term"] });
    nodes.push({ id: k("min_interest_months"), label: "Minimum interest (months)", type: "number", half: true, when: { field: k("min_interest_type"), equals: "A fixed number of months" } });
    nodes.push({ id: k("min_interest_pct"), label: "Minimum interest (% of term)", type: "percent", half: true, help: "e.g. 50% = 6 months on a 12-month loan", when: { field: k("min_interest_type"), equals: "A percentage of the term" } });
    nodes.push({ id: k("exit_after_months"), label: "Can repay in full any time after (months)", type: "number", half: true, placeholder: "e.g. 1" });
    nodes.push({ id: k("interest_time_used"), label: "On early repayment, is interest charged only for the time used?", type: "yes_no", help: "i.e. unused retained interest is refunded." });
    nodes.push({ id: k("erc"), label: "Early repayment charges", type: "choice", options: ["No ERCs", "ERCs apply"], half: true });
    nodes.push({ id: k("erc_detail"), label: "ERC detail", type: "text", placeholder: "e.g. 1% in months 1–3", when: { field: k("erc"), equals: "ERCs apply" } });

    nodes.push(H(k("h_price"), "Pricing"));
    nodes.push({ id: k("rate_from"), label: "Rate from", type: "percent", half: true, placeholder: "0.75" });
    nodes.push({ id: k("rate_to"), label: "Rate to", type: "percent", half: true, placeholder: "1.25" });
    nodes.push({ id: k("rate_basis"), label: "Rate quoted", type: "choice", options: ["Per month", "Per annum"], half: true });
    nodes.push({ id: k("arrangement_fee"), label: "Arrangement fee", type: "percent", half: true, placeholder: "2" });
    nodes.push({ id: k("interest_options"), label: "Interest options", type: "multi", options: ["Retained", "Rolled up", "Serviced", "Part-serviced"] });
    nodes.push({ id: k("exit_fee"), label: "Exit fee", type: "percent", half: true, advanced: true });
    nodes.push({ id: k("proc_fee"), label: "Broker commission (proc fee)", type: "percent", half: true, advanced: true });
    nodes.push({ id: k("other_fees"), label: "Other fees (admin, legal, monitoring)", type: "text", advanced: true });
  }

  if (hasRollover(p)) {
    nodes.push(H(k("h_roll"), "Rollovers & extensions", "When a loan nears the end of its term."));
    nodes.push({ id: k("roll_offered"), label: "Do you offer rollovers or term extensions?", type: "choice", options: ["Yes", "Case by case", "No"] });
    const on = { field: k("roll_offered"), in: ["Yes", "Case by case"] };
    nodes.push({ id: k("roll_max_ltv"), label: "Max LTV to qualify", type: "percent", half: true, placeholder: "70", when: on });
    nodes.push({ id: k("roll_max_count"), label: "Max number of rollovers", type: "number", half: true, when: on });
    nodes.push({ id: k("roll_paydown"), label: "Will you accept a capital paydown to bring the LTV back within limits?", type: "yes_no", when: on });
    nodes.push({ id: k("roll_reretain"), label: "Can interest be retained again for the new period?", type: "yes_no_unsure", help: "e.g. another 6 months retained", when: on });
    nodes.push({ id: k("roll_fee"), label: "Fee on extension", type: "choice", options: ["Extension fee", "New arrangement fee", "No fee", "Case by case"], when: on });
    nodes.push({ id: k("roll_fee_pct"), label: "Fee (%)", type: "percent", half: true, when: { field: k("roll_fee"), in: ["Extension fee", "New arrangement fee"] } });
    nodes.push({ id: k("roll_reval"), label: "Fresh valuation needed?", type: "choice", options: ["Always", "Sometimes", "No"], half: true, when: on });
  }
  nodes.push({ id: k("notes"), label: "Anything else about this product?", type: "textarea", advanced: true });
  return nodes;
}

function productStep(p: ProductDef): Step {
  return {
    id: `prod_${p.key}`,
    title: p.label,
    kicker: FAMILY_LABEL[p.family],
    badge: `Product card · ${FAMILY_LABEL[p.family]}`,
    description: "Your headline terms. Blank is fine where it doesn’t apply — we’ll read the rest from your guide.",
    when: { field: "products", includes: p.label },
    nodes: productFields(p),
  };
}

function grouped<T extends { key: string; label: string; group: string; help?: string }>(rows: T[], prefix: string, groups?: string[]): Node[] {
  const out: Node[] = [];
  const gs = groups ?? [...new Set(rows.map((r) => r.group))];
  for (const g of gs) {
    out.push(H(`${prefix}h_${g.replace(/\W+/g, "_").toLowerCase()}`, g));
    for (const r of rows.filter((x) => x.group === g)) out.push(tol(`${prefix}${r.key}`, r.label, r.help));
  }
  return out;
}

const caseNodes = (from: number, to: number): Node[] =>
  CASE_STUDIES.slice(from, to).flatMap((c): Node[] => [
    { kind: "notice", id: `cs_card_${c.key}`, tone: "case", title: `${c.title} · ${c.tag}`, body: c.body, facts: c.facts },
    { id: `cs_${c.key}`, label: "Would you do this deal?", type: "tolerance", options: ["Yes", "Maybe", "No"], tones: ["good", "mid", "bad"] },
  ]);

export const LENDER_STEP_IDS = { guide: "guide", readback: "readback" } as const;

export const lenderSchema: FormSchema = {
  id: "lender",
  title: "Lender criteria",
  steps: [
    {
      id: "about", title: "About you", kicker: "Profile",
      description: "Who you are and who we should speak to.",
      nodes: [
        { id: "lender_name", label: "Lender name", type: "text", required: true, placeholder: "Registered or trading name" },
        { id: "lender_type", label: "What kind of lender are you?", type: "choice", options: LENDER_TYPES, required: true },
        { id: "website", label: "Website", type: "text", placeholder: "www.", half: true },
        { id: "nacfb_patron", label: "NACFB patron?", type: "yes_no_unsure", half: true },
        { id: "fca_regulated", label: "Authorised for regulated mortgage lending?", type: "yes_no" },
        H("h_contact", "Your details"),
        { id: "contact_name", label: "Your name", type: "text", required: true, half: true },
        { id: "contact_role", label: "Role", type: "text", half: true },
        { id: "contact_email", label: "Email", type: "email", required: true },
        { id: "contact_phone", label: "Phone", type: "tel" },
        { id: "bdm_same", label: "Are you our BDM / day-to-day contact?", type: "yes_no" },
        { id: "bdm_name", label: "BDM name", type: "text", half: true, when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_region", label: "BDM region", type: "text", half: true, when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_email", label: "BDM email", type: "email", when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_phone", label: "BDM phone", type: "tel", when: { field: "bdm_same", equals: "no" } },
      ],
    },
    {
      id: "reach", title: "Where & who you lend to", kicker: "Profile",
      nodes: [
        { id: "regions", label: "Where do you lend?", type: "multi", options: REGIONS, required: true },
        { id: "postcode_exclusions", label: "Any areas or postcodes you avoid?", type: "text", advanced: true },
        { id: "borrower_types", label: "Borrower types", type: "multi", options: BORROWER_TYPES, required: true },
        { id: "min_property_value", label: "Minimum property value", type: "money", half: true },
        { id: "max_exposure", label: "Max exposure, one borrower", type: "money", half: true },
      ],
    },
    {
      id: "guide", title: "Fastest route: send us your product guide", kicker: "Product guide", badge: "Recommended",
      description: "Most lenders’ guides already answer most of this form. Upload yours and we’ll read it, pre-fill what we can and send you a short read-back so you only fill the gaps.",
      nodes: [
        { id: "guide_file", label: "Product guide or criteria sheet", type: "file", help: "PDF, Excel or Word. One combined guide is ideal." },
        { id: "guide_file_2", label: "Second document (e.g. a separate product range)", type: "file", advanced: true },
        { id: "guide_link", label: "Or a link to your published guide", type: "text", placeholder: "https://", advanced: true },
        { id: "guide_date", label: "Date of the guide", type: "date" },
        { id: "guide_update_freq", label: "How often do you update it?", type: "choice", options: ["Monthly", "Quarterly", "Ad hoc"] },
        { kind: "notice", id: "guide_tip", tone: "info", title: "No guide to hand?", body: "No problem — just answer the next few screens. It takes about 20 minutes and you can save and come back." },
      ],
    },
    {
      id: "core", title: "Your core products", kicker: "Products",
      description: "Pick everything you lend on. Each one opens a short product card.",
      nodes: [
        { id: "regulated_scope", label: "Regulated or unregulated?", type: "choice", options: ["Unregulated only", "Regulated only", "Both"], required: true },
        { id: "charge_positions", label: "Charge positions", type: "multi", options: ["1st charge", "2nd charge", "3rd or subsequent", "Behind senior debt (mezzanine)", "Equity / JV (no charge)"] },
        { id: "subordinate_appetite", label: "Do you lend behind another lender’s senior debt?", type: "choice", options: ["Yes — mezzanine or second-ranking", "Second charge only, not mezzanine", "No"] },
        { id: "products", label: "Products", type: "multi", options: PRODUCTS.map((p) => p.label), required: true },
        { id: "products_other", label: "Anything not listed?", type: "text", advanced: true },
        H("h_sweet", "Your sweet spot", "Where most of your book actually sits."),
        { id: "sweet_loan", label: "Typical loan", type: "money", half: true },
        { id: "sweet_ltv", label: "Typical LTV", type: "percent", half: true },
      ],
    },
    ...PRODUCTS.map(productStep),
    {
      id: "valuation", title: "Valuations", kicker: "Valuation",
      nodes: [
        { id: "val_types", label: "Which valuation types do you accept?", type: "multi", options: ["AVM", "Desktop", "Drive-by / external only", "Full RICS valuation", "In-house valuer", "Existing report by transfer or reliance"] },
        { id: "avm_max_loan", label: "AVM: max loan", type: "money", half: true, when: { field: "val_types", includes: "AVM" } },
        { id: "avm_max_ltv", label: "AVM: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "AVM" } },
        { id: "desktop_max_loan", label: "Desktop: max loan", type: "money", half: true, when: { field: "val_types", includes: "Desktop" } },
        { id: "desktop_max_ltv", label: "Desktop: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "Desktop" } },
        { id: "driveby_max_loan", label: "Drive-by: max loan", type: "money", half: true, when: { field: "val_types", includes: "Drive-by / external only" } },
        { id: "driveby_max_ltv", label: "Drive-by: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "Drive-by / external only" } },
        { id: "val_conditions", label: "Conditions for AVM / desktop", type: "text", placeholder: "e.g. standard construction, England & Wales only", when: { any_of: [{ field: "val_types", includes: "AVM" }, { field: "val_types", includes: "Desktop" }] } },
        { id: "val_panel", label: "Valuation panel manager(s) or firms", type: "text" },
        { id: "val_turnaround", label: "Typical time to valuation report", type: "choice", options: ["Under 5 days", "5–10 days", "Over 10 days"] },
      ],
    },
    {
      id: "assets", title: "Asset appetite", kicker: "Appetite",
      description: "Vanilla, quirky or both? Tap one per line. Add a note for any limits.",
      nodes: [
        { id: "appetite_style", label: "Overall, you are…", type: "choice", options: ["Vanilla only", "Mostly vanilla, some quirky", "Happy with quirky", "Specialists in quirky"], required: true },
        { id: "residential_only", label: "Residential only?", type: "yes_no" },
        ...grouped(ASSETS, "asset_"),
      ],
    },
    {
      id: "hair1", title: "Hair on the deal: credit & insolvency", kicker: "Appetite", badge: "Risk tolerance",
      description: "Be honest — it saves us both time. Use the notes for recency, amounts or conditions.",
      nodes: [
        { id: "hair_lookback", label: "How far back do you look at credit history?", type: "choice", options: ["12 months", "24 months", "36 months", "6 years", "Case by case"] },
        ...grouped(HAIR, "hair_", ["Adverse credit", "Insolvency"]),
      ],
    },
    {
      id: "hair2", title: "Hair on the deal: people, structures & situations", kicker: "Appetite", badge: "Risk tolerance",
      nodes: [
        ...grouped(HAIR, "hair_", ["People & compliance", "Borrower profile", "Structures", "Situations"]),
        { id: "hair_auto_declines", label: "Any automatic declines we haven’t covered?", type: "textarea" },
      ],
    },
    {
      id: "legals", title: "Legals & process", kicker: "Process",
      description: "A few quick ones so we set cases up the way you like.",
      nodes: [
        { id: "legal_dd", label: "How do you get comfortable on title and legal due diligence?", type: "multi", options: ["Full searches and report on title", "Search indemnity insurance where suitable", "Title insurance in place of some legal work", "Reduced legal review at low LTV", "Case by case"] },
        { id: "representation", label: "Representation", type: "choice", options: ["Dual representation available", "Separate representation only", "Case by case"] },
        { id: "borrower_solicitor", label: "Borrower’s solicitor", type: "choice", options: ["Any regulated firm meeting our criteria", "Must be on our panel", "We nominate the firm"] },
        { id: "min_partners", label: "Minimum partners at the borrower’s firm", type: "number", half: true, advanced: true },
        { id: "ple_rounds", label: "Typical rounds of pre-legal enquiries", type: "choice", options: ["One", "Two", "Three or more", "Varies"] },
        { id: "val_instruction", label: "When is the valuation instructed?", type: "choice", options: ["On receipt of the fee", "After a decision in principle", "After credit approval"] },
        { id: "time_offer", label: "Typical time to formal offer", type: "choice", options: ["Same day", "1–3 working days", "4–7 working days", "Over a week"], half: true },
        { id: "time_complete", label: "Typical time to complete", type: "choice", options: ["Under 7 days", "1–2 weeks", "2–4 weeks", "Over 4 weeks"], half: true },
      ],
    },
    {
      id: "readback", title: "Read-back: anything missing?", kicker: "Gap check", panel: "lender_gapcheck",
      description: "Here’s what we have so far — from your guide and your answers. Anything flagged, tap to fill or correct it.",
      nodes: [
        { id: "gap_confirm", label: "How does that look?", type: "choice", options: ["Everything looks right", "I’ve filled the gaps", "Please call me to go through it"] },
        { id: "gap_notes", label: "Corrections or updates", type: "textarea" },
      ],
    },
    {
      id: "cases1", title: "Would you do these deals? (1–6)", kicker: "Case studies",
      description: "Quick gut reactions are perfect. Add a reason if it’s a no or a maybe. All scenarios are fictional.",
      nodes: caseNodes(0, 6),
    },
    {
      id: "cases2", title: "Would you do these deals? (7–11)", kicker: "Case studies",
      nodes: caseNodes(6, CASE_STUDIES.length),
    },
    {
      id: "partnership", title: "Partnership & mezzanine appetite", kicker: "An invitation", badge: "Let’s talk",
      description: "Separate from our usual cases. We source distressed and undervalued sites, improve them and run the delivery ourselves. Often all that’s missing is a modest mezzanine or equity top-up to get a project started. There are two ways you could take part. If either sounds interesting, we’d love to hear how you’d like to work together.",
      nodes: [
        { kind: "notice", id: "pt_note", tone: "info", body: "Nothing here is an offer or a commitment on either side. Any figures are an illustrative example, not an offer — they’re only there to start a conversation." },
        { id: "pt_mezz", label: "Would you consider mezzanine or a second charge behind a developer’s senior debt?", type: "choice", options: ["Yes, keen", "Possibly, case by case", "Not for us"] },
        { id: "pt_ticket", label: "Typical ticket you’d be comfortable with", type: "choice", options: ["Under £250k", "£250k–£1m", "£1m–£5m", "Over £5m", "Varies by deal"], when: { field: "pt_mezz", in: ["Yes, keen", "Possibly, case by case"] } },
        { id: "pt_min_deal", label: "Smallest deal you’d look at for this", type: "choice", options: ["£250k+", "£500k+", "£1m+", "£5m+", "No set minimum"], when: { field: "pt_mezz", in: ["Yes, keen", "Possibly, case by case"] } },

        H("pt_h_r1", "Route 1 · Loan notes", "Lend to our lending vehicle through a loan note: a coupon over an agreed term, with security we agree together."),
        { id: "ln_appetite", label: "Would loan notes interest you?", type: "choice", options: ["Yes, interested", "Possibly", "Not for us"] },
        { id: "ln_ticket", label: "Ticket size", type: "choice", options: ["Under £250k", "£250k–£1m", "£1m–£5m", "Over £5m", "Varies"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_term", label: "Term", type: "choice", options: ["Under 12 months", "12–24 months", "2–3 years", "Over 3 years", "Flexible"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_coupon", label: "Target coupon", type: "choice", options: ["Under 8% a year", "8–10% a year", "10–12% a year", "Over 12% a year", "Open to discuss"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_security", label: "Security you’d prefer", type: "multi", options: ["Debenture over the lending vehicle", "Assignment of the underlying charges", "Unsecured with covenants", "Open to discuss"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },

        H("pt_h_r2", "Route 2 · Preferred shares with a profit share", "A private-equity style partnership: you as capital partner, us as managing partner."),
        { kind: "notice", id: "pt_r2_example", tone: "case", title: "Illustrative example, not an offer",
          body: "You fund most of each loan in cash; our share comes from waiving our broker fee, as sweat equity. You hold protected preferred shares, with a preference on the return of your capital and limited voting, while we run the book day to day. Returns are paid in this order:",
          facts: [["Capital partner funds", "~88% of each loan, in cash"], ["Managing partner", "~12%, from its waived broker fee"], ["Your shares", "Protected preferred, limited voting"], ["Capital", "Preference on return of capital"], ["1 · Management fee", "2% a year to the managing partner"], ["2 · Preferred return", "10% a year, paid monthly (0.833%)"], ["3 · Above the hurdle", "75% to you · 25% to us"], ["Control", "Stays with the managing partner"]] },
        { id: "pt_route2", label: "Would you consider something like this?", type: "choice", options: ["Yes, as illustrated", "Yes, with a variation", "A different split would suit us better", "Not for us"] },
        { id: "pt_split", label: "Profit splits you’d consider above the hurdle (illustrative)", type: "multi", options: ["75 / 25", "70 / 30", "60 / 40", "50 / 50", "Open to discuss"], help: "Capital partner / managing partner.", when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },
        { id: "pt_pref", label: "Preferred return you’d look for", type: "choice", options: ["Around 10% a year, as illustrated", "Lower, with a bigger profit share", "Higher, with a smaller profit share", "Open to discuss"], when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },
        { id: "pt_variation", label: "What would you change?", type: "textarea", placeholder: "Fee, preference, split, voting, capital protection, anything", when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },

        H("pt_h_close", "Over to you"),
        { id: "pt_assets", label: "Situations you’d find interesting", type: "multi", options: ["Distressed or stalled sites", "Unsold or inventory stock", "Value-add refurbishment", "Ground-up development", "Specialist (hotels, care, trading)"] },
        { id: "pt_notes", label: "How would you like a partnership to work?", type: "textarea", placeholder: "Structures you like, what you’d need to see, anything you’ve done before" },
        { id: "pt_meet", label: "Fancy a sit-down?", type: "choice", options: ["Happy to sit down and discuss", "Send me more information first", "Not right now"] },
      ],
    },
    {
      id: "feedback", title: "How was this?", kicker: "Your feedback",
      description: "We’re piloting this with a small group of lenders. Honest feedback makes it better for everyone.",
      nodes: [
        { id: "fb_rating", label: "Overall", type: "choice", options: ["Excellent", "Good", "OK", "Hard work"] },
        { id: "fb_minutes", label: "Roughly how long did it take?", type: "choice", options: ["Under 15 min", "15–30 min", "30–60 min", "Over an hour"] },
        { id: "fb_clear", label: "What made sense?", type: "textarea" },
        { id: "fb_missing", label: "What did we miss that you’d want brokers to know?", type: "textarea" },
        { id: "fb_confusing", label: "Anything confusing, too long or irrelevant?", type: "textarea" },
        { id: "fb_send_deals", label: "Happy for us to send you suitable deals?", type: "yes_no", required: true },
        { id: "fb_call", label: "Would a 15-minute call to go through it help?", type: "yes_no" },
      ],
    },
  ],
  declaration: {
    text: "I confirm these criteria reflect our current lending policy to the best of my knowledge. I understand they will be used to match suitable cases, that nothing here is a commitment to lend, and that you may check changes with us.",
    nameLabel: "Your full name",
  },
};

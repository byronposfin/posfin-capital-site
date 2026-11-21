/**
 * Lender criteria catalog — the single source of truth for the lender intake link.
 * Extensible by data: add a product family, a product, an asset class, a "hair" factor or a case study
 * here and the form, summary, PDF, XLSX, PLACED export and Supabase rows all pick it up.
 *
 * Product taxonomy mirrors Posfin's product cards (bridging £26k–£25m to 75% LTV; development and exit
 * to £100m; purchase & refurb; acquisition finance for hotels, care homes and commercial) and adds the
 * capital-stack products Posfin needs for its own lending and raising (mezzanine, second-ranking, equity / JV)
 * and distressed / inventory-stock situations.
 */

export type ProductFamily = "bridging" | "refurb" | "development" | "commercial" | "specialist" | "capital_stack" | "term";

export interface ProductDef {
  key: string;
  label: string;
  family: ProductFamily;
  short: string;
  /** Development-style sizing (LTGDV / LTC / drawdowns). */
  dev?: boolean;
  /** Works / drawdown funding questions. */
  works?: boolean;
  /** Sits behind senior debt (mezz / second-ranking) — asks max combined LTV and intercreditor terms. */
  subordinate?: boolean;
  /** Equity / JV — asks profit share and minimum sponsor equity instead of rate. */
  equity?: boolean;
  /** Asset classes shown in this product's LTV grid. */
  ltvRows: string[];
  /** Possible charge positions for this product. */
  charges: string[];
  /** Field in PLACED research workbook `segment`. */
  placedSegment: string;
}

export const FAMILY_LABEL: Record<ProductFamily, string> = {
  bridging: "Bridging",
  refurb: "Refurbishment",
  development: "Development",
  commercial: "Commercial & semi-commercial",
  specialist: "Specialist commercial",
  capital_stack: "Mezzanine, second-ranking & equity",
  term: "Term finance",
};

const RESI = ["Residential", "HMO / MUFB", "Semi-commercial", "Commercial", "Land"];
const CH12 = ["1st charge", "2nd charge"];

export const PRODUCTS: ProductDef[] = [
  { key: "bridge_resi", label: "Residential bridging (unregulated)", family: "bridging", short: "Resi bridge", ltvRows: ["Residential", "HMO / MUFB", "Holiday let / SA"], charges: CH12, placedSegment: "Bridging" },
  { key: "bridge_reg", label: "Regulated bridging (owner-occupied)", family: "bridging", short: "Regulated bridge", ltvRows: ["Residential"], charges: CH12, placedSegment: "Bridging" },
  { key: "bridge_comm", label: "Commercial & semi-commercial bridging", family: "commercial", short: "Commercial bridge", ltvRows: ["Semi-commercial", "Commercial", "Land with planning"], charges: CH12, placedSegment: "Bridging" },
  { key: "auction", label: "Auction finance", family: "bridging", short: "Auction", ltvRows: ["Residential", "Semi-commercial", "Commercial"], charges: ["1st charge"], placedSegment: "Bridging" },
  { key: "land", label: "Land bridging (with or without planning)", family: "bridging", short: "Land", ltvRows: ["Land with planning", "Land without planning"], charges: CH12, placedSegment: "Bridging" },
  { key: "refurb_light", label: "Light refurbishment", family: "refurb", short: "Light refurb", works: true, ltvRows: RESI.slice(0, 4), charges: ["1st charge"], placedSegment: "Refurbishment" },
  { key: "refurb_heavy", label: "Heavy refurbishment & conversion", family: "refurb", short: "Heavy refurb", works: true, dev: true, ltvRows: RESI.slice(0, 4), charges: ["1st charge"], placedSegment: "Refurbishment" },
  { key: "dev_ground", label: "Ground-up development", family: "development", short: "Development", works: true, dev: true, ltvRows: ["Residential scheme", "Mixed-use scheme", "Commercial scheme"], charges: ["1st charge"], placedSegment: "Development" },
  { key: "dev_exit", label: "Development exit & unsold stock", family: "development", short: "Dev exit / stock", ltvRows: ["Residential units", "Mixed-use units", "Commercial units"], charges: CH12, placedSegment: "Development exit" },
  { key: "distressed", label: "Distressed, stalled & part-built sites", family: "development", short: "Distressed / stalled", works: true, dev: true, ltvRows: ["Part-built residential", "Part-built mixed-use", "Stalled land"], charges: CH12, placedSegment: "Development" },
  { key: "care_hotel", label: "Hotels, care homes & trading businesses", family: "specialist", short: "Hotels / care", ltvRows: ["Hotels & hospitality", "Care homes & healthcare", "Pubs & leisure", "Other trading business"], charges: CH12, placedSegment: "Specialist commercial" },
  { key: "mezz", label: "Mezzanine / second-ranking behind senior debt", family: "capital_stack", short: "Mezzanine", subordinate: true, works: true, dev: true, ltvRows: ["Development", "Bridging / investment", "Trading / specialist"], charges: ["2nd charge", "Unsecured / share charge"], placedSegment: "Mezzanine" },
  { key: "equity_jv", label: "Equity / joint venture funding", family: "capital_stack", short: "Equity / JV", equity: true, dev: true, ltvRows: ["Development", "Value-add / refurb", "Distressed / stock"], charges: ["Equity (no charge)", "Preferred equity"], placedSegment: "Equity" },
  { key: "term_btl", label: "Buy-to-let & portfolio term finance", family: "term", short: "BTL / term", ltvRows: ["Residential", "HMO / MUFB", "Holiday let / SA"], charges: CH12, placedSegment: "Term" },
  { key: "term_comm", label: "Commercial term loans", family: "term", short: "Commercial term", ltvRows: ["Semi-commercial", "Commercial", "Trading business"], charges: CH12, placedSegment: "Term" },
];

export const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p])) as Record<string, ProductDef>;
export const productLabel = (k: string) => PRODUCT_BY_KEY[k]?.label ?? k;
export const PRODUCT_OPTIONS = PRODUCTS.map((p) => p.label);
export const productKeyFromLabel = (l: string) => PRODUCTS.find((p) => p.label === l)?.key;

export const REGIONS = ["England", "Wales", "Scotland", "Northern Ireland", "Isle of Man & Channel Islands"];
export const BORROWER_TYPES = ["Individuals", "UK limited companies / SPVs", "LLPs & partnerships", "Trusts", "Overseas companies", "Pension schemes (SIPP / SSAS)", "Charities & community bodies"];
export const LENDER_TYPES = ["High-street or challenger bank", "Specialist lender (balance sheet)", "Specialist lender (funded lines)", "Private credit / debt fund", "Family office", "Peer-to-peer / platform", "Private individual or syndicate", "Other"];

/** Asset appetite rows (tolerance grid, Accept / Case by case / Decline). */
export const ASSETS: { key: string; label: string; group: string }[] = [
  { key: "std_resi", label: "Standard residential houses & flats", group: "Residential" },
  { key: "hmo_small", label: "Small HMO (up to 6 beds)", group: "Residential" },
  { key: "hmo_large", label: "Large HMO (7+ beds) / sui generis", group: "Residential" },
  { key: "mufb", label: "Multi-unit freehold blocks", group: "Residential" },
  { key: "holiday", label: "Holiday lets & serviced accommodation", group: "Residential" },
  { key: "above_comm", label: "Flats above commercial", group: "Residential" },
  { key: "ex_la", label: "Ex-local authority / high-rise", group: "Residential" },
  { key: "uninhabitable", label: "Uninhabitable (no kitchen or bathroom)", group: "Residential" },
  { key: "non_std", label: "Non-standard construction", group: "Construction & title" },
  { key: "short_lease", label: "Short leases (under 70 years)", group: "Construction & title" },
  { key: "listed", label: "Listed buildings", group: "Construction & title" },
  { key: "rural", label: "Rural, agricultural ties & large acreage", group: "Construction & title" },
  { key: "office", label: "Offices", group: "Commercial" },
  { key: "retail", label: "Retail & high street", group: "Commercial" },
  { key: "industrial", label: "Industrial & warehouse", group: "Commercial" },
  { key: "hospitality", label: "Hotels, pubs & hospitality", group: "Commercial" },
  { key: "care", label: "Care homes & healthcare", group: "Commercial" },
  { key: "leisure", label: "Leisure, places of worship & specialist", group: "Commercial" },
  { key: "land_pp", label: "Land with planning", group: "Land & development" },
  { key: "land_nopp", label: "Land without planning", group: "Land & development" },
  { key: "part_built", label: "Part-built or stalled sites", group: "Land & development" },
  { key: "unsold_stock", label: "Unsold new-build stock", group: "Land & development" },
];

/** "Hair on the deal" factors. */
export const HAIR: { key: string; label: string; group: string; help?: string }[] = [
  { key: "ccj_satisfied", label: "CCJs — satisfied, over 12 months old", group: "Adverse credit" },
  { key: "ccj_recent", label: "CCJs — unsatisfied or in the last 12 months", group: "Adverse credit" },
  { key: "default_satisfied", label: "Defaults — satisfied or settled", group: "Adverse credit" },
  { key: "default_recent", label: "Defaults — recent or unsatisfied", group: "Adverse credit" },
  { key: "missed_unsecured", label: "Missed unsecured payments", group: "Adverse credit" },
  { key: "arrears_current", label: "Current secured arrears (incl. on the security)", group: "Adverse credit" },
  { key: "arrears_historic", label: "Historic mortgage arrears, now cleared", group: "Adverse credit" },
  { key: "dmp", label: "Debt management plan (active)", group: "Adverse credit" },
  { key: "payday", label: "Payday loans in the last 12 months", group: "Adverse credit" },
  { key: "tax_arrears", label: "HMRC / tax arrears or time-to-pay", group: "Adverse credit" },
  { key: "bankrupt_discharged", label: "Bankruptcy — discharged", group: "Insolvency" },
  { key: "bankrupt_current", label: "Bankruptcy — undischarged", group: "Insolvency" },
  { key: "iva_active", label: "IVA — active", group: "Insolvency" },
  { key: "iva_complete", label: "IVA — completed", group: "Insolvency" },
  { key: "corp_insolvency", label: "Director of a company that went into insolvency", group: "Insolvency" },
  { key: "insolvency_assoc", label: "Insolvency-associated parties (connected people or companies)", group: "Insolvency" },
  { key: "director_disq", label: "Director disqualification (past or present)", group: "Insolvency" },
  { key: "repossession", label: "Prior repossession", group: "Insolvency" },
  { key: "adverse_media", label: "Adverse media", group: "People & compliance" },
  { key: "criminal_spent", label: "Criminal record — spent", group: "People & compliance" },
  { key: "criminal_unspent", label: "Criminal record — unspent", group: "People & compliance" },
  { key: "litigation", label: "Live litigation or disputes", group: "People & compliance" },
  { key: "pep", label: "Politically exposed persons (PEPs)", group: "People & compliance" },
  { key: "sanctions_adjacent", label: "Sanctions-adjacent jurisdictions or parties", group: "People & compliance", help: "Not sanctioned parties themselves." },
  { key: "foreign_resident", label: "Foreign nationals living in the UK", group: "Borrower profile" },
  { key: "expat", label: "Expats & non-UK-resident borrowers", group: "Borrower profile" },
  { key: "first_time_borrower", label: "First-time borrowers / no property experience", group: "Borrower profile" },
  { key: "first_time_dev", label: "First-time developers", group: "Borrower profile" },
  { key: "age_extremes", label: "Borrowers over 80 at end of term", group: "Borrower profile" },
  { key: "offshore_spv", label: "Offshore SPVs & overseas companies", group: "Structures" },
  { key: "trusts", label: "Trusts & complex ownership", group: "Structures" },
  { key: "layered", label: "Multi-layered group structures", group: "Structures" },
  { key: "reg_borderline", label: "Regulated / unregulated borderline (e.g. family member in occupation)", group: "Structures" },
  { key: "security_in_default", label: "Security already in default with existing lender", group: "Situations" },
  { key: "receivership", label: "Receivership, LPA or administrator sales", group: "Situations" },
  { key: "no_exit_evidence", label: "Exit not yet evidenced (e.g. refinance subject to planning)", group: "Situations" },
];

export interface CaseStudy {
  key: string;
  title: string;
  tag: "Rollover" | "Vanilla" | "Quirky" | "Hairy" | "Part-build" | "Second charge" | "Regulated borderline" | "Development exit" | "Specialist" | "Mezzanine" | "Distressed";
  body: string;
  facts: [string, string][];
  /** Signals this answer feeds in PLACED (product, asset or hair keys). */
  signals: string[];
}

/** Eleven anonymised, fictional scenarios — no real client data. */
export const CASE_STUDIES: CaseStudy[] = [
  { key: "cs01", title: "1 · Vanilla refinance bridge", tag: "Vanilla", signals: ["bridge_resi", "std_resi"],
    body: "Experienced landlord, clean credit, refinancing a three-bed terrace in Leeds held in a UK SPV to release equity for the next purchase. Exit: BTL refinance in 9 months.",
    facts: [["Loan", "£285,000"], ["Value", "£425,000"], ["LTV", "67% gross"], ["Term", "12 months"], ["Charge", "1st"], ["Interest", "Retained"]] },
  { key: "cs02", title: "2 · Quirky: Grade II barn conversion", tag: "Quirky", signals: ["bridge_resi", "listed", "rural", "non_std"],
    body: "Completed Grade II listed barn conversion on 4 acres in rural Herefordshire, timber frame, private drainage. Owner wants to bridge to sale.",
    facts: [["Loan", "£620,000"], ["Value", "£1,100,000"], ["LTV", "56%"], ["Term", "12 months"], ["Charge", "1st"], ["Exit", "Sale"]] },
  { key: "cs03", title: "3 · Hairy: satisfied CCJ and old default", tag: "Hairy", signals: ["ccj_satisfied", "default_satisfied", "bridge_resi"],
    body: "Self-employed borrower with a £6,400 CCJ satisfied 2 years ago and a settled default from 4 years ago. Purchase of a mid-terrace at auction, 28-day completion.",
    facts: [["Loan", "£168,000"], ["Price", "£240,000"], ["LTV", "70%"], ["Term", "12 months"], ["Charge", "1st"], ["Deadline", "28 days"]] },
  { key: "cs04", title: "4 · Part-built: stalled 6-unit scheme", tag: "Part-build", signals: ["distressed", "part_built", "dev_ground"],
    body: "New developer takes over a 6-house scheme stalled at roof level after the original contractor failed. Fixed-price contract for the remaining works; QS report in hand.",
    facts: [["Day 1", "£900,000"], ["Works", "£650,000"], ["GDV", "£2,700,000"], ["LTGDV", "57%"], ["Term", "15 months"], ["Charge", "1st"]] },
  { key: "cs05", title: "5 · Second charge behind a high-street lender", tag: "Second charge", signals: ["bridge_resi", "2nd_charge"],
    body: "Business-purpose second charge on a portfolio property to fund a deposit. First charge is with a high-street lender at 45% LTV; consent to be requested.",
    facts: [["Loan", "£150,000"], ["Value", "£800,000"], ["Combined LTV", "64%"], ["Term", "9 months"], ["Charge", "2nd"], ["Purpose", "Business"]] },
  { key: "cs06", title: "6 · Regulated borderline", tag: "Regulated borderline", signals: ["reg_borderline", "bridge_reg"],
    body: "Borrower's adult son lives in the flat rent-free while studying. Borrower wants to raise funds for a business, secured on the flat.",
    facts: [["Loan", "£190,000"], ["Value", "£330,000"], ["LTV", "58%"], ["Term", "12 months"], ["Charge", "1st"], ["Occupier", "Family member"]] },
  { key: "cs07", title: "7 · Development exit on unsold stock", tag: "Development exit", signals: ["dev_exit", "unsold_stock"],
    body: "Practical completion reached on 14 flats; 5 sold, 9 unsold. Refinance the senior development loan to give 12 months to sell the rest.",
    facts: [["Loan", "£2,300,000"], ["Unsold GDV", "£3,600,000"], ["LTV", "64%"], ["Term", "12 months"], ["Charge", "1st"], ["Exit", "Unit sales"]] },
  { key: "cs08", title: "8 · Specialist: care home acquisition", tag: "Specialist", signals: ["care_hotel", "care"],
    body: "Experienced operator acquiring a 42-bed residential care home with 'Good' regulatory rating. 3 years of trading accounts; bricks-and-mortar value below trading value.",
    facts: [["Loan", "£2,100,000"], ["Trading value", "£3,500,000"], ["LTV", "60% (trading)"], ["Term", "18 months"], ["Charge", "1st"], ["Exit", "Term loan"]] },
  { key: "cs09", title: "9 · Mezzanine on a ground-up scheme", tag: "Mezzanine", signals: ["mezz", "dev_ground"],
    body: "Senior lender at 60% LTGDV on a 20-unit scheme. Developer needs mezzanine to reduce their equity to 10% of costs. Intercreditor to be agreed.",
    facts: [["Mezz", "£1,400,000"], ["GDV", "£9,000,000"], ["Total LTGDV", "75%"], ["Term", "24 months"], ["Charge", "2nd"], ["Senior", "60% LTGDV"]] },
  { key: "cs10", title: "10 · Distressed: receiver sale, 50% LTV", tag: "Distressed", signals: ["receivership", "security_in_default", "dev_exit"],
    body: "Buyer purchasing 8 completed but empty units from an LPA receiver at a discount. Low leverage, quick completion, limited information pack.",
    facts: [["Loan", "£1,050,000"], ["Value", "£2,100,000"], ["LTV", "50%"], ["Term", "12 months"], ["Charge", "1st"], ["Deadline", "21 days"]] },
  { key: "cs11", title: "11 · Rollover with a capital paydown", tag: "Rollover", signals: ["rollover", "bridge_resi"],
    body: "Month 11 of a 12-month bridge on a mixed-use building. Refinance is delayed and a new valuation has come in lower, putting the loan at 76% LTV. The borrower will pay down £120,000 of capital to bring it under 70% and asks for 6 more months with interest retained.",
    facts: [["Balance now", "£1,140,000"], ["New value", "£1,500,000"], ["LTV after paydown", "68%"], ["Extension", "6 months"], ["Interest", "Re-retained"], ["Conduct", "No arrears"]] },
];

/** Decline-reason taxonomy used by the live-deal feedback loop (see lib/lender/rules.ts). */
export const DECLINE_REASONS: { key: string; label: string; maps: string }[] = [
  { key: "ltv", label: "LTV too high", maps: "product.<key>.ltv" },
  { key: "loan_size", label: "Loan too small / too large", maps: "product.<key>.min_loan|max_loan" },
  { key: "asset", label: "Asset type outside appetite", maps: "asset.<asset_key>" },
  { key: "location", label: "Location / region", maps: "profile.regions" },
  { key: "credit", label: "Adverse credit", maps: "hair.<hair_key>" },
  { key: "borrower", label: "Borrower profile / experience", maps: "hair.<hair_key>" },
  { key: "structure", label: "Structure (trust, offshore, layered)", maps: "hair.<hair_key>" },
  { key: "exit", label: "Exit not credible", maps: "hair.no_exit_evidence" },
  { key: "valuation", label: "Valuation / down-valuation", maps: "valuation.*" },
  { key: "term", label: "Term or redemption terms", maps: "product.<key>.term" },
  { key: "capacity", label: "No capacity / pipeline full (no rule change)", maps: "none" },
  { key: "other", label: "Other", maps: "manual" },
];

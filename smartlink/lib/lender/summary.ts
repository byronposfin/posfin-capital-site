/**
 * Pure builders for the lender criteria: summary (web + PDF + XLSX), gap check / read-back, and the
 * PLACED export rows (column names match PLACED_Lender_Research_14Nov2026_v001.xlsx → Products sheet).
 */
import type { Answers } from "@/lib/engine/types";
import { parseMoney } from "@/lib/engine/money";
import { ASSETS, CASE_STUDIES, HAIR, PRODUCTS, type ProductDef } from "./catalog";
import { hasRollover, LENDER_STEP_IDS } from "@/lib/forms/lender";

type Grid = Record<string, Record<string, string>>;
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const n = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const x = Number(String(v).replace(/[%,£\s]/g, ""));
  return Number.isFinite(x) ? x : null;
};
const money = (v: unknown) => parseMoney(v);
export const gbpShort = (x: number | null) => {
  if (x === null) return "";
  if (x >= 1_000_000) return `£${+(x / 1_000_000).toFixed(x % 1_000_000 ? 2 : 0)}m`;
  if (x >= 1000) return `£${+(x / 1000).toFixed(x % 1000 ? 1 : 0)}k`;
  return `£${x}`;
};

export function pickedProducts(a: Answers): ProductDef[] {
  const sel = arr(a.products);
  return PRODUCTS.filter((p) => sel.includes(p.label));
}

function gridMax(g: Grid | undefined, col?: RegExp): number | null {
  let m: number | null = null;
  for (const row of Object.values(g ?? {})) for (const [c, v] of Object.entries(row ?? {})) {
    if (col && !col.test(c)) continue;
    const x = n(v);
    if (x !== null && (m === null || x > m)) m = x;
  }
  return m;
}

export interface ProductSummary {
  key: string; label: string; short: string; family: string; segment: string;
  min_loan: number | null; max_loan: number | null; charges: string[];
  ltv: Grid; ltv_cols: string[]; ltv_basis: string;
  max_ltv_first: number | null; max_ltv_second: number | null; max_ltgdv: number | null; max_ltc: number | null; max_day1: number | null;
  term_min: number | null; term_max: number | null;
  min_interest: string; exit_after_months: number | null; interest_time_used: string; erc: string;
  rate_from: number | null; rate_to: number | null; rate_basis: string; arrangement_fee: number | null; exit_fee: number | null; proc_fee: number | null;
  interest_options: string[]; works: string; rollover: string; rollover_offered: string; rollover_detail: Record<string, string>; notes: string; extra: Record<string, string>;
}

export function productSummary(p: ProductDef, a: Answers): ProductSummary {
  const g = (f: string) => a[`p_${p.key}_${f}`];
  const ltv = (g("ltv") as Grid) ?? {};
  const mit = s(g("min_interest_type"));
  const min_interest = !mit ? "" : mit.startsWith("None") ? "None — days used" : mit.startsWith("A fixed") ? (s(g("min_interest_months")) ? `${s(g("min_interest_months"))} months` : "Fixed months") : s(g("min_interest_pct")) ? `${s(g("min_interest_pct"))}% of term` : "% of term";
  const ro = s(g("roll_offered"));
  const rd: Record<string, string> = {};
  if (hasRollover(p) && ro && ro !== "No") {
    if (s(g("roll_max_ltv"))) rd["Max LTV"] = `${s(g("roll_max_ltv"))}%`;
    if (s(g("roll_paydown"))) rd["Capital paydown"] = s(g("roll_paydown")) === "yes" ? "Accepted" : "No";
    if (s(g("roll_reretain"))) rd["Re-retain interest"] = ({ yes: "Yes", no: "No", unsure: "Case by case" } as Record<string, string>)[s(g("roll_reretain"))] ?? s(g("roll_reretain"));
    if (s(g("roll_fee"))) rd["Fee"] = s(g("roll_fee")) + (s(g("roll_fee_pct")) ? ` ${s(g("roll_fee_pct"))}%` : "");
    if (s(g("roll_reval"))) rd["Revaluation"] = s(g("roll_reval"));
    if (s(g("roll_max_count"))) rd["Max rollovers"] = s(g("roll_max_count"));
  }
  const rollover = !hasRollover(p) ? "n/a" : !ro ? "" : ro === "No" ? "No" : `${ro}${rd["Max LTV"] ? ` to ${rd["Max LTV"]}` : ""}${rd["Capital paydown"] === "Accepted" ? ", paydown OK" : ""}${rd["Re-retain interest"] === "Yes" ? ", re-retain" : ""}`;
  const firstCols = Object.keys(Object.values(ltv)[0] ?? {});
  const cols = p.equity ? ["LTV", "LTGDV"] : p.subordinate ? ["Total LTV", "Total LTGDV", "Senior max"] : p.dev ? ["Day 1", "LTGDV", "LTC"] : p.charges.filter((c) => /charge/.test(c));
  const extra: Record<string, string> = {};
  for (const [f, l] of [["intercreditor", "Intercreditor"], ["value_basis", "Valuation basis"], ["min_sponsor_equity", "Min sponsor equity %"], ["max_cost_pct", "Max % of costs"], ["profit_share", "Profit share %"], ["pref_return", "Preferred return %"], ["min_experience", "Experience"], ["other_fees", "Other fees"], ["erc_detail", "ERC detail"]] as const)
    if (s(g(f))) extra[l] = s(g(f));
  return {
    key: p.key, label: p.label, short: p.short, family: p.family, segment: p.placedSegment,
    min_loan: money(g("min_loan")), max_loan: money(g("max_loan")), charges: arr(g("charges")).length ? arr(g("charges")) : p.charges.length === 1 ? p.charges : [],
    ltv, ltv_cols: cols.length ? cols : firstCols, ltv_basis: s(g("ltv_basis")),
    max_ltv_first: p.dev || p.subordinate || p.equity ? gridMax(ltv, /Day 1|Total LTV|^LTV$/) : gridMax(ltv, /1st/),
    max_ltv_second: p.dev || p.equity ? null : p.subordinate ? gridMax(ltv, /Total LTV/) : gridMax(ltv, /2nd/),
    max_ltgdv: gridMax(ltv, /LTGDV/), max_ltc: gridMax(ltv, /LTC/), max_day1: gridMax(ltv, /Day 1/),
    term_min: n(g("term_min")), term_max: n(g("term_max")),
    min_interest, exit_after_months: n(g("exit_after_months")), interest_time_used: s(g("interest_time_used")) === "yes" ? "Yes" : s(g("interest_time_used")) === "no" ? "No" : "",
    erc: s(g("erc")) === "ERCs apply" ? (s(g("erc_detail")) || "Yes") : s(g("erc")) ? "None" : "",
    rate_from: n(g("rate_from")), rate_to: n(g("rate_to")), rate_basis: s(g("rate_basis")), arrangement_fee: n(g("arrangement_fee")), exit_fee: n(g("exit_fee")), proc_fee: n(g("proc_fee")),
    interest_options: arr(g("interest_options")),
    works: p.works ? [s(g("works_funding")), s(g("works_max_pct")) ? `to ${s(g("works_max_pct"))}% of cost` : ""].filter(Boolean).join(", ") : "",
    rollover, rollover_offered: hasRollover(p) ? ro : "", rollover_detail: rd, notes: s(g("notes")), extra,
  };
}

export type Tol = "Accept" | "Case by case" | "Decline";
export interface TolRow { key: string; label: string; group: string; value: string; note: string }
const tolRows = (rows: { key: string; label: string; group: string }[], prefix: string, a: Answers): TolRow[] =>
  rows.map((r) => ({ key: r.key, label: r.label, group: r.group, value: s(a[`${prefix}${r.key}`]), note: s(a[`${prefix}${r.key}_note`]) }));

/* ------------------------------------------------------------------ gap check / read-back */

/** What staff extraction (or, in v001, the simulated reader) found in the uploaded guide. */
export interface SheetExtraction {
  status: "none" | "queued" | "extracted" | "reviewed";
  file?: string;
  extracted_at?: string;
  method?: "manual" | "ai_assisted" | "simulated";
  reviewed_by?: string;
  items: { path: string; label: string; value: string; page?: string }[];
}

export interface GapItem { path: string; label: string; step: string; section: string; status: "missing" | "conflict" | "from_guide" | "ok"; form?: string; guide?: string; page?: string }

function formValueAt(a: Answers, path: string): string {
  // path "p_bridge_resi_ltv.Residential.1st charge" or plain field id
  const [id, r, c] = path.split(".");
  const v = a[id];
  if (r && c) return s((v as Grid | undefined)?.[r]?.[c]);
  if (Array.isArray(v)) return v.join(", ");
  return s(v);
}

/** Key fields per picked product + the global sections. Missing = not answered and not in the guide. */
export function gapCheck(a: Answers): { items: GapItem[]; missing: number; conflicts: number; fromGuide: number; ok: number; extraction: SheetExtraction } {
  const ex: SheetExtraction = (a.sheet_extraction as SheetExtraction) ?? { status: a.guide_file ? "queued" : "none", items: [] };
  const exBy = new Map(ex.items.map((i) => [i.path, i]));
  const items: GapItem[] = [];
  const add = (path: string, label: string, step: string, section: string) => {
    const form = formValueAt(a, path);
    const g = exBy.get(path);
    const norm = (x: string) => x.replace(/[£,%\s]/g, "").toLowerCase();
    let status: GapItem["status"] = form ? "ok" : "missing";
    if (g && !form) status = "from_guide";
    else if (g && form && norm(g.value) !== norm(form)) status = "conflict";
    items.push({ path, label, step, section, status, form: form || undefined, guide: g?.value, page: g?.page });
  };
  for (const p of pickedProducts(a)) {
    const k = (f: string) => `p_${p.key}_${f}`;
    const step = `prod_${p.key}`;
    add(k("min_loan"), p.equity ? "Minimum ticket" : "Minimum loan", step, p.label);
    add(k("max_loan"), p.equity ? "Maximum ticket" : "Maximum loan", step, p.label);
    const firstRow = p.ltvRows[0];
    const firstCol = p.equity ? "LTV" : p.subordinate ? "Total LTV" : p.dev ? "LTGDV" : "1st charge";
    add(`${k("ltv")}.${firstRow}.${firstCol}`, `Max ${firstCol} — ${firstRow}`, step, p.label);
    add(k("term_max"), "Maximum term", step, p.label);
    if (!p.equity) {
      add(k("rate_from"), "Rate from", step, p.label);
      add(k("arrangement_fee"), "Arrangement fee", step, p.label);
      add(k("min_interest_type"), "Minimum interest period", step, p.label);
      add(k("interest_options"), "Interest options", step, p.label);
    }
    if (p.works) add(k("works_funding"), "Works funding", step, p.label);
    if (hasRollover(p)) add(k("roll_offered"), "Rollovers & extensions", step, p.label);
  }
  add("regions", "Regions", "reach", "Profile");
  add("val_types", "Valuation types", "valuation", "Valuation");
  add("appetite_style", "Asset appetite", "assets", "Appetite");
  add("hair_lookback", "Credit look-back", "hair1", "Risk tolerance");
  add("legal_dd", "Legal due diligence approach", "legals", "Legals");
  add("representation", "Representation", "legals", "Legals");
  // every term read from the guide is checked, even if not a key field
  for (const it of ex.items) if (!items.some((i) => i.path === it.path)) {
    const pk = PRODUCTS.find((p) => it.path.startsWith(`p_${p.key}_`));
    add(it.path, it.label.replace(/^[^:]+:\s*/, "").replace(/^./, (c) => c.toUpperCase()), pk ? `prod_${pk.key}` : "guide", pk ? pk.label : "Product guide");
  }
  const answeredHair = HAIR.filter((h) => s(a[`hair_${h.key}`])).length;
  if (answeredHair < HAIR.length) items.push({ path: "hair_*", label: `Risk tolerance: ${HAIR.length - answeredHair} of ${HAIR.length} not answered`, step: answeredHair < 18 ? "hair1" : "hair2", section: "Risk tolerance", status: "missing" });
  const answeredAssets = ASSETS.filter((x) => s(a[`asset_${x.key}`])).length;
  if (answeredAssets < ASSETS.length) items.push({ path: "asset_*", label: `Asset types: ${ASSETS.length - answeredAssets} of ${ASSETS.length} not answered`, step: "assets", section: "Appetite", status: "missing" });
  return {
    items,
    missing: items.filter((i) => i.status === "missing").length,
    conflicts: items.filter((i) => i.status === "conflict").length,
    fromGuide: items.filter((i) => i.status === "from_guide").length,
    ok: items.filter((i) => i.status === "ok").length,
    extraction: ex,
  };
}

/** Apply a guide value into the answers (used by "Use guide value" in the read-back). Pure. */
export function applyGuideValue(a: Answers, path: string, value: string): Answers {
  const [id, r, c] = path.split(".");
  if (r && c) {
    const g = { ...((a[id] as Grid) ?? {}) };
    g[r] = { ...(g[r] ?? {}), [c]: value.replace(/[%\s]/g, "") };
    return { ...a, [id]: g };
  }
  if (/interest_options$/.test(id)) return { ...a, [id]: value.split(/,\s*/) };
  return { ...a, [id]: value };
}

/* ------------------------------------------------------------------ full summary */

export function buildLender(a: Answers) {
  const products = pickedProducts(a).map((p) => productSummary(p, a));
  const assets = tolRows(ASSETS, "asset_", a);
  const hair = tolRows(HAIR, "hair_", a);
  const cases = CASE_STUDIES.map((c) => ({ key: c.key, title: c.title, tag: c.tag, facts: c.facts, signals: c.signals, answer: s(a[`cs_${c.key}`]), reason: s(a[`cs_${c.key}_note`]) }));
  const gaps = gapCheck(a);
  const count = (rows: TolRow[], v: string) => rows.filter((r) => r.value === v).length;
  const minLoan = products.map((p) => p.min_loan).filter((x): x is number => x !== null);
  const maxLoan = products.map((p) => p.max_loan).filter((x): x is number => x !== null);
  const firsts = products.map((p) => p.max_ltv_first).filter((x): x is number => x !== null);
  const seconds = products.map((p) => p.max_ltv_second).filter((x): x is number => x !== null);
  const ltgdv = products.map((p) => p.max_ltgdv).filter((x): x is number => x !== null);
  return {
    profile: {
      lender: s(a.lender_name), type: s(a.lender_type), website: s(a.website), nacfb: ({ yes: "Yes", no: "No", unsure: "Not sure" } as Record<string, string>)[s(a.nacfb_patron)] ?? "",
      regulated_lending: s(a.fca_regulated) === "yes" ? "Yes" : s(a.fca_regulated) === "no" ? "No" : "",
      contact: [s(a.contact_name), s(a.contact_role)].filter(Boolean).join(", "), email: s(a.contact_email), phone: s(a.contact_phone),
      bdm: s(a.bdm_same) === "no" ? [s(a.bdm_name), s(a.bdm_region)].filter(Boolean).join(", ") : s(a.bdm_same) === "yes" ? "Same as contact" : "",
      bdm_email: s(a.bdm_email), regions: arr(a.regions), exclusions: s(a.postcode_exclusions), borrower_types: arr(a.borrower_types),
      min_property_value: money(a.min_property_value), max_exposure: money(a.max_exposure),
      regulated_scope: s(a.regulated_scope), charge_positions: arr(a.charge_positions), subordinate: s(a.subordinate_appetite),
      sweet_loan: money(a.sweet_loan), sweet_ltv: n(a.sweet_ltv), products_other: s(a.products_other),
      guide: (a.guide_file as { name?: string } | undefined)?.name ?? "", guide_date: s(a.guide_date), guide_link: s(a.guide_link),
    },
    products,
    headline: {
      products: products.length,
      loan_range: minLoan.length || maxLoan.length ? `${gbpShort(minLoan.length ? Math.min(...minLoan) : null)}–${gbpShort(maxLoan.length ? Math.max(...maxLoan) : null)}` : "",
      max_ltv_first: firsts.length ? Math.max(...firsts) : null,
      max_ltv_second: seconds.length ? Math.max(...seconds) : null,
      max_ltgdv: ltgdv.length ? Math.max(...ltgdv) : null,
    },
    valuation: {
      types: arr(a.val_types),
      avm: [money(a.avm_max_loan), n(a.avm_max_ltv)] as const, desktop: [money(a.desktop_max_loan), n(a.desktop_max_ltv)] as const, driveby: [money(a.driveby_max_loan), n(a.driveby_max_ltv)] as const,
      conditions: s(a.val_conditions), panel: s(a.val_panel), turnaround: s(a.val_turnaround),
    },
    appetite: { style: s(a.appetite_style), residential_only: s(a.residential_only) === "yes" ? "Yes" : s(a.residential_only) === "no" ? "No" : "", assets, accept: count(assets, "Accept"), cbc: count(assets, "Case by case"), decline: count(assets, "Decline") },
    hair: { lookback: s(a.hair_lookback), rows: hair, accept: count(hair, "Accept"), cbc: count(hair, "Case by case"), decline: count(hair, "Decline"), auto_declines: s(a.hair_auto_declines) },
    legals: {
      dd: arr(a.legal_dd), representation: s(a.representation), solicitor: s(a.borrower_solicitor), min_partners: s(a.min_partners), ple_rounds: s(a.ple_rounds),
      val_instruction: s(a.val_instruction), time_offer: s(a.time_offer), time_complete: s(a.time_complete),
    },
    cases,
    case_counts: { yes: cases.filter((c) => c.answer === "Yes").length, maybe: cases.filter((c) => c.answer === "Maybe").length, no: cases.filter((c) => c.answer === "No").length },
    gaps,
    partnership: {
      mezz: s(a.pt_mezz), ticket: s(a.pt_ticket), min_deal: s(a.pt_min_deal),
      loan_notes: { appetite: s(a.ln_appetite), ticket: s(a.ln_ticket), term: s(a.ln_term), coupon: s(a.ln_coupon), security: arr(a.ln_security) },
      pref_shares: { response: s(a.pt_route2), splits: arr(a.pt_split), pref: s(a.pt_pref), variation: s(a.pt_variation), illustrative: "2% pa management fee → 10% pa preferred return paid monthly → 75/25 split above hurdle; partner ~88% cash, managing partner ~12% via waived broker fee; protected preferred shares, limited voting" },
      situations: arr(a.pt_assets), notes: s(a.pt_notes), meet: s(a.pt_meet),
    },
    feedback: { rating: s(a.fb_rating), minutes: s(a.fb_minutes), clear: s(a.fb_clear), missing: s(a.fb_missing), confusing: s(a.fb_confusing), send_deals: s(a.fb_send_deals), call: s(a.fb_call) },
  };
}
export type LenderStatement = ReturnType<typeof buildLender>;

/* ------------------------------------------------------------------ PLACED export */

const UNKNOWN = "Unknown / not established in reviewed sources";
const yn = (b: boolean | null) => (b === null ? UNKNOWN : b ? "Y" : "N");

/** One row per product in the PLACED research-workbook column order. Evidence status is always lender-declared + unverified. */
export function placedProductRows(st: LenderStatement, meta: { lender_id: string; checked_date: string }) {
  const vt = st.valuation.types;
  return st.products.map((p, i) => ({
    research_lender_id: meta.lender_id,
    canonical_merged_id: "PENDING merged list",
    lender: st.profile.lender,
    product: p.label,
    segment: p.segment,
    security: p.family === "capital_stack" && p.charges.some((c) => /Equity|Unsecured/.test(c)) ? "Subordinated / equity" : "Secured",
    first_charge: yn(p.charges.length ? p.charges.includes("1st charge") : null),
    second_charge: yn(p.charges.length ? p.charges.some((c) => /2nd/.test(c)) : null),
    max_ltv_first: p.max_ltv_first !== null ? `${p.max_ltv_first}%` : UNKNOWN,
    max_ltv_second: p.max_ltv_second !== null ? `${p.max_ltv_second}%` : p.charges.some((c) => /2nd/.test(c)) ? UNKNOWN : "N/A",
    advertised_ltv_unspecified_charge: "N/A (lender-declared by charge)",
    ltv_basis: p.ltv_basis || UNKNOWN,
    regulated: p.key === "bridge_reg" ? "Y" : "N",
    unregulated: p.key === "bridge_reg" ? "N" : "Y",
    business_purpose: p.key === "bridge_reg" ? "N" : "Y",
    development: yn(["development"].includes(p.family) || p.key === "refurb_heavy"),
    max_ltgdv: p.max_ltgdv !== null ? `${p.max_ltgdv}%` : UNKNOWN,
    max_ltc: p.max_ltc !== null ? `${p.max_ltc}%` : UNKNOWN,
    build_cost_funding: p.works || UNKNOWN,
    avm_allowed: yn(vt.length ? vt.includes("AVM") : null),
    avm_max_ltv: st.valuation.avm[1] !== null ? `${st.valuation.avm[1]}%` : UNKNOWN,
    avm_conditions: st.valuation.conditions || UNKNOWN,
    desktop_allowed: yn(vt.length ? vt.includes("Desktop") : null),
    desktop_max_ltv: st.valuation.desktop[1] !== null ? `${st.valuation.desktop[1]}%` : UNKNOWN,
    desktop_conditions: st.valuation.conditions || UNKNOWN,
    in_house_valuer: yn(vt.length ? vt.includes("In-house valuer") : null),
    dual_rep: st.legals.representation ? (st.legals.representation.startsWith("Dual") ? "Y" : st.legals.representation.startsWith("Separate") ? "N" : "Case by case") : UNKNOWN,
    min_loan_gbp: p.min_loan ?? UNKNOWN,
    max_loan_gbp: p.max_loan ?? UNKNOWN,
    min_term_months: p.term_min ?? UNKNOWN,
    max_term_months: p.term_max ?? UNKNOWN,
    geography: st.profile.regions.join("; ") || UNKNOWN,
    promotes: [p.interest_options.join("/"), p.min_interest && `min interest ${p.min_interest}`, p.exit_after_months !== null && `exit any time after ${p.exit_after_months}m`, p.interest_time_used === "Yes" && "interest for time used", p.rollover && p.rollover !== "n/a" && `rollover: ${p.rollover}`].filter(Boolean).join("; "),
    quirks: [p.notes, ...Object.entries(p.extra).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join("; "),
    evidence_status: "lender_declared_unverified",
    source_ids: "smartlink_lender_criteria",
    source_urls: st.profile.guide_link || "",
    source_pdf_pages: "",
    checked_date: meta.checked_date,
    guide_edition: st.profile.guide_date || "",
    freshness: "Lender-declared via SmartLink; verify against written guide or BDM before matching",
    field_provenance: "SmartLink lender intake",
    review_notes: "Not approved for automatic matching until a Posfin reviewer approves",
    research_product_id: `${meta.lender_id}-${String(i + 1).padStart(2, "0")}`,
    // extra structured terms (beyond the research workbook) — BROKA capture columns
    rate_from: p.rate_from, rate_to: p.rate_to, rate_type: p.rate_basis, arrangement_fee_pct: p.arrangement_fee, exit_fee_pct: p.exit_fee, proc_fee_pct: p.proc_fee,
    interest_options: p.interest_options.join("; "), min_interest: p.min_interest, exit_after_months: p.exit_after_months, interest_time_used: p.interest_time_used, erc: p.erc,
    rollover: p.rollover, rollover_detail: p.rollover_detail, ltv_grid: p.ltv,
  }));
}

export const READBACK_STEP = LENDER_STEP_IDS.readback;

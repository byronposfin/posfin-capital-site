import { resolveBrand, type Brand, type FormId } from "./brands";
import { flagsFor, type CaseInfo } from "./cases";
import { flattenAnswers } from "./engine/flatten";
import type { Answers, Ctx, Draft } from "./engine/types";
import { validateForm } from "./engine/validate";
import { buildAL } from "./export/al-rows";
import { buildWorks } from "./export/works-rows";
import { computeALTotals } from "./forms/al-calc";
import { getSchema, initialAnswers } from "./forms/registry";
import { STAFF_ONLY_FIELDS } from "./forms/remortgage";
import { computeWorksTotals } from "./forms/works-calc";
import { getCase } from "./server";
import { buildLender, placedProductRows } from "./lender/summary";
import { storage } from "./storage";

export const FORMS: FormId[] = ["al", "remortgage", "works", "lender"];
const MAX_BODY = 512 * 1024;

export type RouteParams = { params: Promise<{ form: string; token: string }> };

export async function resolve(req: Request, { params }: RouteParams) {
  const { form, token } = await params;
  if (!FORMS.includes(form as FormId)) return { error: Response.json({ error: "unknown form" }, { status: 404 }) };
  const c = await getCase(token);
  if (!c) return { error: Response.json({ error: "link not found or expired" }, { status: 404 }) };
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  return { form: form as FormId, token, c, sp };
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const j = JSON.parse(text);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

export function derivedFor(form: FormId, a: Answers) {
  if (form === "al") return { totals: computeALTotals(a) };
  if (form === "works") return { totals: computeWorksTotals(a) };
  if (form === "lender") {
    const st = buildLender(a);
    return { totals: { products: st.headline.products, max_ltv_first: st.headline.max_ltv_first, max_ltv_second: st.headline.max_ltv_second, max_ltgdv: st.headline.max_ltgdv, gaps_missing: st.gaps.missing, gaps_conflicts: st.gaps.conflicts, cases_yes: st.case_counts.yes, cases_maybe: st.case_counts.maybe, cases_no: st.case_counts.no } };
  }
  return {};
}

export function crmExport(form: FormId, c: CaseInfo, brand: Brand, ctx: Ctx, draft: Pick<Draft, "answers" | "status"> & { updated_at?: string; submitted_at?: string }) {
  const schema = getSchema(form, brand.id, Object.keys(c.prefill));
  const answers = flattenAnswers(schema, draft.answers, ctx);
  const derived = derivedFor(form, draft.answers) as { totals?: Record<string, unknown> };
  const totals = Object.fromEntries(Object.entries(derived.totals ?? {}).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [`total_${k}`, v as never]));
  return {
    schema: `posfin.smartlink.${form}.v001`,
    case_token: c.token,
    case_ref: form === "lender" ? c.ref.replace(/^PC-/, "LC-") : c.ref,
    form,
    brand: brand.id,
    flags: ctx.flags,
    status: draft.status,
    updated_at: draft.updated_at ?? null,
    submitted_at: draft.submitted_at ?? null,
    ...(form === "remortgage" ? { staff_only_fields: Object.fromEntries(STAFF_ONLY_FIELDS.map((k) => [k, null])) } : {}),
    answers: { ...answers, ...totals },
    ...(form === "lender" ? { placed: placedExport(c, draft) } : {}),
  };
}

/** Structured PLACED block for the lender intake. Always lands as lender-declared + unverified (human review before matching). */
export function placedExport(c: CaseInfo, draft: Pick<Draft, "answers" | "status"> & { updated_at?: string; submitted_at?: string }) {
  const st = buildLender(draft.answers);
  const lender_id = `SL-${c.token}`;
  const checked = (draft.submitted_at ?? draft.updated_at ?? new Date().toISOString()).slice(0, 10);
  return {
    target: "PLACED lender_criteria / lender_products / lender_case_study_answers",
    verification_status: "unverified",
    matching_enabled: false,
    lender: { lender_id, name: st.profile.lender, type: st.profile.type, nacfb_patron: st.profile.nacfb, regions: st.profile.regions, borrower_types: st.profile.borrower_types, regulated_scope: st.profile.regulated_scope, charge_positions: st.profile.charge_positions, subordinate_appetite: st.profile.subordinate, contact_email: st.profile.email },
    products: placedProductRows(st, { lender_id, checked_date: checked }),
    valuation: st.valuation,
    asset_appetite: Object.fromEntries(st.appetite.assets.filter((r) => r.value).map((r) => [r.key, { value: r.value, note: r.note || null }])),
    hair_tolerance: Object.fromEntries(st.hair.rows.filter((r) => r.value).map((r) => [r.key, { value: r.value, note: r.note || null }])),
    legals: st.legals,
    case_study_signals: st.cases.filter((x) => x.answer).map((x) => ({ case_key: x.key, tag: x.tag, answer: x.answer, reason: x.reason || null, signals: x.signals, weight: x.answer === "Yes" ? 1 : x.answer === "Maybe" ? 0.5 : -1 })),
    partnership: st.partnership,
    gap_check: { missing: st.gaps.missing, conflicts: st.gaps.conflicts, from_guide: st.gaps.fromGuide, extraction_status: st.gaps.extraction.status, items: st.gaps.items.filter((i) => i.status !== "ok") },
    pilot_feedback: st.feedback,
  };
}

export async function currentAnswers(form: FormId, c: CaseInfo, brand: Brand) {
  const saved = await storage().getDraft(form, c.token);
  return { saved, answers: saved?.answers ?? initialAnswers(form, c, brand) };
}

export function ctxFrom(c: CaseInfo, sp: Record<string, string>, bodyFlags?: unknown): Ctx {
  const flags = flagsFor(c, sp);
  // Demo tokens may override flags from the client (for previews); real cases use the case record only.
  if (c.demo && bodyFlags && typeof bodyFlags === "object" && "titleInsurance" in (bodyFlags as object)) flags.titleInsurance = Boolean((bodyFlags as { titleInsurance: unknown }).titleInsurance);
  return { flags };
}

export function submitValidate(form: FormId, brand: Brand, c: CaseInfo, ctx: Ctx, answers: Answers) {
  const schema = getSchema(form, brand.id, Object.keys(c.prefill));
  return validateForm(schema, answers, ctx, { requireDeclaration: true });
}

export function meta(c: CaseInfo, saved: Draft | null) {
  const d = saved?.submitted_at ?? saved?.updated_at ?? new Date().toISOString();
  return { date: new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }), ref: c.ref };
}

/** Lender links carry their own LC- reference. */
export function lenderMeta(c: CaseInfo, saved: Draft | null) {
  const m = meta(c, saved);
  return { ...m, ref: c.ref.replace(/^PC-/, "LC-") };
}

export { resolveBrand, buildAL, buildWorks, buildLender };

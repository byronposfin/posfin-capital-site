import { resolveBrand, type FormId } from "./brands";
import { flagsFor, getDemoCase, TOKEN_RE, type CaseInfo } from "./cases";
import type { Answers, Ctx, Draft } from "./engine/types";
import { getSchema, initialAnswers } from "./forms/registry";
import { storage } from "./storage";

export type SP = Record<string, string | string[] | undefined>;

/**
 * Demo tokens keep their fictional cases. Any other well-formed token is a live
 * smart link. public.leads / deals / pipeline.case_register have no token column,
 * so there is nothing to join until a token map exists.
 */
export async function getCase(token: string): Promise<CaseInfo | null> {
  if (!TOKEN_RE.test(token)) return null;
  return getDemoCase(token) ?? {
    token,
    ref: (token.startsWith("PC-") ? token : `PC-${token}`).slice(0, 48),
    demo: false,
    applicant: { name: "", email: "" },
    flags: { titleInsurance: true },
    prefill: {},
  };
}

export async function loadForm(form: FormId, token: string, sp: SP) {
  const c = await getCase(token);
  if (!c) return null;
  const brand = resolveBrand(sp.brand, form, c.brand?.[form]);
  const flags = flagsFor(c, sp);
  const ctx: Ctx = { flags };
  const prefillSources = Object.keys(c.prefill);
  const schema = getSchema(form, brand.id, prefillSources);
  const saved = await storage().getDraft(form, token);
  const draft: Pick<Draft, "answers" | "step" | "status"> = saved
    ? { answers: saved.answers, step: saved.step, status: saved.status }
    : { answers: initialAnswers(form, c, brand), step: -1, status: "draft" };
  return { c, brand, flags, ctx, schema, prefillSources, draft, saved };
}

export function answersOrDemo(form: FormId, c: CaseInfo, saved: Draft | null, brandId: string): Answers {
  if (saved) return saved.answers;
  return initialAnswers(form, c, resolveBrand(brandId, form));
}

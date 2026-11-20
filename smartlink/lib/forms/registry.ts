import { BRANDS, type Brand, type FormId } from "@/lib/brands";
import type { CaseInfo } from "@/lib/cases";
import { DEMO_AL, DEMO_LENDER, DEMO_REMORTGAGE_EXTRA, DEMO_WORKS } from "@/lib/demo";
import { lenderSchema } from "./lender";
import type { Answers, FormSchema } from "@/lib/engine/types";
import { alSchema } from "./al";
import { buildRemortgageSchema, remortgagePrefill } from "./remortgage";
import { worksSchema } from "./works";

/** Isomorphic: builds the same schema on the server (validation/export) and in the browser (rendering). */
export function getSchema(form: FormId, brandId: string, prefillSources: string[] = []): FormSchema {
  if (form === "al") return alSchema;
  if (form === "works") return worksSchema;
  if (form === "lender") return lenderSchema;
  return buildRemortgageSchema({ brand: BRANDS[brandId] ?? BRANDS.posfin, prefillSources });
}

export function initialAnswers(form: FormId, c: CaseInfo, brand: Brand): Answers {
  const isFullDemo = c.token === "demo";
  if (form === "al") {
    if (isFullDemo) return structuredClone(DEMO_AL);
    return { applicant_name: c.applicant.name, email: c.applicant.email, mobile: c.applicant.mobile ?? "", company_name: c.applicant.company ?? "", referred_by: c.applicant.referred_by ?? "" };
  }
  if (form === "lender") return isFullDemo ? structuredClone(DEMO_LENDER) : {};
  if (form === "works") {
    if (isFullDemo) return structuredClone(DEMO_WORKS);
    return { borrower_name: c.applicant.company || c.applicant.name, contingency_pct: 10 };
  }
  const base = remortgagePrefill(c.prefill, brand);
  return isFullDemo ? { ...base, ...DEMO_REMORTGAGE_EXTRA } : base;
}

export const FORM_PATH: Record<FormId, string> = { al: "al", remortgage: "remortgage", works: "works", lender: "lender" };
export const FORM_TITLE: Record<FormId, string> = { al: "Assets & Liabilities", remortgage: "Remortgage questionnaire", works: "Schedule of Works", lender: "Lender criteria" };

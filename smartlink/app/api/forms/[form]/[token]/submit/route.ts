import { NextResponse } from "next/server";
import { crmExport, ctxFrom, derivedFor, readJson, resolve, resolveBrand, submitValidate, type RouteParams } from "@/lib/api";
import { hasErrors } from "@/lib/engine/validate";
import { storage } from "@/lib/storage";
import type { Answers } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

/** POST submit: server re-validates every rule, computes totals, stores the CRM export. */
export async function POST(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  const answers: Answers = { ...(body.answers as Answers), declaration_at: new Date().toISOString() };
  if (r.form === "remortgage") answers.answers_accurate = answers.declaration_accepted === true;
  const issues = submitValidate(r.form, brand, r.c, c2, answers);
  if (hasErrors(issues)) return NextResponse.json({ ok: false, issues: issues.filter((i) => i.level === "error").slice(0, 50) }, { status: 422 });
  const exp = crmExport(r.form, r.c, brand, c2, { answers, status: "submitted", submitted_at: answers.declaration_at as string });
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step: 0, status: "submitted", derived: derivedFor(r.form, answers), export: exp });
    // Hook point for Tom: notify CRM / case owner here (webhook, Supabase trigger, e-sign prep).
    return NextResponse.json({ ok: true, submitted_at: saved.submitted_at });
  } catch (e) {
    console.error(`[smartlink] submit failed form=${r.form}: ${(e as Error).message}`);
    return NextResponse.json({ error: "submit failed" }, { status: 500 });
  }
}

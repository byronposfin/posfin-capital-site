import {
  buildAL, buildLender, buildWorks, crmExport, ctxFrom, currentAnswers, derivedFor, lenderMeta, meta,
  readJson, resolve, resolveBrand, submitValidate, type RouteParams,
} from "@/lib/api";
import type { Boot } from "@/lib/boot-types";
import type { Answers } from "@/lib/engine/types";
import { hasErrors } from "@/lib/engine/validate";
import { lenderPdf } from "@/lib/export/lender-pdf";
import { lenderXlsx } from "@/lib/export/lender-xlsx";
import { alPdf, worksPdf } from "@/lib/export/pdf";
import { alXlsx, worksXlsx } from "@/lib/export/xlsx";
import type { FormId } from "@/lib/brands";
import { notifySubmission } from "@/lib/notify";
import { loadForm, type SP } from "@/lib/server";
import { storage } from "@/lib/storage";

const JSON_HEADERS = { "cache-control": "no-store" };

function resultFor(form: FormId, token: string, brandId: string, sp: SP) {
  const q = new URLSearchParams({ brand: brandId });
  const ti = sp.titleInsurance;
  if (ti !== undefined) q.set("titleInsurance", String(Array.isArray(ti) ? ti[0] : ti));
  if (form === "al") return { href: `/al/${token}/statement?${q}`, label: "View your A&L statement" };
  if (form === "works") return { href: `/works/${token}/statement?${q}`, label: "View the schedule" };
  if (form === "lender") return { href: `/lender/${token}/summary?${q}`, label: "View your criteria summary" };
  return { href: `/remortgage/${token}/summary?${q}`, label: "View a summary of your answers" };
}

async function getDraft(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const sp = r.sp as SP;
  const loaded = await loadForm(r.form, r.token, sp);
  if (!loaded) return Response.json({ error: "link not found or expired" }, { status: 404 });
  let step = loaded.draft.step;
  const stepParam = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  if (loaded.c.demo && stepParam) {
    const idx = stepParam === "review" ? loaded.schema.steps.length : loaded.schema.steps.findIndex((s) => s.id === stepParam);
    if (idx >= 0) step = idx;
  }
  const result = resultFor(r.form, r.token, loaded.brand.id, sp);
  const ref = r.form === "lender" ? loaded.c.ref.replace(/^PC-/, "LC-") : loaded.c.ref;
  const boot: Boot = {
    case: { ref, demo: loaded.c.demo, flags: loaded.c.flags },
    draft: loaded.saved
      ? { answers: loaded.saved.answers, step: loaded.saved.step, status: loaded.saved.status, version: loaded.saved.version, updated_at: loaded.saved.updated_at, submitted_at: loaded.saved.submitted_at ?? null }
      : null,
    brandId: loaded.brand.id,
    flags: loaded.flags,
    prefillSources: loaded.prefillSources,
    initial: { answers: loaded.draft.answers, step, status: loaded.draft.status },
    resultHref: result.href,
    resultLabel: result.label,
  };
  return Response.json(
    { case: { ref: r.c.ref, demo: r.c.demo, flags: r.c.flags }, draft: loaded.saved, boot },
    { headers: JSON_HEADERS },
  );
}

async function putDraft(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "invalid body" }, { status: 400 });
  const prev = await storage().getDraft(r.form, r.token);
  if (prev?.status === "submitted") return Response.json({ error: "already submitted" }, { status: 409 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const answers = body.answers as Answers;
  const step = Number.isFinite(Number(body.step)) ? Number(body.step) : 0;
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step, derived: derivedFor(r.form, answers), export: crmExport(r.form, r.c, brand, c2, { answers, status: "draft" }) });
    return Response.json({ ok: true, version: saved.version, updated_at: saved.updated_at }, { headers: JSON_HEADERS });
  } catch (e) {
    console.error(`[smartlink] save failed form=${r.form}: ${(e as Error).message}`);
    return Response.json({ error: "save failed" }, { status: 500 });
  }
}

async function postSubmit(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "invalid body" }, { status: 400 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  const answers: Answers = { ...(body.answers as Answers), declaration_at: new Date().toISOString() };
  if (r.form === "remortgage") answers.answers_accurate = answers.declaration_accepted === true;
  const issues = submitValidate(r.form, brand, r.c, c2, answers);
  if (hasErrors(issues)) return Response.json({ ok: false, issues: issues.filter((i) => i.level === "error").slice(0, 50) }, { status: 422 });
  const exp = crmExport(r.form, r.c, brand, c2, { answers, status: "submitted", submitted_at: answers.declaration_at as string });
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step: 0, status: "submitted", derived: derivedFor(r.form, answers), export: exp });
    try { await notifySubmission({ form: r.form }); } catch (e) { console.error(`[smartlink] notify failed form=${r.form}: ${(e as Error).message}`); }
    return Response.json({ ok: true, submitted_at: saved.submitted_at });
  } catch (e) {
    console.error(`[smartlink] submit failed form=${r.form}: ${(e as Error).message}`);
    return Response.json({ error: "submit failed" }, { status: 500 });
  }
}

async function getExport(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const body = crmExport(r.form, r.c, brand, ctxFrom(r.c, r.sp), { answers, status: saved?.status ?? "draft", updated_at: saved?.updated_at, submitted_at: saved?.submitted_at });
  return Response.json(body, { headers: { "cache-control": "no-store", "content-disposition": `inline; filename="${r.form}_${r.token}_crm.json"` } });
}

async function getPdf(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.form === "remortgage") return Response.json({ error: "not available" }, { status: 404 });
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const m = r.form === "lender" ? lenderMeta(r.c, saved) : meta(r.c, saved);
  const buf = r.form === "al" ? alPdf(buildAL(answers), brand, m) : r.form === "lender" ? lenderPdf(buildLender(answers), brand, m) : worksPdf(buildWorks(answers), brand, m);
  const name = r.form === "al" ? "Assets_and_Liabilities" : r.form === "lender" ? "Lender_Criteria" : "Schedule_of_Works";
  const disp = r.sp.inline ? "inline" : "attachment";
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `${disp}; filename="${name}_${m.ref}.pdf"`, "cache-control": "no-store" } });
}

async function getXlsx(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.form === "remortgage") return Response.json({ error: "not available" }, { status: 404 });
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const m = r.form === "lender" ? lenderMeta(r.c, saved) : meta(r.c, saved);
  const buf = r.form === "al" ? await alXlsx(buildAL(answers), brand, m) : r.form === "lender" ? await lenderXlsx(buildLender(answers), brand, { ...m, token: r.token }) : await worksXlsx(buildWorks(answers), brand, m);
  const name = r.form === "al" ? "Assets_and_Liabilities" : r.form === "lender" ? "Lender_Criteria" : "Schedule_of_Works";
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}_${m.ref}.xlsx"`, "cache-control": "no-store" } });
}

export async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.indexOf("forms");
  if (at < 0 || parts.length < at + 3 || parts.length > at + 4) return Response.json({ error: "not found" }, { status: 404 });
  const form = parts[at + 1];
  const token = decodeURIComponent(parts[at + 2]);
  const action = parts[at + 3] ?? "";
  const ctx: RouteParams = { params: Promise.resolve({ form, token }) };
  if (!action && req.method === "GET") return getDraft(req, ctx);
  if (!action && req.method === "PUT") return putDraft(req, ctx);
  if (action === "submit" && req.method === "POST") return postSubmit(req, ctx);
  if (action === "export" && req.method === "GET") return getExport(req, ctx);
  if (action === "pdf" && req.method === "GET") return getPdf(req, ctx);
  if (action === "xlsx" && req.method === "GET") return getXlsx(req, ctx);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  return Response.json({ error: "method not allowed" }, { status: 405 });
}

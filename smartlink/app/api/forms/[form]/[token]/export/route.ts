import { NextResponse } from "next/server";
import { crmExport, ctxFrom, currentAnswers, resolve, resolveBrand, type RouteParams } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET CRM-friendly flat JSON of the answers for a case. Staff/CRM use — protect with Tom's auth when porting. */
export async function GET(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const body = crmExport(r.form, r.c, brand, ctxFrom(r.c, r.sp), { answers, status: saved?.status ?? "draft", updated_at: saved?.updated_at, submitted_at: saved?.submitted_at });
  return NextResponse.json(body, { headers: { "cache-control": "no-store", "content-disposition": `inline; filename="${r.form}_${r.token}_crm.json"` } });
}

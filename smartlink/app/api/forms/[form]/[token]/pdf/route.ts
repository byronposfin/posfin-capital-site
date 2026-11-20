import { NextResponse } from "next/server";
import { buildAL, buildLender, buildWorks, currentAnswers, lenderMeta, meta, resolve, resolveBrand, type RouteParams } from "@/lib/api";
import { lenderPdf } from "@/lib/export/lender-pdf";
import { alPdf, worksPdf } from "@/lib/export/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.form === "remortgage") return NextResponse.json({ error: "not available" }, { status: 404 });
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const m = r.form === "lender" ? lenderMeta(r.c, saved) : meta(r.c, saved);
  const buf = r.form === "al" ? alPdf(buildAL(answers), brand, m) : r.form === "lender" ? lenderPdf(buildLender(answers), brand, m) : worksPdf(buildWorks(answers), brand, m);
  const name = r.form === "al" ? "Assets_and_Liabilities" : r.form === "lender" ? "Lender_Criteria" : "Schedule_of_Works";
  const disp = r.sp.inline ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `${disp}; filename="${name}_${m.ref}.pdf"`, "cache-control": "no-store" } });
}

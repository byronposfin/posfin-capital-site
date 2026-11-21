import { AnswersSummary } from "@/components/AnswersSummary";
import { BrandFooter, BrandHeader } from "@/components/BrandChrome";
import { PrintButton } from "@/components/PrintButton";
import { meta } from "@/lib/api";
import { brandStyle } from "@/lib/brands";
import { loadForm } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questionnaire summary · SmartLink" };

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const loaded = await loadForm("remortgage", token, sp);
  if (!loaded) return <p className="p-8 text-[15px]">This link is not valid.</p>;
  const { c, brand, ctx, schema, draft, saved } = loaded;
  const m = meta(c, saved);
  const q = new URLSearchParams({ brand: brand.id });
  if (sp.titleInsurance !== undefined) q.set("titleInsurance", String(sp.titleInsurance));
  return (
    <div style={brandStyle(brand) as React.CSSProperties} className="min-h-dvh bg-surface print:bg-white">
      <div className="no-print sticky top-0 z-20 border-b border-rule bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="mr-auto text-[13px] font-semibold text-slate-600">Answers summary{c.demo && <span className="ml-2 rounded bg-[#FFF6E0] px-1.5 py-0.5 text-[11px] text-[#8A5A00]">Demo — fictional data</span>}</span>
          <PrintButton />
          <a href={`/api/forms/remortgage/${token}/export?${q}`} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700">CRM JSON</a>
          <a href={`/remortgage/${token}?${q}`} className="inline-flex min-h-[40px] items-center rounded-lg bg-ink px-3.5 text-[13.5px] font-semibold text-white">Edit answers</a>
        </div>
      </div>
      <main className="print-sheet mx-auto max-w-3xl px-5 py-8">
        <BrandHeader brand={brand} />
        <p className="mt-6 text-[11.5px] font-bold uppercase tracking-[0.16em] text-accent">{brand.kicker}</p>
        <h1 className="font-heading mt-1 text-[30px] font-semibold text-ink">Remortgage questionnaire — your answers</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-600">
          <span>Ref <b className="text-ink">{m.ref}</b></span>
          <span>{saved?.status === "submitted" ? "Submitted" : "Last saved"} <b className="text-ink">{m.date}</b></span>
          <span>Title insurance <b className="text-ink">{ctx.flags.titleInsurance ? "Yes" : "No"}</b></span>
        </div>
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-[13.5px] text-slate-600">We’ll use these answers to prepare the solicitor’s forms for e-signature. You don’t need to print anything — this page is for your records. Bank account numbers are partly hidden.</p>
        <div className="mt-6"><AnswersSummary schema={schema} answers={draft.answers} ctx={ctx} /></div>
        {saved?.status === "submitted" && Boolean(saved.answers.declaration_name) && (
          <p className="mt-6 text-[13px] text-slate-600">Confirmed complete and accurate by <span className="font-heading text-[16px] italic text-ink">{String(saved.answers.declaration_name)}</span>.</p>
        )}
        <BrandFooter brand={brand} className="mt-10 border-t border-rule pt-4" />
      </main>
    </div>
  );
}

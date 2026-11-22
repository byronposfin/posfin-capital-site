import { DataTable, Kpis, SectionTitle, StatementShell } from "@/components/StatementShell";
import { meta } from "@/lib/api";
import { gbp, pct } from "@/lib/engine/money";
import { buildWorks } from "@/lib/export/works-rows";
import { loadForm } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule of Works · SmartLink" };
const M = (n: number | null | undefined) => (n === null || n === undefined ? "" : gbp(n, { dp: 0 }));

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const loaded = await loadForm("works", token, sp);
  if (!loaded) return <p className="p-8 text-[15px]">This link is not valid.</p>;
  const { c, brand, draft, saved } = loaded;
  const s = buildWorks(draft.answers);
  const m = meta(c, saved);
  const q = `brand=${brand.id}`;
  const borrower = s.facts.find(([k]) => k === "Borrower")?.[1] ?? "";
  return (
    <StatementShell brand={brand} title="Schedule of Works" demo={c.demo}
      meta={[["Borrower", borrower], ["Date", m.date], ["Reference", m.ref], ["Status", saved?.status === "submitted" ? "Submitted & declared" : "Draft"]]}
      actions={[
        { href: `/api/forms/works/${token}/pdf?${q}`, label: "Download PDF", primary: true },
        { href: `/api/forms/works/${token}/xlsx?${q}`, label: "Excel" },
        { href: `/api/forms/works/${token}/export?${q}`, label: "CRM JSON" },
        { href: `/works/${token}?${q}`, label: "Edit answers" },
      ]}
      note="Costs as supplied by the borrower, including labour and VAT. A high-level schedule for lender and valuer review, not a priced bill of quantities. Not verified.">
      <Kpis tiles={[
        { label: "Total inc. contingency", value: M(s.t.total) },
        { label: "Works subtotal", value: M(s.t.subtotal) },
        { label: `Contingency ${s.t.contingency_pct}%`, value: M(s.t.contingency) },
        { label: "Programme", value: s.t.programme_weeks ? `${s.t.programme_weeks} weeks` : "—" },
        { label: "Value today", value: M(s.t.current_value) || "—" },
        { label: "GDV", value: M(s.t.gdv) || "—" },
        { label: "Works / GDV", value: pct(s.t.cost_to_gdv) },
      ]} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr] print:grid-cols-[1.3fr_1fr]">
        <div>
          <SectionTitle>The project</SectionTitle>
          {s.summary && <p className="mb-3 font-heading text-[15px] italic leading-snug text-[#0A1A33]">“{s.summary}”</p>}
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 print:grid-cols-2">
            {s.facts.filter(([k]) => k !== "Borrower").map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-[12px]"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-[#0A1A33]">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div>
          <SectionTitle>Cost by trade</SectionTitle>
          <div className="space-y-1.5">
            {s.t.by_category.map((b) => (
              <div key={b.category} className="text-[11.5px]">
                <div className="flex justify-between"><span className="text-slate-600">{b.category}</span><span className="tabular font-semibold">{M(b.cost)} <span className="font-normal text-slate-400">· {pct(b.share, 0)}</span></span></div>
                <div className="mt-0.5 h-1.5 rounded-full bg-slate-100"><div className="kpi h-1.5 rounded-full" style={{ width: `${Math.max(b.share * 100, 1.5)}%`, background: brand.kind === "neutral" ? "#6B7280" : "#01BAB5" }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle note={`${s.lines.length} of 20 lines · trades, not materials`}>Works</SectionTitle>
      <DataTable cols={["#", "Trade", "Description of works", "Weeks", "Cost (inc. VAT)", "% of works"]} num={[3, 4, 5]} wide={[2]} cardTitle={1} cardSub={2}
        rows={s.lines.map((l) => [String(l.n), l.category, l.description, l.weeks === null ? "" : String(l.weeks), M(l.cost), pct(l.share)])}
        foot={["", "Works subtotal", "", "", M(s.t.subtotal), "100%"]} />
      <div className="avoid-break mt-4 flex justify-end">
        <div className="w-full rounded-lg bg-[#F4F6F9] p-4 md:w-[380px]">
          <div className="flex justify-between py-1 text-[12.5px]"><span className="text-slate-600">Works subtotal</span><span className="tabular font-semibold">{M(s.t.subtotal)}</span></div>
          <div className="flex justify-between py-1 text-[12.5px]"><span className="text-slate-600">Contingency ({s.t.contingency_pct}%)</span><span className="tabular font-semibold">{M(s.t.contingency)}</span></div>
          <div className="mt-1.5 flex justify-between border-t-2 pt-2 text-[15px] font-bold" style={{ borderColor: "var(--primary)" }}><span>Total cost of works</span><span className="tabular">{M(s.t.total)}</span></div>
          {s.t.uplift !== null && <div className="mt-2 flex justify-between text-[12px] text-slate-600"><span>Value uplift (GDV − today)</span><span className="tabular font-semibold">{M(s.t.uplift)}</span></div>}
        </div>
      </div>
      {s.experience && <><SectionTitle>Relevant experience</SectionTitle><p className="whitespace-pre-line text-[12px] text-slate-700">{s.experience}</p></>}
      {saved?.status === "submitted" && Boolean(saved.answers.declaration_name) && (
        <p className="mt-5 text-[11.5px] text-slate-600">Declared by <span className="font-heading italic text-[14px]">{String(saved.answers.declaration_name)}</span> on {m.date}.</p>
      )}
    </StatementShell>
  );
}

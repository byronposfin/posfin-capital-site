import { AnswersSummary } from "@/components/AnswersSummary";
import { BrandFooter, BrandHeader } from "@/components/BrandChrome";
import { PrintButton } from "@/components/PrintButton";
import { LenderSnapshot } from "@/components/LenderPanels";
import { DataTable, Kpis, SectionTitle, StatementShell } from "@/components/StatementShell";
import { BRANDS, brandStyle, type FormId } from "@/lib/brands";
import type { Boot } from "@/lib/boot-types";
import { gbp, pct } from "@/lib/engine/money";
import { buildAL } from "@/lib/export/al-rows";
import { buildWorks } from "@/lib/export/works-rows";
import { getSchema } from "@/lib/forms/registry";

const M = (n: number | null | undefined) => (n === null || n === undefined ? "" : gbp(n, { dp: 0 }));

function londonDate(iso?: string | null) {
  return new Date(iso || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

function query(brandId: string) {
  const q = new URLSearchParams(window.location.search);
  q.set("brand", brandId);
  return q.toString();
}

export function StatementView({ form, token, boot }: { form: FormId; token: string; boot: Boot }) {
  const brand = BRANDS[boot.brandId] ?? BRANDS.posfin;
  const answers = boot.draft?.answers ?? boot.initial.answers;
  const submitted = boot.draft?.status === "submitted";
  const date = londonDate(boot.draft?.submitted_at || boot.draft?.updated_at);
  const q = query(brand.id);
  if (form === "works") return <WorksStatement token={token} brand={brand} answers={answers} submitted={submitted} date={date} refId={boot.case.ref} demo={boot.case.demo} q={q} />;
  if (form === "al") return <AlStatement token={token} brand={brand} answers={answers} submitted={submitted} date={date} refId={boot.case.ref} demo={boot.case.demo} q={q} />;
  if (form === "remortgage") return <RemortgageSummary token={token} brand={brand} boot={boot} answers={answers} submitted={submitted} date={date} q={q} />;
  return <LenderSummary token={token} brand={brand} answers={answers} submitted={submitted} date={date} refId={boot.case.ref} demo={boot.case.demo} q={q} />;
}

function WorksStatement({ token, brand, answers, submitted, date, refId, demo, q }: ViewProps) {
  const s = buildWorks(answers);
  const borrower = s.facts.find(([k]) => k === "Borrower")?.[1] ?? "";
  return (
    <StatementShell brand={brand} title="Schedule of Works" demo={demo}
      meta={[["Borrower", borrower], ["Date", date], ["Reference", refId], ["Status", submitted ? "Submitted & declared" : "Draft"]]}
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
      {submitted && Boolean(answers.declaration_name) && (
        <p className="mt-5 text-[11.5px] text-slate-600">Declared by <span className="font-heading italic text-[14px]">{String(answers.declaration_name)}</span> on {date}.</p>
      )}
    </StatementShell>
  );
}

function AlStatement({ token, brand, answers, submitted, date, refId, demo, q }: ViewProps) {
  const s = buildAL(answers);
  const t = s.totals;
  return (
    <StatementShell brand={brand} title="Assets & Liabilities Statement" demo={demo}
      meta={[["Applicant", [s.applicant, s.joint].filter(Boolean).join(" & ")], ["Company", s.company], ["Date completed", date], ["Reference", refId], ["Status", submitted ? "Submitted & declared" : "Draft"]]}
      actions={[
        { href: `/api/forms/al/${token}/pdf?${q}`, label: "Download PDF", primary: true },
        { href: `/api/forms/al/${token}/xlsx?${q}`, label: "Excel" },
        { href: `/api/forms/al/${token}/export?${q}`, label: "CRM JSON" },
        { href: `/al/${token}?${q}`, label: "Edit answers" },
      ]}
      note="Prepared from information supplied by the applicant via SmartLink. Figures are the applicant’s own estimates and have not been verified. Each liability over £10,000 is itemised; smaller debts may be combined.">
      <Kpis tiles={[
        { label: "Net worth", value: M(s.summary.net), neg: s.summary.net < 0 },
        { label: "Total assets", value: M(t.total_assets) },
        { label: "Total liabilities", value: M(t.total_liabilities) },
        { label: "Property equity", value: M(t.equity) },
        { label: "Portfolio LTV", value: pct(t.portfolio_ltv) },
        { label: "Rent / month", value: M(t.rent_monthly) },
        { label: "Commitments / month", value: M(t.monthly_commitments) },
      ]} />
      <SectionTitle note={`${s.property.length} ${s.property.length === 1 ? "property" : "properties"} · ${t.mortgaged_count} mortgaged`}>Assets — Property</SectionTitle>
      <DataTable
        cols={["Registered owner", "Property address", "Type", "Purchased", "Value", "Rent / month", "Mortgage / month", "Lender", "Charge", "Balance", "LTV", "Equity"]}
        num={[4, 5, 6, 9, 10, 11]} wide={[1]} cardTitle={1} cardSub={0}
        empty="No property owned"
        rows={s.property.map((p) => [p.owner, `${p.address}${p.postcode ? ", " + p.postcode : ""}`, p.type, p.purchase_date, M(p.value), M(p.rent_monthly), M(p.mortgage_payment), p.lender, p.charge, M(p.balance), p.ltv === null ? "" : pct(p.ltv), M(p.equity)])}
        foot={["", "Totals", "", "", M(t.property_value), M(t.property_rent), M(t.property_payments), "", "", M(t.mortgages), pct(t.portfolio_ltv), M(t.equity)]}
      />
      <div className="grid gap-x-6 lg:grid-cols-2 print:grid-cols-2">
        <div>
          <SectionTitle note="Cash, investments, pensions, vehicles and other assets">Assets — Other</SectionTitle>
          <DataTable cols={["Registered name", "Description", "Purchased", "Lender", "Value", "Owed"]} num={[4, 5]} wide={[1]} cardTitle={1}
            rows={s.other.map((o) => [o.owner, o.description, o.purchase_date, o.lender, M(o.value), M(o.owed)])}
            foot={["", "Totals", "", "", M(t.other_value), M(t.other_owed)]} />
        </div>
        <div>
          <SectionTitle note="Excluding the mortgages above">Liabilities</SectionTitle>
          <DataTable cols={["Registered name", "Description", "Lender", "Rate", "Owed", "Monthly"]} num={[4, 5]} wide={[1]} cardTitle={1} cardSub={2}
            rows={s.liab.map((l) => [l.owner, l.description, l.lender, l.rate, M(l.balance), M(l.monthly)])}
            foot={["", "Totals", "", "", M(t.liab_balance), M(t.liab_monthly)]} />
        </div>
      </div>
      <div className="avoid-break mt-7 flex flex-col gap-4 md:flex-row md:items-stretch md:justify-end">
        <div className="rounded-lg border border-slate-200 p-4 text-[11.5px] leading-relaxed text-slate-600 md:max-w-[46%]">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Basis</div>
          Property values and balances are the applicant’s estimates. LTV = mortgage balance ÷ value. Rent entered annually has been converted to monthly. Monthly commitments = mortgage payments + itemised debt payments + small-debt payments.
        </div>
        <div className="w-full rounded-lg bg-[#F4F6F9] p-4 md:w-[380px]">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Summary</div>
          {([["Total assets — property (net of mortgages)", s.summary.property_net], ["Total assets — other (net of finance)", s.summary.other_net], ["Total liabilities", -s.summary.liabilities]] as [string, number][]).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-[12.5px]"><span className="text-slate-600">{k}</span><span className="tabular font-semibold">{M(v)}</span></div>
          ))}
          <div className={`mt-1.5 flex justify-between border-t-2 border-[#0A1A33] pt-2 text-[15px] font-bold ${s.summary.net < 0 ? "text-[#B42318]" : "text-[#0A1A33]"}`}><span>Net worth</span><span className="tabular">{M(s.summary.net)}</span></div>
        </div>
      </div>
      {submitted && Boolean(answers.declaration_name) && (
        <p className="mt-5 text-[11.5px] text-slate-600">Declared accurate by <span className="font-heading italic text-[14px] text-[#0A1A33]">{String(answers.declaration_name)}</span> on {date}.</p>
      )}
    </StatementShell>
  );
}

function RemortgageSummary({ token, brand, boot, answers, submitted, date, q }: { token: string; brand: ReturnType<typeof brandOf>; boot: Boot; answers: Boot["initial"]["answers"]; submitted: boolean; date: string; q: string }) {
  const schema = getSchema("remortgage", brand.id, boot.prefillSources);
  return (
    <div style={brandStyle(brand) as React.CSSProperties} className="min-h-dvh bg-surface print:bg-white">
      <div className="no-print sticky top-0 z-20 border-b border-rule bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="mr-auto text-[13px] font-semibold text-slate-600">Answers summary{boot.case.demo && <span className="ml-2 rounded bg-[#FFF6E0] px-1.5 py-0.5 text-[11px] text-[#8A5A00]">Demo — fictional data</span>}</span>
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
          <span>Ref <b className="text-ink">{boot.case.ref}</b></span>
          <span>{submitted ? "Submitted" : "Last saved"} <b className="text-ink">{date}</b></span>
          <span>Title insurance <b className="text-ink">{boot.flags.titleInsurance ? "Yes" : "No"}</b></span>
        </div>
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-[13.5px] text-slate-600">We’ll use these answers to prepare the solicitor’s forms for e-signature. You don’t need to print anything — this page is for your records. Bank account numbers are partly hidden.</p>
        <div className="mt-6"><AnswersSummary schema={schema} answers={answers} ctx={{ flags: boot.flags }} /></div>
        {submitted && Boolean(answers.declaration_name) && (
          <p className="mt-6 text-[13px] text-slate-600">Confirmed complete and accurate by <span className="font-heading text-[16px] italic text-ink">{String(answers.declaration_name)}</span>.</p>
        )}
        <BrandFooter brand={brand} className="mt-10 border-t border-rule pt-4" />
      </main>
    </div>
  );
}

function LenderSummary({ token, brand, answers, date, refId, demo, q }: ViewProps) {
  return (
    <StatementShell brand={brand} title="Lender criteria" demo={demo}
      meta={[["Date", date], ["Reference", refId]]}
      actions={[
        { href: `/api/forms/lender/${token}/pdf?${q}`, label: "Download PDF", primary: true },
        { href: `/api/forms/lender/${token}/xlsx?${q}`, label: "Excel" },
        { href: `/api/forms/lender/${token}/export?${q}`, label: "CRM JSON" },
        { href: `/lender/${token}?${q}`, label: "Edit answers" },
      ]}
      note="Lender-declared and unverified. Nothing here is used for matching until a person has checked it.">
      <div className="mt-6"><LenderSnapshot answers={answers} /></div>
    </StatementShell>
  );
}

type ViewProps = {
  token: string;
  brand: ReturnType<typeof brandOf>;
  answers: Boot["initial"]["answers"];
  submitted: boolean;
  date: string;
  refId: string;
  demo: boolean;
  q: string;
};

function brandOf() {
  return BRANDS.posfin;
}

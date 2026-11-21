import { DataTable, Kpis, SectionTitle, StatementShell } from "@/components/StatementShell";
import { meta } from "@/lib/api";
import { gbp, pct } from "@/lib/engine/money";
import { buildAL } from "@/lib/export/al-rows";
import { loadForm } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "A&L Statement · SmartLink" };

const M = (n: number | null | undefined) => (n === null || n === undefined ? "" : gbp(n, { dp: 0 }));

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { c, brand, draft, saved } = await loadForm("al", token, sp);
  const s = buildAL(draft.answers);
  const t = s.totals;
  const m = meta(c, saved);
  const q = `brand=${brand.id}`;
  return (
    <StatementShell brand={brand} title="Assets & Liabilities Statement" demo={c.demo}
      meta={[["Applicant", [s.applicant, s.joint].filter(Boolean).join(" & ")], ["Company", s.company], ["Date completed", m.date], ["Reference", m.ref], ["Status", saved?.status === "submitted" ? "Submitted & declared" : "Draft"]]}
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
          {[["Total assets — property (net of mortgages)", s.summary.property_net], ["Total assets — other (net of finance)", s.summary.other_net], ["Total liabilities", -s.summary.liabilities]].map(([k, v]) => (
            <div key={k as string} className="flex justify-between py-1 text-[12.5px]"><span className="text-slate-600">{k}</span><span className="tabular font-semibold">{M(v as number)}</span></div>
          ))}
          <div className={`mt-1.5 flex justify-between border-t-2 border-[#0A1A33] pt-2 text-[15px] font-bold ${s.summary.net < 0 ? "text-[#B42318]" : "text-[#0A1A33]"}`}><span>Net worth</span><span className="tabular">{M(s.summary.net)}</span></div>
        </div>
      </div>
      {saved?.status === "submitted" && Boolean(saved.answers.declaration_name) && (
        <p className="mt-5 text-[11.5px] text-slate-600">Declared accurate by <span className="font-heading italic text-[14px] text-[#0A1A33]">{String(saved.answers.declaration_name)}</span> on {m.date}.</p>
      )}
    </StatementShell>
  );
}

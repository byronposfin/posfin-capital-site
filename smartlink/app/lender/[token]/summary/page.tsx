import { DataTable, Kpis, SectionTitle, StatementShell } from "@/components/StatementShell";
import { buildLender, lenderMeta } from "@/lib/api";
import { exitCell, ltvCell, range, rateCell, termCell } from "@/lib/export/lender-pdf";
import type { TolRow } from "@/lib/lender/summary";
import { gbpShort } from "@/lib/lender/summary";
import { loadForm } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lender criteria summary · SmartLink" };

const TONE: Record<string, string> = {
  Accept: "bg-[#E7F7EF] text-[#16613F] border-[#BFE6D2]", "Case by case": "bg-[#FFF4DC] text-[#7A5600] border-[#F1DB9F]", Decline: "bg-[#FDECEA] text-[#9B1C1C] border-[#F3C3C0]",
  Yes: "bg-[#E7F7EF] text-[#16613F] border-[#BFE6D2]", Maybe: "bg-[#FFF4DC] text-[#7A5600] border-[#F1DB9F]", No: "bg-[#FDECEA] text-[#9B1C1C] border-[#F3C3C0]",
};
const P = (x: number | null) => (x === null ? "—" : `${x}%`);

function TolGrid({ rows }: { rows: TolRow[] }) {
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g} className="avoid-break">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{g}</div>
          <div className="flex flex-wrap gap-1.5">
            {rows.filter((r) => r.group === g).map((r) => (
              <span key={r.key} title={r.note} className={`rounded-md border px-2 py-1 text-[11px] leading-tight ${r.value ? TONE[r.value] : "border-dashed border-slate-300 text-slate-400"}`}>
                {r.label}{r.note ? <span className="opacity-75"> · {r.note}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-3 pt-1 text-[10.5px] text-slate-500">
        {["Accept", "Case by case", "Decline"].map((t) => <span key={t} className="flex items-center gap-1"><span className={`inline-block h-2.5 w-2.5 rounded-sm border ${TONE[t]}`} />{t}</span>)}
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-slate-300" />Not answered</span>
      </div>
    </div>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 text-[12px]"><dt className="shrink-0 text-slate-500">{k}</dt><dd className="text-right font-semibold text-[#0A1A33]">{v}</dd></div>
      ))}
    </dl>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const loaded = await loadForm("lender", token, sp);
  if (!loaded) return <p className="p-8 text-[15px]">This link is not valid.</p>;
  const { c, brand, draft, saved } = loaded;
  const s = buildLender(draft.answers);
  const m = lenderMeta(c, saved);
  const q = `brand=${brand.id}`;
  const pr = s.profile;
  const open = s.gaps.items.filter((i) => i.status !== "ok");
  const roll = s.products.filter((p) => Object.keys(p.rollover_detail).length);
  const pt = s.partnership;
  return (
    <StatementShell brand={brand} title="Lender Criteria Summary" demo={c.demo}
      meta={[["Lender", pr.lender], ["Date", m.date], ["Reference", m.ref], ["Status", saved?.status === "submitted" ? "Submitted · unverified" : "Draft · unverified"]]}
      actions={[
        { href: `/api/forms/lender/${token}/pdf?${q}`, label: "Download PDF", primary: true },
        { href: `/api/forms/lender/${token}/xlsx?${q}`, label: "Excel" },
        { href: `/api/forms/lender/${token}/export?${q}`, label: "PLACED JSON" },
        { href: `/lender/${token}?${q}`, label: "Edit answers" },
      ]}
      note="Lender-declared criteria via SmartLink. Unverified: check against the written guide or a confirmed BDM response, and approve, before using for matching. Not a commitment to lend.">
      <Kpis tiles={[
        { label: "Products", value: String(s.headline.products) },
        { label: "Loan range", value: s.headline.loan_range || "—" },
        { label: "Max LTV 1st", value: P(s.headline.max_ltv_first) },
        { label: "Max LTV 2nd", value: P(s.headline.max_ltv_second) },
        { label: "Max LTGDV", value: P(s.headline.max_ltgdv) },
        { label: "Deals Y / M / N", value: `${s.case_counts.yes} / ${s.case_counts.maybe} / ${s.case_counts.no}` },
        { label: "Open gaps", value: String(s.gaps.missing + s.gaps.conflicts), neg: s.gaps.missing + s.gaps.conflicts > 0 },
      ]} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3 print:grid-cols-3">
        <div>
          <SectionTitle>Profile</SectionTitle>
          <KV rows={[["Type", pr.type], ["NACFB patron", pr.nacfb], ["Regulated lending", pr.regulated_lending], ["Contact", pr.contact], ["Email", pr.email], ["BDM", pr.bdm], ["Product guide", [pr.guide, pr.guide_date].filter(Boolean).join(" · ")]]} />
        </div>
        <div>
          <SectionTitle>Reach</SectionTitle>
          <KV rows={[["Regions", pr.regions.join(", ")], ["Avoids", pr.exclusions], ["Borrowers", pr.borrower_types.join(", ")], ["Min property value", gbpShort(pr.min_property_value)], ["Max exposure", gbpShort(pr.max_exposure)]]} />
        </div>
        <div>
          <SectionTitle>Lending shape</SectionTitle>
          <KV rows={[["Scope", pr.regulated_scope], ["Charges", pr.charge_positions.join(", ")], ["Behind senior debt", pr.subordinate], ["Sweet spot", [gbpShort(pr.sweet_loan), pr.sweet_ltv !== null ? `${pr.sweet_ltv}% LTV` : ""].filter(Boolean).join(" at ")]]} />
        </div>
      </div>

      <SectionTitle note="Max leverage shown as the highest declared across asset types">Products</SectionTitle>
      <DataTable cols={["Product", "Loan", "Max leverage", "Basis", "Term", "Min interest", "Early exit", "Rate", "Arr. fee", "Interest", "Rollover"]} cardTitle={0} wide={[0]}
        rows={s.products.map((p) => [p.label, range(p.min_loan, p.max_loan), ltvCell(p), p.ltv_basis, termCell(p), p.min_interest, exitCell(p), rateCell(p), p.arrangement_fee !== null ? `${p.arrangement_fee}%` : "", p.interest_options.join(", "), p.rollover === "n/a" ? "" : p.rollover])}
        empty="No products selected" />

      <div className="mt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
        {s.products.map((p) => (
          <div key={p.key} className="avoid-break rounded-lg border border-slate-200 p-3">
            <div className="mb-1.5 text-[12px] font-semibold text-[#0A1A33]">{p.short} <span className="font-normal text-slate-400">· {p.ltv_basis || "basis n/k"}</span></div>
            <table className="w-full text-[11px]">
              <thead><tr><th className="text-left font-semibold text-slate-400"></th>{p.ltv_cols.map((col) => <th key={col} className="text-right font-semibold text-slate-400">{col}</th>)}</tr></thead>
              <tbody>
                {Object.entries(p.ltv).map(([row, cells]) => (
                  <tr key={row} className="border-t border-slate-100"><td className="py-1 text-slate-600">{row}</td>{p.ltv_cols.map((col) => <td key={col} className="py-1 text-right font-semibold tabular text-[#0A1A33]">{cells?.[col] ? `${cells[col]}%` : "–"}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {roll.length > 0 && <>
        <SectionTitle>Rollovers & extensions</SectionTitle>
        <DataTable cols={["Product", "Offered", "Max LTV", "Capital paydown", "Re-retain interest", "Fee", "Revaluation", "Max rollovers"]} cardTitle={0}
          rows={roll.map((p) => [p.label, p.rollover_offered, p.rollover_detail["Max LTV"] ?? "", p.rollover_detail["Capital paydown"] ?? "", p.rollover_detail["Re-retain interest"] ?? "", p.rollover_detail["Fee"] ?? "", p.rollover_detail["Revaluation"] ?? "", p.rollover_detail["Max rollovers"] ?? ""])} />
      </>}

      <div className="mt-2 grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <div>
          <SectionTitle note={`${s.appetite.accept} accept · ${s.appetite.cbc} case by case · ${s.appetite.decline} decline`}>Asset appetite · {s.appetite.style || "—"}</SectionTitle>
          <TolGrid rows={s.appetite.assets} />
        </div>
        <div>
          <SectionTitle note={`Look-back ${s.hair.lookback || "—"}`}>Hair on the deal</SectionTitle>
          <TolGrid rows={s.hair.rows} />
          {s.hair.auto_declines && <p className="mt-2 text-[11.5px] text-slate-600"><b>Automatic declines:</b> {s.hair.auto_declines}</p>}
        </div>
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <div>
          <SectionTitle>Valuation</SectionTitle>
          <KV rows={[["Types", s.valuation.types.join(", ")], ["AVM", s.valuation.avm.some((x) => x !== null) ? `to ${gbpShort(s.valuation.avm[0])} · ${P(s.valuation.avm[1])}` : ""], ["Desktop", s.valuation.desktop.some((x) => x !== null) ? `to ${gbpShort(s.valuation.desktop[0])} · ${P(s.valuation.desktop[1])}` : ""], ["Drive-by", s.valuation.driveby.some((x) => x !== null) ? `to ${gbpShort(s.valuation.driveby[0])} · ${P(s.valuation.driveby[1])}` : ""], ["Conditions", s.valuation.conditions], ["Panel", s.valuation.panel], ["Turnaround", s.valuation.turnaround]]} />
        </div>
        <div>
          <SectionTitle>Legals & process</SectionTitle>
          <KV rows={[["Legal due diligence", s.legals.dd.join("; ")], ["Representation", s.legals.representation], ["Borrower’s solicitor", s.legals.solicitor], ["Min partners", s.legals.min_partners], ["Pre-legal rounds", s.legals.ple_rounds], ["Valuation instructed", s.legals.val_instruction], ["Offer / completion", [s.legals.time_offer, s.legals.time_complete].filter(Boolean).join(" / ")]]} />
        </div>
      </div>

      <SectionTitle note="Fictional scenarios · answers stored as appetite signals">Case studies</SectionTitle>
      <div className="grid gap-2 md:grid-cols-2 print:grid-cols-2">
        {s.cases.map((k) => (
          <div key={k.key} className="avoid-break flex items-start gap-3 rounded-lg border border-slate-200 p-2.5">
            <span className={`mt-0.5 w-[54px] shrink-0 rounded-md border py-1 text-center text-[11px] font-bold ${k.answer ? TONE[k.answer] : "border-dashed border-slate-300 text-slate-400"}`}>{k.answer || "—"}</span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-[#0A1A33]">{k.title} <span className="font-normal text-slate-400">· {k.tag}</span></div>
              <div className="text-[11px] text-slate-500">{k.facts.slice(0, 4).map(([a, b]) => `${a} ${b}`).join(" · ")}</div>
              {k.reason && <div className="mt-0.5 text-[11.5px] italic text-slate-700">“{k.reason}”</div>}
            </div>
          </div>
        ))}
      </div>

      {(pt.mezz || pt.loan_notes.appetite || pt.pref_shares.response || pt.meet) && <>
        <SectionTitle note="Conversation starter, not terms">Partnership & mezzanine appetite</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-3 print:grid-cols-3">
          <div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Mezzanine</div>
            <KV rows={[["Behind developer senior", pt.mezz], ["Typical ticket", pt.ticket], ["Minimum deal", pt.min_deal], ["Situations", pt.situations.join(", ")], ["Sit-down", pt.meet]]} /></div>
          <div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Route 1 · Loan notes</div>
            <KV rows={[["Appetite", pt.loan_notes.appetite], ["Ticket", pt.loan_notes.ticket], ["Term", pt.loan_notes.term], ["Target coupon", pt.loan_notes.coupon], ["Security", pt.loan_notes.security.join(", ")]]} /></div>
          <div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Route 2 · Preferred shares + profit share</div>
            <KV rows={[["Response", pt.pref_shares.response], ["Splits (illustrative)", pt.pref_shares.splits.join(", ")], ["Preferred return", pt.pref_shares.pref], ["Variation", pt.pref_shares.variation]]} /></div>
        </div>
        <p className="mt-2 text-[10.5px] italic text-slate-500">Illustrative example shown to the lender, not an offer: {pt.pref_shares.illustrative}.</p>
        {pt.notes && <p className="mt-2 font-heading text-[14px] italic text-[#0A1A33]">“{pt.notes}”</p>}
      </>}

      <SectionTitle note={`Guide: ${s.gaps.extraction.file ?? "none"} · ${s.gaps.extraction.status}${s.gaps.extraction.method ? ` (${s.gaps.extraction.method})` : ""}`}>Read-back & gaps</SectionTitle>
      <DataTable cols={["Section", "Item", "Status", "Form", "Guide", "Page"]} cardTitle={1} cardSub={0} empty="No gaps — complete"
        rows={open.map((i) => [i.section, i.label, i.status === "missing" ? "Missing" : i.status === "conflict" ? "Conflict" : "From guide", i.form ?? "", i.guide ?? "", i.page ?? ""])} />

      {(s.feedback.rating || s.feedback.clear || s.feedback.missing) && <>
        <SectionTitle note="Pilot">Lender feedback on the form</SectionTitle>
        <KV rows={[["Overall", s.feedback.rating], ["Time taken", s.feedback.minutes], ["What made sense", s.feedback.clear], ["What we missed", s.feedback.missing], ["Confusing", s.feedback.confusing], ["Send deals", s.feedback.send_deals === "yes" ? "Yes" : s.feedback.send_deals === "no" ? "No" : ""], ["Wants a call", s.feedback.call === "yes" ? "Yes" : s.feedback.call === "no" ? "No" : ""]]} />
      </>}
    </StatementShell>
  );
}

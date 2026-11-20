"use client";
import { gbp, pct } from "@/lib/engine/money";
import type { Answers } from "@/lib/engine/types";
import { computeALTotals } from "@/lib/forms/al-calc";
import { computeWorksTotals, WORKS_MAX_LINES } from "@/lib/forms/works-calc";

function Stat({ label, value, tone, big }: { label: string; value: string; tone?: "neg" | "pos"; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
      <div className={`tabular truncate ${big ? "text-[22px]" : "text-[17px]"} font-semibold ${tone === "neg" ? "text-[#FF8A80]" : "text-white"}`}>{value}</div>
    </div>
  );
}

export function ALTotalsPanel({ answers }: { answers: Answers }) {
  const t = computeALTotals(answers);
  return (
    <section aria-label="Live totals" className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg shadow-slate-900/10">
      <div className="flex items-end justify-between gap-3 px-5 pt-4">
        <Stat label="Net worth" value={gbp(t.net_worth, { dp: 0 })} tone={t.net_worth < 0 ? "neg" : undefined} big />
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Portfolio LTV</div>
          <div className="tabular text-[22px] font-semibold" style={{ color: "#5EEAD4" }}>{pct(t.portfolio_ltv)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 px-5 py-4">
        <Stat label="Property value" value={gbp(t.property_value, { dp: 0 })} />
        <Stat label="Equity" value={gbp(t.equity, { dp: 0 })} tone={t.equity < 0 ? "neg" : undefined} />
        <Stat label="Rent / month" value={gbp(t.rent_monthly, { dp: 0 })} />
        <Stat label="Commitments / month" value={gbp(t.monthly_commitments, { dp: 0 })} />
        <Stat label="Total assets" value={gbp(t.total_assets, { dp: 0 })} />
        <Stat label="Total liabilities" value={gbp(t.total_liabilities, { dp: 0 })} />
      </div>
    </section>
  );
}

export function WorksTotalsPanel({ answers }: { answers: Answers }) {
  const t = computeWorksTotals(answers);
  return (
    <section aria-label="Live totals" className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg shadow-slate-900/10">
      <div className="flex items-end justify-between gap-3 px-5 pt-4">
        <Stat label="Total inc. contingency" value={gbp(t.total, { dp: 0 })} big />
        <div className="text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Lines</div>
          <div className={`tabular text-[22px] font-semibold ${t.lines >= WORKS_MAX_LINES ? "text-[#FFD27A]" : "text-white"}`}>{t.lines}<span className="text-white/45 text-[15px]"> / {WORKS_MAX_LINES}</span></div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 px-5 py-4">
        <Stat label="Works subtotal" value={gbp(t.subtotal, { dp: 0 })} />
        <Stat label={`Contingency ${t.contingency_pct}%`} value={gbp(t.contingency, { dp: 0 })} />
        <Stat label="Programme" value={t.programme_weeks ? `${t.programme_weeks} weeks` : "—"} />
        <Stat label="Cost / GDV" value={pct(t.cost_to_gdv)} />
      </div>
      {t.by_category.length > 0 && (
        <div className="flex h-2 w-full">
          {t.by_category.slice(0, 8).map((c, i) => (
            <div key={c.category} title={c.category} style={{ width: `${c.share * 100}%`, background: `color-mix(in srgb, var(--accent) ${100 - i * 10}%, #0A1A33)` }} />
          ))}
        </div>
      )}
    </section>
  );
}

import type { Brand } from "@/lib/brands";
import { brandStyle, POSFIN_FOOTER } from "@/lib/brands";
import { PosfinWordmark } from "./BrandChrome";
import { PrintButton } from "./PrintButton";

export function StatementShell({ brand, title, meta, actions, note, demo, children }: {
  brand: Brand; title: string; meta: [string, string][]; actions: { href: string; label: string; primary?: boolean }[]; note: string; demo?: boolean; children: React.ReactNode;
}) {
  const neutral = brand.kind === "neutral";
  const style = { ...brandStyle(neutral ? brand : { ...brand, colours: { ...brand.colours, primary: "#0A1A33", ink: "#0A1A33", accent: "#01BAB5" } }) } as React.CSSProperties;
  return (
    <div style={style} className="min-h-dvh bg-[#E9EDF2] print:bg-white">
      <div className="no-print sticky top-0 z-20 border-b border-slate-300/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2 px-4 py-2.5">
          <span className="mr-auto text-[13px] font-semibold text-slate-600">{title}{demo && <span className="ml-2 rounded bg-[#FFF6E0] px-1.5 py-0.5 text-[11px] text-[#8A5A00]">Demo — fictional data</span>}</span>
          <PrintButton />
          {actions.map((a) => (
            <a key={a.href} href={a.href} className={`inline-flex min-h-[40px] items-center rounded-lg px-3.5 text-[13.5px] font-semibold ${a.primary ? "bg-[#0A1A33] text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{a.label}</a>
          ))}
        </div>
      </div>
      <div className="print-sheet statement mx-auto my-6 w-full max-w-[1180px] bg-white px-5 py-6 shadow-[0_10px_40px_-12px_rgba(10,26,51,.25)] sm:rounded-sm md:px-[14mm] md:py-[11mm] print:my-0">
        <header className="flex flex-col gap-4 border-b-[3px] pb-4 md:flex-row md:items-end md:justify-between" style={{ borderColor: neutral ? "#9CA3AF" : "#01BAB5" }}>
          <div>
            {neutral ? <div className="text-[18px] font-bold uppercase tracking-[0.16em] text-gray-800">{title}</div> : <PosfinWordmark size="lg" />}
            {!neutral && <h1 className="font-heading mt-1.5 text-[22px] font-semibold text-[#0A1A33]">{title}</h1>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px] md:text-right">
            {meta.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500 md:text-right">{k}</dt>
                <dd className="font-semibold text-[#0A1A33] tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </header>
        {children}
        <footer className="mt-8 border-t border-slate-200 pt-3 text-[10.5px] leading-relaxed text-slate-500">
          <p>{note}</p>
          {!neutral && <p>{POSFIN_FOOTER}</p>}
        </footer>
      </div>
    </div>
  );
}

export function Kpis({ tiles }: { tiles: { label: string; value: string; neg?: boolean }[] }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 print:grid-cols-7">
      {tiles.map((t, i) => (
        <div key={t.label} className={`kpi rounded-lg px-3.5 py-3 ${i === 0 ? "bg-ink text-white" : "bg-[#F4F6F9]"}`}>
          <div className={`text-[9.5px] font-bold uppercase tracking-[0.08em] ${i === 0 ? "text-white/60" : "text-slate-500"}`}>{t.label}</div>
          <div className={`mt-1 text-[18px] font-semibold tabular leading-tight ${t.neg ? "text-[#B42318]" : i === 0 ? "text-white" : "text-[#0A1A33]"}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-2 mt-7 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-heading text-[16px] font-semibold text-[#0A1A33]">{children}</h2>
      {note && <span className="text-[10.5px] text-slate-500">{note}</span>}
    </div>
  );
}

/** Table on md+ and in print; stacked cards on mobile. */
export function DataTable({ cols, rows, foot, num = [], wide = [], cardTitle, cardSub, empty = "None declared" }: {
  cols: string[]; rows: (string | null)[][]; foot?: (string | null)[]; num?: number[]; wide?: number[];
  cardTitle: number; cardSub?: number; empty?: string;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block print:block">
        <table>
          <thead><tr>{cols.map((c, i) => <th key={c} className={num.includes(i) ? "num" : ""}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} className="italic text-slate-400">{empty}</td></tr>}
            {rows.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={num.includes(i) ? "num" : wide.includes(i) ? "wide" : ""}>{v ?? ""}</td>)}</tr>)}
          </tbody>
          {foot && <tfoot><tr>{foot.map((v, i) => <td key={i} className={num.includes(i) ? "num" : ""}>{v ?? ""}</td>)}</tr></tfoot>}
        </table>
      </div>
      <div className="space-y-2.5 md:hidden print:hidden">
        {rows.length === 0 && <p className="text-[13px] italic text-slate-400">{empty}</p>}
        {rows.map((r, ri) => (
          <div key={ri} className="rounded-xl border border-slate-200 p-3.5">
            <div className="text-[14px] font-semibold text-[#0A1A33]">{r[cardTitle]}</div>
            {cardSub !== undefined && r[cardSub] && <div className="text-[12px] text-slate-500">{r[cardSub]}</div>}
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {r.map((v, i) => (i === cardTitle || i === cardSub || !v ? null : (
                <div key={i}><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{cols[i]}</dt><dd className={`text-[13px] text-[#0A1A33] ${num.includes(i) ? "tabular font-semibold" : ""}`}>{v}</dd></div>
              )))}
            </dl>
          </div>
        ))}
        {foot && (
          <div className="rounded-xl bg-[#E6F7F6] p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Totals</div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {foot.map((v, i) => (!v || v === "Totals" ? null : <div key={i}><dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{cols[i]}</dt><dd className="text-[13.5px] font-bold tabular text-[#0A1A33]">{v}</dd></div>))}
            </dl>
          </div>
        )}
      </div>
    </>
  );
}

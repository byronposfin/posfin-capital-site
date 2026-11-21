"use client";
import type { Answers } from "@/lib/engine/types";
import { applyGuideValue, buildLender, gapCheck } from "@/lib/lender/summary";

type SetA = (fn: (a: Answers) => Answers) => void;

const BADGE: Record<string, string> = {
  missing: "bg-[#FFF4DC] text-[#7A5600]",
  conflict: "bg-[#FDECEA] text-[#9B1C1C]",
  from_guide: "bg-[color-mix(in_srgb,var(--accent)_14%,white)] text-[var(--accent-ink)]",
};
const LABEL: Record<string, string> = { missing: "Missing", conflict: "Check", from_guide: "From your guide" };

/** Read-back: what we have from the guide + answers, with gaps highlighted and one-tap fixes. */
export function LenderGapCheckPanel({ answers, setAnswers, onJump }: { answers: Answers; setAnswers: SetA; onJump: (stepId: string) => void }) {
  const g = gapCheck(answers);
  const ex = g.extraction;
  const open = g.items.filter((i) => i.status !== "ok");
  const sections = [...new Set(open.map((i) => i.section))];
  return (
    <section aria-label="Read-back" className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg shadow-slate-900/10">
        <div className="px-5 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Your product guide</div>
          <div className="mt-0.5 truncate text-[16px] font-semibold">{ex.file ?? ((answers.guide_file as { name?: string } | undefined)?.name || "No guide uploaded")}</div>
          <div className="mt-0.5 text-[12.5px] text-white/60">
            {ex.status === "extracted" || ex.status === "reviewed" ? `We read ${ex.items.length} terms from it` : ex.status === "queued" ? "Received — our team will read it and send you a read-back" : "Upload one any time to save typing"}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 border-t border-white/10 text-center">
          {[["Complete", g.ok, "#5EEAD4"], ["To check", g.conflicts + g.fromGuide, "#FFD27A"], ["Missing", g.missing, "#FF8A80"]].map(([l, n, c]) => (
            <div key={String(l)} className="px-2 py-3">
              <div className="tabular text-[22px] font-semibold" style={{ color: String(c) }}>{n}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {open.length === 0 && <p className="rounded-xl bg-[#E7F7EF] px-4 py-3 text-[14.5px] font-medium text-[#16613F]">Nothing missing — thank you.</p>}
      {sections.map((sec) => (
        <div key={sec} className="overflow-hidden rounded-2xl border border-rule bg-white">
          <div className="border-b border-rule bg-surface px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">{sec}</div>
          <ul>
            {open.filter((i) => i.section === sec).map((i) => (
              <li key={i.path} className="flex items-center gap-3 border-b border-rule px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold leading-snug text-ink">{i.label}</div>
                  {i.status === "conflict" && <div className="mt-0.5 text-[13px] text-slate-600 tabular">You said <b>{i.form}</b> · guide says <b>{i.guide}</b>{i.page ? ` (p.${i.page})` : ""}</div>}
                  {i.status === "from_guide" && <div className="mt-0.5 text-[13px] text-slate-600 tabular">Guide says <b>{i.guide}</b>{i.page ? ` (p.${i.page})` : ""}</div>}
                  <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${BADGE[i.status]}`}>{LABEL[i.status]}</span>
                </div>
                {i.guide && i.status !== "missing" ? (
                  <button type="button" onClick={() => setAnswers((a) => applyGuideValue(a, i.path, i.guide!))} className="min-h-[40px] shrink-0 rounded-xl bg-ink px-3 text-[13px] font-semibold text-white">Use guide</button>
                ) : null}
                <button type="button" onClick={() => onJump(i.step)} className="min-h-[40px] shrink-0 rounded-xl border border-rule px-3 text-[13px] font-semibold text-ink">{i.status === "missing" ? "Fill in" : "Edit"}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Compact snapshot on the review screen. */
export function LenderSnapshot({ answers }: { answers: Answers }) {
  const s = buildLender(answers);
  const tiles: [string, string][] = [
    ["Products", String(s.headline.products)],
    ["Loan range", s.headline.loan_range || "—"],
    ["Max LTV 1st", s.headline.max_ltv_first !== null ? `${s.headline.max_ltv_first}%` : "—"],
    ["Max LTGDV", s.headline.max_ltgdv !== null ? `${s.headline.max_ltgdv}%` : "—"],
    ["Deals: yes / maybe / no", `${s.case_counts.yes} / ${s.case_counts.maybe} / ${s.case_counts.no}`],
    ["Open gaps", String(s.gaps.missing + s.gaps.conflicts)],
  ];
  return (
    <section aria-label="Snapshot" className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg shadow-slate-900/10">
      <div className="px-5 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Lender</div>
        <div className="truncate text-[20px] font-semibold">{s.profile.lender || "—"}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 px-5 py-4">
        {tiles.map(([l, v]) => (
          <div key={l} className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{l}</div>
            <div className="truncate text-[17px] font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

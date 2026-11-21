import { evalCond } from "@/lib/engine/conditions";
import { formatValue } from "@/lib/engine/format";
import type { Answers, Ctx, Field, FormSchema, Item } from "@/lib/engine/types";

function Row({ f, v, answers }: { f: Field; v: unknown; answers: Answers }) {
  const s = formatValue(f, v, answers);
  if (!s) return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-[var(--rule)] py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] leading-snug text-slate-500">{f.label}</dt>
      <dd className="whitespace-pre-line text-[14.5px] font-medium leading-snug text-ink tabular">{s}</dd>
    </div>
  );
}

function stepHasAnswers(s: FormSchema["steps"][number], answers: Answers, ctx: Ctx) {
  return s.nodes.some((n) => {
    if (n.kind === "notice") return false;
    if (n.kind === "repeater") return evalCond(n.when, answers, ctx) && ((((answers[n.id] as Item[]) ?? []).length > 0) || (n.noneField ? answers[n.noneField] === true : false));
    return evalCond(n.when, answers, ctx) && formatValue(n, answers[n.id], answers) !== "";
  });
}

export function AnswersSummary({ schema, answers, ctx, onEdit, compact }: { schema: FormSchema; answers: Answers; ctx: Ctx; onEdit?: (stepId: string) => void; compact?: boolean }) {
  return (
    <div className="space-y-4">
      {schema.steps.filter((s) => evalCond(s.when, answers, ctx)).map((s) => (
        <section key={s.id} className="avoid-break rounded-2xl border border-rule bg-white px-5 py-4">
          <header className="mb-1 flex items-center justify-between gap-3">
            <h3 className="font-heading text-[18px] font-semibold text-ink">
              {s.title}
              {s.badge && <span className="ml-2 align-middle rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,white)] px-2 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-wider text-accent">{s.badge}</span>}
            </h3>
            {onEdit && <button type="button" onClick={() => onEdit(s.id)} className="no-print min-h-[40px] rounded-lg px-2 text-[14px] font-semibold text-accent">Edit</button>}
          </header>
          {!stepHasAnswers(s, answers, ctx) && <p className="py-1.5 text-[13.5px] italic text-slate-400">Not answered yet</p>}
          <dl>
            {s.nodes.map((n) => {
              if (n.kind === "notice") return null;
              if (n.kind === "repeater") {
                if (!evalCond(n.when, answers, ctx)) return null;
                const items = (answers[n.id] as Item[]) ?? [];
                if (n.noneField && answers[n.noneField] === true) return <p key={n.id} className="py-2 text-[14px] text-slate-500">{n.noneLabel}</p>;
                return items.map((it, i) => (
                  <div key={`${n.id}${i}`} className="mt-2 rounded-xl bg-surface px-4 py-1">
                    <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{n.itemLabel} {i + 1}{n.summary && !compact ? ` · ${n.summary(it, answers)}` : ""}</div>
                    {n.fields.filter((f) => evalCond(f.when, answers, ctx, it)).map((f) => <Row key={f.id} f={f} v={it[f.id]} answers={answers} />)}
                  </div>
                ));
              }
              if (!evalCond(n.when, answers, ctx)) return null;
              return <Row key={n.id} f={n} v={answers[n.id]} answers={answers} />;
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

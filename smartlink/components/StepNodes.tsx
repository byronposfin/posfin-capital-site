"use client";
import { useId, useState } from "react";
import { evalCond } from "@/lib/engine/conditions";
import type { Answers, Ctx, Field, Issue, Item, Node, Repeater } from "@/lib/engine/types";
import { FieldInput, FieldShell } from "./fields";

type Setter = (fn: (a: Answers) => Answers) => void;

export function issueMap(issues: Issue[]) {
  const m: Record<string, { error?: string; warn?: string; action?: Issue["action"] }> = {};
  for (const i of issues) {
    const e = (m[i.path] ??= {});
    if (i.level === "error" && !e.error) { e.error = i.message; e.action = i.action; }
    if (i.level === "warn" && !e.warn) e.warn = i.message;
  }
  return m;
}

function FieldBlock({ field, value, onChange, answers, issue, onAction }: {
  field: Field; value: unknown; onChange: (v: unknown) => void; answers: Answers;
  issue?: { error?: string; warn?: string; action?: Issue["action"] }; onAction?: (id: string) => void;
}) {
  const id = useId();
  return (
    <FieldShell field={field} error={issue?.action ? undefined : issue?.error} warn={issue?.warn} htmlFor={id}>
      <FieldInput field={field} value={value} onChange={onChange} answers={answers} error={issue?.error} inputId={id} />
      {issue?.action && onAction && issue.error && (
        <p role="alert" className="mt-2 text-[13.5px] font-medium text-[#B42318]">{issue.error}</p>
      )}
      {issue?.action && onAction && (
        <button type="button" onClick={() => onAction(issue.action!.id)} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-4 text-[14.5px] font-semibold text-white">
          ＋ {issue.action.label}
        </button>
      )}
    </FieldShell>
  );
}

function FieldsGrid({ fields, get, set, answers, ctx, item, issues, prefix, onAction }: {
  fields: Field[]; get: (id: string) => unknown; set: (id: string, v: unknown) => void; answers: Answers; ctx: Ctx; item?: Item;
  issues: ReturnType<typeof issueMap>; prefix: string; onAction?: (id: string) => void;
}) {
  const [showAdv, setShowAdv] = useState(false);
  const visible = fields.filter((f) => evalCond(f.when, answers, ctx, item));
  const main = visible.filter((f) => !f.advanced);
  const adv = visible.filter((f) => f.advanced);
  const advHasValue = adv.some((f) => { const v = get(f.id); return v !== undefined && v !== "" && v !== null; });
  const render = (list: Field[]) => (
    <div className={`grid grid-cols-2 gap-x-3 ${list.length && list.every((f) => f.type === "tolerance") ? "gap-y-3.5" : "gap-y-5"}`}>
      {list.map((f) => (
        <div key={f.id} className={f.half ? "col-span-1" : "col-span-2"}>
          <FieldBlock field={f} value={get(f.id)} answers={answers} issue={issues[prefix + f.id]} onAction={onAction}
            onChange={(v) => {
              if (v && typeof v === "object" && "__other" in (v as object)) set(`${f.id}_other`, (v as { __other: string }).__other);
              else if (v && typeof v === "object" && "__note" in (v as object)) set(`${f.id}_note`, (v as { __note: string }).__note);
              else set(f.id, v);
            }} />
        </div>
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
      {render(main)}
      {adv.length > 0 && (
        <div className="rounded-xl border border-rule bg-white/60">
          <button type="button" onClick={() => setShowAdv((x) => !x)} aria-expanded={showAdv || advHasValue}
            className="flex min-h-[48px] w-full items-center justify-between px-4 text-[14.5px] font-semibold text-slate-600">
            More detail <span className="font-normal text-slate-400">(optional)</span>
            <span className={`ml-auto transition ${showAdv || advHasValue ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {(showAdv || advHasValue) && <div className="border-t border-rule px-4 pb-5 pt-4">{render(adv)}</div>}
        </div>
      )}
    </div>
  );
}

function RepeaterView({ node, answers, setAnswers, ctx, issues }: { node: Repeater; answers: Answers; setAnswers: Setter; ctx: Ctx; issues: ReturnType<typeof issueMap> }) {
  const items = (answers[node.id] as Item[] | undefined) ?? [];
  const none = node.noneField ? answers[node.noneField] === true : false;
  const [open, setOpen] = useState<string | null>(() => (items.length === 1 ? String(items[0]._id) : null));
  const atMax = node.max !== undefined && items.length >= node.max;

  const update = (idx: number, k: string, v: unknown) =>
    setAnswers((a) => {
      const list = [...(((a[node.id] as Item[]) ?? []))];
      list[idx] = { ...list[idx], [k]: v };
      return { ...a, [node.id]: list };
    });
  const add = () => {
    const _id = crypto.randomUUID();
    setAnswers((a) => ({ ...a, [node.id]: [...(((a[node.id] as Item[]) ?? [])), { _id, ...(node.emptyItem?.() ?? {}) }], ...(node.noneField ? { [node.noneField]: false } : {}) }));
    setOpen(_id);
    setTimeout(() => document.querySelector(`[data-item="${_id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const remove = (idx: number) => setAnswers((a) => ({ ...a, [node.id]: (((a[node.id] as Item[]) ?? [])).filter((_, i) => i !== idx) }));

  const groupErr = issues[node.id]?.error;
  return (
    <div className="space-y-3">
      {node.help && <p className="text-[13.5px] text-slate-500">{node.help}</p>}
      {!none && items.map((it, idx) => {
        const key = String(it._id ?? idx);
        const isOpen = open === key || it._open === true;
        const hasErr = Object.keys(issues).some((p) => p.startsWith(`${node.id}.${idx}.`) && issues[p].error);
        return (
          <article key={key} data-item={key} className={`fade-in overflow-hidden rounded-2xl border bg-white shadow-sm ${hasErr ? "border-[#F04438]" : "border-rule"}`}>
            <header className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-[13px] font-bold text-ink tabular">{idx + 1}</span>
              <button type="button" className="min-h-[44px] min-w-0 flex-1 text-left" onClick={() => { setOpen(isOpen ? null : key); if (it._open) update(idx, "_open", false); }} aria-expanded={isOpen}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{node.itemLabel} {idx + 1}</div>
                <div className="truncate text-[15px] font-semibold text-ink tabular">{node.summary ? node.summary(it, answers) : `${node.itemLabel} ${idx + 1}`}</div>
              </button>
              <button type="button" onClick={() => setOpen(isOpen ? null : key)} className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-surface" aria-label={isOpen ? "Collapse" : "Edit"}>
                {isOpen ? "⌃" : "✎"}
              </button>
            </header>
            {isOpen && (
              <div className="border-t border-rule px-4 pb-4 pt-5">
                <FieldsGrid fields={node.fields} answers={answers} ctx={ctx} item={it} issues={issues} prefix={`${node.id}.${idx}.`}
                  get={(k) => it[k]} set={(k, v) => update(idx, k, v)} />
                <div className="mt-5 flex items-center justify-between">
                  <button type="button" onClick={() => remove(idx)} className="min-h-[44px] rounded-lg px-2 text-[14px] font-medium text-[#B42318]">Remove</button>
                  <button type="button" onClick={() => setOpen(null)} className="min-h-[44px] rounded-xl bg-surface px-4 text-[14.5px] font-semibold text-ink">Done</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
      {!none && (
        <button type="button" onClick={add} disabled={atMax}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 text-[15.5px] font-semibold text-ink transition hover:border-[var(--accent)] disabled:opacity-50">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-white">＋</span>
          {atMax ? `Maximum of ${node.max} reached` : items.length ? node.addLabel : node.addLabel.replace(/another /, "a ").replace(/^Add a a /, "Add a ")}
        </button>
      )}
      {node.max && items.length > 0 && <p className="text-right text-[12px] text-slate-400 tabular">{items.length} of {node.max}</p>}
      {node.noneLabel && node.noneField && (items.length === 0 || none) && (
        <button type="button" role="checkbox" aria-checked={none} onClick={() => setAnswers((a) => ({ ...a, [node.noneField!]: !none }))}
          className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-rule bg-white px-4 text-left text-[15px] ${none ? "choice-on font-semibold" : ""}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${none ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-slate-300"}`}>{none ? "✓" : ""}</span>
          {node.noneLabel}
        </button>
      )}
      {groupErr && <p role="alert" className="text-[13.5px] font-medium text-[#B42318]">● {groupErr}</p>}
    </div>
  );
}

export function StepNodes({ nodes, answers, setAnswers, ctx, issues, onAction }: { nodes: Node[]; answers: Answers; setAnswers: Setter; ctx: Ctx; issues: Issue[]; onAction: (id: string) => void }) {
  const im = issueMap(issues);
  // group consecutive plain fields so half-width pairs line up
  const blocks: (Node | Field[])[] = [];
  for (const n of nodes) {
    if (n.kind === "repeater" || n.kind === "notice") blocks.push(n);
    else {
      const last = blocks[blocks.length - 1];
      if (Array.isArray(last)) last.push(n);
      else blocks.push([n]);
    }
  }
  return (
    <div className="space-y-7">
      {blocks.map((b, i) => {
        if (Array.isArray(b))
          return <FieldsGrid key={i} fields={b} answers={answers} ctx={ctx} issues={im} prefix="" get={(k) => answers[k]} set={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} onAction={onAction} />;
        if (!evalCond(b.when, answers, ctx)) return null;
        if (b.kind === "notice" && b.tone === "heading")
          return (
            <div key={b.id} className={`${b.body ? "" : "-mb-3 "}border-b border-rule pb-2`}>
              <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">{b.title}</h2>
              {b.body && <p className="mt-1 text-[13.5px] text-slate-500">{b.body}</p>}
            </div>
          );
        if (b.kind === "notice" && b.tone === "case")
          return (
            <article key={b.id} className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg shadow-slate-900/10">
              <div className="px-5 pt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5EEAD4]">{b.title}</div>
                <p className="mt-1.5 text-[15.5px] leading-snug text-white/90">{b.body}</p>
              </div>
              {b.facts && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/10 px-5 py-3.5">
                  {b.facts.map(([k, v]) => (
                    <div key={k} className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{k}</dt><dd className="text-[14px] font-semibold tabular text-white">{v}</dd></div>
                  ))}
                </dl>
              )}
            </article>
          );
        if (b.kind === "notice")
          return (
            <div key={b.id} className={`rounded-xl px-4 py-3 text-[14px] leading-snug ${b.tone === "warn" ? "bg-[#FFF6E0] text-[#8A5A00]" : "bg-[color-mix(in_srgb,var(--accent)_10%,white)] text-ink"}`}>
              {b.title && <div className="font-semibold">{b.title}</div>}
              <div className="text-slate-600">{b.body}</div>
            </div>
          );
        if (b.kind === "repeater") return <RepeaterView key={b.id} node={b} answers={answers} setAnswers={setAnswers} ctx={ctx} issues={im} />;
        return null;
      })}
    </div>
  );
}

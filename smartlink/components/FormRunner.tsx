"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRANDS, brandStyle, type FormId } from "@/lib/brands";
import { evalCond } from "@/lib/engine/conditions";
import { hasErrors, stepIssues } from "@/lib/engine/validate";
import type { Answers, Ctx, Draft, Issue } from "@/lib/engine/types";
import { getSchema } from "@/lib/forms/registry";
import { AnswersSummary } from "./AnswersSummary";
import { BrandFooter, BrandHeader } from "./BrandChrome";
import { ALTotalsPanel, WorksTotalsPanel } from "./Panels";
import { LenderGapCheckPanel, LenderSnapshot } from "./LenderPanels";
import { StepNodes as StepNodesLazy } from "./StepNodes";

export interface RunnerProps {
  form: FormId;
  token: string;
  brandId: string;
  caseRef: string;
  demo: boolean;
  flags: Ctx["flags"];
  prefillSources: string[];
  initial: Pick<Draft, "answers" | "step" | "status">;
  resultHref?: string;
  resultLabel?: string;
}

type SaveState = { s: "idle" | "saving" | "saved" | "error"; at?: string };

export default function FormRunner(p: RunnerProps) {
  const brand = BRANDS[p.brandId];
  const schema = useMemo(() => getSchema(p.form, p.brandId, p.prefillSources), [p.form, p.brandId, p.prefillSources]);
  const ctx: Ctx = useMemo(() => ({ flags: p.flags }), [p.flags]);
  const [answers, setAnswersRaw] = useState<Answers>(p.initial.answers);
  const REVIEW = schema.steps.length;
  const DONE = REVIEW + 1;
  const [pos, setPos] = useState<number>(p.initial.status === "submitted" ? DONE : Math.min(p.initial.step ?? -1, REVIEW));
  const [dir, setDir] = useState<1 | -1>(1);
  const [showErr, setShowErr] = useState<Record<string, boolean>>({});
  const [save, setSave] = useState<SaveState>({ s: "idle" });
  const [parked, setParked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const first = useRef(true);
  const topRef = useRef<HTMLDivElement>(null);

  const setAnswers = useCallback((fn: (a: Answers) => Answers) => setAnswersRaw((a) => fn(a)), []);
  const visibleIdx = useMemo(() => schema.steps.map((s, i) => (evalCond(s.when, answers, ctx) ? i : -1)).filter((i) => i >= 0), [schema, answers, ctx]);

  const persist = useCallback(async (a: Answers, step: number) => {
    setSave({ s: "saving" });
    try {
      const r = await fetch(`/api/forms/${p.form}/${encodeURIComponent(p.token)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: a, step, brand: p.brandId, flags: p.flags }) });
      if (!r.ok) throw new Error();
      setSave({ s: "saved", at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
    } catch {
      setSave({ s: "error" });
    }
  }, [p.form, p.token, p.brandId]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (pos >= DONE) return;
    const t = setTimeout(() => persist(answers, pos), 700);
    return () => clearTimeout(t);
  }, [answers, pos, persist, DONE]);

  const go = (to: number, d: 1 | -1) => {
    setDir(d);
    setPos(to);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const nextFrom = (i: number) => visibleIdx.find((x) => x > i) ?? REVIEW;
  const prevFrom = (i: number) => [...visibleIdx].reverse().find((x) => x < i) ?? -1;

  const step = pos >= 0 && pos < REVIEW ? schema.steps[pos] : null;
  const issues = step ? stepIssues(schema, step, answers, ctx) : [];
  const shown = issues.filter((i) => i.level === "warn" || i.action || showErr[step?.id ?? ""]);

  const onNext = () => {
    if (!step) return;
    if (hasErrors(issues)) {
      setShowErr((s) => ({ ...s, [step.id]: true }));
      setTimeout(() => document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
      return;
    }
    go(nextFrom(pos), 1);
  };

  const onAction = (id: string) => {
    const fn = schema.actions?.[id];
    if (fn) setAnswers(fn);
  };

  const submit = async () => {
    setSubmitting(true);
    setServerIssues([]);
    try {
      const r = await fetch(`/api/forms/${p.form}/${encodeURIComponent(p.token)}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, brand: p.brandId, flags: p.flags }) });
      const j = await r.json();
      if (!r.ok) {
        const iss: Issue[] = j.issues ?? [];
        setServerIssues(iss);
        const root = iss.find((i) => i.level === "error")?.path.split(".")[0];
        const target = schema.steps.findIndex((s) => s.nodes.some((n) => n.id === root || (n.kind === "repeater" && n.noneField === root)));
        if (target >= 0) { setShowErr((s) => ({ ...s, [schema.steps[target].id]: true })); go(target, -1); }
        return;
      }
      go(DONE, 1);
    } finally {
      setSubmitting(false);
    }
  };

  const shownIndex = step ? visibleIdx.indexOf(pos) + 1 : pos === REVIEW ? visibleIdx.length + 1 : 0;
  const total = visibleIdx.length + 1;
  const progress = pos < 0 ? 0 : pos >= DONE ? 1 : shownIndex / total;
  const intro = brand.intro[p.form] ?? BRANDS.posfin.intro[p.form]!;
  const anim = dir === 1 ? "step-enter" : "step-enter-back";
  const declOk = answers.declaration_accepted === true && String(answers.declaration_name ?? "").trim().length >= 3;

  return (
    <div style={brandStyle(brand) as React.CSSProperties} className="min-h-dvh bg-surface">
      <div ref={topRef} />
      <header className="sticky top-0 z-30 border-b border-rule bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 pb-2.5 pt-[max(12px,env(safe-area-inset-top))]">
          <BrandHeader brand={brand} sub={schema.title} />
          <span className={`text-[11.5px] font-medium tabular ${save.s === "error" ? "text-[#B42318]" : "text-slate-400"}`} aria-live="polite">
            {save.s === "saving" ? "Saving…" : save.s === "saved" ? `Saved ${save.at}` : save.s === "error" ? "Not saved — retrying" : ""}
          </span>
        </div>
        <div className="mx-auto max-w-xl px-5 pb-2.5">
          <div className="flex items-center justify-between text-[12px] text-slate-500">
            <span className="truncate">
              {pos < 0 ? `About ${intro.minutes} minutes · you can come back later` : pos >= DONE ? "All done" : pos === REVIEW ? `Step ${shownIndex} of ${total} · Review` : `Step ${shownIndex} of ${total} · ${step?.title}`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.max(progress * 100, pos < 0 ? 0 : 4)}%` }} />
          </div>
        </div>
      </header>

      {p.demo && (
        <div className="mx-auto max-w-xl px-5 pt-3">
          <div className="rounded-lg bg-[#FFF6E0] px-3 py-1.5 text-center text-[12px] font-medium text-[#8A5A00]">Demo case — every name, address and figure is fictional</div>
        </div>
      )}

      <main className="mx-auto max-w-xl px-5 pb-40 pt-6">
        {pos < 0 && (
          <div className={anim} key="intro">
            <span className="inline-block rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-slate-600 shadow-sm">About {intro.minutes} minutes</span>
            <p className="mt-6 text-[11.5px] font-bold uppercase tracking-[0.16em] text-accent">{brand.kicker}</p>
            <h1 className="font-heading mt-2 text-[34px] font-semibold leading-[1.1] text-ink">{intro.title}</h1>
            <p className="mt-4 text-[16.5px] leading-relaxed text-slate-600">{intro.body}</p>
            <div className="mt-6 rounded-2xl border border-rule bg-white p-4 text-[14.5px] leading-snug text-slate-600">
              <b className="text-ink">Nothing to print.</b> Your answers save as you go — close the page any time and this link brings you back to where you were.
            </div>
            <ul className="mt-6 space-y-2.5">
              {visibleIdx.slice(0, 6).map((i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] text-ink">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,white)] text-[12px] font-bold text-accent">{visibleIdx.indexOf(i) + 1}</span>
                  {schema.steps[i].title}
                </li>
              ))}
              {visibleIdx.length > 6 && <li className="pl-9 text-[14px] text-slate-500">+ {visibleIdx.length - 6} more short sections</li>}
            </ul>
          </div>
        )}

        {step && (
          <div className={anim} key={step.id}>
            {step.badge && <span className="mb-3 inline-block rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,white)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">{step.badge}</span>}
            <h1 className="font-heading text-[30px] font-semibold leading-[1.12] text-ink">{step.title}</h1>
            {step.description && <p className="mt-3 text-[15.5px] leading-relaxed text-slate-600">{step.description}</p>}
            {step.panel === "lender_gapcheck" && <div className="mt-6"><LenderGapCheckPanel answers={answers} setAnswers={setAnswers} onJump={(id) => { const i = schema.steps.findIndex((s) => s.id === id); if (i >= 0) go(i, -1); }} /></div>}
            <div className="mt-7">
              <StepNodesLazy nodes={step.nodes} answers={answers} setAnswers={setAnswers} ctx={ctx} issues={[...shown, ...serverIssues.filter((i) => step.nodes.some((n) => i.path.split(".")[0] === n.id))]} onAction={onAction} />
            </div>
            {step.panel === "al_totals" && <div className="mt-8"><ALTotalsPanel answers={answers} /></div>}
            {step.panel === "works_totals" && <div className="mt-8"><WorksTotalsPanel answers={answers} /></div>}
          </div>
        )}

        {pos === REVIEW && (
          <div className={anim} key="review">
            <h1 className="font-heading text-[30px] font-semibold leading-[1.12] text-ink">Check and confirm</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-slate-600">Have a quick look through. Tap <b>Edit</b> to change anything.</p>
            {p.form === "al" && <div className="mt-6"><ALTotalsPanel answers={answers} /></div>}
            {p.form === "works" && <div className="mt-6"><WorksTotalsPanel answers={answers} /></div>}
            {p.form === "lender" && <div className="mt-6"><LenderSnapshot answers={answers} /></div>}
            <div className="mt-6">
              <AnswersSummary schema={schema} answers={answers} ctx={ctx} onEdit={(id) => go(schema.steps.findIndex((s) => s.id === id), -1)} />
            </div>
            <section className="mt-8 rounded-2xl border border-rule bg-white p-5">
              <h2 className="font-heading text-[20px] font-semibold text-ink">Declaration</h2>
              <button type="button" role="checkbox" aria-checked={answers.declaration_accepted === true}
                onClick={() => setAnswers((a) => ({ ...a, declaration_accepted: !(a.declaration_accepted === true) }))}
                className={`mt-4 flex w-full items-start gap-3 rounded-xl border border-rule p-4 text-left ${answers.declaration_accepted === true ? "choice-on" : ""}`}>
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${answers.declaration_accepted === true ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-slate-300"}`}>{answers.declaration_accepted === true ? "✓" : ""}</span>
                <span className="text-[15px] leading-snug text-ink">{schema.declaration.text}</span>
              </button>
              <label className="mt-5 block text-[15px] font-semibold text-ink" htmlFor="decl-name">{schema.declaration.nameLabel}</label>
              <input id="decl-name" autoComplete="name" className="mt-1.5 h-[54px] w-full rounded-xl border border-rule bg-white px-4 font-heading text-[20px] italic text-ink focus-accent outline-none"
                placeholder="Full name" value={String(answers.declaration_name ?? "")} onChange={(e) => setAnswers((a) => ({ ...a, declaration_name: e.target.value }))} />
              <p className="mt-2 text-[12.5px] text-slate-500">Dated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Typing your name is your acknowledgement — there’s no signature here.</p>
              {serverIssues.length > 0 && <p role="alert" className="mt-3 text-[13.5px] font-medium text-[#B42318]">● {serverIssues[0].message}</p>}
            </section>
          </div>
        )}

        {pos >= DONE && (
          <div className="step-enter text-center" key="done">
            <div className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-accent text-[30px] text-white shadow-lg">✓</div>
            <h1 className="font-heading mt-6 text-[32px] font-semibold text-ink">Thank you</h1>
            <p className="mx-auto mt-3 max-w-sm text-[16px] leading-relaxed text-slate-600">
              {p.form === "remortgage" ? "We’ll prepare your form for e-signature and send you the envelope shortly. You don’t need to print anything." : p.form === "lender" ? "Thank you — that’s hugely helpful. We’ll review your criteria and come back to you with a read-back of anything we need to confirm." : "We’ve got everything we need. Your case manager will be in touch if anything’s missing."}
            </p>
            {p.resultHref && <a href={p.resultHref} className="btn-primary mt-8 inline-flex min-h-[54px] items-center justify-center rounded-2xl px-6 text-[16px] font-semibold">{p.resultLabel}</a>}
            <button type="button" onClick={() => go(REVIEW, -1)} className="mt-4 block w-full text-[14px] font-semibold text-accent">Review my answers</button>
          </div>
        )}

        <BrandFooter brand={brand} className="mt-14 border-t border-rule pt-5" />
        <p className="mt-3 text-[11px] text-slate-400">Ref {p.caseRef}</p>
      </main>

      {pos < DONE && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-5 pb-2 pt-3">
            {pos >= 0 && (
              <button type="button" onClick={() => go(prevFrom(pos), -1)} aria-label="Back" className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-2xl border border-rule bg-white text-[20px] text-ink active:scale-95">←</button>
            )}
            {pos < 0 && <button type="button" onClick={() => go(nextFrom(-1), 1)} className="btn-primary h-[56px] flex-1 rounded-2xl text-[17px] font-semibold active:scale-[0.99]">Start</button>}
            {step && <button type="button" onClick={onNext} className="btn-primary h-[56px] flex-1 rounded-2xl text-[17px] font-semibold active:scale-[0.99]">Continue</button>}
            {pos === REVIEW && <button type="button" onClick={submit} disabled={!declOk || submitting} className="btn-primary h-[56px] flex-1 rounded-2xl text-[17px] font-semibold">{submitting ? "Sending…" : "Submit"}</button>}
          </div>
          {pos >= 0 && (
            <div className="mx-auto -mt-1 max-w-xl px-5 pb-[max(10px,env(safe-area-inset-bottom))] text-center">
              <button type="button" onClick={async () => { await persist(answers, pos); setParked(true); }} className="min-h-[36px] text-[13.5px] font-semibold text-slate-500 underline-offset-4 hover:underline">Save &amp; finish later</button>
            </div>
          )}
        </nav>
      )}

      {parked && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 p-4 sm:place-items-center" onClick={() => setParked(false)}>
          <div className="fade-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-[24px] font-semibold text-ink">Saved — pick up any time</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">Open the same link whenever you’re ready and we’ll bring you straight back here. Nothing has been sent yet.</p>
            <button type="button" onClick={() => setParked(false)} className="btn-primary mt-5 h-[52px] w-full rounded-2xl text-[16px] font-semibold">Keep going now</button>
          </div>
        </div>
      )}
    </div>
  );
}


"use client";
import { useId, useState } from "react";
import { formatMoneyInput, gbp, parseMoney } from "@/lib/engine/money";
import type { Answers, Field } from "@/lib/engine/types";

const inputBase =
  "w-full rounded-xl border border-rule bg-white px-4 text-[17px] text-ink placeholder:text-slate-400 transition focus-accent outline-none";
const h = "h-[54px]";

export function FieldShell({ field, error, warn, children, htmlFor }: { field: Field; error?: string; warn?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="fade-in" data-field={field.id}>
      {field.prefilled && (
        <span className="mb-1.5 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">From your file — please check</span>
      )}
      {field.type !== "checkbox" && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-semibold leading-snug text-ink">
          {field.label}
          {field.required ? <span className="text-accent"> *</span> : field.type === "tolerance" || field.type === "grid" ? null : <span className="ml-1 text-[13px] font-normal text-slate-400">optional</span>}
        </label>
      )}
      {field.help && field.type !== "checkbox" && <p className="mb-2 text-[13.5px] leading-snug text-slate-500">{field.help}</p>}
      {children}
      {error && (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13.5px] font-medium text-[#B42318]">
          <span aria-hidden>●</span>
          {error}
        </p>
      )}
      {!error && warn && <p className="mt-1.5 rounded-lg bg-[#FFF6E0] px-3 py-2 text-[13px] text-[#8A5A00]">{warn}</p>}
    </div>
  );
}

function MoneyInput({ id, value, onChange, invalid }: { id: string; value: unknown; onChange: (v: string) => void; invalid?: boolean }) {
  const display = value === undefined || value === null || value === "" ? "" : formatMoneyInput(String(value));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[17px] font-medium text-slate-400">£</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        className={`${inputBase} ${h} pl-9 tabular ${invalid ? "border-[#B42318]" : ""}`}
        value={display}
        placeholder="0"
        onChange={(e) => onChange(formatMoneyInput(e.target.value))}
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}

function Segmented({ options, labels, value, onChange, cols }: { options: string[]; labels?: string[]; value: unknown; onChange: (v: string) => void; cols?: number }) {
  const c = cols ?? Math.min(options.length, 3);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${c}, minmax(0,1fr))` }} role="radiogroup">
      {options.map((o, i) => {
        const on = value === o;
        return (
          <button
            type="button"
            key={o}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`min-h-[52px] rounded-xl border border-rule bg-white px-3 text-[16px] font-medium text-ink transition active:scale-[0.98] ${on ? "choice-on" : "hover:border-slate-400"}`}
          >
            {labels?.[i] ?? o}
          </button>
        );
      })}
    </div>
  );
}

function RadioList({ options, value, onChange }: { options: string[]; value: unknown; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2" role="radiogroup">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            type="button"
            key={o}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-rule bg-white px-4 text-left text-[15.5px] text-ink transition active:scale-[0.99] ${on ? "choice-on font-semibold" : "hover:border-slate-400"}`}
          >
            <span className={`h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 ${on ? "dot-on" : ""}`} />
            {o}
          </button>
        );
      })}
    </div>
  );
}

const YN: Record<string, { v: string[]; l: string[] }> = {
  yes_no: { v: ["yes", "no"], l: ["Yes", "No"] },
  yes_no_unsure: { v: ["yes", "no", "unsure"], l: ["Yes", "No", "Not sure"] },
  yes_no_na: { v: ["yes", "no", "na"], l: ["Yes", "No", "N/A"] },
};

export function FieldInput({ field, value, onChange, answers, error, inputId }: { field: Field; value: unknown; onChange: (v: unknown) => void; answers: Answers; error?: string; inputId?: string }) {
  const autoId = useId();
  const id = inputId ?? autoId;
  const invalid = Boolean(error);
  const t = field.type;
  const textCls = `${inputBase} ${h} ${invalid ? "border-[#B42318]" : ""}`;

  let control: React.ReactNode;
  switch (t) {
    case "textarea":
      control = <textarea id={id} rows={3} className={`${inputBase} min-h-[96px] py-3 ${invalid ? "border-[#B42318]" : ""}`} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "money":
      control = <MoneyInput id={id} value={value} onChange={onChange} invalid={invalid} />;
      break;
    case "money_freq": {
      const o = (value as { amount?: string; frequency?: string }) ?? {};
      const amt = parseMoney(o.amount);
      const freq = o.frequency ?? "monthly";
      const other = amt === null ? null : freq === "monthly" ? amt * 12 : amt / 12;
      control = (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <MoneyInput id={id} value={o.amount} onChange={(v) => onChange(v ? { amount: v, frequency: freq } : undefined)} invalid={invalid} />
            </div>
            <div className="flex rounded-xl border border-rule bg-white p-1" role="radiogroup" aria-label="Frequency">
              {[["monthly", "Monthly"], ["annual", "Annually"]].map(([v, l]) => (
                <button type="button" key={v} role="radio" aria-checked={freq === v} onClick={() => onChange({ amount: o.amount ?? "", frequency: v })}
                  className={`rounded-lg px-3 text-[14px] font-semibold transition ${freq === v ? "bg-ink text-white" : "text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          {other !== null && <p className="text-[13px] text-slate-500 tabular">= {gbp(Math.round(other * 100) / 100, { dp: 0 })} {freq === "monthly" ? "a year" : "a month"}</p>}
        </div>
      );
      break;
    }
    case "number":
    case "percent":
      control = (
        <div className="relative">
          <input id={id} inputMode="numeric" className={`${textCls} tabular ${t === "percent" ? "pr-10" : ""}`} value={String(value ?? "")} placeholder={field.placeholder ?? (t === "percent" ? "10" : "")}
            onChange={(e) => onChange(e.target.value.replace(t === "percent" ? /[^\d.]/g : /[^\d]/g, ""))} />
          {t === "percent" && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>}
        </div>
      );
      break;
    case "date":
    case "month":
      control = <input id={id} type={t} className={`${textCls} appearance-none`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "yes_no":
    case "yes_no_unsure":
    case "yes_no_na": {
      const m = YN[t];
      control = <Segmented options={m.v} labels={m.l} value={value} onChange={onChange} />;
      break;
    }
    case "choice":
    case "choice_other": {
      const opts = field.dynamicOptions ? field.dynamicOptions(answers) : field.options ?? [];
      const short = opts.every((o) => o.length <= 14);
      if (opts.length > 8 || (field.half && opts.length > 3)) {
        control = (
          <select id={id} className={`${textCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%235B6B82%22 stroke-width=%222%22 fill=%22none%22/></svg>')] bg-[right_16px_center] bg-no-repeat pr-10`}
            value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose…</option>
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        );
      } else if (short && opts.length <= 4) control = <Segmented options={opts} value={value} onChange={onChange} cols={opts.length === 4 ? 2 : undefined} />;
      else control = <RadioList options={opts} value={value} onChange={onChange} />;
      if (t === "choice_other" && value === "Other") {
        control = (
          <div className="space-y-2">
            {control}
            <input className={textCls} placeholder="Please tell us" value={String(answers[`${field.id}_other`] ?? "")} onChange={(e) => onChange({ __other: e.target.value })} />
          </div>
        );
      }
      break;
    }
    case "multi": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="space-y-2">
          {(field.options ?? []).map((o) => {
            const on = arr.includes(o);
            return (
              <button type="button" key={o} aria-pressed={on} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-rule bg-white px-4 text-left text-[15.5px] transition ${on ? "choice-on font-semibold" : ""}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${on ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
                {o}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "checkbox": {
      const on = value === true;
      control = (
        <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)}
          className={`flex w-full items-start gap-3 rounded-xl border border-rule bg-white p-4 text-left transition ${on ? "choice-on" : ""} ${invalid ? "border-[#B42318]" : ""}`}>
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 text-[14px] ${on ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-slate-300 bg-white"}`}>{on ? "✓" : ""}</span>
          <span>
            <span className="block text-[15.5px] font-semibold leading-snug text-ink">{field.label}{field.required && <span className="text-accent"> *</span>}</span>
            {field.help && <span className="mt-1 block text-[13.5px] leading-snug text-slate-500">{field.help}</span>}
          </span>
        </button>
      );
      break;
    }
    case "sort_code":
      control = (
        <input id={id} inputMode="numeric" autoComplete="off" className={`${textCls} tabular tracking-widest`} placeholder="00-00-00" value={String(value ?? "")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 6);
            onChange(d.replace(/(\d{2})(?=\d)/g, "$1-"));
          }} />
      );
      break;
    case "account_number":
      control = <input id={id} inputMode="numeric" autoComplete="off" className={`${textCls} tabular tracking-widest`} placeholder="8 digits" value={String(value ?? "")} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))} />;
      break;
    case "file": {
      const f = value as { name?: string; size?: number } | undefined;
      control = (
        <label className={`flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-[15px] transition hover:border-slate-400`}>
          <span className="truncate text-slate-600">{f?.name ? `📎 ${f.name}` : "Choose a file or photo"}</span>
          <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-ink">{f?.name ? "Change" : "Upload"}</span>
          <input type="file" className="sr-only" accept="image/*,application/pdf" onChange={(e) => {
            const file = e.target.files?.[0];
            onChange(file ? { name: file.name, size: file.size, type: file.type } : undefined);
          }} />
        </label>
      );
      break;
    }
    case "tolerance": {
      const opts = field.options ?? ["Accept", "Case by case", "Decline"];
      const tones = field.tones ?? ["good", "mid", "bad"];
      const note = String(answers[`${field.id}_note`] ?? "");
      control = <ToleranceRow id={id} opts={opts} tones={tones} value={value} note={note} onChange={onChange} />;
      break;
    }
    case "grid": {
      const rows = field.rows ?? [];
      const cols = field.cols ?? [];
      const o = (value as Record<string, Record<string, string>>) ?? {};
      const u = field.unit ?? "%";
      const setCell = (r: string, c: string, v: string) => onChange({ ...o, [r]: { ...(o[r] ?? {}), [c]: v } });
      control = (
        <div className="overflow-hidden rounded-xl border border-rule bg-white" role="table" aria-label={field.label}>
          <div className="grid bg-surface text-[11px] font-bold uppercase tracking-wider text-slate-500" style={{ gridTemplateColumns: `minmax(0,1.5fr) repeat(${cols.length}, minmax(0,1fr))` }} role="row">
            <span className="px-3 py-2" role="columnheader">{field.placeholder ?? ""}</span>
            {cols.map((c) => <span key={c} className="px-2 py-2 text-center" role="columnheader">{c}</span>)}
          </div>
          {rows.map((r) => (
            <div key={r} className="grid items-center border-t border-rule" style={{ gridTemplateColumns: `minmax(0,1.5fr) repeat(${cols.length}, minmax(0,1fr))` }} role="row">
              <span className="px-3 py-2 text-[14px] font-medium leading-tight text-ink" role="rowheader">{r}</span>
              {cols.map((c) => (
                <div key={c} className="relative px-1.5 py-1.5" role="cell">
                  {u === "£" && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">£</span>}
                  <input inputMode="decimal" aria-label={`${r} — ${c}`} value={o[r]?.[c] ?? ""} placeholder="–"
                    onChange={(e) => setCell(r, c, e.target.value.replace(u === "£" ? /[^\d,]/g : /[^\d.]/g, ""))}
                    className={`h-[44px] w-full rounded-lg border border-rule bg-white text-center text-[16px] tabular text-ink outline-none focus-accent ${u === "£" ? "pl-5" : "pr-5"}`} />
                  {u === "%" && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
      break;
    }
    case "suggest": {
      const listId = id + "-list";
      control = (
        <>
          <input id={id} list={listId} autoComplete="off" className={textCls} value={String(value ?? "")} placeholder={field.placeholder ?? "Start typing…"} onChange={(e) => onChange(e.target.value)} />
          <datalist id={listId}>{field.suggestions?.map((s) => <option key={s} value={s} />)}</datalist>
        </>
      );
      break;
    }
    default: {
      const type = t === "email" ? "email" : t === "tel" ? "tel" : "text";
      const inputMode = t === "email" ? "email" : t === "tel" ? "tel" : undefined;
      const autoComplete = t === "email" ? "email" : t === "tel" ? "tel" : t === "postcode" ? "postal-code" : field.id.includes("name") ? "name" : "off";
      control = (
        <input id={id} type={type} inputMode={inputMode} autoComplete={autoComplete} className={`${textCls} ${t === "postcode" ? "uppercase" : ""}`} value={String(value ?? "")} placeholder={field.placeholder}
          onChange={(e) => onChange(t === "postcode" ? e.target.value.toUpperCase() : e.target.value)} />
      );
    }
  }
  return control;
}

const TONE: Record<string, string> = {
  good: "bg-[#E7F7EF] border-[#2E9E6A] text-[#16613F]",
  mid: "bg-[#FFF4DC] border-[#D9A21B] text-[#7A5600]",
  bad: "bg-[#FDECEA] border-[#D64545] text-[#9B1C1C]",
};

function ToleranceRow({ id, opts, tones, value, note, onChange }: { id: string; opts: string[]; tones: string[]; value: unknown; note: string; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(Boolean(note));
  return (
    <div>
      <div id={id} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0,1fr))` }} role="radiogroup">
        {opts.map((o, i) => {
          const on = value === o;
          return (
            <button type="button" key={o} role="radio" aria-checked={on} onClick={() => onChange(on ? "" : o)}
              className={`min-h-[44px] rounded-xl border px-1.5 text-[13.5px] font-semibold leading-tight transition active:scale-[0.98] ${on ? TONE[tones[i] ?? "mid"] : "border-rule bg-white text-slate-600 hover:border-slate-400"}`}>
              {o}
            </button>
          );
        })}
      </div>
      {open ? (
        <input className="mt-1.5 h-[42px] w-full rounded-lg border border-rule bg-white px-3 text-[14.5px] text-ink outline-none focus-accent" placeholder="Note, e.g. limits, recency, conditions" value={note}
          onChange={(e) => onChange({ __set: `${id}`, __note: e.target.value })} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 min-h-[30px] text-[12.5px] font-semibold text-slate-400 hover:text-accent">+ Add a note</button>
      )}
    </div>
  );
}

export function useToggle(init = false) {
  const [v, set] = useState(init);
  return [v, () => set((x) => !x), set] as const;
}

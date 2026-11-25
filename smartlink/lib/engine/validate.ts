import { dobError, ukMobileError } from "./contact";
import { evalCond } from "./conditions";
import { MONEY_MAX, parseMoney } from "./money";
import type { Answers, Ctx, Field, FormSchema, Issue, Item, Step } from "./types";

export const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const SORT = /^\d{2}-?\d{2}-?\d{2}$/;
const ACCOUNT = /^\d{8}$/;

export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("amount" in o) return isEmpty(o.amount);
    if ("name" in o && "size" in o) return !o.name;
    // grid: empty when no cell has a value
    if (Object.values(o).every((r) => r && typeof r === "object" && !Array.isArray(r))) return Object.values(o).every((r) => Object.values(r as object).every((c) => c === "" || c === undefined || c === null));
    return Object.keys(o).length === 0;
  }
  return false;
}

export function validateField(f: Field, value: unknown): string | null {
  if (f.type === "checkbox") {
    if (f.required && value !== true) return "Please tick to confirm.";
    return null;
  }
  if (isEmpty(value)) return f.required ? requiredMsg(f) : null;
  const s = typeof value === "string" ? value.trim() : value;
  switch (f.type) {
    case "email":
      return EMAIL.test(String(s)) ? null : "That email doesn’t look quite right.";
    case "tel":
      if (f.ukMobile) return ukMobileError(String(s));
      return PHONE.test(String(s)) ? null : "Please enter a valid phone number.";
    case "date":
      if (!f.dob) return null;
      return dobError(String(s), f.minAge ?? 18);
    case "postcode":
      return UK_POSTCODE.test(String(s)) ? null : "Please enter a full UK postcode, e.g. SW1A 1AA.";
    case "sort_code":
      return SORT.test(String(s)) ? null : "Sort codes are 6 digits, e.g. 12-34-56.";
    case "account_number":
      return ACCOUNT.test(String(s).replace(/\s/g, "")) ? null : "Account numbers are 8 digits.";
    case "money": {
      const n = parseMoney(value);
      if (n === null) return "Please enter an amount in pounds.";
      if (n < 0) return "Amounts can’t be negative.";
      if (n > MONEY_MAX) return "That’s above £999m — please check.";
      if (f.min !== undefined && n < f.min) return f.min > 0 ? "Please enter an amount above £0." : null;
      return null;
    }
    case "money_freq": {
      const o = value as { amount?: unknown; frequency?: string };
      const n = parseMoney(o.amount);
      if (n === null || n < 0) return "Please enter an amount in pounds.";
      if (!o.frequency) return "Is that monthly or annually?";
      return null;
    }
    case "grid": {
      const o = value as Record<string, Record<string, unknown>>;
      for (const r of Object.values(o ?? {})) for (const c of Object.values(r ?? {})) {
        if (c === "" || c === undefined || c === null) continue;
        const n = Number(String(c).replace(/[%,£\s]/g, ""));
        if (!Number.isFinite(n)) return "Figures only, please.";
        if (f.unit === "%" && (n < 0 || n > 100)) return "Percentages should be between 0 and 100.";
      }
      return null;
    }
    case "number":
    case "percent": {
      const n = Number(String(s).replace(/[%,\s]/g, ""));
      if (!Number.isFinite(n)) return "Please enter a number.";
      if (f.min !== undefined && n < f.min) return `Minimum is ${f.min}.`;
      if (f.max !== undefined && n > f.max) return `Maximum is ${f.max}.`;
      return null;
    }
    default:
      return null;
  }
}

function requiredMsg(f: Field) {
  if (["yes_no", "yes_no_unsure", "yes_no_na", "choice", "choice_other", "multi", "tolerance"].includes(f.type)) return "Please choose an answer.";
  if (f.type === "grid") return "Please fill in at least one figure.";
  if (f.type === "money") return "Please enter an amount.";
  if (f.type === "file") return "Please attach a file.";
  return "This one’s needed.";
}

/** Validate a single step (visible fields only). */
export function validateStep(step: Step, answers: Answers, ctx: Ctx): Issue[] {
  const issues: Issue[] = [];
  if (!evalCond(step.when, answers, ctx)) return issues;
  for (const node of step.nodes) {
    if (node.kind === "notice") continue;
    if (node.kind === "repeater") {
      if (!evalCond(node.when, answers, ctx)) continue;
      const items = (answers[node.id] as Item[] | undefined) ?? [];
      const noneTicked = node.noneField ? answers[node.noneField] === true : false;
      if (node.min && items.length < node.min && !noneTicked) {
        issues.push({ path: node.id, level: "error", message: node.noneLabel ? `Add at least one, or tick “${node.noneLabel}”.` : `Please add at least ${node.min}.` });
      }
      if (node.max && items.length > node.max) {
        issues.push({ path: node.id, level: "error", message: `Up to ${node.max} items, please — group smaller items together.` });
      }
      items.forEach((it, i) => {
        for (const f of node.fields) {
          if (!evalCond(f.when, answers, ctx, it)) continue;
          const msg = validateField(f, it[f.id]);
          if (msg) issues.push({ path: `${node.id}.${i}.${f.id}`, level: "error", message: msg });
        }
      });
      continue;
    }
    if (!evalCond(node.when, answers, ctx)) continue;
    const msg = validateField(node, answers[node.id]);
    if (msg) issues.push({ path: node.id, level: "error", message: msg });
  }
  return issues;
}

/** Full-form validation: every visible step + cross-field rules + declaration. Server re-runs this on submit. */
export function validateForm(schema: FormSchema, answers: Answers, ctx: Ctx, opts: { requireDeclaration?: boolean } = {}): Issue[] {
  const issues = schema.steps.flatMap((s) => validateStep(s, answers, ctx));
  if (schema.validate) issues.push(...schema.validate(answers, ctx));
  if (opts.requireDeclaration) {
    if (answers.declaration_accepted !== true) issues.push({ path: "declaration_accepted", level: "error", message: "Please confirm the declaration." });
    const nm = String(answers.declaration_name ?? "").trim();
    if (nm.length < 3) issues.push({ path: "declaration_name", level: "error", message: "Please type your full name." });
  }
  return issues;
}

export function stepIssues(schema: FormSchema, step: Step, answers: Answers, ctx: Ctx): Issue[] {
  const base = validateStep(step, answers, ctx);
  if (!schema.validate) return base;
  const ids = new Set(step.nodes.map((n) => n.id));
  const cross = schema.validate(answers, ctx).filter((i) => ids.has(i.path.split(".")[0]));
  return [...base, ...cross];
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === "error");

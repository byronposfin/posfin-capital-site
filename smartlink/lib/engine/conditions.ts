import type { Answers, Cond, Ctx, Item } from "./types";

function norm(v: unknown): unknown {
  if (v === true) return "yes";
  if (v === false) return "no";
  return v;
}

/** Evaluate a condition. Item-level answers (inside a repeater) take precedence over top level. */
export function evalCond(cond: Cond | undefined, answers: Answers, ctx: Ctx, item?: Item): boolean {
  if (!cond) return true;
  if ("all_of" in cond) return cond.all_of.every((c) => evalCond(c, answers, ctx, item));
  if ("any_of" in cond) return cond.any_of.some((c) => evalCond(c, answers, ctx, item));
  if ("flag" in cond) {
    const v = ctx.flags[cond.flag];
    return cond.equals === undefined ? Boolean(v) : norm(v) === norm(cond.equals);
  }
  const raw = item && cond.field in item ? item[cond.field] : answers[cond.field];
  if ("includes" in cond) return Array.isArray(raw) && raw.includes(cond.includes);
  const v = norm(raw);
  if ("notEmpty" in cond) return v !== undefined && v !== null && v !== "";
  if ("in" in cond) return cond.in.map(norm).includes(v as never);
  return v === norm(cond.equals);
}

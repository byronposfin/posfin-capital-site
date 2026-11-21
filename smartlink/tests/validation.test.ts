import { describe, expect, it } from "vitest";
import { BRANDS, resolveBrand } from "@/lib/brands";
import { evalCond } from "@/lib/engine/conditions";
import { flattenAnswers } from "@/lib/engine/flatten";
import { hasErrors, UK_POSTCODE, validateForm, validateStep } from "@/lib/engine/validate";
import type { Ctx, Field, Node } from "@/lib/engine/types";
import { alSchema } from "@/lib/forms/al";
import { buildRemortgageSchema, REMORTGAGE_FIELDS } from "@/lib/forms/remortgage";
import { worksSchema } from "@/lib/forms/works";
import { DEMO_AL, DEMO_WORKS } from "@/lib/demo";

const ctx: Ctx = { flags: { titleInsurance: true } };
const step = (id: string) => alSchema.steps.find((s) => s.id === id)!;

describe("A&L validation", () => {
  it("requires only address, postcode, value and mortgage y/n per property", () => {
    const issues = validateStep(step("properties"), { properties: [{ _id: "x" }] }, ctx);
    expect(issues.map((i) => i.path).sort()).toEqual(["properties.0.address_line1", "properties.0.has_mortgage", "properties.0.postcode", "properties.0.value"].sort());
  });
  it("requires lender + balance only when mortgaged", () => {
    const base = { address_line1: "1 Test", postcode: "ZZ1 1ZZ", value: "100,000" };
    expect(hasErrors(validateStep(step("properties"), { properties: [{ ...base, has_mortgage: "no" }] }, ctx))).toBe(false);
    const paths = validateStep(step("properties"), { properties: [{ ...base, has_mortgage: "yes" }] }, ctx).map((i) => i.path);
    expect(paths).toContain("properties.0.lender");
    expect(paths).toContain("properties.0.mortgage_balance");
  });
  it("'I own no property' satisfies the step", () => {
    expect(hasErrors(validateStep(step("properties"), { no_property: true }, ctx))).toBe(false);
    expect(hasErrors(validateStep(step("properties"), {}, ctx))).toBe(true);
  });
  it("blocks grouped totals over £10,000 and offers to itemise", () => {
    const issues = alSchema.validate!({ grouped_credit_cards: "12,500" }, ctx);
    expect(issues[0].level).toBe("error");
    expect(issues[0].action?.id).toBe("itemise:grouped_credit_cards");
    const fixed = alSchema.actions!["itemise:grouped_credit_cards"]({ grouped_credit_cards: "12,500", liabilities: [] });
    expect(fixed.grouped_credit_cards).toBe("");
    expect((fixed.liabilities as { type: string; balance: string }[])[0]).toMatchObject({ type: "Credit card", balance: "12,500" });
    expect(alSchema.validate!({ grouped_credit_cards: "10,000" }, ctx).filter((i) => i.level === "error")).toHaveLength(0);
  });
  it("itemised debts need type, creditor, balance and monthly payment", () => {
    const paths = validateStep(step("liabilities"), { liabilities: [{ _id: "a" }] }, ctx).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["liabilities.0.type", "liabilities.0.creditor", "liabilities.0.balance", "liabilities.0.monthly_payment"]));
  });
  it("soft-warns on vague lenders and balance > value (not blocking)", () => {
    const issues = alSchema.validate!({ properties: [{ has_mortgage: "yes", lender: "family", value: 100, mortgage_balance: 200 }] }, ctx);
    expect(issues.every((i) => i.level === "warn")).toBe(true);
    expect(issues).toHaveLength(2);
  });
  it("UK postcode regex", () => {
    for (const p of ["SW1A 1AA", "M1 1AE", "B33 8TH", "CR2 6XH", "DN55 1PT", "zz1 1zz"]) expect(UK_POSTCODE.test(p)).toBe(true);
    for (const p of ["SW1A", "12345", "ABC 123"]) expect(UK_POSTCODE.test(p)).toBe(false);
  });
  it("demo case passes full validation with a declaration", () => {
    const issues = validateForm(alSchema, { ...DEMO_AL, declaration_accepted: true, declaration_name: "Jordan Example" }, ctx, { requireDeclaration: true });
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });
  it("declaration + typed name required", () => {
    const paths = validateForm(alSchema, DEMO_AL, ctx, { requireDeclaration: true }).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["declaration_accepted", "declaration_name"]));
  });
});

describe("Schedule of Works validation", () => {
  it("caps at 20 lines", () => {
    const lines = Array.from({ length: 21 }, (_, i) => ({ _id: String(i), category: "Other", description: "x", cost: 100 }));
    const s = worksSchema.steps.find((x) => x.id === "lines")!;
    expect(validateStep(s, { lines }, ctx).some((i) => i.path === "lines" && i.level === "error")).toBe(true);
    expect(validateStep(s, { lines: lines.slice(0, 20) }, ctx).some((i) => i.path === "lines")).toBe(false);
  });
  it("contractor name only required for a main contractor", () => {
    const s = worksSchema.steps.find((x) => x.id === "consents")!;
    const base = { planning_status: "Not required", building_regs_status: "Not required", start_date: "2027-01-01", duration_weeks: "8" };
    expect(validateStep(s, { ...base, contractor_type: "Myself" }, ctx).map((i) => i.path)).not.toContain("contractor_name");
    expect(validateStep(s, { ...base, contractor_type: "Main contractor" }, ctx).map((i) => i.path)).toContain("contractor_name");
  });
  it("warns under 10% contingency", () => {
    expect(worksSchema.validate!({ lines: [{ cost: 1 }], contingency_pct: "5" }, ctx).some((i) => i.path === "contingency_pct" && i.level === "warn")).toBe(true);
  });
  it("demo passes", () => {
    expect(validateForm(worksSchema, { ...DEMO_WORKS, declaration_accepted: true, declaration_name: "Jordan Example" }, ctx, { requireDeclaration: true }).filter((i) => i.level === "error")).toEqual([]);
  });
});

function allText(nodes: Node[]): string[] {
  return nodes.flatMap((n) => (n.kind === "repeater" ? [n.label, n.help ?? "", ...allText(n.fields)] : n.kind === "notice" ? [n.body, n.title ?? ""] : [n.label, n.help ?? "", n.placeholder ?? "", ...((n as Field).options ?? [])]));
}

describe("Remortgage schema from approved spec", () => {
  const general = buildRemortgageSchema({ brand: BRANDS.posfin });
  const ack = buildRemortgageSchema({ brand: BRANDS.ackroyds });
  const ids = (s: typeof general) => s.steps.flatMap((st) => st.nodes.flatMap((n) => (n.kind === "repeater" ? n.fields.map((f) => f.id) : [n.id])));

  it("includes every borrower-visible spec field exactly once", () => {
    const expected = REMORTGAGE_FIELDS.filter((f) => !f.staff_only && f.id !== "answers_accurate").map((f) => f.id).sort();
    expect(ids(general).sort()).toEqual(expected);
  });
  it("never exposes staff-only fields", () => {
    for (const id of ["new_lender_name", "new_lender_address", "new_lender_account_number"]) expect(ids(general)).not.toContain(id);
  });
  it("no lender/insurer/CIFAS names in borrower copy; no Ackroyds on general", () => {
    const g = general.steps.flatMap((s) => [s.title, s.description ?? "", ...allText(s.nodes)]).join(" | ");
    const a = ack.steps.flatMap((s) => [s.title, s.description ?? "", ...allText(s.nodes)]).join(" | ");
    for (const bad of [/SM1/, /SOMO/i, /Charles Rose/i, /Westcor/i, /CIFAS/i, /Instruction Form/i]) {
      expect(g).not.toMatch(bad);
      expect(a).not.toMatch(bad);
    }
    expect(g).not.toMatch(/Ackroyd/i);
  });
  it("Q21 wording follows the brand", () => {
    const q = (s: typeof general) => s.steps.flatMap((x) => x.nodes).find((n) => n.id === "heard_about_firm") as Field;
    expect(q(general).label).toMatch(/Posfin/);
    expect(q(ack).label).toMatch(/Ackroyd Legal/);
    expect(q(ack).options).toContain("Introduced by Posfin Capital");
  });
  it("title insurance section is gated on the case flag", () => {
    const ti = general.steps.find((s) => s.id === "title_insurance")!;
    expect(ti.badge).toBe("Title insurance");
    expect(evalCond(ti.when, {}, { flags: { titleInsurance: true } })).toBe(true);
    expect(evalCond(ti.when, {}, { flags: { titleInsurance: false } })).toBe(false);
    expect(ids({ ...general, steps: [ti] })).toEqual(expect.arrayContaining(["balance_funds_needed", "business_purpose_confirmation", "exit_route", "insolvency_declaration"]));
  });
  it("leasehold / company / purchase sections are conditional", () => {
    const st = (id: string) => general.steps.find((s) => s.id === id)!;
    expect(evalCond(st("leasehold").when, { tenure: "Freehold" }, ctx)).toBe(false);
    expect(evalCond(st("leasehold").when, { tenure: "Leasehold" }, ctx)).toBe(true);
    expect(evalCond(st("company").when, { borrower_or_guarantor_is_company: "yes" }, ctx)).toBe(true);
    expect(evalCond(st("purchase").when, { is_purchase: "no" }, ctx)).toBe(false);
  });
  it("flat CRM export drops hidden branches", () => {
    const flat = flattenAnswers(general, { tenure: "Freehold", leasehold_freeholder_name: "stale", borrowers: [{ borrower_forenames: "A" }] }, ctx);
    expect(flat.leasehold_freeholder_name).toBeUndefined();
    expect(flat.borrowers_1_borrower_forenames).toBe("A");
    expect(flat.borrowers_count).toBe(1);
  });
});

describe("brands", () => {
  it("resolves aliases and falls back safely", () => {
    expect(resolveBrand("general", "remortgage").id).toBe("posfin");
    expect(resolveBrand("ackroyds", "remortgage").id).toBe("ackroyds");
    expect(resolveBrand("ackroyds", "works").id).toBe("posfin");
    expect(resolveBrand("unbranded", "works").id).toBe("unbranded");
    expect(resolveBrand("unbranded", "works").footer).toEqual([]);
    expect(resolveBrand("nonsense", "al").id).toBe("posfin");
  });
});

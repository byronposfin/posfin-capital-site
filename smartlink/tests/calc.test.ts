import { describe, expect, it } from "vitest";
import { formatMoneyInput, gbp, parseMoney } from "@/lib/engine/money";
import { computeALTotals, propertyDerived, rentMonthly } from "@/lib/forms/al-calc";
import { computeWorksTotals } from "@/lib/forms/works-calc";
import { buildAL } from "@/lib/export/al-rows";
import { DEMO_AL, DEMO_WORKS } from "@/lib/demo";

describe("money", () => {
  it("parses £ and commas", () => {
    expect(parseMoney("£1,250.50")).toBe(1250.5);
    expect(parseMoney(" 1 000 ")).toBe(1000);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("formats live input", () => {
    expect(formatMoneyInput("1234567")).toBe("1,234,567");
    expect(formatMoneyInput("£12,34.567")).toBe("1,234.56");
    expect(formatMoneyInput("0005")).toBe("5");
  });
  it("formats gbp incl. negatives", () => {
    expect(gbp(-2500, { dp: 0 })).toBe("−£2,500");
  });
});

describe("A&L calcs", () => {
  it("converts annual rent to monthly", () => {
    expect(rentMonthly({ amount: "52,800", frequency: "annual" })).toBe(4400);
    expect(rentMonthly({ amount: "1,650", frequency: "monthly" })).toBe(1650);
  });
  it("derives equity and LTV per property; ignores balance when no mortgage", () => {
    const d = propertyDerived({ value: "500,000", has_mortgage: "yes", mortgage_balance: "300,000" });
    expect(d.equity).toBe(200000);
    expect(d.ltv).toBeCloseTo(0.6);
    expect(propertyDerived({ value: 400000, has_mortgage: "no", mortgage_balance: 99 }).balance).toBe(0);
  });
  it("totals the demo case", () => {
    const t = computeALTotals(DEMO_AL);
    expect(t.property_value).toBe(685000 + 295000 + 540000 + 420000);
    expect(t.mortgages).toBe(312500 + 198000 + 351000);
    expect(t.equity).toBe(t.property_value - t.mortgages);
    expect(t.rent_monthly).toBe(1650 + 4400 + 2750);
    expect(t.rent_annual).toBe(t.rent_monthly * 12);
    expect(t.other_assets).toBe(38500 + 92000 + 64000 + 210000 + 34000);
    expect(t.total_liabilities).toBe(t.mortgages + 4200 + 1800 + 24000 + 150000 + 12600);
    expect(t.net_worth).toBe(t.total_assets - t.total_liabilities);
    expect(t.monthly_commitments).toBe(1840 + 1030 + 2190 + 610 + 0 + 320);
  });
  it("no_property excludes properties", () => {
    expect(computeALTotals({ ...DEMO_AL, no_property: true }).property_value).toBe(0);
  });
  it("Albatross-style summary reconciles to net worth", () => {
    const s = buildAL(DEMO_AL);
    expect(s.summary.net).toBe(computeALTotals(DEMO_AL).net_worth);
  });
  it("net worth may be negative", () => {
    const t = computeALTotals({ properties: [{ value: 100000, has_mortgage: "yes", mortgage_balance: 150000 }] });
    expect(t.net_worth).toBe(-50000);
  });
});

describe("Schedule of Works calcs", () => {
  it("applies default 10% contingency", () => {
    const t = computeWorksTotals({ lines: [{ cost: "10,000" }, { cost: 5000 }] });
    expect(t.subtotal).toBe(15000);
    expect(t.contingency_pct).toBe(10);
    expect(t.total).toBe(16500);
  });
  it("honours custom contingency and GDV ratios", () => {
    const t = computeWorksTotals(DEMO_WORKS);
    expect(t.lines).toBe(12);
    expect(t.contingency).toBeCloseTo(t.subtotal * 0.1);
    expect(t.uplift).toBe(220000);
    expect(t.cost_to_gdv).toBeCloseTo(t.total / 760000);
    expect(t.by_category.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
  });
});

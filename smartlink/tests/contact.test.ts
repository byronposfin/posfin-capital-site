import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contactColumns } from "@/lib/contact-columns";
import { dobError, ukMobileError } from "@/lib/engine/contact";
import { validateForm } from "@/lib/engine/validate";
import { alSchema } from "@/lib/forms/al";
import { buildRemortgageSchema } from "@/lib/forms/remortgage";
import { worksSchema } from "@/lib/forms/works";
import { BRANDS } from "@/lib/brands";
import { DEMO_AL, DEMO_WORKS } from "@/lib/demo";
import type { Ctx } from "@/lib/engine/types";

const ctx: Ctx = { flags: { titleInsurance: true } };
const now = new Date("2026-11-21T12:00:00Z");

describe("UK mobile and date of birth", () => {
  it("accepts 07 and +44 mobiles and rejects a landline", () => {
    for (const phone of ["07700900123", "07700 900123", "+44 7700 900123", "+447700900123", "00447700900123"]) {
      expect(ukMobileError(phone)).toBeNull();
    }
    expect(ukMobileError("02079460000")).toMatch(/07 or \+44/);
  });

  it("requires a real past date and 18 years", () => {
    expect(dobError("1984-03-14", 18, now)).toBeNull();
    expect(dobError("2008-11-21", 18, now)).toBeNull();
    expect(dobError("2008-11-22", 18, now)).toMatch(/18 or over/);
    expect(dobError("2020-02-31", 18, now)).toMatch(/real date/);
    expect(dobError("2009-06-01", 17, now)).toBeNull();
  });

  it("keeps the A&L mobile optional and requires both dates when there is a joint applicant", () => {
    const issues = validateForm(alSchema, { ...DEMO_AL, declaration_accepted: true, declaration_name: "Jordan Example" }, ctx, { requireDeclaration: true });
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    const missing = validateForm(alSchema, { ...DEMO_AL, date_of_birth: "", joint_applicant_dob: "", mobile: "" }, ctx).map((i) => i.path);
    expect(missing).toContain("date_of_birth");
    expect(missing).toContain("joint_applicant_dob");
    expect(missing).not.toContain("mobile");
    const young = validateForm(alSchema, { ...DEMO_AL, date_of_birth: "2015-01-01" }, ctx).find((i) => i.path === "date_of_birth");
    expect(young?.message).toMatch(/18 or over/);
    const landline = validateForm(alSchema, { ...DEMO_AL, mobile: "020 7946 0000" }, ctx).find((i) => i.path === "mobile");
    expect(landline?.message).toMatch(/07 or \+44/);
  });

  it("asks the schedule of works for the person completing it", () => {
    const ok = validateForm(worksSchema, { ...DEMO_WORKS, declaration_accepted: true, declaration_name: "Jordan Example" }, ctx, { requireDeclaration: true });
    expect(ok.filter((i) => i.level === "error")).toEqual([]);
    const step = worksSchema.steps.find((s) => s.id === "project")!;
    const ids = step.nodes.map((n) => n.id);
    expect(ids).toContain("borrower_mobile");
    expect(ids).toContain("borrower_date_of_birth");
  });

  it("checks each remortgage borrower mobile and date of birth, and allows an occupier of 17", () => {
    const schema = buildRemortgageSchema({ brand: BRANDS.posfin });
    const borrowers = schema.steps.flatMap((s) => s.nodes).find((n) => n.kind === "repeater" && n.id === "borrowers");
    expect(borrowers && borrowers.kind === "repeater" && borrowers.fields.find((f) => f.id === "borrower_phone_mobile")?.ukMobile).toBe(true);
    expect(borrowers && borrowers.kind === "repeater" && borrowers.fields.find((f) => f.id === "borrower_date_of_birth")?.dob).toBe(true);
    const issues = validateForm(schema, {
      occupiers_17_plus: "yes",
      borrowers: [{ borrower_phone_mobile: "02079460000", borrower_date_of_birth: "2015-01-01" }],
      occupiers: [{ occupier_date_of_birth: "2009-01-01" }],
    }, ctx);
    expect(issues.find((i) => i.path === "borrowers.0.borrower_phone_mobile")?.message).toMatch(/07 or \+44/);
    expect(issues.find((i) => i.path === "borrowers.0.borrower_date_of_birth")?.message).toMatch(/18 or over/);
    expect(issues.find((i) => i.path === "occupiers.0.occupier_date_of_birth")).toBeUndefined();
  });

  it("copies phone and date of birth onto columns and leaves the lender form alone", () => {
    expect(contactColumns("al", DEMO_AL)).toMatchObject({ applicant_mobile: "07700 900123", applicant_dob: "1984-03-14", joint_applicant_dob: "1986-07-02" });
    expect(contactColumns("works", DEMO_WORKS)).toMatchObject({ borrower_mobile: "07700 900123", borrower_dob: "1984-03-14" });
    expect(contactColumns("remortgage", { borrowers: [{ borrower_phone_mobile: "+44 7700 900123", borrower_date_of_birth: "1984-03-14" }, { borrower_phone_mobile: "07700900456", borrower_date_of_birth: "1990-01-02" }] })).toEqual({
      applicant_mobile: "+44 7700 900123",
      applicant_dob: "1984-03-14",
      applicants: [
        { mobile: "+44 7700 900123", date_of_birth: "1984-03-14" },
        { mobile: "07700900456", date_of_birth: "1990-01-02" },
      ],
    });
    expect(contactColumns("lender", { contact_phone: "020 7946 0000" })).toEqual({});
    const sql = readFileSync(new URL("../../sql/20261121_smartlink_phone_dob.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/add column if not exists applicant_dob/);
    expect(sql).toMatch(/add column if not exists borrower_dob/);
    expect(sql).not.toMatch(/drop table|truncate|delete from|drop column/i);
  });
});

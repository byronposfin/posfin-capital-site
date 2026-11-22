import { gbp, num } from "@/lib/engine/money";
import type { FormSchema, Issue, Item } from "@/lib/engine/types";
import { contingencyPct, WORKS_CATEGORIES, WORKS_MAX_LINES } from "./works-calc";

export const PROJECT_TYPES = ["Light refurbishment", "Heavy refurbishment", "Conversion", "Extension", "Ground-up"];

export const worksSchema: FormSchema = {
  id: "works",
  title: "Schedule of Works",
  declaration: {
    text: "I confirm this schedule is a fair summary of the works planned, the costs include labour and VAT where applicable, and I understand lenders and valuers may rely on it.",
    nameLabel: "Type your full name",
  },
  steps: [
    {
      id: "project",
      kicker: "Step 1",
      title: "The project",
      description: "A high-level view of what’s being done — lenders and valuers use this to understand the scheme.",
      nodes: [
        { id: "borrower_name", label: "Borrower", type: "text", required: true, help: "Person or company taking the loan." },
        { id: "property_address", label: "Property address", type: "textarea", required: true },
        { id: "property_postcode", label: "Postcode", type: "postcode", required: true, half: true },
        { id: "property_type", label: "Property type", type: "choice", half: true, options: ["Residential", "BTL", "HMO", "Multi-unit", "Commercial", "Semi-commercial", "Other"] },
        { id: "project_type", label: "What kind of project is it?", type: "choice", required: true, options: PROJECT_TYPES },
        { id: "project_summary", label: "In a sentence or two", type: "textarea", placeholder: "e.g. Convert a 3-bed house into two self-contained flats", help: "Optional — the headline the valuer will read first." },
        { id: "units_before", label: "Units before", type: "number", half: true, min: 0, advanced: true },
        { id: "units_after", label: "Units after", type: "number", half: true, min: 0, advanced: true },
      ],
    },
    {
      id: "consents",
      kicker: "Step 2",
      title: "Consents & timing",
      description: "Where planning and building regulations stand, and who is doing the work.",
      nodes: [
        { id: "planning_status", label: "Planning", type: "choice", required: true, options: ["Not required", "Permitted development", "Applied for", "Granted", "Not yet applied"] },
        { id: "planning_reference", label: "Planning reference", type: "text", when: { field: "planning_status", in: ["Applied for", "Granted"] }, placeholder: "e.g. 24/01234/FUL" },
        { id: "building_regs_status", label: "Building regulations", type: "choice", required: true, options: ["Not required", "Building notice", "Full plans submitted", "Full plans approved", "Approved inspector appointed", "Not sure"] },
        { id: "start_date", label: "Start date", type: "date", required: true, half: true },
        { id: "duration_weeks", label: "Duration (weeks)", type: "number", required: true, half: true, min: 1, max: 260 },
        { id: "contractor_type", label: "Who is doing the works?", type: "choice", required: true, options: ["Main contractor", "Self-managed with trades", "Myself"] },
        { id: "contractor_name", label: "Contractor name", type: "text", required: true, when: { field: "contractor_type", equals: "Main contractor" } },
        { id: "contract_type", label: "Basis", type: "choice", options: ["Fixed price", "Quoted estimate", "My own estimate"], when: { field: "contractor_type", notEmpty: true } },
        { id: "experience", label: "Similar projects you’ve completed", type: "textarea", advanced: true, help: "Optional — lenders like to see one or two recent examples." },
      ],
    },
    {
      id: "lines",
      kicker: "Step 3",
      title: "The works",
      description: `Trades, not materials — up to ${WORKS_MAX_LINES} lines. Include labour and VAT in each cost, even if you’re doing the work yourself.`,
      panel: "works_totals",
      nodes: [
        {
          kind: "repeater", id: "lines", label: "Works", itemLabel: "Line", addLabel: "Add a line", min: 1, max: WORKS_MAX_LINES,
          summary: (l: Item) => [l.category || "Line", l.cost ? gbp(num(l.cost)) : null, l.weeks ? `${l.weeks} wks` : null].filter(Boolean).join(" · "),
          fields: [
            { id: "category", label: "Trade", type: "choice", required: true, options: WORKS_CATEGORIES },
            { id: "description", label: "What’s involved", type: "text", required: true, placeholder: "e.g. Full rewire, new consumer unit" },
            { id: "cost", label: "Cost (inc. labour & VAT)", type: "money", required: true, half: true, min: 1 },
            { id: "weeks", label: "Weeks (optional)", type: "number", half: true, min: 0, max: 260 },
          ],
        },
        { id: "contingency_pct", label: "Contingency", type: "percent", min: 0, max: 50, help: "Lenders usually expect 10–15%. Default 10%." },
      ],
    },
    {
      id: "values",
      kicker: "Step 4",
      title: "Values",
      description: "Optional, but it helps the lender see the uplift the works create.",
      panel: "works_totals",
      nodes: [
        { id: "current_value", label: "Value today (before works)", type: "money" },
        { id: "gdv", label: "Value after works (GDV)", type: "money", help: "Your estimate, or the agent’s / valuer’s figure if you have one." },
        { id: "gdv_basis", label: "Where does that figure come from?", type: "choice", options: ["My estimate", "Agent appraisal", "RICS valuation", "Comparable sales"], when: { field: "gdv", notEmpty: true } },
      ],
    },
  ],
  validate: (a) => {
    const issues: Issue[] = [];
    const lines = ((a.lines as Item[]) ?? []);
    if (lines.length > WORKS_MAX_LINES) issues.push({ path: "lines", level: "error", message: `Keep it to ${WORKS_MAX_LINES} lines — group smaller items under one trade.` });
    const cp = contingencyPct(a);
    if (cp < 10 && lines.length) issues.push({ path: "contingency_pct", level: "warn", message: "Below 10% — most lenders will expect more contingency." });
    if (a.project_type === "Heavy refurbishment" || a.project_type === "Conversion" || a.project_type === "Ground-up") {
      if (a.building_regs_status === "Not required") issues.push({ path: "building_regs_status", level: "warn", message: "This kind of project usually needs building regulations sign-off — worth checking." });
    }
    return issues;
  },
};

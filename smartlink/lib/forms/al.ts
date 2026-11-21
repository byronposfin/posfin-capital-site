import { gbp, num } from "@/lib/engine/money";
import type { Answers, FormSchema, Issue, Item } from "@/lib/engine/types";
import { ITEMISE_THRESHOLD, propertyDerived, VAGUE_LENDER } from "./al-calc";

export const LENDER_SUGGESTIONS = [
  "Barclays", "HSBC", "Lloyds Bank", "NatWest", "Santander", "Nationwide", "Halifax", "TSB", "Coventry BS", "Skipton BS",
  "Paragon", "The Mortgage Works", "Kent Reliance", "Precise", "Shawbrook", "Aldermore", "Hampshire Trust Bank", "InterBay",
  "Together", "Octopus Real Estate", "LendInvest", "MT Finance", "Fleet Mortgages", "Foundation Home Loans", "Landbay", "Other",
];

const GROUPED = [
  { id: "grouped_credit_cards", label: "Credit cards (total)", type: "Credit card" },
  { id: "grouped_overdrafts", label: "Overdrafts (total)", type: "Overdraft" },
  { id: "grouped_other_small", label: "Other small debts (total)", type: "Other" },
] as const;

const propSummary = (p: Item) => {
  const d = propertyDerived(p);
  const addr = String(p.address_line1 || "New property");
  return [addr, d.value ? gbp(d.value) : null, d.value ? `${gbp(d.equity)} equity` : null].filter(Boolean).join(" · ");
};

export const alSchema: FormSchema = {
  id: "al",
  title: "Assets & Liabilities",
  declaration: {
    text: "I confirm the information in this statement is accurate and complete to the best of my knowledge, and I understand it may be shared with lenders to support my application.",
    nameLabel: "Type your full name",
  },
  steps: [
    {
      id: "about_you",
      kicker: "Step 1",
      title: "About you",
      description: "We’ve filled in what we already have. Check it and change anything that’s out of date.",
      nodes: [
        { id: "applicant_name", label: "Your full name", type: "text", required: true, placeholder: "As it appears on your ID" },
        { id: "email", label: "Email", type: "email", required: true },
        { id: "mobile", label: "Mobile", type: "tel", placeholder: "07…" },
        { id: "company_name", label: "Company name", type: "text", help: "Only if you own property through a company or SPV." },
        { id: "joint_applicant_name", label: "Anyone else on this?", type: "text", help: "A joint applicant’s full name, if there is one." },
      ],
    },
    {
      id: "properties",
      kicker: "Step 2",
      title: "Your properties",
      description: "One card per property, including your home. Only the address, value and mortgage are needed — the rest is optional.",
      panel: "al_totals",
      nodes: [
        {
          kind: "repeater",
          id: "properties",
          label: "Properties",
          itemLabel: "Property",
          addLabel: "Add another property",
          min: 1,
          max: 25,
          noneLabel: "I don’t own any property",
          noneField: "no_property",
          summary: propSummary,
          emptyItem: () => ({ owned_by: "Me", charge: "1st" }),
          fields: [
            { id: "address_line1", label: "Address", type: "text", required: true, placeholder: "e.g. Flat 2, 14 Example Road" },
            { id: "postcode", label: "Postcode", type: "postcode", required: true, half: true },
            { id: "property_type", label: "Type", type: "choice", half: true, options: ["Residential", "BTL", "HMO", "Multi-unit", "Commercial", "Semi-commercial", "Land", "Other"] },
            { id: "value", label: "Current value", type: "money", required: true, min: 1, help: "Your best estimate of what it’s worth today." },
            { id: "has_mortgage", label: "Is there a mortgage or loan on it?", type: "yes_no", required: true },
            { id: "lender", label: "Lender", type: "suggest", required: true, suggestions: LENDER_SUGGESTIONS, when: { field: "has_mortgage", equals: "yes" }, help: "The name on your statement — “don’t know” slows the lender down." },
            { id: "mortgage_balance", label: "Balance outstanding", type: "money", required: true, half: true, when: { field: "has_mortgage", equals: "yes" } },
            { id: "monthly_payment", label: "Monthly payment", type: "money", half: true, when: { field: "has_mortgage", equals: "yes" } },
            { id: "charge", label: "Charge", type: "choice", options: ["1st", "2nd", "3rd+"], when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "rent", label: "Rent received", type: "money_freq", help: "Optional. Enter monthly or annual — we’ll work out the other." },
            { id: "owned_by", label: "Owned by", type: "choice", options: ["Me", "Joint", "Company"], advanced: true },
            { id: "owner_name", label: "Company name", type: "text", when: { field: "owned_by", equals: "Company" }, advanced: true },
            { id: "tenanted", label: "Currently tenanted?", type: "yes_no", advanced: true },
            { id: "purchase_date", label: "Purchase date", type: "month", half: true, advanced: true },
            { id: "purchase_price", label: "Purchase price", type: "money", half: true, advanced: true },
            { id: "rate_type", label: "Rate type", type: "choice", options: ["Fixed", "Tracker", "Variable", "Not sure"], when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "rate_expiry", label: "Rate ends", type: "month", when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "notes", label: "Notes", type: "textarea", advanced: true, placeholder: "Anything the lender should know" },
          ],
        },
      ],
    },
    {
      id: "other_assets",
      kicker: "Step 3",
      title: "Other assets",
      description: "Savings, investments and anything else of value. All optional — skip what doesn’t apply.",
      panel: "al_totals",
      nodes: [
        {
          kind: "repeater", id: "cash", label: "Cash & savings", itemLabel: "Account", addLabel: "Add a cash or savings account", max: 15,
          summary: (c) => [c.where || "Account", c.amount ? gbp(num(c.amount)) : null].filter(Boolean).join(" · "),
          fields: [
            { id: "where", label: "Where it’s held", type: "text", required: true, placeholder: "e.g. Current account" },
            { id: "amount", label: "Balance", type: "money", required: true },
          ],
        },
        { id: "investments", label: "Investments (shares, ISAs, funds)", type: "money" },
        { id: "pensions", label: "Pensions", type: "money" },
        { id: "insurances", label: "Life policies (surrender value)", type: "money" },
        {
          kind: "repeater", id: "other_assets", label: "Other assets", itemLabel: "Asset", addLabel: "Add a vehicle, business or other asset", max: 15,
          summary: (o) => [o.description || o.type || "Asset", o.value ? gbp(num(o.value)) : null].filter(Boolean).join(" · "),
          fields: [
            { id: "type", label: "Type", type: "choice", required: true, options: ["Vehicle", "Business interest", "Art & collectables", "Jewellery", "Other"] },
            { id: "description", label: "Description", type: "text", placeholder: "e.g. 2022 Range Rover" },
            { id: "value", label: "Current value", type: "money", required: true, half: true },
            { id: "finance_owed", label: "Finance owed", type: "money", half: true },
            { id: "lender", label: "Finance provider", type: "text", when: { field: "finance_owed", notEmpty: true } },
            { id: "purchase_date", label: "Purchase date", type: "month", advanced: true },
          ],
        },
      ],
    },
    {
      id: "liabilities",
      kicker: "Step 4",
      title: "Debts & commitments",
      description: "Mortgages are already counted from your properties. Smaller debts can go in as totals; anything over £10,000 gets its own line.",
      panel: "al_totals",
      nodes: [
        { kind: "notice", id: "rule", tone: "info", title: "One line for each debt over £10,000", body: "Lenders need to see larger debts individually. Smaller ones can be added up in the totals." },
        ...GROUPED.map((g) => ({ id: g.id, label: g.label, type: "money" as const, help: "Combined balance of debts that are each £10,000 or less" })),
        { id: "grouped_monthly_payments", label: "Total monthly payments on these", type: "money" },
        {
          kind: "repeater", id: "liabilities", label: "Itemised debts", itemLabel: "Debt", addLabel: "Add a loan, bridge or other debt", max: 25,
          summary: (l) => [l.creditor || l.type || "Debt", l.balance ? gbp(num(l.balance)) : null, l.monthly_payment ? `${gbp(num(l.monthly_payment))}/m` : null].filter(Boolean).join(" · "),
          fields: [
            { id: "type", label: "Type", type: "choice", required: true, options: ["Loan", "Credit card", "Overdraft", "Bridge", "Director’s loan", "HP / car finance", "Tax (HMRC)", "Other"] },
            { id: "creditor", label: "Who is it owed to?", type: "text", required: true },
            { id: "balance", label: "Balance", type: "money", required: true, half: true },
            { id: "monthly_payment", label: "Monthly payment", type: "money", required: true, half: true, help: "Enter 0 if interest rolls up." },
            { id: "rate", label: "Interest rate", type: "text", half: true, placeholder: "e.g. 6.9%" },
            { id: "limit", label: "Limit", type: "money", half: true, advanced: true },
            { id: "secured_on", label: "Secured on", type: "choice", dynamicOptions: (a) => ["Unsecured", ...(((a.properties as Item[]) ?? []).map((p) => String(p.address_line1 || "")).filter(Boolean))], advanced: true },
            { id: "end_date", label: "Ends", type: "month", advanced: true },
          ],
        },
      ],
    },
  ],
  validate: (a) => {
    const issues: Issue[] = [];
    for (const g of GROUPED) {
      if (num(a[g.id]) > ITEMISE_THRESHOLD) {
        issues.push({
          path: g.id, level: "error",
          message: "Anything over £10,000 needs listing individually — add it below.",
          action: { label: "List it individually", id: `itemise:${g.id}` },
        });
      }
    }
    if (a.no_property !== true) {
      ((a.properties as Item[]) ?? []).forEach((p, i) => {
        if (p.has_mortgage === "yes") {
          const lender = String(p.lender ?? "").trim();
          if (lender && VAGUE_LENDER.test(lender)) issues.push({ path: `properties.${i}.lender`, level: "warn", message: "If you can, use the lender’s name from your statement — it saves the lender asking." });
          if (num(p.mortgage_balance) > num(p.value) && num(p.value) > 0) issues.push({ path: `properties.${i}.mortgage_balance`, level: "warn", message: "The balance is more than the value — worth a quick check." });
        }
      });
    }
    return issues;
  },
  actions: Object.fromEntries(
    GROUPED.map((g) => [
      `itemise:${g.id}`,
      (a: Answers): Answers => {
        const items = [...(((a.liabilities as Item[]) ?? []))];
        items.push({ _id: crypto.randomUUID(), type: g.type, balance: a[g.id], _open: true });
        return { ...a, [g.id]: "", liabilities: items };
      },
    ]),
  ),
};

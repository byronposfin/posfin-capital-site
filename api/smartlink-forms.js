/* Generated from smartlink/server/vercel.ts by smartlink/scripts/build-site.mjs. Do not edit. */

// lib/brands.ts
var POSFIN_FOOTER = "Posfin Capital is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 913022. NACFB member.";
var POSFIN_COLOURS = { ink: "#0A1A33", primary: "#0A1A33", accent: "#01BAB5", accentInk: "#007C78", surface: "#F4F6F9", rule: "#DDE3EB" };
var posfin = {
  id: "posfin",
  name: "Posfin Capital",
  kind: "posfin",
  logos: [],
  posfinWordmark: true,
  colours: POSFIN_COLOURS,
  headingStyle: "serif",
  kicker: "Posfin Capital \xB7 SmartLink",
  intro: {
    al: { title: "Your assets & liabilities, in a few minutes", body: "A short, guided version of the lender\u2019s A&L form. We\u2019ll turn your answers into a lender-ready statement \u2014 no spreadsheets, nothing to print.", minutes: 6 },
    remortgage: { title: "Let\u2019s get the legal work moving", body: "A few questions about you, the property and your current mortgage. We\u2019ll use your answers to prepare the solicitor\u2019s forms and send them for e-signature. You will not need to print or fill anything in by hand.", minutes: 10 },
    works: { title: "Your schedule of works", body: "A high-level summary of the works planned \u2014 trades, costs and timing. Lenders and valuers use it to understand the project. It takes about five minutes.", minutes: 5 },
    lender: { title: "Your lending criteria, in one place", body: "Tell us what you lend on and where your appetite really sits, so we only send you deals you\u2019ll want to see. Upload your product guide and we\u2019ll pre-fill most of it \u2014 you just plug the gaps.", minutes: 20 }
  },
  howHeard: { label: "How did you hear about Posfin Capital?", options: ["Recommendation", "Existing client", "Introducer or broker", "Search / website", "LinkedIn or social media", "Other"] },
  disclaimers: [
    "Your property may be repossessed if you do not keep up repayments on a mortgage or any other debt secured on it.",
    "Some commercial and buy-to-let lending is not regulated by the Financial Conduct Authority."
  ],
  footer: [POSFIN_FOOTER],
  forms: ["al", "remortgage", "works", "lender"]
};
var ackroyds = {
  id: "ackroyds",
  name: "Ackroyd Legal",
  kind: "cobrand",
  logos: [{ src: "/brands/ackroyds/logo.svg", alt: "Ackroyd Legal", height: 30 }],
  posfinWordmark: true,
  colours: { ink: "#151E46", primary: "#151E46", accent: "#E30613", accentInk: "#B0050F", surface: "#F3F4F8", rule: "#D8DCE6" },
  headingStyle: "serif",
  kicker: "Ackroyds \xD7 Posfin 2.0",
  intro: {
    remortgage: { title: "Let\u2019s get the legal work moving", body: "Ackroyd Legal will act as your solicitor on this remortgage. Posfin is collecting the answers they need, so we can complete their forms and send them to you for e-signature. You will not need to print or fill in a PDF.", minutes: 10 }
  },
  howHeard: { label: "How did you hear about Ackroyd Legal?", options: ["Introduced by Posfin Capital", "Recommendation", "Existing client", "Search / website", "Other"], default: "Introduced by Posfin Capital" },
  disclaimers: [],
  footer: ["Prepared by Posfin Capital, a broker not a lender, for Ackroyd Legal.", POSFIN_FOOTER],
  forms: ["remortgage"]
};
var unbranded = {
  id: "unbranded",
  name: "Schedule of works",
  kind: "neutral",
  logos: [],
  posfinWordmark: false,
  colours: { ink: "#1F2937", primary: "#1F2937", accent: "#4B5563", accentInk: "#374151", surface: "#F5F5F4", rule: "#E5E7EB" },
  headingStyle: "sans",
  kicker: "Schedule of works",
  intro: {
    works: { title: "Schedule of works", body: "A high-level summary of the works planned on the property \u2014 trades, costs and timing \u2014 for the lender and valuer.", minutes: 5 },
    al: { title: "Assets & liabilities", body: "A short, guided assets and liabilities statement.", minutes: 6 },
    lender: { title: "Lending criteria", body: "Tell us what you lend on and where your appetite sits, so we only send you suitable deals. Upload your product guide to pre-fill most of it.", minutes: 20 }
  },
  howHeard: { label: "How did you hear about us?", options: ["Recommendation", "Existing client", "Search / website", "Other"] },
  disclaimers: [],
  footer: [],
  forms: ["works", "al", "lender"]
};
var BRANDS = { posfin, ackroyds, unbranded };
var ALIASES = { general: "posfin", "ackroyds_posfin_2_0": "ackroyds", ackroyd: "ackroyds", none: "unbranded", master: "unbranded", noname: "unbranded" };
function resolveBrand(param, form, caseDefault) {
  const raw = (Array.isArray(param) ? param[0] : param) || caseDefault || "posfin";
  const id = ALIASES[raw.toLowerCase()] ?? raw.toLowerCase();
  const b = BRANDS[id];
  if (b && b.forms.includes(form)) return b;
  return posfin;
}

// lib/cases.ts
var TOKEN_RE = /^[A-Za-z0-9_-]{3,64}$/;
var DEMO = {
  token: "demo",
  ref: "PC-DEMO-001",
  demo: true,
  applicant: { name: "Jordan Example", email: "jordan.example@example.com", mobile: "07700 900123", company: "Example Holdings Ltd (fictional)", referred_by: "Demo introducer" },
  flags: { titleInsurance: true },
  prefill: {
    "crm.borrower.legal_forenames": "Jordan Alex",
    "crm.borrower.legal_surname": "Example",
    "crm.borrower.mobile": "07700 900123",
    "crm.borrower.email": "jordan.example@example.com",
    "crm.property.address / title": "14 Sample Terrace\nDemo Town",
    "crm.property.postcode / title": "ZZ1 1ZZ",
    "title.tenure": "Freehold",
    "crm.case.transaction_type": "no",
    "crm.borrower.entity_type": "no",
    "title.first_charge.proprietor / crm": "Example Building Society (fictional)",
    "crm.existing_borrowing.balance": "312,500",
    "crm.offer.gross_or_net_amount": "425,000",
    "crm.borrower.legal_name": "Jordan Alex Example"
  }
};
function getDemoCase(token) {
  if (token === "demo") return DEMO;
  if (token === "demo-blank") return { ...DEMO, token, ref: "PC-DEMO-002", prefill: { "crm.borrower.email": DEMO.applicant.email } };
  if (token === "demo-noti") return { ...DEMO, token, ref: "PC-DEMO-003", flags: { titleInsurance: false } };
  return null;
}
function flagsFor(c, searchParams) {
  const p = searchParams.titleInsurance ?? searchParams.ti;
  const v = Array.isArray(p) ? p[0] : p;
  if (v === void 0) return { titleInsurance: c.flags.titleInsurance };
  return { titleInsurance: ["1", "true", "yes", "on"].includes(v.toLowerCase()) };
}

// lib/engine/conditions.ts
function norm(v) {
  if (v === true) return "yes";
  if (v === false) return "no";
  return v;
}
function evalCond(cond, answers, ctx, item) {
  if (!cond) return true;
  if ("all_of" in cond) return cond.all_of.every((c) => evalCond(c, answers, ctx, item));
  if ("any_of" in cond) return cond.any_of.some((c) => evalCond(c, answers, ctx, item));
  if ("flag" in cond) {
    const v2 = ctx.flags[cond.flag];
    return cond.equals === void 0 ? Boolean(v2) : norm(v2) === norm(cond.equals);
  }
  const raw = item && cond.field in item ? item[cond.field] : answers[cond.field];
  if ("includes" in cond) return Array.isArray(raw) && raw.includes(cond.includes);
  const v = norm(raw);
  if ("notEmpty" in cond) return v !== void 0 && v !== null && v !== "";
  if ("in" in cond) return cond.in.map(norm).includes(v);
  return v === norm(cond.equals);
}

// lib/engine/money.ts
var MONEY_MAX = 999e6;
function parseMoney(input) {
  if (input === null || input === void 0 || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? round2(input) : null;
  const s2 = String(input).replace(/[£,\s]/g, "").replace(/^gbp/i, "");
  if (s2 === "" || s2 === ".") return null;
  if (!/^-?\d*\.?\d*$/.test(s2)) return null;
  const n2 = Number(s2);
  return Number.isFinite(n2) ? round2(n2) : null;
}
function round2(n2) {
  return Math.round(n2 * 100) / 100;
}
function gbp(n2, opts = {}) {
  if (n2 === null || n2 === void 0 || !Number.isFinite(n2)) return opts.blank ?? "\u2014";
  const dp = opts.dp ?? (Number.isInteger(n2) ? 0 : 2);
  const s2 = Math.abs(n2).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (n2 < 0 ? "\u2212\xA3" : "\xA3") + s2;
}
function pct(n2, dp = 1) {
  if (n2 === null || n2 === void 0 || !Number.isFinite(n2)) return "\u2014";
  return (n2 * 100).toFixed(dp) + "%";
}
function num(v) {
  const n2 = parseMoney(v);
  return n2 ?? 0;
}

// lib/engine/flatten.ts
function flattenAnswers(schema, answers, ctx) {
  const out = {};
  const put = (k, type, v) => {
    if (v === void 0 || v === "") return;
    if (type === "money") out[k] = parseMoney(v);
    else if (type === "money_freq") {
      const o = v;
      const a = parseMoney(o.amount);
      if (a === null) return;
      out[`${k}_amount`] = a;
      out[`${k}_frequency`] = o.frequency ?? null;
      out[`${k}_monthly`] = o.frequency === "annual" ? Math.round(a / 12 * 100) / 100 : a;
      out[`${k}_annual`] = o.frequency === "annual" ? a : Math.round(a * 12 * 100) / 100;
    } else if (type === "grid") {
      const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      for (const [r, cells] of Object.entries(v ?? {}))
        for (const [c, x] of Object.entries(cells ?? {})) {
          if (x === "" || x === void 0 || x === null) continue;
          const n2 = Number(String(x).replace(/[%,£\s]/g, ""));
          out[`${k}__${slug(r)}__${slug(c)}`] = Number.isFinite(n2) ? n2 : String(x);
        }
    } else if (type === "file") {
      const f = v;
      out[k] = f?.name ?? null;
    } else if (Array.isArray(v)) out[k] = v.join("; ");
    else if (typeof v === "object" && v !== null) out[k] = JSON.stringify(v);
    else out[k] = v;
  };
  for (const step of schema.steps) {
    if (!evalCond(step.when, answers, ctx)) continue;
    for (const n2 of step.nodes) {
      if (n2.kind === "notice") continue;
      if (n2.kind === "repeater") {
        if (!evalCond(n2.when, answers, ctx)) continue;
        const items = answers[n2.id] ?? [];
        out[`${n2.id}_count`] = items.length;
        items.forEach((it, i) => {
          for (const f of n2.fields) if (evalCond(f.when, answers, ctx, it)) put(`${n2.id}_${i + 1}_${f.id}`, f.type, it[f.id]);
        });
        continue;
      }
      if (evalCond(n2.when, answers, ctx)) {
        put(n2.id, n2.type, answers[n2.id]);
        if (n2.type === "tolerance") put(`${n2.id}_note`, "text", answers[`${n2.id}_note`]);
      }
    }
  }
  for (const k of ["declaration_accepted", "declaration_name", "declaration_at"]) if (answers[k] !== void 0) out[k] = answers[k];
  return out;
}

// lib/engine/validate.ts
var UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var PHONE = /^\+?[\d\s()-]{7,20}$/;
var SORT = /^\d{2}-?\d{2}-?\d{2}$/;
var ACCOUNT = /^\d{8}$/;
function isEmpty(v) {
  if (v === void 0 || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const o = v;
    if ("amount" in o) return isEmpty(o.amount);
    if ("name" in o && "size" in o) return !o.name;
    if (Object.values(o).every((r) => r && typeof r === "object" && !Array.isArray(r))) return Object.values(o).every((r) => Object.values(r).every((c) => c === "" || c === void 0 || c === null));
    return Object.keys(o).length === 0;
  }
  return false;
}
function validateField(f, value) {
  if (f.type === "checkbox") {
    if (f.required && value !== true) return "Please tick to confirm.";
    return null;
  }
  if (isEmpty(value)) return f.required ? requiredMsg(f) : null;
  const s2 = typeof value === "string" ? value.trim() : value;
  switch (f.type) {
    case "email":
      return EMAIL.test(String(s2)) ? null : "That email doesn\u2019t look quite right.";
    case "tel":
      return PHONE.test(String(s2)) ? null : "Please enter a valid phone number.";
    case "postcode":
      return UK_POSTCODE.test(String(s2)) ? null : "Please enter a full UK postcode, e.g. SW1A 1AA.";
    case "sort_code":
      return SORT.test(String(s2)) ? null : "Sort codes are 6 digits, e.g. 12-34-56.";
    case "account_number":
      return ACCOUNT.test(String(s2).replace(/\s/g, "")) ? null : "Account numbers are 8 digits.";
    case "money": {
      const n2 = parseMoney(value);
      if (n2 === null) return "Please enter an amount in pounds.";
      if (n2 < 0) return "Amounts can\u2019t be negative.";
      if (n2 > MONEY_MAX) return "That\u2019s above \xA3999m \u2014 please check.";
      if (f.min !== void 0 && n2 < f.min) return f.min > 0 ? "Please enter an amount above \xA30." : null;
      return null;
    }
    case "money_freq": {
      const o = value;
      const n2 = parseMoney(o.amount);
      if (n2 === null || n2 < 0) return "Please enter an amount in pounds.";
      if (!o.frequency) return "Is that monthly or annually?";
      return null;
    }
    case "grid": {
      const o = value;
      for (const r of Object.values(o ?? {})) for (const c of Object.values(r ?? {})) {
        if (c === "" || c === void 0 || c === null) continue;
        const n2 = Number(String(c).replace(/[%,£\s]/g, ""));
        if (!Number.isFinite(n2)) return "Figures only, please.";
        if (f.unit === "%" && (n2 < 0 || n2 > 100)) return "Percentages should be between 0 and 100.";
      }
      return null;
    }
    case "number":
    case "percent": {
      const n2 = Number(String(s2).replace(/[%,\s]/g, ""));
      if (!Number.isFinite(n2)) return "Please enter a number.";
      if (f.min !== void 0 && n2 < f.min) return `Minimum is ${f.min}.`;
      if (f.max !== void 0 && n2 > f.max) return `Maximum is ${f.max}.`;
      return null;
    }
    default:
      return null;
  }
}
function requiredMsg(f) {
  if (["yes_no", "yes_no_unsure", "yes_no_na", "choice", "choice_other", "multi", "tolerance"].includes(f.type)) return "Please choose an answer.";
  if (f.type === "grid") return "Please fill in at least one figure.";
  if (f.type === "money") return "Please enter an amount.";
  if (f.type === "file") return "Please attach a file.";
  return "This one\u2019s needed.";
}
function validateStep(step, answers, ctx) {
  const issues = [];
  if (!evalCond(step.when, answers, ctx)) return issues;
  for (const node of step.nodes) {
    if (node.kind === "notice") continue;
    if (node.kind === "repeater") {
      if (!evalCond(node.when, answers, ctx)) continue;
      const items = answers[node.id] ?? [];
      const noneTicked = node.noneField ? answers[node.noneField] === true : false;
      if (node.min && items.length < node.min && !noneTicked) {
        issues.push({ path: node.id, level: "error", message: node.noneLabel ? `Add at least one, or tick \u201C${node.noneLabel}\u201D.` : `Please add at least ${node.min}.` });
      }
      if (node.max && items.length > node.max) {
        issues.push({ path: node.id, level: "error", message: `Up to ${node.max} items, please \u2014 group smaller items together.` });
      }
      items.forEach((it, i) => {
        for (const f of node.fields) {
          if (!evalCond(f.when, answers, ctx, it)) continue;
          const msg2 = validateField(f, it[f.id]);
          if (msg2) issues.push({ path: `${node.id}.${i}.${f.id}`, level: "error", message: msg2 });
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
function validateForm(schema, answers, ctx, opts = {}) {
  const issues = schema.steps.flatMap((s2) => validateStep(s2, answers, ctx));
  if (schema.validate) issues.push(...schema.validate(answers, ctx));
  if (opts.requireDeclaration) {
    if (answers.declaration_accepted !== true) issues.push({ path: "declaration_accepted", level: "error", message: "Please confirm the declaration." });
    const nm = String(answers.declaration_name ?? "").trim();
    if (nm.length < 3) issues.push({ path: "declaration_name", level: "error", message: "Please type your full name." });
  }
  return issues;
}
var hasErrors = (issues) => issues.some((i) => i.level === "error");

// lib/engine/format.ts
function fmtDate(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return v;
}

// lib/forms/al-calc.ts
var ITEMISE_THRESHOLD = 1e4;
function rentMonthly(rent) {
  const r = rent;
  if (!r) return 0;
  const a = num(r.amount);
  return r.frequency === "annual" ? round2(a / 12) : a;
}
function propertyDerived(p) {
  const value = num(p.value);
  const balance = p.has_mortgage === "yes" ? num(p.mortgage_balance) : 0;
  const equity = value - balance;
  const ltv = value > 0 ? balance / value : null;
  const rm = rentMonthly(p.rent);
  return { value, balance, equity, ltv, rent_monthly: rm, rent_annual: round2(rm * 12), monthly_payment: p.has_mortgage === "yes" ? num(p.monthly_payment) : 0 };
}
var list = (a, k) => a[k] ?? [];
function computeALTotals(a) {
  const props = a.no_property === true ? [] : list(a, "properties");
  const d = props.map(propertyDerived);
  const sum = (xs) => round2(xs.reduce((x, y) => x + y, 0));
  const property_value = sum(d.map((x) => x.value));
  const mortgages = sum(d.map((x) => x.balance));
  const rent_monthly = sum(d.map((x) => x.rent_monthly));
  const mortgage_payments_monthly = sum(d.map((x) => x.monthly_payment));
  const cash = sum(list(a, "cash").map((c) => num(c.amount)));
  const others = list(a, "other_assets");
  const other_assets = round2(cash + num(a.investments) + num(a.pensions) + num(a.insurances) + sum(others.map((o) => num(o.value))));
  const other_asset_finance = sum(others.map((o) => num(o.finance_owed)));
  const grouped_small_debts = round2(num(a.grouped_credit_cards) + num(a.grouped_overdrafts) + num(a.grouped_other_small));
  const items = list(a, "liabilities");
  const itemised_liabilities = sum(items.map((l) => num(l.balance)));
  const other_liabilities = round2(grouped_small_debts + itemised_liabilities + other_asset_finance);
  const monthly_commitments = round2(mortgage_payments_monthly + sum(items.map((l) => num(l.monthly_payment))) + num(a.grouped_monthly_payments));
  const total_assets = round2(property_value + other_assets);
  const total_liabilities = round2(mortgages + other_liabilities);
  return {
    property_value,
    mortgages,
    equity: round2(property_value - mortgages),
    portfolio_ltv: property_value > 0 ? mortgages / property_value : null,
    rent_monthly,
    rent_annual: round2(rent_monthly * 12),
    mortgage_payments_monthly,
    other_assets,
    other_asset_finance,
    grouped_small_debts,
    itemised_liabilities,
    other_liabilities,
    monthly_commitments,
    total_assets,
    total_liabilities,
    net_worth: round2(total_assets - total_liabilities),
    property_count: props.length,
    mortgaged_count: props.filter((p) => p.has_mortgage === "yes").length
  };
}
function registeredOwner(p, a) {
  const me = String(a.applicant_name ?? "").trim() || "Applicant";
  switch (p.owned_by) {
    case "Joint":
      return [me, String(a.joint_applicant_name ?? "").trim()].filter(Boolean).join(" & ") || "Joint";
    case "Company":
      return String(p.owner_name ?? a.company_name ?? "Company").trim() || "Company";
    default:
      return me;
  }
}
var VAGUE_LENDER = /^(tbc|tba|family|don'?t know|dont know|unknown|n\/?a|\?+|the mortgage lender|bank|mortgage)$/i;

// lib/export/al-rows.ts
var AL_PROPERTY_COLS = ["Registered owner", "Property address", "Property type", "Purchase date", "Property value", "Monthly rental income", "Monthly mortgage payment", "Lender name", "Charge", "Current mortgage balance", "LTV"];
var AL_OTHER_COLS = ["Registered name", "Description", "Purchase date", "Lender (if applicable)", "Current value", "Outstanding / money owed"];
var AL_LIAB_COLS = ["Registered name", "Description", "Lender", "Rate", "Outstanding / money owed", "Monthly payment"];
function buildAL(a) {
  const me = String(a.applicant_name ?? "").trim() || "Applicant";
  const props = a.no_property === true ? [] : a.properties ?? [];
  const property = props.map((p) => {
    const d = propertyDerived(p);
    const mort = p.has_mortgage === "yes";
    return {
      owner: registeredOwner(p, a),
      address: String(p.address_line1 ?? ""),
      postcode: String(p.postcode ?? "").toUpperCase(),
      type: String(p.property_type ?? ""),
      purchase_date: p.purchase_date ? fmtDate(String(p.purchase_date)) : "",
      value: d.value,
      rent_monthly: d.rent_monthly || null,
      mortgage_payment: mort && p.monthly_payment !== void 0 && p.monthly_payment !== "" ? d.monthly_payment : null,
      lender: mort ? String(p.lender ?? "") : "Unencumbered",
      charge: mort ? String(p.charge || "1st") : "\u2014",
      balance: mort ? d.balance : null,
      ltv: mort ? d.ltv : null,
      equity: d.equity
    };
  });
  const other = [];
  for (const c of a.cash ?? []) other.push({ owner: me, description: `Cash \u2014 ${c.where ?? "account"}`, purchase_date: "", lender: "", value: num(c.amount), owed: null });
  if (num(a.investments)) other.push({ owner: me, description: "Investments (shares, ISAs, funds)", purchase_date: "", lender: "", value: num(a.investments), owed: null });
  if (num(a.pensions)) other.push({ owner: me, description: "Pensions", purchase_date: "", lender: "", value: num(a.pensions), owed: null });
  if (num(a.insurances)) other.push({ owner: me, description: "Life policies (surrender value)", purchase_date: "", lender: "", value: num(a.insurances), owed: null });
  for (const o of a.other_assets ?? []) other.push({ owner: me, description: [o.type, o.description].filter(Boolean).join(" \u2014 "), purchase_date: o.purchase_date ? fmtDate(String(o.purchase_date)) : "", lender: String(o.lender ?? ""), value: num(o.value), owed: num(o.finance_owed) || null });
  const liab = [];
  for (const l of a.liabilities ?? []) {
    const sec = l.secured_on && l.secured_on !== "Unsecured" ? ` (secured on ${l.secured_on})` : "";
    liab.push({ owner: me, description: `${l.type ?? "Debt"}${sec}`, lender: String(l.creditor ?? ""), rate: String(l.rate ?? ""), balance: num(l.balance), monthly: l.monthly_payment === void 0 || l.monthly_payment === "" ? null : num(l.monthly_payment) });
  }
  const grouped2 = [["grouped_credit_cards", "Credit cards (combined, each under \xA310k)"], ["grouped_overdrafts", "Overdrafts (combined, each under \xA310k)"], ["grouped_other_small", "Other small debts (combined, each under \xA310k)"]];
  const groupedRows = grouped2.filter(([k]) => num(a[k]) > 0);
  groupedRows.forEach(([k, label], i) => liab.push({ owner: me, description: label, lender: "Various", rate: "", balance: num(a[k]), monthly: i === 0 && num(a.grouped_monthly_payments) ? num(a.grouped_monthly_payments) : null }));
  if (!groupedRows.length && num(a.grouped_monthly_payments)) liab.push({ owner: me, description: "Small debts \u2014 monthly payments", lender: "Various", rate: "", balance: 0, monthly: num(a.grouped_monthly_payments) });
  const t = computeALTotals(a);
  const sum = (xs) => xs.reduce((s2, x) => s2 + (x ?? 0), 0);
  const totals = {
    ...t,
    property_rent: sum(property.map((r) => r.rent_monthly)),
    property_payments: sum(property.map((r) => r.mortgage_payment)),
    other_value: sum(other.map((r) => r.value)),
    other_owed: sum(other.map((r) => r.owed)),
    liab_balance: sum(liab.map((r) => r.balance)),
    liab_monthly: sum(liab.map((r) => r.monthly))
  };
  const summary = {
    property_net: totals.property_value - totals.mortgages,
    other_net: totals.other_value - totals.other_owed,
    liabilities: totals.liab_balance,
    net: totals.property_value - totals.mortgages + (totals.other_value - totals.other_owed) - totals.liab_balance
  };
  return { applicant: me, joint: String(a.joint_applicant_name ?? ""), company: String(a.company_name ?? ""), property, other, liab, totals, summary };
}

// lib/forms/works-calc.ts
var WORKS_MAX_LINES = 20;
var DEFAULT_CONTINGENCY = 10;
var WORKS_CATEGORIES = [
  "Strip-out & demolition",
  "Structural",
  "Roofing",
  "Windows & doors",
  "Electrics",
  "Plumbing & heating",
  "Kitchen",
  "Bathrooms",
  "Plastering & drylining",
  "Flooring",
  "Joinery",
  "Decoration",
  "Damp & timber",
  "Fire safety & compliance",
  "External & landscaping",
  "Professional fees",
  "Other"
];
function contingencyPct(a) {
  const raw = a.contingency_pct;
  if (raw === void 0 || raw === null || raw === "") return DEFAULT_CONTINGENCY;
  const n2 = Number(String(raw).replace(/[%\s]/g, ""));
  return Number.isFinite(n2) && n2 >= 0 ? n2 : DEFAULT_CONTINGENCY;
}
function computeWorksTotals(a) {
  const items = a.lines ?? [];
  const subtotal = round2(items.reduce((s2, l) => s2 + num(l.cost), 0));
  const cp = contingencyPct(a);
  const contingency = round2(subtotal * cp / 100);
  const total = round2(subtotal + contingency);
  const map = /* @__PURE__ */ new Map();
  for (const l of items) {
    const c = String(l.category || "Other");
    map.set(c, round2((map.get(c) ?? 0) + num(l.cost)));
  }
  const by_category = [...map.entries()].map(([category, cost]) => ({ category, cost, share: subtotal > 0 ? cost / subtotal : 0 })).sort((x, y) => y.cost - x.cost);
  const dur = num(a.duration_weeks);
  const gdv = a.gdv ? num(a.gdv) : null;
  const cv = a.current_value ? num(a.current_value) : null;
  return {
    lines: items.length,
    subtotal,
    contingency_pct: cp,
    contingency,
    total,
    by_category,
    programme_weeks: dur > 0 ? dur : null,
    gdv,
    current_value: cv,
    uplift: gdv !== null && cv !== null ? round2(gdv - cv) : null,
    cost_to_gdv: gdv ? total / gdv : null
  };
}

// lib/export/works-rows.ts
var WORKS_COLS = ["#", "Trade", "Description of works", "Weeks", "Cost (inc. VAT)", "% of works"];
function buildWorks(a) {
  const t = computeWorksTotals(a);
  const lines = (a.lines ?? []).map((l, i) => ({
    n: i + 1,
    category: String(l.category ?? ""),
    description: String(l.description ?? ""),
    weeks: l.weeks === void 0 || l.weeks === "" ? null : num(l.weeks),
    cost: num(l.cost),
    share: t.subtotal > 0 ? num(l.cost) / t.subtotal : 0
  }));
  const contractor = a.contractor_type === "Main contractor" ? String(a.contractor_name || "Main contractor") : String(a.contractor_type ?? "");
  const facts = [
    ["Borrower", String(a.borrower_name ?? "")],
    ["Property", [String(a.property_address ?? "").replace(/\n/g, ", "), String(a.property_postcode ?? "").toUpperCase()].filter(Boolean).join(", ")],
    ["Property type", String(a.property_type ?? "")],
    ["Project type", String(a.project_type ?? "")],
    ["Units", a.units_before || a.units_after ? `${a.units_before ?? "?"} \u2192 ${a.units_after ?? "?"}` : ""],
    ["Planning", [a.planning_status, a.planning_reference].filter(Boolean).join(" \xB7 ")],
    ["Building regulations", String(a.building_regs_status ?? "")],
    ["Start date", a.start_date ? fmtDate(String(a.start_date)) : ""],
    ["Duration", a.duration_weeks ? `${a.duration_weeks} weeks` : ""],
    ["Contractor", [contractor, a.contract_type].filter(Boolean).join(" \xB7 ")],
    ["GDV basis", String(a.gdv_basis ?? "")]
  ];
  return { t, lines, facts: facts.filter(([, v]) => v), summary: String(a.project_summary ?? ""), experience: String(a.experience ?? "") };
}

// lib/lender/catalog.ts
var FAMILY_LABEL = {
  bridging: "Bridging",
  refurb: "Refurbishment",
  development: "Development",
  commercial: "Commercial & semi-commercial",
  specialist: "Specialist commercial",
  capital_stack: "Mezzanine, second-ranking & equity",
  term: "Term finance"
};
var RESI = ["Residential", "HMO / MUFB", "Semi-commercial", "Commercial", "Land"];
var CH12 = ["1st charge", "2nd charge"];
var PRODUCTS = [
  { key: "bridge_resi", label: "Residential bridging (unregulated)", family: "bridging", short: "Resi bridge", ltvRows: ["Residential", "HMO / MUFB", "Holiday let / SA"], charges: CH12, placedSegment: "Bridging" },
  { key: "bridge_reg", label: "Regulated bridging (owner-occupied)", family: "bridging", short: "Regulated bridge", ltvRows: ["Residential"], charges: CH12, placedSegment: "Bridging" },
  { key: "bridge_comm", label: "Commercial & semi-commercial bridging", family: "commercial", short: "Commercial bridge", ltvRows: ["Semi-commercial", "Commercial", "Land with planning"], charges: CH12, placedSegment: "Bridging" },
  { key: "auction", label: "Auction finance", family: "bridging", short: "Auction", ltvRows: ["Residential", "Semi-commercial", "Commercial"], charges: ["1st charge"], placedSegment: "Bridging" },
  { key: "land", label: "Land bridging (with or without planning)", family: "bridging", short: "Land", ltvRows: ["Land with planning", "Land without planning"], charges: CH12, placedSegment: "Bridging" },
  { key: "refurb_light", label: "Light refurbishment", family: "refurb", short: "Light refurb", works: true, ltvRows: RESI.slice(0, 4), charges: ["1st charge"], placedSegment: "Refurbishment" },
  { key: "refurb_heavy", label: "Heavy refurbishment & conversion", family: "refurb", short: "Heavy refurb", works: true, dev: true, ltvRows: RESI.slice(0, 4), charges: ["1st charge"], placedSegment: "Refurbishment" },
  { key: "dev_ground", label: "Ground-up development", family: "development", short: "Development", works: true, dev: true, ltvRows: ["Residential scheme", "Mixed-use scheme", "Commercial scheme"], charges: ["1st charge"], placedSegment: "Development" },
  { key: "dev_exit", label: "Development exit & unsold stock", family: "development", short: "Dev exit / stock", ltvRows: ["Residential units", "Mixed-use units", "Commercial units"], charges: CH12, placedSegment: "Development exit" },
  { key: "distressed", label: "Distressed, stalled & part-built sites", family: "development", short: "Distressed / stalled", works: true, dev: true, ltvRows: ["Part-built residential", "Part-built mixed-use", "Stalled land"], charges: CH12, placedSegment: "Development" },
  { key: "care_hotel", label: "Hotels, care homes & trading businesses", family: "specialist", short: "Hotels / care", ltvRows: ["Hotels & hospitality", "Care homes & healthcare", "Pubs & leisure", "Other trading business"], charges: CH12, placedSegment: "Specialist commercial" },
  { key: "mezz", label: "Mezzanine / second-ranking behind senior debt", family: "capital_stack", short: "Mezzanine", subordinate: true, works: true, dev: true, ltvRows: ["Development", "Bridging / investment", "Trading / specialist"], charges: ["2nd charge", "Unsecured / share charge"], placedSegment: "Mezzanine" },
  { key: "equity_jv", label: "Equity / joint venture funding", family: "capital_stack", short: "Equity / JV", equity: true, dev: true, ltvRows: ["Development", "Value-add / refurb", "Distressed / stock"], charges: ["Equity (no charge)", "Preferred equity"], placedSegment: "Equity" },
  { key: "term_btl", label: "Buy-to-let & portfolio term finance", family: "term", short: "BTL / term", ltvRows: ["Residential", "HMO / MUFB", "Holiday let / SA"], charges: CH12, placedSegment: "Term" },
  { key: "term_comm", label: "Commercial term loans", family: "term", short: "Commercial term", ltvRows: ["Semi-commercial", "Commercial", "Trading business"], charges: CH12, placedSegment: "Term" }
];
var PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));
var PRODUCT_OPTIONS = PRODUCTS.map((p) => p.label);
var REGIONS = ["England", "Wales", "Scotland", "Northern Ireland", "Isle of Man & Channel Islands"];
var BORROWER_TYPES = ["Individuals", "UK limited companies / SPVs", "LLPs & partnerships", "Trusts", "Overseas companies", "Pension schemes (SIPP / SSAS)", "Charities & community bodies"];
var LENDER_TYPES = ["High-street or challenger bank", "Specialist lender (balance sheet)", "Specialist lender (funded lines)", "Private credit / debt fund", "Family office", "Peer-to-peer / platform", "Private individual or syndicate", "Other"];
var ASSETS = [
  { key: "std_resi", label: "Standard residential houses & flats", group: "Residential" },
  { key: "hmo_small", label: "Small HMO (up to 6 beds)", group: "Residential" },
  { key: "hmo_large", label: "Large HMO (7+ beds) / sui generis", group: "Residential" },
  { key: "mufb", label: "Multi-unit freehold blocks", group: "Residential" },
  { key: "holiday", label: "Holiday lets & serviced accommodation", group: "Residential" },
  { key: "above_comm", label: "Flats above commercial", group: "Residential" },
  { key: "ex_la", label: "Ex-local authority / high-rise", group: "Residential" },
  { key: "uninhabitable", label: "Uninhabitable (no kitchen or bathroom)", group: "Residential" },
  { key: "non_std", label: "Non-standard construction", group: "Construction & title" },
  { key: "short_lease", label: "Short leases (under 70 years)", group: "Construction & title" },
  { key: "listed", label: "Listed buildings", group: "Construction & title" },
  { key: "rural", label: "Rural, agricultural ties & large acreage", group: "Construction & title" },
  { key: "office", label: "Offices", group: "Commercial" },
  { key: "retail", label: "Retail & high street", group: "Commercial" },
  { key: "industrial", label: "Industrial & warehouse", group: "Commercial" },
  { key: "hospitality", label: "Hotels, pubs & hospitality", group: "Commercial" },
  { key: "care", label: "Care homes & healthcare", group: "Commercial" },
  { key: "leisure", label: "Leisure, places of worship & specialist", group: "Commercial" },
  { key: "land_pp", label: "Land with planning", group: "Land & development" },
  { key: "land_nopp", label: "Land without planning", group: "Land & development" },
  { key: "part_built", label: "Part-built or stalled sites", group: "Land & development" },
  { key: "unsold_stock", label: "Unsold new-build stock", group: "Land & development" }
];
var HAIR = [
  { key: "ccj_satisfied", label: "CCJs \u2014 satisfied, over 12 months old", group: "Adverse credit" },
  { key: "ccj_recent", label: "CCJs \u2014 unsatisfied or in the last 12 months", group: "Adverse credit" },
  { key: "default_satisfied", label: "Defaults \u2014 satisfied or settled", group: "Adverse credit" },
  { key: "default_recent", label: "Defaults \u2014 recent or unsatisfied", group: "Adverse credit" },
  { key: "missed_unsecured", label: "Missed unsecured payments", group: "Adverse credit" },
  { key: "arrears_current", label: "Current secured arrears (incl. on the security)", group: "Adverse credit" },
  { key: "arrears_historic", label: "Historic mortgage arrears, now cleared", group: "Adverse credit" },
  { key: "dmp", label: "Debt management plan (active)", group: "Adverse credit" },
  { key: "payday", label: "Payday loans in the last 12 months", group: "Adverse credit" },
  { key: "tax_arrears", label: "HMRC / tax arrears or time-to-pay", group: "Adverse credit" },
  { key: "bankrupt_discharged", label: "Bankruptcy \u2014 discharged", group: "Insolvency" },
  { key: "bankrupt_current", label: "Bankruptcy \u2014 undischarged", group: "Insolvency" },
  { key: "iva_active", label: "IVA \u2014 active", group: "Insolvency" },
  { key: "iva_complete", label: "IVA \u2014 completed", group: "Insolvency" },
  { key: "corp_insolvency", label: "Director of a company that went into insolvency", group: "Insolvency" },
  { key: "insolvency_assoc", label: "Insolvency-associated parties (connected people or companies)", group: "Insolvency" },
  { key: "director_disq", label: "Director disqualification (past or present)", group: "Insolvency" },
  { key: "repossession", label: "Prior repossession", group: "Insolvency" },
  { key: "adverse_media", label: "Adverse media", group: "People & compliance" },
  { key: "criminal_spent", label: "Criminal record \u2014 spent", group: "People & compliance" },
  { key: "criminal_unspent", label: "Criminal record \u2014 unspent", group: "People & compliance" },
  { key: "litigation", label: "Live litigation or disputes", group: "People & compliance" },
  { key: "pep", label: "Politically exposed persons (PEPs)", group: "People & compliance" },
  { key: "sanctions_adjacent", label: "Sanctions-adjacent jurisdictions or parties", group: "People & compliance", help: "Not sanctioned parties themselves." },
  { key: "foreign_resident", label: "Foreign nationals living in the UK", group: "Borrower profile" },
  { key: "expat", label: "Expats & non-UK-resident borrowers", group: "Borrower profile" },
  { key: "first_time_borrower", label: "First-time borrowers / no property experience", group: "Borrower profile" },
  { key: "first_time_dev", label: "First-time developers", group: "Borrower profile" },
  { key: "age_extremes", label: "Borrowers over 80 at end of term", group: "Borrower profile" },
  { key: "offshore_spv", label: "Offshore SPVs & overseas companies", group: "Structures" },
  { key: "trusts", label: "Trusts & complex ownership", group: "Structures" },
  { key: "layered", label: "Multi-layered group structures", group: "Structures" },
  { key: "reg_borderline", label: "Regulated / unregulated borderline (e.g. family member in occupation)", group: "Structures" },
  { key: "security_in_default", label: "Security already in default with existing lender", group: "Situations" },
  { key: "receivership", label: "Receivership, LPA or administrator sales", group: "Situations" },
  { key: "no_exit_evidence", label: "Exit not yet evidenced (e.g. refinance subject to planning)", group: "Situations" }
];
var CASE_STUDIES = [
  {
    key: "cs01",
    title: "1 \xB7 Vanilla refinance bridge",
    tag: "Vanilla",
    signals: ["bridge_resi", "std_resi"],
    body: "Experienced landlord, clean credit, refinancing a three-bed terrace in Leeds held in a UK SPV to release equity for the next purchase. Exit: BTL refinance in 9 months.",
    facts: [["Loan", "\xA3285,000"], ["Value", "\xA3425,000"], ["LTV", "67% gross"], ["Term", "12 months"], ["Charge", "1st"], ["Interest", "Retained"]]
  },
  {
    key: "cs02",
    title: "2 \xB7 Quirky: Grade II barn conversion",
    tag: "Quirky",
    signals: ["bridge_resi", "listed", "rural", "non_std"],
    body: "Completed Grade II listed barn conversion on 4 acres in rural Herefordshire, timber frame, private drainage. Owner wants to bridge to sale.",
    facts: [["Loan", "\xA3620,000"], ["Value", "\xA31,100,000"], ["LTV", "56%"], ["Term", "12 months"], ["Charge", "1st"], ["Exit", "Sale"]]
  },
  {
    key: "cs03",
    title: "3 \xB7 Hairy: satisfied CCJ and old default",
    tag: "Hairy",
    signals: ["ccj_satisfied", "default_satisfied", "bridge_resi"],
    body: "Self-employed borrower with a \xA36,400 CCJ satisfied 2 years ago and a settled default from 4 years ago. Purchase of a mid-terrace at auction, 28-day completion.",
    facts: [["Loan", "\xA3168,000"], ["Price", "\xA3240,000"], ["LTV", "70%"], ["Term", "12 months"], ["Charge", "1st"], ["Deadline", "28 days"]]
  },
  {
    key: "cs04",
    title: "4 \xB7 Part-built: stalled 6-unit scheme",
    tag: "Part-build",
    signals: ["distressed", "part_built", "dev_ground"],
    body: "New developer takes over a 6-house scheme stalled at roof level after the original contractor failed. Fixed-price contract for the remaining works; QS report in hand.",
    facts: [["Day 1", "\xA3900,000"], ["Works", "\xA3650,000"], ["GDV", "\xA32,700,000"], ["LTGDV", "57%"], ["Term", "15 months"], ["Charge", "1st"]]
  },
  {
    key: "cs05",
    title: "5 \xB7 Second charge behind a high-street lender",
    tag: "Second charge",
    signals: ["bridge_resi", "2nd_charge"],
    body: "Business-purpose second charge on a portfolio property to fund a deposit. First charge is with a high-street lender at 45% LTV; consent to be requested.",
    facts: [["Loan", "\xA3150,000"], ["Value", "\xA3800,000"], ["Combined LTV", "64%"], ["Term", "9 months"], ["Charge", "2nd"], ["Purpose", "Business"]]
  },
  {
    key: "cs06",
    title: "6 \xB7 Regulated borderline",
    tag: "Regulated borderline",
    signals: ["reg_borderline", "bridge_reg"],
    body: "Borrower's adult son lives in the flat rent-free while studying. Borrower wants to raise funds for a business, secured on the flat.",
    facts: [["Loan", "\xA3190,000"], ["Value", "\xA3330,000"], ["LTV", "58%"], ["Term", "12 months"], ["Charge", "1st"], ["Occupier", "Family member"]]
  },
  {
    key: "cs07",
    title: "7 \xB7 Development exit on unsold stock",
    tag: "Development exit",
    signals: ["dev_exit", "unsold_stock"],
    body: "Practical completion reached on 14 flats; 5 sold, 9 unsold. Refinance the senior development loan to give 12 months to sell the rest.",
    facts: [["Loan", "\xA32,300,000"], ["Unsold GDV", "\xA33,600,000"], ["LTV", "64%"], ["Term", "12 months"], ["Charge", "1st"], ["Exit", "Unit sales"]]
  },
  {
    key: "cs08",
    title: "8 \xB7 Specialist: care home acquisition",
    tag: "Specialist",
    signals: ["care_hotel", "care"],
    body: "Experienced operator acquiring a 42-bed residential care home with 'Good' regulatory rating. 3 years of trading accounts; bricks-and-mortar value below trading value.",
    facts: [["Loan", "\xA32,100,000"], ["Trading value", "\xA33,500,000"], ["LTV", "60% (trading)"], ["Term", "18 months"], ["Charge", "1st"], ["Exit", "Term loan"]]
  },
  {
    key: "cs09",
    title: "9 \xB7 Mezzanine on a ground-up scheme",
    tag: "Mezzanine",
    signals: ["mezz", "dev_ground"],
    body: "Senior lender at 60% LTGDV on a 20-unit scheme. Developer needs mezzanine to reduce their equity to 10% of costs. Intercreditor to be agreed.",
    facts: [["Mezz", "\xA31,400,000"], ["GDV", "\xA39,000,000"], ["Total LTGDV", "75%"], ["Term", "24 months"], ["Charge", "2nd"], ["Senior", "60% LTGDV"]]
  },
  {
    key: "cs10",
    title: "10 \xB7 Distressed: receiver sale, 50% LTV",
    tag: "Distressed",
    signals: ["receivership", "security_in_default", "dev_exit"],
    body: "Buyer purchasing 8 completed but empty units from an LPA receiver at a discount. Low leverage, quick completion, limited information pack.",
    facts: [["Loan", "\xA31,050,000"], ["Value", "\xA32,100,000"], ["LTV", "50%"], ["Term", "12 months"], ["Charge", "1st"], ["Deadline", "21 days"]]
  },
  {
    key: "cs11",
    title: "11 \xB7 Rollover with a capital paydown",
    tag: "Rollover",
    signals: ["rollover", "bridge_resi"],
    body: "Month 11 of a 12-month bridge on a mixed-use building. Refinance is delayed and a new valuation has come in lower, putting the loan at 76% LTV. The borrower will pay down \xA3120,000 of capital to bring it under 70% and asks for 6 more months with interest retained.",
    facts: [["Balance now", "\xA31,140,000"], ["New value", "\xA31,500,000"], ["LTV after paydown", "68%"], ["Extension", "6 months"], ["Interest", "Re-retained"], ["Conduct", "No arrears"]]
  }
];

// lib/demo.ts
var DEMO_AL = {
  applicant_name: "Jordan Example",
  email: "jordan.example@example.com",
  mobile: "07700 900123",
  company_name: "Example Holdings Ltd",
  joint_applicant_name: "Sam Example",
  no_property: false,
  properties: [
    { _id: "p1", address_line1: "14 Sample Terrace, Demo Town", postcode: "ZZ1 1ZZ", property_type: "Residential", owned_by: "Joint", value: 685e3, has_mortgage: "yes", lender: "Example Building Society", mortgage_balance: 312500, monthly_payment: 1840, charge: "1st", purchase_date: "2016-04", purchase_price: 455e3, rate_type: "Fixed", rate_expiry: "2027-06" },
    { _id: "p2", address_line1: "Flat 3, 2 Fiction Road, Demo Town", postcode: "ZZ2 4AB", property_type: "BTL", owned_by: "Company", owner_name: "Example Holdings Ltd", value: 295e3, has_mortgage: "yes", lender: "Demo Bank plc", mortgage_balance: 198e3, monthly_payment: 1030, charge: "1st", rent: { amount: "1,650", frequency: "monthly" }, tenanted: "yes", purchase_date: "2019-09" },
    { _id: "p3", address_line1: "21 Placeholder Street, Sampleton", postcode: "ZZ3 7CD", property_type: "HMO", owned_by: "Company", owner_name: "Example Holdings Ltd", value: 54e4, has_mortgage: "yes", lender: "Specimen Mortgages Ltd", mortgage_balance: 351e3, monthly_payment: 2190, charge: "1st", rent: { amount: "52,800", frequency: "annual" }, tenanted: "yes", purchase_date: "2021-02" },
    { _id: "p4", address_line1: "Unit 5, Mock Industrial Estate", postcode: "ZZ4 9EF", property_type: "Commercial", owned_by: "Company", owner_name: "Example Holdings Ltd", value: 42e4, has_mortgage: "no", rent: { amount: "2,750", frequency: "monthly" }, tenanted: "yes", purchase_date: "2014-11" }
  ],
  cash: [
    { _id: "c1", where: "Current account", amount: 38500 },
    { _id: "c2", where: "Business savings", amount: 92e3 }
  ],
  investments: 64e3,
  pensions: 21e4,
  insurances: "",
  other_assets: [
    { _id: "o1", type: "Vehicle", description: "2022 estate car", value: 34e3, finance_owed: 12600, lender: "Demo Motor Finance" }
  ],
  grouped_credit_cards: 4200,
  grouped_overdrafts: "",
  grouped_other_small: 1800,
  grouped_monthly_payments: 320,
  liabilities: [
    { _id: "l1", type: "Loan", creditor: "Example Finance Co", balance: 24e3, monthly_payment: 610, rate: "7.4%" },
    { _id: "l2", type: "Bridge", creditor: "Sample Bridging Ltd", balance: 15e4, monthly_payment: 0, rate: "0.85% pm (rolled)", secured_on: "Unit 5, Mock Industrial Estate" }
  ]
};
var DEMO_WORKS = {
  borrower_name: "Example Holdings Ltd",
  property_address: "21 Placeholder Street\nSampleton",
  property_postcode: "ZZ3 7CD",
  property_type: "HMO",
  project_type: "Heavy refurbishment",
  project_summary: "Back-to-brick refurbishment of a 5-bed HMO, adding a sixth en-suite room in the loft.",
  units_before: 5,
  units_after: 6,
  planning_status: "Permitted development",
  building_regs_status: "Full plans approved",
  start_date: "2027-01-11",
  duration_weeks: 16,
  contractor_type: "Main contractor",
  contractor_name: "Demo Build & Refurb Ltd",
  contract_type: "Fixed price",
  lines: [
    { _id: "w1", category: "Strip-out & demolition", description: "Strip out kitchen, bathrooms and ceilings; skips", cost: 9500, weeks: 2 },
    { _id: "w2", category: "Structural", description: "Steel beam to rear reception; loft floor joists", cost: 18500, weeks: 2 },
    { _id: "w3", category: "Roofing", description: "Loft dormer, re-felt and batten rear slope", cost: 24e3, weeks: 3 },
    { _id: "w4", category: "Windows & doors", description: "8 uPVC windows, FD30 fire doors throughout", cost: 16800, weeks: 1 },
    { _id: "w5", category: "Electrics", description: "Full rewire, new consumer unit, LD2 fire alarm", cost: 14500, weeks: 2 },
    { _id: "w6", category: "Plumbing & heating", description: "New combi boilers x2, radiators, first-fix plumbing", cost: 17200, weeks: 2 },
    { _id: "w7", category: "Bathrooms", description: "6 en-suite shower rooms", cost: 27e3, weeks: 3 },
    { _id: "w8", category: "Kitchen", description: "Communal kitchen, appliances and worktops", cost: 11500, weeks: 1 },
    { _id: "w9", category: "Plastering & drylining", description: "Re-plaster throughout, fire-rated boarding", cost: 12800, weeks: 2 },
    { _id: "w10", category: "Flooring", description: "LVT to wet areas, carpet to rooms", cost: 7400, weeks: 1 },
    { _id: "w11", category: "Decoration", description: "Full internal decoration", cost: 6900, weeks: 1 },
    { _id: "w12", category: "Professional fees", description: "Architect, building control, party wall", cost: 8600 }
  ],
  contingency_pct: 10,
  current_value: 54e4,
  gdv: 76e4,
  gdv_basis: "Agent appraisal"
};
var DEMO_REMORTGAGE_EXTRA = {
  purchase_date: "2016-04-22",
  first_lender_account_number: "DEMO-00012345",
  first_lender_payment_date: "1st",
  first_lender_rate_type: "Fixed",
  first_lender_repayment_type: "Repayment",
  has_further_charges: "no",
  redemption_penalties: "unsure",
  new_loan_has_monthly_payment: "Interest is rolled up \u2014 no monthly payment",
  buildings_insurance_by_new_loan: "no",
  buildings_insurance_insurer: "Sample Insurance Co (fictional)",
  buildings_insurance_sum_insured: "520,000",
  buildings_insurance_lender_noted: "Yes, I will arrange this",
  interest_only: "yes",
  forthcoming_holidays: "None planned",
  balance_funds_needed: "no",
  business_purpose_confirmation: true,
  business_purpose_details: "To refinance the property and fund a small refurbishment of the rear extension.",
  exit_route: ["Refinance", "Sale of another property"],
  exit_route_details: "Term refinance once works are complete, expected within 12 months.",
  insolvency_declaration: "no",
  occupancy_type: "My or our main home (owner-occupied)",
  occupiers_17_plus: "no",
  conveyancing_protocol_consent: "yes",
  net_advance_bank_name: "Demo Bank plc",
  net_advance_account_name: "Jordan Alex Example",
  net_advance_sort_code: "00-00-00",
  net_advance_account_number: "00001234",
  net_advance_account_in_all_borrowers_names: "yes"
};
var _assetVals = {
  std_resi: "Accept",
  hmo_small: "Accept",
  hmo_large: "Case by case",
  mufb: "Accept",
  holiday: "Case by case",
  above_comm: "Accept",
  ex_la: "Case by case",
  uninhabitable: "Accept",
  non_std: "Case by case",
  short_lease: "Decline",
  listed: "Case by case",
  rural: "Case by case",
  office: "Accept",
  retail: "Accept",
  industrial: "Accept",
  hospitality: "Case by case",
  care: "Decline",
  leisure: "Decline",
  land_pp: "Accept",
  land_nopp: "Case by case",
  part_built: "Accept",
  unsold_stock: "Accept"
};
var _hairVals = {
  ccj_satisfied: "Accept",
  ccj_recent: "Case by case",
  default_satisfied: "Accept",
  default_recent: "Case by case",
  missed_unsecured: "Accept",
  arrears_current: "Case by case",
  arrears_historic: "Accept",
  dmp: "Case by case",
  payday: "Case by case",
  tax_arrears: "Case by case",
  bankrupt_discharged: "Case by case",
  bankrupt_current: "Decline",
  iva_active: "Decline",
  iva_complete: "Case by case",
  corp_insolvency: "Case by case",
  insolvency_assoc: "Case by case",
  director_disq: "Decline",
  repossession: "Case by case",
  adverse_media: "Case by case",
  criminal_spent: "Accept",
  criminal_unspent: "Decline",
  litigation: "Case by case",
  pep: "Case by case",
  sanctions_adjacent: "Decline",
  foreign_resident: "Accept",
  expat: "Accept",
  first_time_borrower: "Case by case",
  first_time_dev: "Case by case",
  age_extremes: "Accept",
  offshore_spv: "Case by case",
  trusts: "Case by case",
  layered: "Case by case",
  reg_borderline: "Decline",
  security_in_default: "Accept",
  receivership: "Accept",
  no_exit_evidence: "Case by case"
};
var DEMO_LENDER = {
  lender_name: "Northgate Example Capital (fictional)",
  lender_type: "Specialist lender (funded lines)",
  website: "www.northgate-example.test",
  nacfb_patron: "yes",
  fca_regulated: "no",
  contact_name: "Alex Sample",
  contact_role: "Head of Distribution",
  contact_email: "alex.sample@example.com",
  contact_phone: "020 7946 0000",
  bdm_same: "no",
  bdm_name: "Robin Placeholder",
  bdm_region: "London & South East",
  bdm_email: "robin.placeholder@example.com",
  bdm_phone: "07700 900456",
  regions: ["England", "Wales", "Scotland"],
  postcode_exclusions: "Highlands & Islands",
  borrower_types: ["Individuals", "UK limited companies / SPVs", "LLPs & partnerships", "Trusts", "Overseas companies"],
  min_property_value: "100,000",
  max_exposure: "15,000,000",
  guide_file: { name: "Northgate_Product_Guide_Nov2026.pdf", size: 1843200, type: "application/pdf" },
  guide_date: "2026-11-01",
  guide_update_freq: "Quarterly",
  regulated_scope: "Unregulated only",
  charge_positions: ["1st charge", "2nd charge", "Behind senior debt (mezzanine)"],
  subordinate_appetite: "Yes \u2014 mezzanine or second-ranking",
  products: ["Residential bridging (unregulated)", "Commercial & semi-commercial bridging", "Heavy refurbishment & conversion", "Development exit & unsold stock", "Distressed, stalled & part-built sites", "Mezzanine / second-ranking behind senior debt"],
  sweet_loan: "1,250,000",
  sweet_ltv: "62",
  p_bridge_resi_min_loan: "100,000",
  p_bridge_resi_max_loan: "15,000,000",
  p_bridge_resi_charges: ["1st charge", "2nd charge"],
  p_bridge_resi_ltv: { Residential: { "1st charge": "75", "2nd charge": "65" }, "HMO / MUFB": { "1st charge": "70", "2nd charge": "60" }, "Holiday let / SA": { "1st charge": "65", "2nd charge": "" } },
  p_bridge_resi_ltv_basis: "Gross",
  p_bridge_resi_term_min: "3",
  p_bridge_resi_term_max: "18",
  p_bridge_resi_min_interest_type: "A fixed number of months",
  p_bridge_resi_min_interest_months: "1",
  p_bridge_resi_exit_after_months: "1",
  p_bridge_resi_interest_time_used: "yes",
  p_bridge_resi_erc: "No ERCs",
  p_bridge_resi_rate_from: "0.79",
  p_bridge_resi_rate_to: "1.15",
  p_bridge_resi_rate_basis: "Per month",
  p_bridge_resi_arrangement_fee: "2",
  p_bridge_resi_interest_options: ["Retained", "Rolled up", "Serviced"],
  p_bridge_resi_proc_fee: "1",
  p_bridge_resi_roll_offered: "Yes",
  p_bridge_resi_roll_max_ltv: "70",
  p_bridge_resi_roll_max_count: "2",
  p_bridge_resi_roll_paydown: "yes",
  p_bridge_resi_roll_reretain: "yes",
  p_bridge_resi_roll_fee: "Extension fee",
  p_bridge_resi_roll_fee_pct: "1",
  p_bridge_resi_roll_reval: "Sometimes",
  p_bridge_comm_min_loan: "150,000",
  p_bridge_comm_max_loan: "10,000,000",
  p_bridge_comm_charges: ["1st charge"],
  p_bridge_comm_ltv: { "Semi-commercial": { "1st charge": "70" }, Commercial: { "1st charge": "65" }, "Land with planning": { "1st charge": "60" } },
  p_bridge_comm_ltv_basis: "Gross",
  p_bridge_comm_term_min: "3",
  p_bridge_comm_term_max: "18",
  p_bridge_comm_min_interest_type: "A percentage of the term",
  p_bridge_comm_min_interest_pct: "50",
  p_bridge_comm_exit_after_months: "6",
  p_bridge_comm_interest_time_used: "no",
  p_bridge_comm_erc: "No ERCs",
  p_bridge_comm_rate_from: "0.89",
  p_bridge_comm_rate_to: "1.25",
  p_bridge_comm_rate_basis: "Per month",
  p_bridge_comm_arrangement_fee: "2",
  p_bridge_comm_interest_options: ["Retained", "Serviced"],
  p_bridge_comm_roll_offered: "Case by case",
  p_bridge_comm_roll_max_ltv: "65",
  p_bridge_comm_roll_paydown: "yes",
  p_bridge_comm_roll_reretain: "unsure",
  p_bridge_comm_roll_fee: "New arrangement fee",
  p_bridge_comm_roll_fee_pct: "2",
  p_bridge_comm_roll_reval: "Always",
  p_refurb_heavy_min_loan: "250,000",
  p_refurb_heavy_max_loan: "12,000,000",
  p_refurb_heavy_ltv: { Residential: { "Day 1": "70", LTGDV: "70", LTC: "90" }, "HMO / MUFB": { "Day 1": "65", LTGDV: "65", LTC: "85" }, "Semi-commercial": { "Day 1": "65", LTGDV: "65", LTC: "85" } },
  p_refurb_heavy_ltv_basis: "Gross",
  p_refurb_heavy_works_funding: "In arrears (drawdowns)",
  p_refurb_heavy_works_max_pct: "100",
  p_refurb_heavy_min_experience: "1+ similar project",
  p_refurb_heavy_term_min: "6",
  p_refurb_heavy_term_max: "24",
  p_refurb_heavy_min_interest_type: "A fixed number of months",
  p_refurb_heavy_min_interest_months: "3",
  p_refurb_heavy_exit_after_months: "3",
  p_refurb_heavy_interest_time_used: "yes",
  p_refurb_heavy_erc: "No ERCs",
  p_refurb_heavy_rate_from: "0.95",
  p_refurb_heavy_rate_to: "1.35",
  p_refurb_heavy_rate_basis: "Per month",
  p_refurb_heavy_arrangement_fee: "2",
  p_refurb_heavy_interest_options: ["Retained", "Rolled up"],
  p_refurb_heavy_roll_offered: "Case by case",
  p_refurb_heavy_roll_max_ltv: "65",
  p_refurb_heavy_roll_paydown: "yes",
  p_refurb_heavy_roll_reretain: "yes",
  p_refurb_heavy_roll_fee: "Extension fee",
  p_refurb_heavy_roll_fee_pct: "1",
  p_refurb_heavy_roll_reval: "Always",
  p_dev_exit_min_loan: "500,000",
  p_dev_exit_max_loan: "25,000,000",
  p_dev_exit_charges: ["1st charge"],
  p_dev_exit_ltv: { "Residential units": { "1st charge": "75" }, "Mixed-use units": { "1st charge": "70" }, "Commercial units": { "1st charge": "60" } },
  p_dev_exit_ltv_basis: "Gross",
  p_dev_exit_term_min: "6",
  p_dev_exit_term_max: "24",
  p_dev_exit_min_interest_type: "None \u2014 interest for days used only",
  p_dev_exit_exit_after_months: "1",
  p_dev_exit_interest_time_used: "yes",
  p_dev_exit_erc: "No ERCs",
  p_dev_exit_rate_from: "0.75",
  p_dev_exit_rate_to: "1.05",
  p_dev_exit_rate_basis: "Per month",
  p_dev_exit_arrangement_fee: "1.5",
  p_dev_exit_interest_options: ["Retained", "Rolled up"],
  p_dev_exit_roll_offered: "Yes",
  p_dev_exit_roll_max_ltv: "65",
  p_dev_exit_roll_paydown: "yes",
  p_dev_exit_roll_reretain: "yes",
  p_dev_exit_roll_fee: "Extension fee",
  p_dev_exit_roll_fee_pct: "1",
  p_dev_exit_roll_reval: "Sometimes",
  p_dev_exit_roll_max_count: "1",
  p_distressed_min_loan: "500,000",
  p_distressed_max_loan: "8,000,000",
  p_distressed_charges: ["1st charge"],
  p_distressed_ltv: { "Part-built residential": { "Day 1": "55", LTGDV: "60", LTC: "80" }, "Part-built mixed-use": { "Day 1": "50", LTGDV: "55", LTC: "75" }, "Stalled land": { "Day 1": "50", LTGDV: "", LTC: "" } },
  p_distressed_ltv_basis: "Gross",
  p_distressed_works_funding: "In arrears (drawdowns)",
  p_distressed_works_max_pct: "100",
  p_distressed_min_experience: "3+ similar projects",
  p_distressed_term_min: "6",
  p_distressed_term_max: "24",
  p_distressed_min_interest_type: "A fixed number of months",
  p_distressed_min_interest_months: "6",
  p_distressed_rate_from: "1.10",
  p_distressed_rate_to: "1.50",
  p_distressed_rate_basis: "Per month",
  p_distressed_arrangement_fee: "2.5",
  p_distressed_interest_options: ["Retained", "Rolled up"],
  p_distressed_roll_offered: "Case by case",
  p_mezz_min_loan: "250,000",
  p_mezz_max_loan: "5,000,000",
  p_mezz_charges: ["2nd charge"],
  p_mezz_ltv: { Development: { "Total LTV": "", "Total LTGDV": "80", "Senior max": "65" }, "Bridging / investment": { "Total LTV": "80", "Total LTGDV": "", "Senior max": "65" } },
  p_mezz_intercreditor: "Case by case",
  p_mezz_ltv_basis: "Gross",
  p_mezz_works_funding: "In arrears (drawdowns)",
  p_mezz_min_experience: "3+ similar projects",
  p_mezz_term_min: "12",
  p_mezz_term_max: "30",
  p_mezz_min_interest_type: "A fixed number of months",
  p_mezz_min_interest_months: "9",
  p_mezz_rate_from: "1.6",
  p_mezz_rate_to: "2.2",
  p_mezz_rate_basis: "Per month",
  p_mezz_arrangement_fee: "3",
  p_mezz_interest_options: ["Rolled up"],
  p_mezz_roll_offered: "No",
  val_types: ["AVM", "Desktop", "Full RICS valuation", "Existing report by transfer or reliance"],
  avm_max_loan: "500,000",
  avm_max_ltv: "60",
  desktop_max_loan: "1,000,000",
  desktop_max_ltv: "65",
  val_conditions: "Standard construction, England & Wales, refinance only",
  val_panel: "Two national panel managers plus direct instruction above \xA35m",
  val_turnaround: "5\u201310 days",
  appetite_style: "Happy with quirky",
  residential_only: "no",
  ...Object.fromEntries(ASSETS.map((a) => [`asset_${a.key}`, _assetVals[a.key]])),
  asset_short_lease_note: "Min 85 years unexpired at end of term",
  asset_hospitality_note: "Bricks & mortar basis only",
  hair_lookback: "36 months",
  ...Object.fromEntries(HAIR.map((h) => [`hair_${h.key}`, _hairVals[h.key]])),
  hair_ccj_recent_note: "Up to \xA310k total if explained",
  hair_adverse_media_note: "Depends on nature; fraud = decline",
  hair_insolvency_assoc_note: "Fine if 3+ years ago and no loss to creditors",
  hair_auto_declines: "Sanctioned parties; anything touching gambling or adult industries.",
  legal_dd: ["Full searches and report on title", "Search indemnity insurance where suitable", "Case by case"],
  representation: "Dual representation available",
  borrower_solicitor: "Any regulated firm meeting our criteria",
  min_partners: "2",
  ple_rounds: "Two",
  val_instruction: "After a decision in principle",
  time_offer: "1\u20133 working days",
  time_complete: "1\u20132 weeks",
  gap_confirm: "I\u2019ve filled the gaps",
  cs_cs01: "Yes",
  cs_cs02: "Maybe",
  cs_cs02_note: "Would want a specialist valuer and 55% max",
  cs_cs03: "Yes",
  cs_cs04: "Yes",
  cs_cs04_note: "Subject to QS and contractor covenant",
  cs_cs05: "Yes",
  cs_cs06: "No",
  cs_cs06_note: "Family occupation = regulated, we don't do it",
  cs_cs07: "Yes",
  cs_cs08: "No",
  cs_cs08_note: "Outside our asset appetite",
  cs_cs09: "Maybe",
  cs_cs09_note: "Only behind senior lenders we know",
  cs_cs10: "Yes",
  cs_cs11: "Yes",
  cs_cs11_note: "Fee 1%, new valuation if older than 6 months",
  pt_mezz: "Possibly, case by case",
  pt_ticket: "\xA3250k\u2013\xA31m",
  pt_min_deal: "\xA3500k+",
  ln_appetite: "Yes, interested",
  ln_ticket: "\xA31m\u2013\xA35m",
  ln_term: "12\u201324 months",
  ln_coupon: "10\u201312% a year",
  ln_security: ["Debenture over the lending vehicle", "Assignment of the underlying charges"],
  pt_route2: "Yes, with a variation",
  pt_split: ["75 / 25", "70 / 30"],
  pt_pref: "Around 10% a year, as illustrated",
  pt_variation: "Would want a first-loss layer from the managing partner and quarterly reporting.",
  pt_assets: ["Distressed or stalled sites", "Unsold or inventory stock"],
  pt_notes: "Would want to see the business plan and the first three deals.",
  pt_meet: "Happy to sit down and discuss",
  fb_rating: "Good",
  fb_minutes: "15\u201330 min",
  fb_clear: "Product cards and the tolerance grid were quick.",
  fb_missing: "A place for our postcode exclusion list as a file.",
  fb_confusing: "",
  fb_send_deals: "yes",
  fb_call: "no",
  /** Staff-side extraction of the uploaded guide (simulated in v001 — see LENDER_CRITERIA.md). */
  sheet_extraction: {
    status: "extracted",
    file: "Northgate_Product_Guide_Nov2026.pdf",
    extracted_at: "2026-11-18T16:20:00Z",
    method: "simulated",
    items: [
      { path: "p_bridge_resi_max_loan", label: "Resi bridge: maximum loan", value: "15,000,000", page: "2" },
      { path: "p_bridge_resi_ltv.Residential.1st charge", label: "Resi bridge: max LTV, residential 1st charge", value: "75", page: "2" },
      { path: "p_bridge_resi_ltv.Residential.2nd charge", label: "Resi bridge: max LTV, residential 2nd charge", value: "60", page: "2" },
      { path: "p_bridge_resi_rate_from", label: "Resi bridge: rate from", value: "0.79", page: "3" },
      { path: "p_bridge_comm_max_loan", label: "Commercial bridge: maximum loan", value: "10,000,000", page: "4" },
      { path: "p_bridge_comm_arrangement_fee", label: "Commercial bridge: arrangement fee", value: "2", page: "4" },
      { path: "p_dev_exit_term_max", label: "Dev exit: maximum term", value: "18", page: "6" },
      { path: "p_distressed_exit_after_months", label: "Distressed: repay any time after", value: "6", page: "7" }
    ]
  }
};

// lib/forms/lender.ts
var H = (id, title2, body = "") => ({ kind: "notice", id, tone: "heading", title: title2, body });
var tol = (id, label, help) => ({ id, label, type: "tolerance", help, options: ["Accept", "Case by case", "Decline"] });
var hasRollover = (p) => !p.equity && p.family !== "term";
function productFields(p) {
  const k = (s2) => `p_${p.key}_${s2}`;
  const nodes = [];
  nodes.push(H(k("h_size"), "Size & leverage"));
  nodes.push({ id: k("min_loan"), label: p.equity ? "Minimum ticket" : "Minimum loan", type: "money", half: true });
  nodes.push({ id: k("max_loan"), label: p.equity ? "Maximum ticket" : "Maximum loan", type: "money", half: true, required: true });
  if (p.charges.length > 1) nodes.push({ id: k("charges"), label: "Positions you take", type: "multi", options: p.charges });
  if (p.equity) {
    nodes.push({ id: k("min_sponsor_equity"), label: "Minimum sponsor equity (% of costs)", type: "percent", half: true });
    nodes.push({ id: k("max_cost_pct"), label: "Max share of total costs you fund", type: "percent", half: true });
    nodes.push({ id: k("profit_share"), label: "Typical profit share", type: "percent", half: true });
    nodes.push({ id: k("pref_return"), label: "Preferred return (if any, % p.a.)", type: "percent", half: true });
    nodes.push({ id: k("ltv"), label: "Max total leverage including senior debt", type: "grid", rows: p.ltvRows, cols: ["LTV", "LTGDV"], unit: "%", placeholder: "Asset" });
  } else if (p.subordinate) {
    nodes.push({ id: k("ltv"), label: "Maximum leverage, including the senior loan", type: "grid", rows: p.ltvRows, cols: ["Total LTV", "Total LTGDV", "Senior max"], unit: "%", placeholder: "Scheme", help: "Senior max = the most senior debt you'll sit behind." });
    nodes.push({ id: k("intercreditor"), label: "Intercreditor / deed of priority", type: "choice", options: ["Will agree with any senior lender", "Approved senior lenders only", "Case by case"] });
  } else if (p.dev) {
    nodes.push({ id: k("ltv"), label: "Maximum leverage", type: "grid", rows: p.ltvRows, cols: ["Day 1", "LTGDV", "LTC"], unit: "%", placeholder: "Scheme" });
  } else {
    nodes.push({ id: k("ltv"), label: "Maximum LTV by asset type and charge", type: "grid", rows: p.ltvRows, cols: p.charges.filter((c) => /charge/.test(c)), unit: "%", placeholder: "Asset", help: "Leave a cell blank if you don\u2019t offer it." });
  }
  if (!p.equity) nodes.push({ id: k("ltv_basis"), label: "LTV basis", type: "choice", options: ["Gross", "Net", "Either"], half: true });
  if (p.family === "specialist") nodes.push({ id: k("value_basis"), label: "Valuation basis", type: "choice", options: ["Bricks & mortar", "Trading (going concern)", "Either"], half: true });
  if (p.works) {
    nodes.push(H(k("h_works"), "Works funding"));
    nodes.push({ id: k("works_funding"), label: "How are works funded?", type: "choice", options: ["Day 1", "In arrears (drawdowns)", "Either"] });
    nodes.push({ id: k("works_max_pct"), label: "Works funded up to (% of cost)", type: "percent", half: true });
    nodes.push({ id: k("min_experience"), label: "Experience needed", type: "choice", options: ["None", "1+ similar project", "3+ similar projects", "Case by case"], half: true });
  }
  nodes.push(H(k("h_term"), "Term & early repayment"));
  nodes.push({ id: k("term_min"), label: "Minimum term (months)", type: "number", half: true });
  nodes.push({ id: k("term_max"), label: "Maximum term (months)", type: "number", half: true });
  if (!p.equity) {
    nodes.push({ id: k("min_interest_type"), label: "Minimum interest period", type: "choice", options: ["None \u2014 interest for days used only", "A fixed number of months", "A percentage of the term"] });
    nodes.push({ id: k("min_interest_months"), label: "Minimum interest (months)", type: "number", half: true, when: { field: k("min_interest_type"), equals: "A fixed number of months" } });
    nodes.push({ id: k("min_interest_pct"), label: "Minimum interest (% of term)", type: "percent", half: true, help: "e.g. 50% = 6 months on a 12-month loan", when: { field: k("min_interest_type"), equals: "A percentage of the term" } });
    nodes.push({ id: k("exit_after_months"), label: "Can repay in full any time after (months)", type: "number", half: true, placeholder: "e.g. 1" });
    nodes.push({ id: k("interest_time_used"), label: "On early repayment, is interest charged only for the time used?", type: "yes_no", help: "i.e. unused retained interest is refunded." });
    nodes.push({ id: k("erc"), label: "Early repayment charges", type: "choice", options: ["No ERCs", "ERCs apply"], half: true });
    nodes.push({ id: k("erc_detail"), label: "ERC detail", type: "text", placeholder: "e.g. 1% in months 1\u20133", when: { field: k("erc"), equals: "ERCs apply" } });
    nodes.push(H(k("h_price"), "Pricing"));
    nodes.push({ id: k("rate_from"), label: "Rate from", type: "percent", half: true, placeholder: "0.75" });
    nodes.push({ id: k("rate_to"), label: "Rate to", type: "percent", half: true, placeholder: "1.25" });
    nodes.push({ id: k("rate_basis"), label: "Rate quoted", type: "choice", options: ["Per month", "Per annum"], half: true });
    nodes.push({ id: k("arrangement_fee"), label: "Arrangement fee", type: "percent", half: true, placeholder: "2" });
    nodes.push({ id: k("interest_options"), label: "Interest options", type: "multi", options: ["Retained", "Rolled up", "Serviced", "Part-serviced"] });
    nodes.push({ id: k("exit_fee"), label: "Exit fee", type: "percent", half: true, advanced: true });
    nodes.push({ id: k("proc_fee"), label: "Broker commission (proc fee)", type: "percent", half: true, advanced: true });
    nodes.push({ id: k("other_fees"), label: "Other fees (admin, legal, monitoring)", type: "text", advanced: true });
  }
  if (hasRollover(p)) {
    nodes.push(H(k("h_roll"), "Rollovers & extensions", "When a loan nears the end of its term."));
    nodes.push({ id: k("roll_offered"), label: "Do you offer rollovers or term extensions?", type: "choice", options: ["Yes", "Case by case", "No"] });
    const on = { field: k("roll_offered"), in: ["Yes", "Case by case"] };
    nodes.push({ id: k("roll_max_ltv"), label: "Max LTV to qualify", type: "percent", half: true, placeholder: "70", when: on });
    nodes.push({ id: k("roll_max_count"), label: "Max number of rollovers", type: "number", half: true, when: on });
    nodes.push({ id: k("roll_paydown"), label: "Will you accept a capital paydown to bring the LTV back within limits?", type: "yes_no", when: on });
    nodes.push({ id: k("roll_reretain"), label: "Can interest be retained again for the new period?", type: "yes_no_unsure", help: "e.g. another 6 months retained", when: on });
    nodes.push({ id: k("roll_fee"), label: "Fee on extension", type: "choice", options: ["Extension fee", "New arrangement fee", "No fee", "Case by case"], when: on });
    nodes.push({ id: k("roll_fee_pct"), label: "Fee (%)", type: "percent", half: true, when: { field: k("roll_fee"), in: ["Extension fee", "New arrangement fee"] } });
    nodes.push({ id: k("roll_reval"), label: "Fresh valuation needed?", type: "choice", options: ["Always", "Sometimes", "No"], half: true, when: on });
  }
  nodes.push({ id: k("notes"), label: "Anything else about this product?", type: "textarea", advanced: true });
  return nodes;
}
function productStep(p) {
  return {
    id: `prod_${p.key}`,
    title: p.label,
    kicker: FAMILY_LABEL[p.family],
    badge: `Product card \xB7 ${FAMILY_LABEL[p.family]}`,
    description: "Your headline terms. Blank is fine where it doesn\u2019t apply \u2014 we\u2019ll read the rest from your guide.",
    when: { field: "products", includes: p.label },
    nodes: productFields(p)
  };
}
function grouped(rows2, prefix, groups) {
  const out = [];
  const gs = groups ?? [...new Set(rows2.map((r) => r.group))];
  for (const g of gs) {
    out.push(H(`${prefix}h_${g.replace(/\W+/g, "_").toLowerCase()}`, g));
    for (const r of rows2.filter((x) => x.group === g)) out.push(tol(`${prefix}${r.key}`, r.label, r.help));
  }
  return out;
}
var caseNodes = (from, to) => CASE_STUDIES.slice(from, to).flatMap((c) => [
  { kind: "notice", id: `cs_card_${c.key}`, tone: "case", title: `${c.title} \xB7 ${c.tag}`, body: c.body, facts: c.facts },
  { id: `cs_${c.key}`, label: "Would you do this deal?", type: "tolerance", options: ["Yes", "Maybe", "No"], tones: ["good", "mid", "bad"] }
]);
var LENDER_STEP_IDS = { guide: "guide", readback: "readback" };
var lenderSchema = {
  id: "lender",
  title: "Lender criteria",
  steps: [
    {
      id: "about",
      title: "About you",
      kicker: "Profile",
      description: "Who you are and who we should speak to.",
      nodes: [
        { id: "lender_name", label: "Lender name", type: "text", required: true, placeholder: "Registered or trading name" },
        { id: "lender_type", label: "What kind of lender are you?", type: "choice", options: LENDER_TYPES, required: true },
        { id: "website", label: "Website", type: "text", placeholder: "www.", half: true },
        { id: "nacfb_patron", label: "NACFB patron?", type: "yes_no_unsure", half: true },
        { id: "fca_regulated", label: "Authorised for regulated mortgage lending?", type: "yes_no" },
        H("h_contact", "Your details"),
        { id: "contact_name", label: "Your name", type: "text", required: true, half: true },
        { id: "contact_role", label: "Role", type: "text", half: true },
        { id: "contact_email", label: "Email", type: "email", required: true },
        { id: "contact_phone", label: "Phone", type: "tel" },
        { id: "bdm_same", label: "Are you our BDM / day-to-day contact?", type: "yes_no" },
        { id: "bdm_name", label: "BDM name", type: "text", half: true, when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_region", label: "BDM region", type: "text", half: true, when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_email", label: "BDM email", type: "email", when: { field: "bdm_same", equals: "no" } },
        { id: "bdm_phone", label: "BDM phone", type: "tel", when: { field: "bdm_same", equals: "no" } }
      ]
    },
    {
      id: "reach",
      title: "Where & who you lend to",
      kicker: "Profile",
      nodes: [
        { id: "regions", label: "Where do you lend?", type: "multi", options: REGIONS, required: true },
        { id: "postcode_exclusions", label: "Any areas or postcodes you avoid?", type: "text", advanced: true },
        { id: "borrower_types", label: "Borrower types", type: "multi", options: BORROWER_TYPES, required: true },
        { id: "min_property_value", label: "Minimum property value", type: "money", half: true },
        { id: "max_exposure", label: "Max exposure, one borrower", type: "money", half: true }
      ]
    },
    {
      id: "guide",
      title: "Fastest route: send us your product guide",
      kicker: "Product guide",
      badge: "Recommended",
      description: "Most lenders\u2019 guides already answer most of this form. Upload yours and we\u2019ll read it, pre-fill what we can and send you a short read-back so you only fill the gaps.",
      nodes: [
        { id: "guide_file", label: "Product guide or criteria sheet", type: "file", help: "PDF, Excel or Word. One combined guide is ideal." },
        { id: "guide_file_2", label: "Second document (e.g. a separate product range)", type: "file", advanced: true },
        { id: "guide_link", label: "Or a link to your published guide", type: "text", placeholder: "https://", advanced: true },
        { id: "guide_date", label: "Date of the guide", type: "date" },
        { id: "guide_update_freq", label: "How often do you update it?", type: "choice", options: ["Monthly", "Quarterly", "Ad hoc"] },
        { kind: "notice", id: "guide_tip", tone: "info", title: "No guide to hand?", body: "No problem \u2014 just answer the next few screens. It takes about 20 minutes and you can save and come back." }
      ]
    },
    {
      id: "core",
      title: "Your core products",
      kicker: "Products",
      description: "Pick everything you lend on. Each one opens a short product card.",
      nodes: [
        { id: "regulated_scope", label: "Regulated or unregulated?", type: "choice", options: ["Unregulated only", "Regulated only", "Both"], required: true },
        { id: "charge_positions", label: "Charge positions", type: "multi", options: ["1st charge", "2nd charge", "3rd or subsequent", "Behind senior debt (mezzanine)", "Equity / JV (no charge)"] },
        { id: "subordinate_appetite", label: "Do you lend behind another lender\u2019s senior debt?", type: "choice", options: ["Yes \u2014 mezzanine or second-ranking", "Second charge only, not mezzanine", "No"] },
        { id: "products", label: "Products", type: "multi", options: PRODUCTS.map((p) => p.label), required: true },
        { id: "products_other", label: "Anything not listed?", type: "text", advanced: true },
        H("h_sweet", "Your sweet spot", "Where most of your book actually sits."),
        { id: "sweet_loan", label: "Typical loan", type: "money", half: true },
        { id: "sweet_ltv", label: "Typical LTV", type: "percent", half: true }
      ]
    },
    ...PRODUCTS.map(productStep),
    {
      id: "valuation",
      title: "Valuations",
      kicker: "Valuation",
      nodes: [
        { id: "val_types", label: "Which valuation types do you accept?", type: "multi", options: ["AVM", "Desktop", "Drive-by / external only", "Full RICS valuation", "In-house valuer", "Existing report by transfer or reliance"] },
        { id: "avm_max_loan", label: "AVM: max loan", type: "money", half: true, when: { field: "val_types", includes: "AVM" } },
        { id: "avm_max_ltv", label: "AVM: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "AVM" } },
        { id: "desktop_max_loan", label: "Desktop: max loan", type: "money", half: true, when: { field: "val_types", includes: "Desktop" } },
        { id: "desktop_max_ltv", label: "Desktop: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "Desktop" } },
        { id: "driveby_max_loan", label: "Drive-by: max loan", type: "money", half: true, when: { field: "val_types", includes: "Drive-by / external only" } },
        { id: "driveby_max_ltv", label: "Drive-by: max LTV", type: "percent", half: true, when: { field: "val_types", includes: "Drive-by / external only" } },
        { id: "val_conditions", label: "Conditions for AVM / desktop", type: "text", placeholder: "e.g. standard construction, England & Wales only", when: { any_of: [{ field: "val_types", includes: "AVM" }, { field: "val_types", includes: "Desktop" }] } },
        { id: "val_panel", label: "Valuation panel manager(s) or firms", type: "text" },
        { id: "val_turnaround", label: "Typical time to valuation report", type: "choice", options: ["Under 5 days", "5\u201310 days", "Over 10 days"] }
      ]
    },
    {
      id: "assets",
      title: "Asset appetite",
      kicker: "Appetite",
      description: "Vanilla, quirky or both? Tap one per line. Add a note for any limits.",
      nodes: [
        { id: "appetite_style", label: "Overall, you are\u2026", type: "choice", options: ["Vanilla only", "Mostly vanilla, some quirky", "Happy with quirky", "Specialists in quirky"], required: true },
        { id: "residential_only", label: "Residential only?", type: "yes_no" },
        ...grouped(ASSETS, "asset_")
      ]
    },
    {
      id: "hair1",
      title: "Hair on the deal: credit & insolvency",
      kicker: "Appetite",
      badge: "Risk tolerance",
      description: "Be honest \u2014 it saves us both time. Use the notes for recency, amounts or conditions.",
      nodes: [
        { id: "hair_lookback", label: "How far back do you look at credit history?", type: "choice", options: ["12 months", "24 months", "36 months", "6 years", "Case by case"] },
        ...grouped(HAIR, "hair_", ["Adverse credit", "Insolvency"])
      ]
    },
    {
      id: "hair2",
      title: "Hair on the deal: people, structures & situations",
      kicker: "Appetite",
      badge: "Risk tolerance",
      nodes: [
        ...grouped(HAIR, "hair_", ["People & compliance", "Borrower profile", "Structures", "Situations"]),
        { id: "hair_auto_declines", label: "Any automatic declines we haven\u2019t covered?", type: "textarea" }
      ]
    },
    {
      id: "legals",
      title: "Legals & process",
      kicker: "Process",
      description: "A few quick ones so we set cases up the way you like.",
      nodes: [
        { id: "legal_dd", label: "How do you get comfortable on title and legal due diligence?", type: "multi", options: ["Full searches and report on title", "Search indemnity insurance where suitable", "Title insurance in place of some legal work", "Reduced legal review at low LTV", "Case by case"] },
        { id: "representation", label: "Representation", type: "choice", options: ["Dual representation available", "Separate representation only", "Case by case"] },
        { id: "borrower_solicitor", label: "Borrower\u2019s solicitor", type: "choice", options: ["Any regulated firm meeting our criteria", "Must be on our panel", "We nominate the firm"] },
        { id: "min_partners", label: "Minimum partners at the borrower\u2019s firm", type: "number", half: true, advanced: true },
        { id: "ple_rounds", label: "Typical rounds of pre-legal enquiries", type: "choice", options: ["One", "Two", "Three or more", "Varies"] },
        { id: "val_instruction", label: "When is the valuation instructed?", type: "choice", options: ["On receipt of the fee", "After a decision in principle", "After credit approval"] },
        { id: "time_offer", label: "Typical time to formal offer", type: "choice", options: ["Same day", "1\u20133 working days", "4\u20137 working days", "Over a week"], half: true },
        { id: "time_complete", label: "Typical time to complete", type: "choice", options: ["Under 7 days", "1\u20132 weeks", "2\u20134 weeks", "Over 4 weeks"], half: true }
      ]
    },
    {
      id: "readback",
      title: "Read-back: anything missing?",
      kicker: "Gap check",
      panel: "lender_gapcheck",
      description: "Here\u2019s what we have so far \u2014 from your guide and your answers. Anything flagged, tap to fill or correct it.",
      nodes: [
        { id: "gap_confirm", label: "How does that look?", type: "choice", options: ["Everything looks right", "I\u2019ve filled the gaps", "Please call me to go through it"] },
        { id: "gap_notes", label: "Corrections or updates", type: "textarea" }
      ]
    },
    {
      id: "cases1",
      title: "Would you do these deals? (1\u20136)",
      kicker: "Case studies",
      description: "Quick gut reactions are perfect. Add a reason if it\u2019s a no or a maybe. All scenarios are fictional.",
      nodes: caseNodes(0, 6)
    },
    {
      id: "cases2",
      title: "Would you do these deals? (7\u201311)",
      kicker: "Case studies",
      nodes: caseNodes(6, CASE_STUDIES.length)
    },
    {
      id: "partnership",
      title: "Partnership & mezzanine appetite",
      kicker: "An invitation",
      badge: "Let\u2019s talk",
      description: "Separate from our usual cases. We source distressed and undervalued sites, improve them and run the delivery ourselves. Often all that\u2019s missing is a modest mezzanine or equity top-up to get a project started. There are two ways you could take part. If either sounds interesting, we\u2019d love to hear how you\u2019d like to work together.",
      nodes: [
        { kind: "notice", id: "pt_note", tone: "info", body: "Nothing here is an offer or a commitment on either side. Any figures are an illustrative example, not an offer \u2014 they\u2019re only there to start a conversation." },
        { id: "pt_mezz", label: "Would you consider mezzanine or a second charge behind a developer\u2019s senior debt?", type: "choice", options: ["Yes, keen", "Possibly, case by case", "Not for us"] },
        { id: "pt_ticket", label: "Typical ticket you\u2019d be comfortable with", type: "choice", options: ["Under \xA3250k", "\xA3250k\u2013\xA31m", "\xA31m\u2013\xA35m", "Over \xA35m", "Varies by deal"], when: { field: "pt_mezz", in: ["Yes, keen", "Possibly, case by case"] } },
        { id: "pt_min_deal", label: "Smallest deal you\u2019d look at for this", type: "choice", options: ["\xA3250k+", "\xA3500k+", "\xA31m+", "\xA35m+", "No set minimum"], when: { field: "pt_mezz", in: ["Yes, keen", "Possibly, case by case"] } },
        H("pt_h_r1", "Route 1 \xB7 Loan notes", "Lend to our lending vehicle through a loan note: a coupon over an agreed term, with security we agree together."),
        { id: "ln_appetite", label: "Would loan notes interest you?", type: "choice", options: ["Yes, interested", "Possibly", "Not for us"] },
        { id: "ln_ticket", label: "Ticket size", type: "choice", options: ["Under \xA3250k", "\xA3250k\u2013\xA31m", "\xA31m\u2013\xA35m", "Over \xA35m", "Varies"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_term", label: "Term", type: "choice", options: ["Under 12 months", "12\u201324 months", "2\u20133 years", "Over 3 years", "Flexible"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_coupon", label: "Target coupon", type: "choice", options: ["Under 8% a year", "8\u201310% a year", "10\u201312% a year", "Over 12% a year", "Open to discuss"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        { id: "ln_security", label: "Security you\u2019d prefer", type: "multi", options: ["Debenture over the lending vehicle", "Assignment of the underlying charges", "Unsecured with covenants", "Open to discuss"], when: { field: "ln_appetite", in: ["Yes, interested", "Possibly"] } },
        H("pt_h_r2", "Route 2 \xB7 Preferred shares with a profit share", "A private-equity style partnership: you as capital partner, us as managing partner."),
        {
          kind: "notice",
          id: "pt_r2_example",
          tone: "case",
          title: "Illustrative example, not an offer",
          body: "You fund most of each loan in cash; our share comes from waiving our broker fee, as sweat equity. You hold protected preferred shares, with a preference on the return of your capital and limited voting, while we run the book day to day. Returns are paid in this order:",
          facts: [["Capital partner funds", "~88% of each loan, in cash"], ["Managing partner", "~12%, from its waived broker fee"], ["Your shares", "Protected preferred, limited voting"], ["Capital", "Preference on return of capital"], ["1 \xB7 Management fee", "2% a year to the managing partner"], ["2 \xB7 Preferred return", "10% a year, paid monthly (0.833%)"], ["3 \xB7 Above the hurdle", "75% to you \xB7 25% to us"], ["Control", "Stays with the managing partner"]]
        },
        { id: "pt_route2", label: "Would you consider something like this?", type: "choice", options: ["Yes, as illustrated", "Yes, with a variation", "A different split would suit us better", "Not for us"] },
        { id: "pt_split", label: "Profit splits you\u2019d consider above the hurdle (illustrative)", type: "multi", options: ["75 / 25", "70 / 30", "60 / 40", "50 / 50", "Open to discuss"], help: "Capital partner / managing partner.", when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },
        { id: "pt_pref", label: "Preferred return you\u2019d look for", type: "choice", options: ["Around 10% a year, as illustrated", "Lower, with a bigger profit share", "Higher, with a smaller profit share", "Open to discuss"], when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },
        { id: "pt_variation", label: "What would you change?", type: "textarea", placeholder: "Fee, preference, split, voting, capital protection, anything", when: { field: "pt_route2", in: ["Yes, with a variation", "A different split would suit us better"] } },
        H("pt_h_close", "Over to you"),
        { id: "pt_assets", label: "Situations you\u2019d find interesting", type: "multi", options: ["Distressed or stalled sites", "Unsold or inventory stock", "Value-add refurbishment", "Ground-up development", "Specialist (hotels, care, trading)"] },
        { id: "pt_notes", label: "How would you like a partnership to work?", type: "textarea", placeholder: "Structures you like, what you\u2019d need to see, anything you\u2019ve done before" },
        { id: "pt_meet", label: "Fancy a sit-down?", type: "choice", options: ["Happy to sit down and discuss", "Send me more information first", "Not right now"] }
      ]
    },
    {
      id: "feedback",
      title: "How was this?",
      kicker: "Your feedback",
      description: "We\u2019re piloting this with a small group of lenders. Honest feedback makes it better for everyone.",
      nodes: [
        { id: "fb_rating", label: "Overall", type: "choice", options: ["Excellent", "Good", "OK", "Hard work"] },
        { id: "fb_minutes", label: "Roughly how long did it take?", type: "choice", options: ["Under 15 min", "15\u201330 min", "30\u201360 min", "Over an hour"] },
        { id: "fb_clear", label: "What made sense?", type: "textarea" },
        { id: "fb_missing", label: "What did we miss that you\u2019d want brokers to know?", type: "textarea" },
        { id: "fb_confusing", label: "Anything confusing, too long or irrelevant?", type: "textarea" },
        { id: "fb_send_deals", label: "Happy for us to send you suitable deals?", type: "yes_no", required: true },
        { id: "fb_call", label: "Would a 15-minute call to go through it help?", type: "yes_no" }
      ]
    }
  ],
  declaration: {
    text: "I confirm these criteria reflect our current lending policy to the best of my knowledge. I understand they will be used to match suitable cases, that nothing here is a commitment to lend, and that you may check changes with us.",
    nameLabel: "Your full name"
  }
};

// lib/forms/al.ts
var LENDER_SUGGESTIONS = [
  "Barclays",
  "HSBC",
  "Lloyds Bank",
  "NatWest",
  "Santander",
  "Nationwide",
  "Halifax",
  "TSB",
  "Coventry BS",
  "Skipton BS",
  "Paragon",
  "The Mortgage Works",
  "Kent Reliance",
  "Precise",
  "Shawbrook",
  "Aldermore",
  "Hampshire Trust Bank",
  "InterBay",
  "Together",
  "Octopus Real Estate",
  "LendInvest",
  "MT Finance",
  "Fleet Mortgages",
  "Foundation Home Loans",
  "Landbay",
  "Other"
];
var GROUPED = [
  { id: "grouped_credit_cards", label: "Credit cards (total)", type: "Credit card" },
  { id: "grouped_overdrafts", label: "Overdrafts (total)", type: "Overdraft" },
  { id: "grouped_other_small", label: "Other small debts (total)", type: "Other" }
];
var propSummary = (p) => {
  const d = propertyDerived(p);
  const addr = String(p.address_line1 || "New property");
  return [addr, d.value ? gbp(d.value) : null, d.value ? `${gbp(d.equity)} equity` : null].filter(Boolean).join(" \xB7 ");
};
var alSchema = {
  id: "al",
  title: "Assets & Liabilities",
  declaration: {
    text: "I confirm the information in this statement is accurate and complete to the best of my knowledge, and I understand it may be shared with lenders to support my application.",
    nameLabel: "Type your full name"
  },
  steps: [
    {
      id: "about_you",
      kicker: "Step 1",
      title: "About you",
      description: "We\u2019ve filled in what we already have. Check it and change anything that\u2019s out of date.",
      nodes: [
        { id: "applicant_name", label: "Your full name", type: "text", required: true, placeholder: "As it appears on your ID" },
        { id: "email", label: "Email", type: "email", required: true },
        { id: "mobile", label: "Mobile", type: "tel", placeholder: "07\u2026" },
        { id: "company_name", label: "Company name", type: "text", help: "Only if you own property through a company or SPV." },
        { id: "joint_applicant_name", label: "Anyone else on this?", type: "text", help: "A joint applicant\u2019s full name, if there is one." }
      ]
    },
    {
      id: "properties",
      kicker: "Step 2",
      title: "Your properties",
      description: "One card per property, including your home. Only the address, value and mortgage are needed \u2014 the rest is optional.",
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
          noneLabel: "I don\u2019t own any property",
          noneField: "no_property",
          summary: propSummary,
          emptyItem: () => ({ owned_by: "Me", charge: "1st" }),
          fields: [
            { id: "address_line1", label: "Address", type: "text", required: true, placeholder: "e.g. Flat 2, 14 Example Road" },
            { id: "postcode", label: "Postcode", type: "postcode", required: true, half: true },
            { id: "property_type", label: "Type", type: "choice", half: true, options: ["Residential", "BTL", "HMO", "Multi-unit", "Commercial", "Semi-commercial", "Land", "Other"] },
            { id: "value", label: "Current value", type: "money", required: true, min: 1, help: "Your best estimate of what it\u2019s worth today." },
            { id: "has_mortgage", label: "Is there a mortgage or loan on it?", type: "yes_no", required: true },
            { id: "lender", label: "Lender", type: "suggest", required: true, suggestions: LENDER_SUGGESTIONS, when: { field: "has_mortgage", equals: "yes" }, help: "The name on your statement \u2014 \u201Cdon\u2019t know\u201D slows the lender down." },
            { id: "mortgage_balance", label: "Balance outstanding", type: "money", required: true, half: true, when: { field: "has_mortgage", equals: "yes" } },
            { id: "monthly_payment", label: "Monthly payment", type: "money", half: true, when: { field: "has_mortgage", equals: "yes" } },
            { id: "charge", label: "Charge", type: "choice", options: ["1st", "2nd", "3rd+"], when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "rent", label: "Rent received", type: "money_freq", help: "Optional. Enter monthly or annual \u2014 we\u2019ll work out the other." },
            { id: "owned_by", label: "Owned by", type: "choice", options: ["Me", "Joint", "Company"], advanced: true },
            { id: "owner_name", label: "Company name", type: "text", when: { field: "owned_by", equals: "Company" }, advanced: true },
            { id: "tenanted", label: "Currently tenanted?", type: "yes_no", advanced: true },
            { id: "purchase_date", label: "Purchase date", type: "month", half: true, advanced: true },
            { id: "purchase_price", label: "Purchase price", type: "money", half: true, advanced: true },
            { id: "rate_type", label: "Rate type", type: "choice", options: ["Fixed", "Tracker", "Variable", "Not sure"], when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "rate_expiry", label: "Rate ends", type: "month", when: { field: "has_mortgage", equals: "yes" }, advanced: true },
            { id: "notes", label: "Notes", type: "textarea", advanced: true, placeholder: "Anything the lender should know" }
          ]
        }
      ]
    },
    {
      id: "other_assets",
      kicker: "Step 3",
      title: "Other assets",
      description: "Savings, investments and anything else of value. All optional \u2014 skip what doesn\u2019t apply.",
      panel: "al_totals",
      nodes: [
        {
          kind: "repeater",
          id: "cash",
          label: "Cash & savings",
          itemLabel: "Account",
          addLabel: "Add a cash or savings account",
          max: 15,
          summary: (c) => [c.where || "Account", c.amount ? gbp(num(c.amount)) : null].filter(Boolean).join(" \xB7 "),
          fields: [
            { id: "where", label: "Where it\u2019s held", type: "text", required: true, placeholder: "e.g. Current account" },
            { id: "amount", label: "Balance", type: "money", required: true }
          ]
        },
        { id: "investments", label: "Investments (shares, ISAs, funds)", type: "money" },
        { id: "pensions", label: "Pensions", type: "money" },
        { id: "insurances", label: "Life policies (surrender value)", type: "money" },
        {
          kind: "repeater",
          id: "other_assets",
          label: "Other assets",
          itemLabel: "Asset",
          addLabel: "Add a vehicle, business or other asset",
          max: 15,
          summary: (o) => [o.description || o.type || "Asset", o.value ? gbp(num(o.value)) : null].filter(Boolean).join(" \xB7 "),
          fields: [
            { id: "type", label: "Type", type: "choice", required: true, options: ["Vehicle", "Business interest", "Art & collectables", "Jewellery", "Other"] },
            { id: "description", label: "Description", type: "text", placeholder: "e.g. 2022 Range Rover" },
            { id: "value", label: "Current value", type: "money", required: true, half: true },
            { id: "finance_owed", label: "Finance owed", type: "money", half: true },
            { id: "lender", label: "Finance provider", type: "text", when: { field: "finance_owed", notEmpty: true } },
            { id: "purchase_date", label: "Purchase date", type: "month", advanced: true }
          ]
        }
      ]
    },
    {
      id: "liabilities",
      kicker: "Step 4",
      title: "Debts & commitments",
      description: "Mortgages are already counted from your properties. Smaller debts can go in as totals; anything over \xA310,000 gets its own line.",
      panel: "al_totals",
      nodes: [
        { kind: "notice", id: "rule", tone: "info", title: "One line for each debt over \xA310,000", body: "Lenders need to see larger debts individually. Smaller ones can be added up in the totals." },
        ...GROUPED.map((g) => ({ id: g.id, label: g.label, type: "money", help: "Combined balance of debts that are each \xA310,000 or less" })),
        { id: "grouped_monthly_payments", label: "Total monthly payments on these", type: "money" },
        {
          kind: "repeater",
          id: "liabilities",
          label: "Itemised debts",
          itemLabel: "Debt",
          addLabel: "Add a loan, bridge or other debt",
          max: 25,
          summary: (l) => [l.creditor || l.type || "Debt", l.balance ? gbp(num(l.balance)) : null, l.monthly_payment ? `${gbp(num(l.monthly_payment))}/m` : null].filter(Boolean).join(" \xB7 "),
          fields: [
            { id: "type", label: "Type", type: "choice", required: true, options: ["Loan", "Credit card", "Overdraft", "Bridge", "Director\u2019s loan", "HP / car finance", "Tax (HMRC)", "Other"] },
            { id: "creditor", label: "Who is it owed to?", type: "text", required: true },
            { id: "balance", label: "Balance", type: "money", required: true, half: true },
            { id: "monthly_payment", label: "Monthly payment", type: "money", required: true, half: true, help: "Enter 0 if interest rolls up." },
            { id: "rate", label: "Interest rate", type: "text", half: true, placeholder: "e.g. 6.9%" },
            { id: "limit", label: "Limit", type: "money", half: true, advanced: true },
            { id: "secured_on", label: "Secured on", type: "choice", dynamicOptions: (a) => ["Unsecured", ...(a.properties ?? []).map((p) => String(p.address_line1 || "")).filter(Boolean)], advanced: true },
            { id: "end_date", label: "Ends", type: "month", advanced: true }
          ]
        }
      ]
    }
  ],
  validate: (a) => {
    const issues = [];
    for (const g of GROUPED) {
      if (num(a[g.id]) > ITEMISE_THRESHOLD) {
        issues.push({
          path: g.id,
          level: "error",
          message: "Anything over \xA310,000 needs listing individually \u2014 add it below.",
          action: { label: "List it individually", id: `itemise:${g.id}` }
        });
      }
    }
    if (a.no_property !== true) {
      (a.properties ?? []).forEach((p, i) => {
        if (p.has_mortgage === "yes") {
          const lender = String(p.lender ?? "").trim();
          if (lender && VAGUE_LENDER.test(lender)) issues.push({ path: `properties.${i}.lender`, level: "warn", message: "If you can, use the lender\u2019s name from your statement \u2014 it saves the lender asking." });
          if (num(p.mortgage_balance) > num(p.value) && num(p.value) > 0) issues.push({ path: `properties.${i}.mortgage_balance`, level: "warn", message: "The balance is more than the value \u2014 worth a quick check." });
        }
      });
    }
    return issues;
  },
  actions: Object.fromEntries(
    GROUPED.map((g) => [
      `itemise:${g.id}`,
      (a) => {
        const items = [...a.liabilities ?? []];
        items.push({ _id: crypto.randomUUID(), type: g.type, balance: a[g.id], _open: true });
        return { ...a, [g.id]: "", liabilities: items };
      }
    ])
  )
};

// lib/forms/remortgage.spec.json
var remortgage_spec_default = {
  version: "v001",
  prepared: "2026-11-18",
  timezone: "Europe/Paris",
  status: "internal design handoff for Tom \u2014 not a live form",
  title: "Posfin remortgage questionnaire",
  source_pdf: "/workspace/ackroyds/standard_pack_from_amery_20260803/Remortgage Questionnaire.pdf",
  source_protocol: "/workspace/ackroyds/ACKROYDS_STANDARD_PACK_AND_INTRO_PROTOCOL_v001.md",
  source_prefill_note: "/workspace/mazza/MAZZA_ACKROYDS_QUESTIONNAIRE_PREFILL_20261118_v001.md",
  purpose: "Capture every answer on Ackroyds' historic 6-page remortgage questionnaire (and the usual pre-loan enquiry overlap) via a smart link, save the answers to the CRM, populate the solicitor PDF, and send it for e-signature. The borrower never prints or completes the PDF themselves.",
  brands: {
    general: {
      id: "general",
      param: "general",
      title: "Remortgage questionnaire",
      subtitle: "Posfin Capital",
      logo: "assets/posfin_wordmark.png",
      mentions_ackroyds: false,
      html: "GENERAL_v001.html",
      footer: "Posfin Capital is a broker, not a lender."
    },
    ackroyds_posfin_2_0: {
      id: "ackroyds_posfin_2_0",
      param: "ackroyds",
      title: "Ackroyds \xD7 Posfin 2.0",
      subtitle: "Remortgage questionnaire",
      logos: [
        "assets/ackroyd_legal_logo.svg",
        "assets/posfin_wordmark.png"
      ],
      mentions_ackroyds: true,
      html: "ACKROYDS_POSFIN_2_0_v001.html",
      footer: "Prepared by Posfin Capital, a broker not a lender, for Ackroyd Legal.",
      branding_note: "Use the current Ackroyd Legal logo and name, not the historic 'Stirling Ackroyd Legal' wording that still appears on pages 5\u20136 of the PDF."
    }
  },
  stack_recommendation: {
    app: "Next.js on Vercel",
    database: "Supabase (CRM write)",
    brand_switch: "A query or path parameter, e.g. /q/:token?brand=general or /q/:token?brand=ackroyds. Same field schema, different chrome, intro copy, Q21 wording, and logos.",
    pdf_fill: "Server-side population of Ackroyds' Remortgage Questionnaire.pdf from saved answers, then an e-sign envelope (existing Posfin e-sign flow).",
    capture_alternative: "Grok voice call using the same field schema, for borrowers who prefer not to use the link."
  },
  rules: {
    never_name_lenders_in_borrower_copy: "Do not name the proposed new lender, SM1, SOMO, or any panel lender or insurer in borrower-facing copy. Existing lender names are typed by the borrower, or pre-filled from the title for them to confirm. New-lender name, address and account number are staff-only and are written onto the solicitor PDF at generation time. Insurance \u2018interested party\u2019 wording should say \u2018the lender\u2019, not a named lender.",
    no_cifas: "Do not mention CIFAS anywhere in the form or surrounding copy.",
    no_bank_details: "Do not ask for card numbers, PINs or online-banking logins. Mortgage account / roll / court references remain required and must be clearly described as such. Exception, added from SM1/Charles Rose title requisition 5.2 (addition C): we do collect the nominated account for the net advance (bank name, account name, sort code, account number), clearly labelled, in the borrower(s) name(s) only. The solicitor\u2019s client account stays off this form.",
    borrower_never_prints: true,
    e_sign_at_end: "The web form collects answers and a confirmation only. Signatures on the questionnaire, the leasehold block, and the form of authority are collected in the e-sign envelope, not as wet ink and not inside this app.",
    uk_english: true,
    posfin_is_broker_not_lender: true
  },
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      borrower_title: "Remortgage questionnaire",
      description_general: "A few questions about you, the property and your current mortgage. We'll use your answers to prepare the solicitor's forms and send them for e-signature. You will not need to print or fill anything in by hand.",
      description_ackroyds: "Ackroyd Legal will act as your solicitor on this remortgage. Posfin is collecting the answers they need, so we can complete their forms and send them to you for e-signature. You will not need to print or fill in a PDF."
    },
    {
      id: "about_you",
      title: "About you",
      borrower_title: "About you",
      description: "Please use the full legal names of every borrower \u2014 the people who own the property and will be on the new loan."
    },
    {
      id: "the_property",
      title: "The property",
      borrower_title: "The property",
      description: "The property being remortgaged."
    },
    {
      id: "current_mortgages",
      title: "Current mortgages",
      borrower_title: "Your current mortgage",
      description: "Details of the mortgage and any other charges already secured against the property. We only need mortgage account or roll numbers \u2014 not your bank account details."
    },
    {
      id: "the_new_loan",
      title: "The new loan",
      borrower_title: "Your new loan",
      description: "A few details about the new loan, how it will be used and repaid, any money you will put in yourself, insurance, and when you would like to complete. We already have most of the facility details on file. We will not name the new lender on this form."
    },
    {
      id: "who_lives_there",
      title: "Who lives there",
      borrower_title: "Who lives at the property",
      description: "How the property will be occupied on completion, and anyone aged 17 or over other than the borrowers. Occupiers who are not borrowers and not on a tenancy will need to sign occupier documents, which we will send for e-signature."
    },
    {
      id: "about_the_property",
      title: "About the property",
      borrower_title: "A few questions about the property",
      description: "These answers also help the solicitor with the enquiries they usually raise later, so asking them now saves time."
    },
    {
      id: "building_works",
      title: "Building works",
      borrower_title: "Building works and alterations",
      description: "Including works already done, works you plan to do, and any approvals you hold."
    },
    {
      id: "rights_and_neighbours",
      title: "Rights and neighbours",
      borrower_title: "Rights, neighbours and when it was built",
      description: null
    },
    {
      id: "leasehold",
      title: "Leasehold",
      borrower_title: "Your lease",
      description: "These questions only apply if the property is leasehold.",
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      }
    },
    {
      id: "company",
      title: "Company",
      borrower_title: "About the company",
      description: "A few questions that apply when the borrower or a guarantor is a company or LLP.",
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3\u20132.7"
    },
    {
      id: "purchase",
      title: "Purchase and gifts",
      borrower_title: "Buying the property",
      description: "These questions only apply if this facility is being used to buy the property. The solicitor will obtain the contract, transfer and replies to requisitions \u2014 you do not need to attach those papers here.",
      conditional: {
        field: "is_purchase",
        equals: "yes"
      },
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.1 / 9.2"
    },
    {
      id: "nominated_account",
      title: "Account for the net advance",
      borrower_title: "Where should the loan be paid?",
      description: "The account that should receive the net advance, in the borrower(s) name(s). This is not the solicitor\u2019s client account, and we will never ask for a card number or online-banking login.",
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2"
    },
    {
      id: "how_you_found_us",
      title: "How you found us",
      borrower_title: "One last question",
      description: null
    },
    {
      id: "authority_and_declaration",
      title: "Authority and declaration",
      borrower_title: "Before we prepare your forms",
      description: "We'll prepare the solicitor's questionnaire and a form of authority for e-signature. You will not need to print anything. There is also an optional insolvency question, which does not replace searches the solicitor will run."
    },
    {
      id: "done",
      title: "Done",
      borrower_title: "Thank you",
      description: "We'll prepare your form for e-signature and send you the envelope shortly. You don't need to print anything."
    }
  ],
  fields: [
    {
      options: null,
      required: true,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-A",
        field: "Full Forenames Names"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.legal_forenames",
        notes: "Confirm spelling against ID / title."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Your full legal forenames, as they appear on the title or your passport.",
      accept: null,
      placeholder: "e.g. Sarah Jane",
      id: "borrower_forenames",
      section: "about_you",
      label: "First and middle name(s)",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-A",
        field: "Surname(s)"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.legal_surname",
        notes: "Confirm spelling against ID / title."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. Hughes",
      id: "borrower_surname",
      section: "about_you",
      label: "Surname",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-C",
        field: "TELEPHONE NUMBERS: Mobile"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.mobile",
        notes: "Usually already on the case file."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "07\u2026",
      id: "borrower_phone_mobile",
      section: "about_you",
      label: "Mobile number",
      type: "tel"
    },
    {
      options: null,
      required: false,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-C",
        field: "TELEPHONE NUMBERS: Home"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.phone_home",
        notes: "Often missing from the file."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Optional. Leave blank if you do not have a landline.",
      accept: null,
      placeholder: null,
      id: "borrower_phone_home",
      section: "about_you",
      label: "Home telephone",
      type: "tel"
    },
    {
      options: null,
      required: false,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-C",
        field: "TELEPHONE NUMBERS: Work"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.phone_work",
        notes: "Often missing from the file."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Optional.",
      accept: null,
      placeholder: null,
      id: "borrower_phone_work",
      section: "about_you",
      label: "Work telephone",
      type: "tel"
    },
    {
      options: null,
      required: false,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-C",
        field: "TELEPHONE NUMBERS: Fax"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: "Legacy field. Hide behind 'Add a fax number' in the UI."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Optional and rarely used. Included only because it appears on the solicitor form.",
      accept: null,
      placeholder: null,
      id: "borrower_phone_fax",
      section: "about_you",
      label: "Fax number",
      type: "tel"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.borrower.entity_type",
        notes: "Prefill from the case (individual vs company/LLP)."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If yes, we will ask a short set of company questions. If the borrowers are all individuals and there is no company guarantor, choose no.",
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3\u20132.7 (gate)",
      id: "borrower_or_guarantor_is_company",
      section: "about_you",
      label: "Is this loan in the name of a company or LLP, or is a company or LLP acting as a guarantor?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-B",
        field: "FULL ADDRESS OF PROPERTY"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.property.address / title",
        notes: "Confirm with the borrower."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "property_address",
      section: "the_property",
      label: "Full address of the property",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-B",
        field: "Post Code"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.property.postcode / title",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. BS1 1AA",
      id: "property_postcode",
      section: "the_property",
      label: "Postcode",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q16",
        field: "Please state the date you purchased the property."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.price_paid_date",
        notes: "Prefill from the title price-paid entry and ask the borrower to confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "purchase_date",
      section: "the_property",
      label: "When did you buy the property?",
      type: "date"
    },
    {
      options: [
        "Freehold",
        "Leasehold"
      ],
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 5,
        question_ref: "L1\u2013L6 gate",
        field: "SPECIAL QUESTIONS FOR LEASEHOLD PROPERTY ONLY \u2014 section applies or is skipped"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.tenure",
        notes: "Prefill from the official copy. Confirm if the title is unusual (e.g. commonhold)."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "This is not a numbered question on the form, but we need it so we only ask the leasehold questions where they apply.",
      accept: null,
      placeholder: null,
      id: "tenure",
      section: "the_property",
      label: "Is the property freehold or leasehold?",
      type: "single_choice"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.case.transaction_type",
        notes: "Prefill from the case (purchase vs remortgage). If yes, flag for the solicitor that the contract, transfer and TA13 replies will be needed. Do not ask the borrower to attach those legal papers."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Most of our cases are remortgages. Choose yes only if this facility is being used to buy the property.",
      accept: null,
      placeholder: null,
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.1 / 9.2 (gate)",
      id: "is_purchase",
      section: "the_property",
      label: "Are you buying this property, rather than remortgaging one you already own?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Name"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "title.first_charge.proprietor / crm",
        notes: "Prefill from the title charge and confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "The lender named on your main mortgage statement. Please type the name as it appears there.",
      accept: null,
      placeholder: null,
      id: "first_lender_name",
      section: "current_mortgages",
      label: "Who is your current first-charge lender?",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Address"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "title.first_charge.proprietor_address",
        notes: "Often on the title. Confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "first_lender_address",
      section: "current_mortgages",
      label: "Their address, if you have it",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Tel No."
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "first_lender_tel",
      section: "current_mortgages",
      label: "Their telephone number, if you have it",
      type: "tel"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Account Number"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: "Rarely on the title. Usually has to be asked."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "This is the account or roll number on your mortgage statement. It is not a bank account or sort code.",
      accept: null,
      placeholder: null,
      id: "first_lender_account_number",
      section: "current_mortgages",
      label: "Your mortgage account or roll number",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Date of monthly payment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: "Frequently missing from the file."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. the 1st, or the 28th",
      id: "first_lender_payment_date",
      section: "current_mortgages",
      label: "On what date of the month is the payment usually taken?",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Approximate amount owing"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.existing_borrowing.balance",
        notes: "Prefill if a recent redemption figure or statement is on file; always confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "first_lender_amount_owing",
      section: "current_mortgages",
      label: "Approximate amount still owing",
      type: "currency_gbp"
    },
    {
      options: [
        "Fixed",
        "Variable",
        "I'm not sure"
      ],
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Fixed/variable rate"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "first_lender_rate_type",
      section: "current_mortgages",
      label: "Is the rate fixed or variable?",
      type: "single_choice"
    },
    {
      options: [
        "Repayment",
        "Endowment",
        "Interest only",
        "I'm not sure"
      ],
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-D",
        field: "FIRST PRESENT LENDER \u2014 Endowment/Repayment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "first_lender_repayment_type",
      section: "current_mortgages",
      label: "Is this a repayment or endowment mortgage?",
      type: "single_choice"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER (section shown if yes)"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "title.further_charges",
        notes: "Prefill from the title. The solicitor form has only one 'second lender' block; our form is repeatable so every further charge can be recorded and then attached or scheduled when we populate the PDF."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example a second mortgage, a private charge, or a charging order.",
      accept: null,
      placeholder: null,
      id: "has_further_charges",
      section: "current_mortgages",
      label: "Are there any other loans or charges secured against the property?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Name"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "title.further_charges[].proprietor",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_name",
      section: "current_mortgages",
      label: "Name of the other lender or charge holder",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Address"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "title.further_charges[].proprietor_address",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_address",
      section: "current_mortgages",
      label: "Their address, if you have it",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Tel No."
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_tel",
      section: "current_mortgages",
      label: "Their telephone number, if you have it",
      type: "tel"
    },
    {
      options: null,
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Account Number"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If you have a mortgage account number, roll number or court reference, enter it here. This is not a bank account number.",
      accept: null,
      placeholder: null,
      id: "further_lender_account_number",
      section: "current_mortgages",
      label: "Account, roll or court reference number",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Date of monthly payment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_payment_date",
      section: "current_mortgages",
      label: "Date of monthly payment, if any",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Approximate amount owing"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_amount_owing",
      section: "current_mortgages",
      label: "Approximate amount still owing",
      type: "currency_gbp"
    },
    {
      options: [
        "Fixed",
        "Variable",
        "Not applicable",
        "I'm not sure"
      ],
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Fixed/variable rate"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_rate_type",
      section: "current_mortgages",
      label: "Fixed or variable rate?",
      type: "single_choice"
    },
    {
      options: [
        "Repayment",
        "Endowment",
        "Interest only",
        "Not applicable",
        "I'm not sure"
      ],
      required: false,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "SECOND PRESENT LENDER \u2014 Endowment/Repayment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_lender_repayment_type",
      section: "current_mortgages",
      label: "Endowment or repayment?",
      type: "single_choice"
    },
    {
      options: null,
      required: true,
      repeatable_group: "further_charge",
      conditional: {
        field: "has_further_charges",
        equals: "yes"
      },
      pdf: {
        page: 1,
        question_ref: "Q-E",
        field: "Do you intend to repay this second charge from the new Mortgage Advance? YES/NO"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "further_charge_repay_from_advance",
      section: "current_mortgages",
      label: "Should this charge be repaid from the new loan?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-F",
        field: "Are there any financial redemption (repayment) penalties that they may impose?"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Please check your latest mortgage statement or offer if you are unsure.",
      accept: null,
      placeholder: null,
      id: "redemption_penalties",
      section: "current_mortgages",
      label: "Will any of your current lenders charge an early repayment or redemption penalty?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "redemption_penalties",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q-F",
        field: "redemption penalties \u2014 details (unlined follow-on space)"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "redemption_penalties_details",
      section: "current_mortgages",
      label: "Please give any details you have of the penalty",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Name"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.offer.lender_name",
        notes: "Prefill from the offer when generating the PDF. Never surface the name in borrower-facing copy."
      },
      visible_to_borrower: false,
      staff_only: true,
      help: "Staff only. Do not display or name the new lender to the borrower in this form or in surrounding copy.",
      accept: null,
      placeholder: null,
      id: "new_lender_name",
      section: "the_new_loan",
      label: "Name of the proposed new lender",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Address"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.offer.lender_address",
        notes: "Staff-only. Prefill when generating the PDF."
      },
      visible_to_borrower: false,
      staff_only: true,
      help: null,
      accept: null,
      placeholder: null,
      id: "new_lender_address",
      section: "the_new_loan",
      label: "Address of the proposed new lender",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Account Number"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: "Often n/a, especially on a short-term or bridging facility. Leave blank or mark n/a on the PDF."
      },
      visible_to_borrower: false,
      staff_only: true,
      help: "Usually not issued until after completion. Staff only.",
      accept: null,
      placeholder: null,
      id: "new_lender_account_number",
      section: "the_new_loan",
      label: "New lender account number",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Approximate amount of new mortgage"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.offer.gross_or_net_amount",
        notes: "Prefill from the offer (be clear whether the figure is gross or net) and ask the borrower to confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "new_loan_amount",
      section: "the_new_loan",
      label: "Approximate amount of the new loan",
      type: "currency_gbp"
    },
    {
      options: [
        "There is a monthly payment",
        "Interest is rolled up \u2014 no monthly payment",
        "I'm not sure"
      ],
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "Amount of monthly payment / Date of payment \u2014 gate"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If interest is rolled up for the term, there may be no monthly payment.",
      accept: null,
      placeholder: null,
      id: "new_loan_has_monthly_payment",
      section: "the_new_loan",
      label: "Will this loan have a monthly payment, or is the interest rolled up?",
      type: "single_choice"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "new_loan_has_monthly_payment",
        equals: "There is a monthly payment"
      },
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Amount of monthly payment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.offer.monthly_payment",
        notes: "Prefill from the offer where a monthly payment is stated."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "new_loan_monthly_payment",
      section: "the_new_loan",
      label: "Amount of the monthly payment",
      type: "currency_gbp"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "new_loan_has_monthly_payment",
        equals: "There is a monthly payment"
      },
      pdf: {
        page: 2,
        question_ref: "Q-G",
        field: "PROPOSED NEW LENDER \u2014 Date of payment"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "new_loan_payment_date",
      section: "the_new_loan",
      label: "Usual date of the monthly payment, if you know it",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q17",
        field: "Is your new lender insuring the property? YES/NO"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.offer.insurance_arrangement",
        notes: "Often the new loan does not include buildings insurance. Do not name the new lender in the question wording."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If not, we will need a copy of your current buildings insurance policy. You can upload it here.",
      accept: null,
      placeholder: null,
      id: "buildings_insurance_by_new_loan",
      section: "the_new_loan",
      label: "Will buildings insurance be arranged as part of the new loan?",
      type: "yes_no_unsure",
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1 (tightened existing questionnaire Q17 / leasehold L5)"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        equals: "no"
      },
      pdf: {
        page: 4,
        question_ref: "Q17",
        field: "If not, please provide a copy of your buildings insurance policy"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "buildings_insurance_policy_upload",
      section: "the_new_loan",
      label: "Upload a copy of your buildings insurance policy",
      type: "file_upload",
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1 (tightened existing questionnaire Q17 / leasehold L5)"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        in: [
          "no",
          "unsure"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.insurance.insurer",
        notes: "Prefill if a policy is already on the file."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_insurer",
      section: "the_new_loan",
      label: "Name of the insurer",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        in: [
          "no",
          "unsure"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.insurance.policy_number",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_policy_number",
      section: "the_new_loan",
      label: "Policy number",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        in: [
          "no",
          "unsure"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_sum_insured",
      section: "the_new_loan",
      label: "Sum insured",
      type: "currency_gbp"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        in: [
          "no",
          "unsure"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "The schedule is usually a one- or two-page summary from your insurer, rather than the full policy wording.",
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_schedule_upload",
      section: "the_new_loan",
      label: "Upload the current buildings insurance schedule",
      type: "file_upload"
    },
    {
      options: [
        "Yes, I will arrange this",
        "Already noted",
        "I need help with this"
      ],
      required: true,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_by_new_loan",
        in: [
          "no",
          "unsure"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "We will tell you the exact wording to give your insurer. You do not need to name the lender yourself on this form.",
      accept: null,
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_lender_noted",
      section: "the_new_loan",
      label: "Will the lender be noted as an interested party on the policy before completion?",
      type: "single_choice"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "buildings_insurance_lender_noted",
        equals: "Already noted"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1",
      id: "buildings_insurance_endorsement_upload",
      section: "the_new_loan",
      label: "Upload the endorsement or updated schedule showing the lender has been noted",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q18",
        field: "Are you taking an interest only mortgage? YES/NO"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.offer.product_type",
        notes: "Product type is usually known. Do not assume the life-cover answer."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If yes, the solicitor form also asks for evidence of enough life cover. On a short-term facility where interest is rolled up, life cover may not apply in the same way \u2014 tell us if you are unsure.",
      accept: null,
      placeholder: null,
      id: "interest_only",
      section: "the_new_loan",
      label: "Is the new loan interest only?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "interest_only",
        equals: "yes"
      },
      pdf: {
        page: 4,
        question_ref: "Q18",
        field: "If yes, please provide evidence of sufficient life cover for amount of mortgage"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "life_cover_evidence_upload",
      section: "the_new_loan",
      label: "Upload evidence of life cover for the loan amount",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q19",
        field: "Please can you inform us of any forthcoming holidays that you have planned"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Dates are enough. If none, say so.",
      accept: null,
      placeholder: "e.g. None, or 3\u201310 December",
      id: "forthcoming_holidays",
      section: "the_new_loan",
      label: "Do you have any holidays planned that might affect signing or completion?",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q20",
        field: "Please indicate what date you wish to complete your re-mortgage on."
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.case.target_completion_date",
        notes: "Prefill the target date if we have one, and ask the borrower to confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "desired_completion_date",
      section: "the_new_loan",
      label: "When would you like the remortgage to complete?",
      type: "date"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "A",
      source: "SM1/Charles Rose title requisition 1.2 / 2.8",
      id: "balance_funds_needed",
      section: "the_new_loan",
      label: "Will you need to put in any of your own money to complete, for example to redeem existing charges or to make up a purchase balance?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "balance_funds_needed",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "A",
      source: "SM1/Charles Rose title requisition 1.2 / 2.8",
      id: "balance_funds_amount",
      section: "the_new_loan",
      label: "Approximate amount you will put in",
      type: "currency_gbp"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "balance_funds_needed",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "A",
      source: "SM1/Charles Rose title requisition 1.2 / 2.8",
      id: "balance_funds_own_resources",
      section: "the_new_loan",
      label: "This money will come from my or our own resources and is not being borrowed from anywhere else",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "balance_funds_own_resources",
        equals: "no"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "A",
      source: "SM1/Charles Rose title requisition 1.2 / 2.8",
      id: "balance_funds_own_resources_explanation",
      section: "the_new_loan",
      label: "Please explain where any borrowed or third-party money is coming from",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "balance_funds_needed",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example savings, sale proceeds, or a director\u2019s loan.",
      accept: null,
      placeholder: "e.g. savings",
      addition_group: "A",
      source: "SM1/Charles Rose title requisition 1.2 / 2.8",
      id: "balance_funds_source",
      section: "the_new_loan",
      label: "Where will this money come from?",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Most facilities we arrange need to be for a business purpose. If this does not sound right for your case, please tell us in the box below rather than ticking this.",
      accept: null,
      placeholder: null,
      addition_group: "H",
      source: "SM1/Charles Rose title requisition 10.1",
      id: "business_purpose_confirmation",
      section: "the_new_loan",
      label: "I confirm that this loan will be used for business purposes only",
      type: "checkbox"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.use_of_funds / offer purpose",
        notes: "Prefill from a Use of Funds form if one is already on file, and ask the borrower to confirm. The signed Use of Funds form should still go to the lender."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. to refinance the property and fund refurbishment works",
      addition_group: "H",
      source: "SM1/Charles Rose title requisition 10.1",
      id: "business_purpose_details",
      section: "the_new_loan",
      label: "Please tell us what the business purposes are",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      addition_group: "H",
      source: "SM1/Charles Rose title requisition 10.1",
      id: "use_of_funds_upload",
      section: "the_new_loan",
      label: "Optional: upload a Use of Funds form if you have already completed one",
      type: "file_upload"
    },
    {
      options: [
        "Refinance",
        "Sale of this property",
        "Sale of another property",
        "Business proceeds / trading cashflow",
        "Other"
      ],
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.exit_route",
        notes: "Prefill the route if already on the file. Do not pre-fill or display a named refinance lender in borrower-facing copy."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "You can choose more than one.",
      accept: null,
      placeholder: null,
      addition_group: "I",
      source: "SM1/Charles Rose title requisition 10.2",
      id: "exit_route",
      section: "the_new_loan",
      label: "How do you intend to repay this loan at the end of the term?",
      type: "multi_choice"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example expected timing, or a sale that is already planned. You do not need to name a lender unless you want to.",
      accept: null,
      placeholder: null,
      addition_group: "I",
      source: "SM1/Charles Rose title requisition 10.2",
      id: "exit_route_details",
      section: "the_new_loan",
      label: "Please add any details you already have",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q1",
        field: "Are there any persons aged 17 years or over (other than the Borrower(s)) occupying the Property"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.occupiers",
        notes: "We may already have adult occupiers at 18+. Re-ask at 17+ and confirm names."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "The solicitor form uses 17, not 18. Please include every adult or 17-year-old occupier, even if they are a family member.",
      accept: null,
      placeholder: null,
      id: "occupiers_17_plus",
      section: "who_lives_there",
      label: "Does anyone aged 17 or over, other than the borrower(s), live at the property?",
      type: "yes_no",
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1 (tightened existing questionnaire Q1)"
    },
    {
      options: null,
      required: true,
      repeatable_group: "occupier",
      conditional: {
        field: "occupiers_17_plus",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q1",
        field: "If so, give name, date of birth and relationship."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "occupier_name",
      section: "who_lives_there",
      label: "Full name",
      type: "text",
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1 (tightened existing questionnaire Q1)"
    },
    {
      options: null,
      required: true,
      repeatable_group: "occupier",
      conditional: {
        field: "occupiers_17_plus",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q1",
        field: "date of birth"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "occupier_date_of_birth",
      section: "who_lives_there",
      label: "Date of birth",
      type: "date",
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1 (tightened existing questionnaire Q1)"
    },
    {
      options: null,
      required: true,
      repeatable_group: "occupier",
      conditional: {
        field: "occupiers_17_plus",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q1",
        field: "relationship"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. spouse, partner, adult child, lodger",
      id: "occupier_relationship",
      section: "who_lives_there",
      label: "Relationship to you",
      type: "text",
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1 (tightened existing questionnaire Q1)"
    },
    {
      options: null,
      required: true,
      repeatable_group: "occupier",
      conditional: {
        field: "occupiers_17_plus",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1",
      id: "occupier_is_borrower",
      section: "who_lives_there",
      label: "Are they a borrower on this loan?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: "occupier",
      conditional: {
        field: "occupiers_17_plus",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If they are not a borrower and are not named on a tenancy, the lender will need them to sign occupier documents before completion. We will arrange that \u2014 they do not need to print anything now.",
      accept: null,
      placeholder: null,
      addition_group: "E",
      source: "SM1/Charles Rose title requisition 8.1",
      id: "occupier_on_formal_tenancy",
      section: "who_lives_there",
      label: "Are they named on a formal tenancy agreement?",
      type: "yes_no"
    },
    {
      options: [
        "My or our main home (owner-occupied)",
        "Vacant",
        "Let as a residential tenancy",
        "Let as an HMO",
        "Let as a holiday let",
        "Let commercially",
        "Other"
      ],
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "You do not need to upload a tenancy agreement or lease unless we ask for one later.",
      accept: null,
      placeholder: null,
      addition_group: "F",
      source: "SM1/Charles Rose title requisition 8.2",
      id: "occupancy_type",
      section: "who_lives_there",
      label: "Which of these best describes the property on the day of completion?",
      type: "single_choice"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "occupancy_type",
        equals: "Other"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "F",
      source: "SM1/Charles Rose title requisition 8.2",
      id: "occupancy_type_other",
      section: "who_lives_there",
      label: "Please specify how the property will be occupied",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "occupancy_type",
        in: [
          "Let as a residential tenancy",
          "Let as an HMO",
          "Let as a holiday let",
          "Let commercially"
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Please do not upload the tenancy or lease unless we ask for it.",
      accept: null,
      placeholder: null,
      addition_group: "F",
      source: "SM1/Charles Rose title requisition 8.2",
      id: "occupancy_let_details",
      section: "who_lives_there",
      label: "Optional: a few words about the letting (for example an AST, or holiday guests)",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q2",
        field: "Do you own any adjoining property which is not to be included in this remortgage"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "adjoining_property_owned",
      section: "about_the_property",
      label: "Do you own any adjoining property that is not included in this remortgage?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "adjoining_property_owned",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q2",
        field: "If yes, give details here."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "adjoining_property_details",
      section: "about_the_property",
      label: "Please give the address and a short description",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q3",
        field: "Are you aware of any breach of any covenants or restrictions affecting the property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.covenants (flag only)",
        notes: "Do not pre-answer 'no'. If the title shows historic covenants, show them to the borrower and ask whether they are aware of any breach."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Covenants are rules about how the property can be used. If we already know of historic covenants on the title, we will flag them for you to confirm. Please do not guess \u2014 say if you are unsure.",
      accept: null,
      placeholder: null,
      id: "covenant_breach",
      section: "about_the_property",
      label: "Are you aware of any breach of covenants or restrictions affecting the property?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "covenant_breach",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q3",
        field: "If yes, give details here."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "covenant_breach_details",
      section: "about_the_property",
      label: "Please give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q4",
        field: "Has the property been the subject of a Local Authority Improvement/Repair Grant within the last three years?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "la_grant",
      section: "about_the_property",
      label: "Has the property had a local authority improvement or repair grant in the last three years?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "la_grant",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q4",
        field: "approximate date"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "la_grant_date",
      section: "about_the_property",
      label: "Approximate date of the grant",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "la_grant",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q4",
        field: "amount of the Grant"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "la_grant_amount",
      section: "about_the_property",
      label: "Approximate amount of the grant",
      type: "currency_gbp"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "la_grant",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q4",
        field: "details of the Local Authority"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "la_grant_authority",
      section: "about_the_property",
      label: "Which local authority?",
      type: "text"
    },
    {
      options: [
        "Yes",
        "No",
        "Not applicable \u2014 I have not married since"
      ],
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 2,
        question_ref: "Q5",
        field: "If you purchased or remortgaged the property prior to marriage, please provide your original Marriage Certificate for copying and certifying."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.borrower.marital_status",
        notes: "Marital status is often outstanding. Do not invent it."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If yes, the solicitor will need a certified copy of the marriage certificate. You do not need to post the original \u2014 we will arrange certification with you.",
      accept: null,
      placeholder: null,
      id: "purchased_or_remortgaged_prior_to_marriage",
      section: "about_the_property",
      label: "Did you buy or remortgage the property before you got married?",
      type: "yes_no_not_applicable"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "purchased_or_remortgaged_prior_to_marriage",
        equals: "yes"
      },
      pdf: {
        page: 2,
        question_ref: "Q5",
        field: "provide your original Marriage Certificate for copying and certifying"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Optional at this stage. A certified copy can be arranged later if needed.",
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "marriage_certificate_upload",
      section: "about_the_property",
      label: "Upload a copy of your marriage certificate if you have one to hand",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q6",
        field: "Have you received any formal notices in relation to the property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example a notice from the council, a neighbour, a landlord or a court.",
      accept: null,
      placeholder: null,
      id: "formal_notices",
      section: "about_the_property",
      label: "Have you received any formal notices in relation to the property?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "formal_notices",
        equals: "yes"
      },
      pdf: {
        page: 3,
        question_ref: "Q6",
        field: "If yes, give details here."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "formal_notices_details",
      section: "about_the_property",
      label: "Please give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q7",
        field: "Are all main services including drainage/sewers connected to the property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "main_services_connected",
      section: "about_the_property",
      label: "Are all main services, including drainage and sewers, connected to the property?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "main_services_connected",
        equals: "no"
      },
      pdf: {
        page: 3,
        question_ref: "Q7",
        field: "If no, give details here"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "main_services_details",
      section: "about_the_property",
      label: "Please tell us what is not connected, or give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q8",
        field: "Is there main access to the property via a private road?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "private_road_access",
      section: "about_the_property",
      label: "Is the main access to the property via a private road?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "private_road_access",
        equals: "yes"
      },
      pdf: {
        page: 3,
        question_ref: "Q8",
        field: "If yes, is it in good order"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "private_road_condition",
      section: "about_the_property",
      label: "Is the private road in good order?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "private_road_access",
        equals: "yes"
      },
      pdf: {
        page: 3,
        question_ref: "Q8",
        field: "are you expecting to contribute to its maintenance in the near future? (please give details)"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Please give any details you have, including likely cost if you know it.",
      accept: null,
      placeholder: null,
      id: "private_road_maintenance",
      section: "about_the_property",
      label: "Are you expecting to contribute to its maintenance in the near future?",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q9a",
        field: "In the last 4 years has any building on this property been built/altered/added to or other structural works carried out on it?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "works_last_4_years",
      section: "building_works",
      label: "In the last four years, has any building on this property been built, altered, added to, or had other structural works?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q9b",
        field: "Have any replacement doors or windows been installed since 2002?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "replacement_doors_windows_since_2002",
      section: "building_works",
      label: "Have any replacement doors or windows been installed since 2002?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q9c",
        field: "Have any electrical works been carried out since 1 January 2005?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "electrical_works_since_2005",
      section: "building_works",
      label: "Have any electrical works been carried out since 1 January 2005?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q10",
        field: "Are you presently carrying out any building alterations, additions or other structural works at the property, or do you plan to do so with the aid of the remortgage advance?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.use_of_funds (flag only)",
        notes: "Use of funds may already hint at works, but do not auto-answer. Ask explicitly."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "works_underway_or_planned",
      section: "building_works",
      label: "Are you carrying out any building alterations, additions or structural works now, or do you plan to do so with the help of this remortgage?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        any_of: [
          {
            field: "works_last_4_years",
            equals: "yes"
          },
          {
            field: "replacement_doors_windows_since_2002",
            equals: "yes"
          },
          {
            field: "electrical_works_since_2005",
            equals: "yes"
          },
          {
            field: "works_underway_or_planned",
            equals: "yes"
          }
        ]
      },
      pdf: {
        page: 3,
        question_ref: "Q11",
        field: "If the answer is yes to one or both of questions 9 and 10 please give details here"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Needed if you answered yes to any of the works questions above.",
      accept: null,
      placeholder: null,
      id: "works_details",
      section: "building_works",
      label: "Please describe the works",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        any_of: [
          {
            field: "works_last_4_years",
            equals: "yes"
          },
          {
            field: "works_underway_or_planned",
            equals: "yes"
          }
        ]
      },
      pdf: {
        page: 3,
        question_ref: "Q11",
        field: "forward to us copies of any Planning Consents and/or Building Regulation Approvals that you hold"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "works_consents_upload",
      section: "building_works",
      label: "Upload any planning consents or building-regulation approvals you hold",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q12",
        field: "Save as advised above has the original building been altered or added to so far as you are aware?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "original_building_altered",
      section: "building_works",
      label: "Apart from anything already mentioned, has the original building been altered or added to, as far as you are aware?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "original_building_altered",
        equals: "yes"
      },
      pdf: {
        page: 3,
        question_ref: "Q12",
        field: "If yes, give brief details here."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "original_building_altered_details",
      section: "building_works",
      label: "Please give brief details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 3,
        question_ref: "Q13",
        field: "Does any other person or property enjoy any rights of any kind over the property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.easements_and_rights (flag only)",
        notes: "Flag known rights from the title for the borrower to confirm. Do not auto-answer."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example a right of way, a right to park, or shared access.",
      accept: null,
      placeholder: null,
      id: "third_party_rights",
      section: "rights_and_neighbours",
      label: "Does any other person or property have any rights over this property?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "third_party_rights",
        equals: "yes"
      },
      pdf: {
        page: 3,
        question_ref: "Q13",
        field: "If yes, give details here."
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "third_party_rights_details",
      section: "rights_and_neighbours",
      label: "Please give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q14",
        field: "Are you aware of any proposals to develop or re-develop any adjoining or neighbouring land or property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "neighbouring_development",
      section: "rights_and_neighbours",
      label: "Are you aware of any proposals to develop or redevelop adjoining or neighbouring land or property?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "neighbouring_development",
        equals: "yes"
      },
      pdf: {
        page: 4,
        question_ref: "Q14",
        field: "If yes, give details here"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "neighbouring_development_details",
      section: "rights_and_neighbours",
      label: "Please give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q15",
        field: "If the dwelling on this property was built in the last 10 years\u2026"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title / property age",
        notes: "If the title or purchase date shows the building is clearly older than 10 years, prefill 'no' and allow the borrower to correct it."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "built_last_10_years",
      section: "rights_and_neighbours",
      label: "Was the dwelling built in the last 10 years?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "built_last_10_years",
        equals: "yes"
      },
      pdf: {
        page: 4,
        question_ref: "Q15",
        field: "please estimate date of construction"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "construction_date",
      section: "rights_and_neighbours",
      label: "Estimated date of construction",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "built_last_10_years",
        equals: "yes"
      },
      pdf: {
        page: 4,
        question_ref: "Q15",
        field: "confirm the property has the benefit of an NHBC or Municipal Mutual Foundation 15 Certificate"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "NHBC is the usual new-build warranty. 'Municipal Mutual Foundation 15' is the wording on the solicitor form \u2014 tick yes if you have either.",
      accept: null,
      placeholder: null,
      id: "nhbc_or_mmf15",
      section: "rights_and_neighbours",
      label: "Does the property have an NHBC certificate, or a Municipal Mutual Foundation 15 certificate?",
      type: "yes_no_unsure"
    },
    {
      options: [
        "Introduced by Posfin Capital",
        "Recommendation",
        "Existing client",
        "Search / website",
        "Other"
      ],
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 4,
        question_ref: "Q21",
        field: "Can you tell us where you heard about our firm i.e. recommendation, existing client,"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "introduction source",
        notes: "On Ackroyds cases, default to 'Introduced by Posfin Capital' and allow correction. On the general form, this is about Posfin, not a solicitor."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Brand-specific wording: general form asks about Posfin; Ackroyds \xD7 Posfin 2.0 form asks about Ackroyd Legal, with a default of 'Introduced by Posfin Capital'.",
      accept: null,
      placeholder: null,
      id: "heard_about_firm",
      section: "how_you_found_us",
      label: "How did you hear about us?",
      type: "single_choice_with_other"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L1",
        field: "Please give details of the Freeholder, i.e. the landlord, the Managing Agents for the property, or the Secretary of the Management Company \u2014 Name"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.leasehold.landlord / crm",
        notes: "Prefill from the title or lease if held."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_freeholder_name",
      section: "leasehold",
      label: "Name of the freeholder, landlord, managing agent, or secretary of the management company",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L1",
        field: "Address"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "title.leasehold.landlord_address",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_freeholder_address",
      section: "leasehold",
      label: "Their address",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L1",
        field: "Reference (if known) or contact"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_reference",
      section: "leasehold",
      label: "Reference or contact name, if known",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L1",
        field: "Telephone Number (if known)"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_telephone",
      section: "leasehold",
      label: "Telephone number, if known",
      type: "tel"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L2",
        field: "Have you ever complained about a breach of covenant by the landlord?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example, a failure to carry out their obligations under the lease.",
      accept: null,
      placeholder: null,
      id: "leasehold_complained_about_landlord",
      section: "leasehold",
      label: "Have you ever complained about a breach of covenant by the landlord?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L3",
        field: "Has the landlord/managing agent complained of any breach of covenants under your Lease e.g. non payment of ground rent or service charges?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example, non-payment of ground rent or service charges.",
      accept: null,
      placeholder: null,
      id: "leasehold_landlord_complained",
      section: "leasehold",
      label: "Has the landlord or managing agent complained of any breach of your lease?",
      type: "yes_no"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L4",
        field: "indicate how and to whom this is normally paid"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_ground_rent_payment_method",
      section: "leasehold",
      label: "How, and to whom, is ground rent normally paid?",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L4",
        field: "Please send us a copy of the last ground rent receipt issued by the landlord/managing agent (if available)"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "leasehold_ground_rent_receipt_upload",
      section: "leasehold",
      label: "Upload a copy of the last ground rent receipt, if you have it",
      type: "file_upload"
    },
    {
      options: [
        "The landlord or managing agents arrange a block policy",
        "I arrange it myself"
      ],
      required: true,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L5a / L5b",
        field: "If the landlord/managing agents arrange block buildings insurance under the Lease\u2026 / If the landlord/managing agents do not arrange the buildings insurance\u2026"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_block_insurance",
      section: "leasehold",
      label: "Who arranges the buildings insurance under the lease?",
      type: "single_choice",
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1 (tightened existing questionnaire Q17 / leasehold L5)"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L5a / L5b",
        field: "please send us a copy of the current Insurance Schedule"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "The solicitor form says this is needed as soon as possible so that completion can take place.",
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      id: "leasehold_insurance_schedule_upload",
      section: "leasehold",
      label: "Upload the current insurance schedule",
      type: "file_upload",
      addition_group: "D",
      source: "SM1/Charles Rose title requisition 6.1 (tightened existing questionnaire Q17 / leasehold L5)"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "tenure",
        equals: "Leasehold"
      },
      pdf: {
        page: 5,
        question_ref: "L6",
        field: "Are there any present proposals under which (either alone or with other lessees) you will acquire a freehold interest in your property?"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_acquire_freehold",
      section: "leasehold",
      label: "Are there any present proposals for you (alone or with other leaseholders) to buy the freehold?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "tenure",
            equals: "Leasehold"
          },
          {
            field: "leasehold_acquire_freehold",
            equals: "yes"
          }
        ]
      },
      pdf: {
        page: 5,
        question_ref: "L6",
        field: "If yes, give details here"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "leasehold_acquire_freehold_details",
      section: "leasehold",
      label: "Please give details",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 6,
        question_ref: "Auth",
        field: "FORM OF AUTHORITY \u2014 I/We hereby irrevocably authorise and request you to (1) provide the solicitor with any information they request in connection with my/our mortgage and (2) pending redemption to forward the Title Deeds and documents"
      },
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "answers from current_mortgages",
        notes: "Prefill lender names and account numbers onto page 6 when generating the PDF. The wet-ink signature blocks are replaced by the e-sign envelope."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "We will pre-fill a form of authority with the lender names and account numbers you have given, and include it in the e-sign pack. You will not be asked to print or post it. All borrowers will need to sign.",
      accept: null,
      placeholder: null,
      id: "authority_confirmation",
      section: "authority_and_declaration",
      label: "I am happy for the solicitor to request my title deeds and mortgage information from my current lender(s)",
      type: "checkbox"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: 1,
        question_ref: "intro",
        field: "Complete and accurate replies will avoid unnecessary delays\u2026 We will, of course, rely on your replies as being accurate."
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "answers_accurate",
      section: "authority_and_declaration",
      label: "I confirm that the answers I have given are complete and accurate, as far as I know",
      type: "checkbox"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "companies_house.directors",
        notes: "Prefill from Companies House if available, and confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3",
      id: "company_director_count",
      section: "company",
      label: "How many directors does the company have now?",
      type: "number"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3",
      id: "company_previously_more_than_one_director",
      section: "company",
      label: "Has the company ever had more than one director?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If there is currently only one director, the company previously had more than one, and the articles may be unamended, we will need either a second director to be appointed, or the articles to be amended and filed at Companies House, before loan documents can be signed.",
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3",
      id: "company_standard_model_articles",
      section: "company",
      label: "Are the company\u2019s articles the standard model articles, with no amendments?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.3",
      id: "company_articles_upload",
      section: "company",
      label: "Upload any filed resolutions or amended articles if you already have them",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.4",
      id: "company_shares_held_absolutely",
      section: "company",
      label: "Are all the shares held in the shareholders\u2019 own names, and not on trust for anyone else?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "borrower_or_guarantor_is_company",
            equals: "yes"
          },
          {
            field: "company_shares_held_absolutely",
            equals: "no"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.4",
      id: "company_shares_trust_details",
      section: "company",
      label: "Who is the share held for, and why?",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.5",
      id: "company_shareholders_agreement",
      section: "company",
      label: "Is there a shareholders\u2019 agreement, or any other agreement, that changes who owns or controls the company compared with what Companies House shows?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "borrower_or_guarantor_is_company",
            equals: "yes"
          },
          {
            field: "company_shareholders_agreement",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.5",
      id: "company_shareholders_agreement_details",
      section: "company",
      label: "Please give a short description",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "borrower_or_guarantor_is_company",
            equals: "yes"
          },
          {
            field: "company_shareholders_agreement",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: [
        "application/pdf",
        "image/*"
      ],
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.5",
      id: "company_shareholders_agreement_upload",
      section: "company",
      label: "Optional: upload the agreement",
      type: "file_upload"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "For example other loans, director loans, or invoice finance.",
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.6",
      id: "company_other_indebtedness",
      section: "company",
      label: "Apart from any mortgages on this property, does the company owe money to anyone else?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "borrower_or_guarantor_is_company",
            equals: "yes"
          },
          {
            field: "company_other_indebtedness",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.6",
      id: "company_other_indebtedness_details",
      section: "company",
      label: "Please give the creditor, the approximate amount, and whether you expect this to be subordinated to the new loan",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "borrower_or_guarantor_is_company",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "companies_house.charges (flag only)",
        notes: "Flag a known floating charge for the borrower to confirm. Do not auto-answer."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "If yes, the solicitor will need a letter of non-crystallisation and consent to the negative pledge on the day of completion. You do not need to arrange that yourself now.",
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.7",
      id: "company_floating_charge",
      section: "company",
      label: "Has the company granted a floating charge, for example to a bank or invoice funder?",
      type: "yes_no_unsure"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "borrower_or_guarantor_is_company",
            equals: "yes"
          },
          {
            field: "company_floating_charge",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "B",
      source: "SM1/Charles Rose title requisition 2.7",
      id: "company_floating_charge_holder",
      section: "company",
      label: "Name of the floating-charge holder",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        field: "is_purchase",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.2",
      id: "gift_funds",
      section: "purchase",
      label: "Is any part of the deposit, or of the balance needed to complete, being given to you as a gift?",
      type: "yes_no"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "is_purchase",
            equals: "yes"
          },
          {
            field: "gift_funds",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.2",
      id: "gift_donor_name",
      section: "purchase",
      label: "Donor\u2019s full name",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "is_purchase",
            equals: "yes"
          },
          {
            field: "gift_funds",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "e.g. parent, spouse",
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.2",
      id: "gift_donor_relationship",
      section: "purchase",
      label: "Your relationship to the donor",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: {
        all_of: [
          {
            field: "is_purchase",
            equals: "yes"
          },
          {
            field: "gift_funds",
            equals: "yes"
          }
        ]
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "The lender\u2019s gifted-deposit documents will need to be signed. We will send those for e-signature \u2014 you do not need to print them.",
      accept: null,
      placeholder: null,
      addition_group: "G",
      source: "SM1/Charles Rose title requisition 9.2",
      id: "gift_amount",
      section: "purchase",
      label: "Amount of the gift",
      type: "currency_gbp"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "This is the account the net loan should be paid into, in the borrower(s) name(s). It is not the solicitor\u2019s account, and we will never ask for a card number or online-banking login.",
      accept: null,
      placeholder: null,
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_bank_name",
      section: "nominated_account",
      label: "Bank name",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: true,
        source: "crm.borrower.legal_name",
        notes: "Suggest the borrower legal name(s); the borrower must confirm."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_account_name",
      section: "nominated_account",
      label: "Account name",
      type: "text"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: "00-00-00",
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_sort_code",
      section: "nominated_account",
      label: "Sort code",
      type: "sort_code"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "This is the account that should receive the net advance, not a mortgage roll number.",
      accept: null,
      placeholder: null,
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_account_number",
      section: "nominated_account",
      label: "Account number",
      type: "bank_account_number"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_account_in_all_borrowers_names",
      section: "nominated_account",
      label: "This account is in the name of all borrowers",
      type: "checkbox"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: {
        field: "net_advance_account_in_all_borrowers_names",
        equals: "no"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Shown if there is more than one borrower and the confirmation above is not ticked.",
      accept: null,
      placeholder: null,
      addition_group: "C",
      source: "SM1/Charles Rose title requisition 5.2",
      id: "net_advance_account_explanation",
      section: "nominated_account",
      label: "If the account is not in every borrower\u2019s name, please explain or give a joint-account alternative",
      type: "textarea"
    },
    {
      options: null,
      required: false,
      repeatable_group: "party",
      conditional: null,
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "This is optional context for the file. It does not replace the insolvency searches the solicitor will run on the day of completion. Answer for each person if you can.",
      accept: null,
      placeholder: null,
      addition_group: "J",
      source: "SM1/Charles Rose title requisition 1.1 / 2.2 / 9.3 (optional declaration; does not replace completion-day searches)",
      id: "insolvency_declaration",
      section: "authority_and_declaration",
      label: "Have you, or has any director, member or guarantor, ever been bankrupt, entered an IVA or a similar arrangement, or been disqualified as a director?",
      type: "yes_no"
    },
    {
      options: null,
      required: false,
      repeatable_group: "party",
      conditional: {
        field: "insolvency_declaration",
        equals: "yes"
      },
      pdf: null,
      answers_pre_loan_enquiry: true,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      addition_group: "J",
      source: "SM1/Charles Rose title requisition 1.1 / 2.2 / 9.3 (optional declaration; does not replace completion-day searches)",
      id: "insolvency_details",
      section: "authority_and_declaration",
      label: "Please tell us who, when, and the current status",
      type: "textarea"
    }
  ],
  additional_fields_not_on_questionnaire_pdf: [
    {
      options: null,
      required: true,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "email"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.email",
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "Needed so we can send the e-sign envelope. This is on Ackroyds' Client Instruction Form, not the 6-page remortgage questionnaire.",
      accept: null,
      placeholder: null,
      id: "borrower_email",
      section: "about_you_extras",
      label: "Email address",
      type: "email"
    },
    {
      options: null,
      required: true,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "date of birth"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.date_of_birth",
        notes: "Often outstanding."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "On the Client Instruction Form, not the remortgage questionnaire.",
      accept: null,
      placeholder: null,
      id: "borrower_date_of_birth",
      section: "about_you_extras",
      label: "Date of birth",
      type: "date"
    },
    {
      options: null,
      required: false,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "NI number"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: true,
        source: "crm.borrower.ni_number",
        notes: "Often outstanding."
      },
      visible_to_borrower: true,
      staff_only: false,
      help: "On the Client Instruction Form, not the remortgage questionnaire.",
      accept: null,
      placeholder: null,
      id: "borrower_ni_number",
      section: "about_you_extras",
      label: "National Insurance number",
      type: "text"
    },
    {
      options: null,
      required: false,
      repeatable_group: "borrower",
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "Correspondence address"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "correspondence_address",
      section: "about_you_extras",
      label: "Correspondence address, if different from the property",
      type: "textarea"
    },
    {
      options: null,
      required: true,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "I/we agree / do not agree to Conveyancing Protocol information-sharing"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "conveyancing_protocol_consent",
      section: "about_you_extras",
      label: "Do you agree to information being shared under the Law Society Conveyancing Protocol?",
      type: "yes_no"
    },
    {
      options: null,
      required: false,
      repeatable_group: null,
      conditional: null,
      pdf: {
        page: null,
        question_ref: "Instruction form",
        field: "Any other information we need to know?"
      },
      answers_pre_loan_enquiry: false,
      prefill: {
        possible: false,
        source: null,
        notes: null
      },
      visible_to_borrower: true,
      staff_only: false,
      help: null,
      accept: null,
      placeholder: null,
      id: "anything_else",
      section: "about_you_extras",
      label: "Is there anything else the solicitor should know?",
      type: "textarea"
    }
  ],
  counts: {
    fields_mapped_to_pdf: 94,
    fields_total_on_questionnaire: 142,
    ple_addition_fields: 56,
    additional_instruction_form_fields: 6,
    fields_visible_to_borrower: 139,
    staff_only_fields: 3,
    prefillable_fields: 41,
    pre_loan_enquiry_fields: 97,
    ple_fields_by_group: {
      A: 5,
      B: 14,
      C: 6,
      D: 10,
      E: 6,
      F: 3,
      G: 5,
      H: 3,
      I: 2,
      J: 2
    }
  },
  pdf_notes: [
    "The source PDF is a 6-page non-fillable scan (OCR via Readiris, dated 24 July 2017). Pages 5\u20136 still say 'Stirling Ackroyd Legal'. Use current 'Ackroyd Legal' branding on our form.",
    "The PDF typo 'Approximate amount owin2' is 'owing'. 'SPECIAL QUESTONS' is 'questions'.",
    "Telephone numbers on page 1 are laid out as Mr / Ms columns. Our form uses a repeatable borrower group instead, with no gendered columns.",
    "The PDF has only one 'second present lender' block. Cases can have several further charges, so further_charge is repeatable. When populating the PDF, use extra pages or a schedule if there is more than one further charge.",
    "Q9 is three separate yes/no questions (works in the last 4 years; doors/windows since 2002; electrical works since 1 January 2005).",
    "Q11 is a shared details + document request triggered by a yes to Q9 or Q10.",
    "Q5 is not a yes/no on the PDF; it is a conditional document request. We add a clear gate question and do not ask the borrower to post an original certificate.",
    "Q15 only applies if the dwelling was built in the last 10 years. 'Municipal Mutual Foundation 15 Certificate' is historic wording; keep it as an option alongside NHBC.",
    "Page 6 form of authority is in addition to Ackroyds' standalone letter of authority. Prefill it and include both in the e-sign pack until Ackroyds say otherwise.",
    "Signature, print-name and date blocks on pages 4, 5 and 6 are satisfied by the e-sign envelope, not by this web form."
  ],
  gaps: [
    "Ackroyds have not yet confirmed that we may pre-fill and e-sign this historic PDF (rather than a current template or their own e-sign link).",
    "The public Posfin fact-find (posfincapital.com/apply) does not yet cover most of these solicitor questions. The smart link needs to become the system of record for them, writing to Supabase / the CRM.",
    "New-lender account number and payment date are often n/a on a short-term or bridging facility. Confirm PDF wording before typing 'n/a' as fact.",
    "Marital status, mortgage account numbers, ERC details, occupiers at 17+, and most property questions are typically not already on the file.",
    "Client Instruction Form fields (email, date of birth, NI, protocol consent) are recommended extras in this spec but are not on the 6-page questionnaire. Include them in the same smart-link flow if Tom has room.",
    "Fax is a legacy field and should be hidden behind an optional control.",
    "We do not currently have a structured title-to-form mapper in the CRM; prefill from title is a target behaviour, not a live API.",
    "Addition C collects the nominated bank account for the net advance (SM1/Charles Rose title requisition 5.2). This is an intentional exception to the original \u2018no bank details\u2019 brief, and must be stored and transmitted as sensitive data.",
    "Addition H assumes a business-purpose facility, which is typical for Posfin. If the same form is later used for a purely residential remortgage, Tom should hide or reword H rather than force the confirmation.",
    "Addition J is optional and does not replace completion-day bankruptcy searches (1.1, 2.2, 9.3), which stay with the solicitor.",
    "The completed questionnaire should pre-populate the Charles Rose / SM1 PLE response column for the solicitor to confirm and sign. The borrower should never fill in that PDF. Map each A\u2013J answer to the PLE number in the CRM.",
    "Do not ask the borrower for unsolicited leases, tenancies, searches or title documents (the title-insurance covering letter tells the solicitor not to send these unless asked)."
  ],
  ple_additions: {
    source_document: "/workspace/somo/ple/SOMO_PLE_VS_QUESTIONNAIRE_GAP_v001.md",
    form_title: "Solicitor Title Indemnity Requisitions",
    issuer: "Charles Rose Legal, for lender SM1 Capital & Security Limited",
    borrower_copy_rule: "Do not name SM1, SOMO, Charles Rose, Westcor, or any other lender or insurer in borrower-facing copy. Source tags below are for the spec and CRM mapping only.",
    placement: {
      A: "general flow (always asked)",
      B: "gated \u2014 show only if borrower or guarantor is a company or LLP",
      C: "general flow (always asked)",
      D: "tighten existing insurance questions (Q17 / leasehold L5)",
      E: "tighten existing occupier questions (Q1), per named occupier",
      F: "general flow (always asked)",
      G: "gated \u2014 G1 asked of everyone as the purchase gate; G2 and gift fields only if this is a purchase",
      H: "general flow (always asked)",
      I: "general flow (always asked)",
      J: "optional declaration in the general flow; does not replace completion-day searches"
    },
    groups: {
      A: {
        title: "Source of any balance needed to complete",
        source: "SM1/Charles Rose title requisition 1.2 / 2.8"
      },
      B: {
        title: "Company / SPV block",
        source: "SM1/Charles Rose title requisition 2.3\u20132.7"
      },
      C: {
        title: "Account for the net advance",
        source: "SM1/Charles Rose title requisition 5.2"
      },
      D: {
        title: "Buildings insurance \u2014 tightened",
        source: "SM1/Charles Rose title requisition 6.1"
      },
      E: {
        title: "Occupiers aged 17+ \u2014 tightened",
        source: "SM1/Charles Rose title requisition 8.1"
      },
      F: {
        title: "How the property is occupied",
        source: "SM1/Charles Rose title requisition 8.2"
      },
      G: {
        title: "Purchase and gifted funds",
        source: "SM1/Charles Rose title requisition 9.1 / 9.2"
      },
      H: {
        title: "Business purpose of the loan",
        source: "SM1/Charles Rose title requisition 10.1"
      },
      I: {
        title: "Exit route",
        source: "SM1/Charles Rose title requisition 10.2"
      },
      J: {
        title: "Optional insolvency declaration",
        source: "SM1/Charles Rose title requisition 1.1 / 2.2 / 9.3"
      }
    },
    not_added_solicitor_or_completion_items: [
      "1.1, 2.2, 9.3 \u2014 completion-day bankruptcy searches",
      "2.1, 7.1, 7.3, 7.4 \u2014 company search, official copies, OS1, environmental search",
      "3.1\u20133.3, 5.1 \u2014 solicitor PI cover, SRA partner count, solicitor client-account details",
      "4.1, 11 \u2014 return of executed security documents, pre-completion undertaking",
      "9.1 \u2014 purchase contract, transfer and TA13 (flagged to the solicitor when G1 is yes, not collected from the borrower)",
      "7.2 \u2014 redemption statements and DS1 (solicitor documents; we already collect the lender details that let the solicitor obtain them)"
    ]
  },
  version_notes: "v001 includes the full Ackroyds 6-page remortgage questionnaire mapping, plus SOMO/SM1 Charles Rose title-requisition additions A\u2013J from /workspace/somo/ple/SOMO_PLE_VS_QUESTIONNAIRE_GAP_v001.md, folded in on 18 November 2026."
};

// lib/forms/remortgage.ts
var FIELDS = [...remortgage_spec_default.fields, ...remortgage_spec_default.additional_fields_not_on_questionnaire_pdf];
var SECTIONS = remortgage_spec_default.sections;
var TITLE_INSURANCE_GROUPS = ["A", "H", "I", "J"];
var TITLE_INSURANCE_FLAG = "titleInsurance";
var STAFF_ONLY_FIELDS = FIELDS.filter((f) => f.staff_only).map((f) => f.id);
var TYPE_MAP = {
  text: "text",
  textarea: "textarea",
  yes_no: "yes_no",
  yes_no_unsure: "yes_no_unsure",
  file_upload: "file",
  single_choice: "choice",
  currency_gbp: "money",
  tel: "tel",
  checkbox: "checkbox",
  date: "date",
  multi_choice: "multi",
  yes_no_not_applicable: "yes_no_na",
  single_choice_with_other: "choice_other",
  number: "number",
  sort_code: "sort_code",
  bank_account_number: "account_number",
  email: "email"
};
var HELP_OVERRIDE = {
  borrower_email: "So we can send your forms for e-signature.",
  borrower_date_of_birth: "The solicitor needs this to open your file.",
  borrower_ni_number: "Optional \u2014 the solicitor may ask for it later.",
  heard_about_firm: null,
  occupiers_17_plus: "Include every occupier aged 17 or over, even if they are a family member.",
  new_lender_account_number: null
};
var CHECKBOX_AS_YESNO = new Set(
  FIELDS.filter((f) => f.conditional && "field" in f.conditional && "equals" in f.conditional && f.conditional.equals === "no").map((f) => f.conditional.field).filter((id) => FIELDS.find((x) => x.id === id)?.type === "checkbox")
);
var REPEATERS = {
  borrower: { id: "borrowers", label: "Borrowers", itemLabel: "Borrower", addLabel: "Add another borrower", min: 1, max: 4 },
  further_charge: { id: "further_charges", label: "Other charges", itemLabel: "Charge", addLabel: "Add another charge", min: 1, max: 6 },
  occupier: { id: "occupiers", label: "Occupiers", itemLabel: "Occupier", addLabel: "Add another occupier", min: 1, max: 8 }
};
function toField(f, brand, prefillSources) {
  let type = TYPE_MAP[f.type] ?? "text";
  if (CHECKBOX_AS_YESNO.has(f.id)) type = "yes_no";
  if (f.id === "property_postcode") type = "postcode";
  const help = f.id in HELP_OVERRIDE ? HELP_OVERRIDE[f.id] : f.help;
  const field = {
    id: f.id,
    label: f.label,
    type,
    required: f.required,
    help: help ?? void 0,
    placeholder: f.placeholder ?? void 0,
    options: f.options ?? void 0,
    when: f.conditional ?? void 0,
    advanced: ["borrower_phone_fax", "borrower_phone_work"].includes(f.id) || void 0,
    half: ["borrower_forenames", "borrower_surname", "first_lender_amount_owing", "first_lender_payment_date"].includes(f.id) || void 0,
    prefilled: Boolean(f.prefill?.possible && f.prefill.source && prefillSources.has(f.prefill.source)),
    meta: { pdf: f.pdf ?? null, source: f.source ?? null, addition_group: f.addition_group ?? null }
  };
  if (f.id === "heard_about_firm") {
    field.label = brand.howHeard.label;
    field.options = brand.howHeard.options;
  }
  if (f.id === "net_advance_account_in_all_borrowers_names") field.label = "Is this account in the name of all borrowers?";
  return field;
}
function nodesFor(fields, brand, prefill) {
  const out = [];
  const seen = /* @__PURE__ */ new Map();
  for (const f of fields) {
    const g = f.repeatable_group && REPEATERS[f.repeatable_group];
    if (g) {
      let r = seen.get(g.id);
      if (!r) {
        r = { kind: "repeater", id: g.id, label: g.label, itemLabel: g.itemLabel, addLabel: g.addLabel, min: g.min, max: g.max, fields: [], when: f.conditional ?? void 0, emptyItem: () => ({}) };
        if (g.id === "borrowers") r.summary = (it) => [it.borrower_forenames, it.borrower_surname].filter(Boolean).join(" ") || "Borrower";
        if (g.id === "occupiers") r.summary = (it) => String(it.occupier_name || "Occupier");
        if (g.id === "further_charges") r.summary = (it) => String(it.further_lender_name || "Charge");
        seen.set(g.id, r);
        out.push(r);
      }
      const fld = toField(f, brand, prefill);
      if (JSON.stringify(fld.when) === JSON.stringify(r.when)) fld.when = void 0;
      r.fields.push(fld);
    } else out.push(toField(f, brand, prefill));
  }
  return out;
}
function buildRemortgageSchema({ brand, prefillSources = [] }) {
  const pre = new Set(prefillSources);
  const visible = FIELDS.filter((f) => !f.staff_only && f.visible_to_borrower !== false && f.id !== "answers_accurate");
  const isTI = (f) => !!f.addition_group && TITLE_INSURANCE_GROUPS.includes(f.addition_group);
  const bySection = (id) => visible.filter((f) => (f.section === id || id === "about_you" && f.section === "about_you_extras" && f.repeatable_group === "borrower") && !isTI(f));
  const steps = [];
  const sec = (id) => SECTIONS.find((s2) => s2.id === id);
  const order = ["about_you", "the_property", "current_mortgages", "the_new_loan", "who_lives_there", "about_the_property", "building_works", "rights_and_neighbours", "leasehold", "company", "purchase"];
  for (const id of order) {
    const s2 = sec(id);
    const nodes = nodesFor(bySection(id), brand, pre);
    if (id === "about_you") {
      nodes.push(...nodesFor(visible.filter((f) => f.section === "about_you_extras" && !f.repeatable_group && f.id !== "anything_else"), brand, pre));
    }
    steps.push({
      id,
      title: s2.borrower_title,
      description: s2.description ?? void 0,
      nodes,
      when: s2.conditional ?? void 0,
      badge: s2.id === "company" ? "Company" : s2.id === "purchase" ? "Purchase" : s2.id === "leasehold" ? "Leasehold" : void 0
    });
  }
  steps.push({
    id: "title_insurance",
    title: "Title insurance: a few extra checks",
    badge: "Title insurance",
    description: "Your new loan uses title insurance instead of full legal searches. These answers let the solicitor confirm the lender\u2019s checks in one go, without a second round of questions.",
    when: { flag: TITLE_INSURANCE_FLAG },
    nodes: nodesFor(visible.filter(isTI), brand, pre)
  });
  const na = sec("nominated_account");
  steps.push({ id: "nominated_account", title: na.borrower_title, description: na.description ?? void 0, badge: "Title insurance", when: { flag: TITLE_INSURANCE_FLAG }, nodes: nodesFor(bySection("nominated_account"), brand, pre) });
  const hf = sec("how_you_found_us");
  steps.push({ id: "how_you_found_us", title: hf.borrower_title, nodes: [...nodesFor(bySection("how_you_found_us"), brand, pre), ...nodesFor(visible.filter((f) => f.id === "anything_else"), brand, pre)] });
  const ad = sec("authority_and_declaration");
  steps.push({ id: "authority", title: ad.borrower_title, description: "We\u2019ll prepare the solicitor\u2019s questionnaire and a form of authority for e-signature. You will not need to print anything.", nodes: nodesFor(bySection("authority_and_declaration"), brand, pre) });
  steps.forEach((s2, i) => s2.kicker = `Section ${i + 1}`);
  return {
    id: "remortgage",
    title: "Remortgage questionnaire",
    steps,
    declaration: { text: "I confirm that the answers I have given are complete and accurate, as far as I know.", nameLabel: "Type your full name" }
  };
}
function remortgagePrefill(prefill, brand) {
  const a = {};
  const borrower = {};
  for (const f of FIELDS) {
    const src = f.prefill?.possible ? f.prefill.source : null;
    if (!src || !(src in prefill)) continue;
    if (f.repeatable_group === "borrower") borrower[f.id] = prefill[src];
    else if (!f.repeatable_group) a[f.id] = prefill[src];
  }
  if (Object.keys(borrower).length) a.borrowers = [{ _id: "b1", ...borrower }];
  if (brand.howHeard.default) a.heard_about_firm = brand.howHeard.default;
  return a;
}
var REMORTGAGE_SPEC_VERSION = remortgage_spec_default.version;

// lib/forms/works.ts
var PROJECT_TYPES = ["Light refurbishment", "Heavy refurbishment", "Conversion", "Extension", "Ground-up"];
var worksSchema = {
  id: "works",
  title: "Schedule of Works",
  declaration: {
    text: "I confirm this schedule is a fair summary of the works planned, the costs include labour and VAT where applicable, and I understand lenders and valuers may rely on it.",
    nameLabel: "Type your full name"
  },
  steps: [
    {
      id: "project",
      kicker: "Step 1",
      title: "The project",
      description: "A high-level view of what\u2019s being done \u2014 lenders and valuers use this to understand the scheme.",
      nodes: [
        { id: "borrower_name", label: "Borrower", type: "text", required: true, help: "Person or company taking the loan." },
        { id: "property_address", label: "Property address", type: "textarea", required: true },
        { id: "property_postcode", label: "Postcode", type: "postcode", required: true, half: true },
        { id: "property_type", label: "Property type", type: "choice", half: true, options: ["Residential", "BTL", "HMO", "Multi-unit", "Commercial", "Semi-commercial", "Other"] },
        { id: "project_type", label: "What kind of project is it?", type: "choice", required: true, options: PROJECT_TYPES },
        { id: "project_summary", label: "In a sentence or two", type: "textarea", placeholder: "e.g. Convert a 3-bed house into two self-contained flats", help: "Optional \u2014 the headline the valuer will read first." },
        { id: "units_before", label: "Units before", type: "number", half: true, min: 0, advanced: true },
        { id: "units_after", label: "Units after", type: "number", half: true, min: 0, advanced: true }
      ]
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
        { id: "experience", label: "Similar projects you\u2019ve completed", type: "textarea", advanced: true, help: "Optional \u2014 lenders like to see one or two recent examples." }
      ]
    },
    {
      id: "lines",
      kicker: "Step 3",
      title: "The works",
      description: `Trades, not materials \u2014 up to ${WORKS_MAX_LINES} lines. Include labour and VAT in each cost, even if you\u2019re doing the work yourself.`,
      panel: "works_totals",
      nodes: [
        {
          kind: "repeater",
          id: "lines",
          label: "Works",
          itemLabel: "Line",
          addLabel: "Add a line",
          min: 1,
          max: WORKS_MAX_LINES,
          summary: (l) => [l.category || "Line", l.cost ? gbp(num(l.cost)) : null, l.weeks ? `${l.weeks} wks` : null].filter(Boolean).join(" \xB7 "),
          fields: [
            { id: "category", label: "Trade", type: "choice", required: true, options: WORKS_CATEGORIES },
            { id: "description", label: "What\u2019s involved", type: "text", required: true, placeholder: "e.g. Full rewire, new consumer unit" },
            { id: "cost", label: "Cost (inc. labour & VAT)", type: "money", required: true, half: true, min: 1 },
            { id: "weeks", label: "Weeks (optional)", type: "number", half: true, min: 0, max: 260 }
          ]
        },
        { id: "contingency_pct", label: "Contingency", type: "percent", min: 0, max: 50, help: "Lenders usually expect 10\u201315%. Default 10%." }
      ]
    },
    {
      id: "values",
      kicker: "Step 4",
      title: "Values",
      description: "Optional, but it helps the lender see the uplift the works create.",
      panel: "works_totals",
      nodes: [
        { id: "current_value", label: "Value today (before works)", type: "money" },
        { id: "gdv", label: "Value after works (GDV)", type: "money", help: "Your estimate, or the agent\u2019s / valuer\u2019s figure if you have one." },
        { id: "gdv_basis", label: "Where does that figure come from?", type: "choice", options: ["My estimate", "Agent appraisal", "RICS valuation", "Comparable sales"], when: { field: "gdv", notEmpty: true } }
      ]
    }
  ],
  validate: (a) => {
    const issues = [];
    const lines = a.lines ?? [];
    if (lines.length > WORKS_MAX_LINES) issues.push({ path: "lines", level: "error", message: `Keep it to ${WORKS_MAX_LINES} lines \u2014 group smaller items under one trade.` });
    const cp = contingencyPct(a);
    if (cp < 10 && lines.length) issues.push({ path: "contingency_pct", level: "warn", message: "Below 10% \u2014 most lenders will expect more contingency." });
    if (a.project_type === "Heavy refurbishment" || a.project_type === "Conversion" || a.project_type === "Ground-up") {
      if (a.building_regs_status === "Not required") issues.push({ path: "building_regs_status", level: "warn", message: "This kind of project usually needs building regulations sign-off \u2014 worth checking." });
    }
    return issues;
  }
};

// lib/forms/registry.ts
function getSchema(form, brandId, prefillSources = []) {
  if (form === "al") return alSchema;
  if (form === "works") return worksSchema;
  if (form === "lender") return lenderSchema;
  return buildRemortgageSchema({ brand: BRANDS[brandId] ?? BRANDS.posfin, prefillSources });
}
function initialAnswers(form, c, brand) {
  const isFullDemo = c.token === "demo";
  if (form === "al") {
    if (isFullDemo) return structuredClone(DEMO_AL);
    return { applicant_name: c.applicant.name, email: c.applicant.email, mobile: c.applicant.mobile ?? "", company_name: c.applicant.company ?? "", referred_by: c.applicant.referred_by ?? "" };
  }
  if (form === "lender") return isFullDemo ? structuredClone(DEMO_LENDER) : {};
  if (form === "works") {
    if (isFullDemo) return structuredClone(DEMO_WORKS);
    return { borrower_name: c.applicant.company || c.applicant.name, contingency_pct: 10 };
  }
  const base = remortgagePrefill(c.prefill, brand);
  return isFullDemo ? { ...base, ...DEMO_REMORTGAGE_EXTRA } : base;
}

// lib/storage/env.ts
var MAIN_SUPABASE_URL = "https://vgflcrfaudrvrdmxjdtl.supabase.co";
function trim(v) {
  return String(v || "").trim().replace(/\/+$/, "");
}
function supabaseConfig(env = process.env) {
  const ffUrl = trim(env.FF_SUPABASE_URL);
  const ffIsMain = ffUrl === MAIN_SUPABASE_URL;
  const explicitUrl = trim(env.SUPABASE_URL);
  const key = trim(env.SUPABASE_SERVICE_ROLE_KEY) || trim(env.SUPABASE_MAIN_SERVICE_ROLE_KEY) || (ffIsMain ? trim(env.FF_ALERT_SERVICE_KEY) : "");
  const url = explicitUrl || MAIN_SUPABASE_URL;
  return { url, key, ffIsMain };
}
function storageMode(env = process.env) {
  if (env.SMARTLINK_STORAGE === "local") return "local";
  if (env.SMARTLINK_STORAGE === "supabase" || env.VERCEL) return "supabase";
  const { key } = supabaseConfig(env);
  return key ? "supabase" : "local";
}

// lib/storage/local.ts
import { promises as fs } from "node:fs";
import path from "node:path";
function root() {
  return process.env.SMARTLINK_DATA_DIR || path.join(process.cwd(), "data");
}
function file(form, token) {
  if (!TOKEN_RE.test(token) || !/^[a-z]+$/.test(form)) throw new Error("bad token");
  return path.join(root(), form, `${token}.json`);
}
var localAdapter = {
  name: "local",
  async getDraft(form, token) {
    try {
      return JSON.parse(await fs.readFile(file(form, token), "utf8"));
    } catch {
      return null;
    }
  },
  async saveDraft(form, token, data) {
    const prev = await this.getDraft(form, token);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const draft = {
      token,
      form,
      status: data.status ?? prev?.status ?? "draft",
      version: (prev?.version ?? 0) + 1,
      step: data.step,
      answers: data.answers,
      updated_at: now,
      ...data.status === "submitted" ? { submitted_at: now } : prev?.submitted_at ? { submitted_at: prev.submitted_at } : {},
      ...data.derived ? { derived: data.derived } : {},
      ...data.export ? { crm_export: data.export } : {}
    };
    const f = file(form, token);
    await fs.mkdir(path.dirname(f), { recursive: true });
    const tmp = f + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(draft, null, 2), { mode: 384 });
    await fs.rename(tmp, f);
    return draft;
  }
};

// lib/storage/supabase.ts
import { createClient } from "@supabase/supabase-js";
var TABLE = {
  al: "case_assets_liabilities",
  remortgage: "case_remortgage_questionnaire",
  works: "case_schedule_of_works",
  lender: "lender_criteria"
};
var KEY = { al: "case_token", remortgage: "case_token", works: "case_token", lender: "link_token" };
var StorageUnavailable = class extends Error {
  constructor(reason) {
    super(reason);
    this.name = "StorageUnavailable";
  }
};
function isStorageUnavailable(e) {
  return e instanceof StorageUnavailable || e instanceof Error && e.name === "StorageUnavailable";
}
function unavailableReason(error) {
  if (!error) return null;
  const code = String(error.code || "");
  const message = String(error.message || "");
  if (code === "42P01" || code === "PGRST205" || code === "PGRST106") return message || code;
  if (/could not find the table/i.test(message)) return message;
  if (/relation ["'].*["'] does not exist/i.test(message)) return message;
  if (/schema cache/i.test(message) && /table|relation|lender_criteria|case_/i.test(message)) return message;
  return null;
}
var client = null;
function db() {
  if (!client) {
    const { url, key } = supabaseConfig();
    if (!url || !key) throw new StorageUnavailable("supabase_not_configured");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
var toDraft = (form, r) => ({
  token: r.case_token ?? r.link_token,
  form,
  status: r.status,
  version: r.version,
  step: r.step,
  answers: r.payload,
  updated_at: r.updated_at,
  submitted_at: r.submitted_at ?? void 0
});
var COLS = "status,version,step,payload,updated_at,submitted_at";
var supabaseAdapter = {
  name: "supabase",
  async getDraft(form, token) {
    try {
      const key = KEY[form];
      const { data, error } = await db().from(TABLE[form]).select(`${key},${COLS}`).eq(key, token).maybeSingle();
      const missing = unavailableReason(error);
      if (missing) {
        console.error(`[smartlink] storage unavailable form=${form}: ${missing}`);
        return null;
      }
      if (error) throw new Error(`supabase read failed (${error.code})`);
      return data ? toDraft(form, data) : null;
    } catch (e) {
      if (isStorageUnavailable(e)) {
        console.error(`[smartlink] storage unavailable form=${form}: ${e.message}`);
        return null;
      }
      throw e;
    }
  },
  async saveDraft(form, token, d) {
    const prev = await this.getDraft(form, token);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const key = KEY[form];
    const row = {
      [key]: token,
      status: d.status ?? prev?.status ?? "draft",
      version: (prev?.version ?? 0) + 1,
      step: d.step,
      payload: d.answers,
      derived: d.derived ?? null,
      crm_export: d.export ?? null,
      updated_at: now,
      submitted_at: d.status === "submitted" ? now : prev?.submitted_at ?? null
    };
    const res = await db().from(TABLE[form]).upsert(row, { onConflict: key }).select(`${key},${COLS}`).single();
    const missing = unavailableReason(res.error);
    if (missing) throw new StorageUnavailable(missing);
    if (res.error || !res.data) throw new Error(`supabase write failed (${res.error?.code ?? "empty"})`);
    return toDraft(form, res.data);
  }
};

// lib/storage/index.ts
function storage() {
  return storageMode() === "supabase" ? supabaseAdapter : localAdapter;
}

// lib/server.ts
async function getCase(token) {
  if (!TOKEN_RE.test(token)) return null;
  return getDemoCase(token) ?? {
    token,
    ref: (token.startsWith("PC-") ? token : `PC-${token}`).slice(0, 48),
    demo: false,
    applicant: { name: "", email: "" },
    flags: { titleInsurance: true },
    prefill: {}
  };
}
async function loadForm(form, token, sp) {
  const c = await getCase(token);
  if (!c) return null;
  const brand = resolveBrand(sp.brand, form, c.brand?.[form]);
  const flags = flagsFor(c, sp);
  const ctx = { flags };
  const prefillSources = Object.keys(c.prefill);
  const schema = getSchema(form, brand.id, prefillSources);
  let saved = null;
  try {
    saved = await storage().getDraft(form, token);
  } catch (e) {
    if (!isStorageUnavailable(e)) throw e;
    console.error(`[smartlink] storage unavailable form=${form}: ${e.message}`);
  }
  const draft = saved ? { answers: saved.answers, step: saved.step, status: saved.status } : { answers: initialAnswers(form, c, brand), step: -1, status: "draft" };
  return { c, brand, flags, ctx, schema, prefillSources, draft, saved };
}

// lib/lender/summary.ts
var s = (v) => v === void 0 || v === null ? "" : String(v).trim();
var arr = (v) => Array.isArray(v) ? v : [];
var n = (v) => {
  if (v === void 0 || v === null || v === "") return null;
  const x = Number(String(v).replace(/[%,£\s]/g, ""));
  return Number.isFinite(x) ? x : null;
};
var money = (v) => parseMoney(v);
var gbpShort = (x) => {
  if (x === null) return "";
  if (x >= 1e6) return `\xA3${+(x / 1e6).toFixed(x % 1e6 ? 2 : 0)}m`;
  if (x >= 1e3) return `\xA3${+(x / 1e3).toFixed(x % 1e3 ? 1 : 0)}k`;
  return `\xA3${x}`;
};
function pickedProducts(a) {
  const sel = arr(a.products);
  return PRODUCTS.filter((p) => sel.includes(p.label));
}
function gridMax(g, col) {
  let m = null;
  for (const row of Object.values(g ?? {})) for (const [c, v] of Object.entries(row ?? {})) {
    if (col && !col.test(c)) continue;
    const x = n(v);
    if (x !== null && (m === null || x > m)) m = x;
  }
  return m;
}
function productSummary(p, a) {
  const g = (f) => a[`p_${p.key}_${f}`];
  const ltv = g("ltv") ?? {};
  const mit = s(g("min_interest_type"));
  const min_interest = !mit ? "" : mit.startsWith("None") ? "None \u2014 days used" : mit.startsWith("A fixed") ? s(g("min_interest_months")) ? `${s(g("min_interest_months"))} months` : "Fixed months" : s(g("min_interest_pct")) ? `${s(g("min_interest_pct"))}% of term` : "% of term";
  const ro = s(g("roll_offered"));
  const rd = {};
  if (hasRollover(p) && ro && ro !== "No") {
    if (s(g("roll_max_ltv"))) rd["Max LTV"] = `${s(g("roll_max_ltv"))}%`;
    if (s(g("roll_paydown"))) rd["Capital paydown"] = s(g("roll_paydown")) === "yes" ? "Accepted" : "No";
    if (s(g("roll_reretain"))) rd["Re-retain interest"] = { yes: "Yes", no: "No", unsure: "Case by case" }[s(g("roll_reretain"))] ?? s(g("roll_reretain"));
    if (s(g("roll_fee"))) rd["Fee"] = s(g("roll_fee")) + (s(g("roll_fee_pct")) ? ` ${s(g("roll_fee_pct"))}%` : "");
    if (s(g("roll_reval"))) rd["Revaluation"] = s(g("roll_reval"));
    if (s(g("roll_max_count"))) rd["Max rollovers"] = s(g("roll_max_count"));
  }
  const rollover = !hasRollover(p) ? "n/a" : !ro ? "" : ro === "No" ? "No" : `${ro}${rd["Max LTV"] ? ` to ${rd["Max LTV"]}` : ""}${rd["Capital paydown"] === "Accepted" ? ", paydown OK" : ""}${rd["Re-retain interest"] === "Yes" ? ", re-retain" : ""}`;
  const firstCols = Object.keys(Object.values(ltv)[0] ?? {});
  const cols = p.equity ? ["LTV", "LTGDV"] : p.subordinate ? ["Total LTV", "Total LTGDV", "Senior max"] : p.dev ? ["Day 1", "LTGDV", "LTC"] : p.charges.filter((c) => /charge/.test(c));
  const extra = {};
  for (const [f, l] of [["intercreditor", "Intercreditor"], ["value_basis", "Valuation basis"], ["min_sponsor_equity", "Min sponsor equity %"], ["max_cost_pct", "Max % of costs"], ["profit_share", "Profit share %"], ["pref_return", "Preferred return %"], ["min_experience", "Experience"], ["other_fees", "Other fees"], ["erc_detail", "ERC detail"]])
    if (s(g(f))) extra[l] = s(g(f));
  return {
    key: p.key,
    label: p.label,
    short: p.short,
    family: p.family,
    segment: p.placedSegment,
    min_loan: money(g("min_loan")),
    max_loan: money(g("max_loan")),
    charges: arr(g("charges")).length ? arr(g("charges")) : p.charges.length === 1 ? p.charges : [],
    ltv,
    ltv_cols: cols.length ? cols : firstCols,
    ltv_basis: s(g("ltv_basis")),
    max_ltv_first: p.dev || p.subordinate || p.equity ? gridMax(ltv, /Day 1|Total LTV|^LTV$/) : gridMax(ltv, /1st/),
    max_ltv_second: p.dev || p.equity ? null : p.subordinate ? gridMax(ltv, /Total LTV/) : gridMax(ltv, /2nd/),
    max_ltgdv: gridMax(ltv, /LTGDV/),
    max_ltc: gridMax(ltv, /LTC/),
    max_day1: gridMax(ltv, /Day 1/),
    term_min: n(g("term_min")),
    term_max: n(g("term_max")),
    min_interest,
    exit_after_months: n(g("exit_after_months")),
    interest_time_used: s(g("interest_time_used")) === "yes" ? "Yes" : s(g("interest_time_used")) === "no" ? "No" : "",
    erc: s(g("erc")) === "ERCs apply" ? s(g("erc_detail")) || "Yes" : s(g("erc")) ? "None" : "",
    rate_from: n(g("rate_from")),
    rate_to: n(g("rate_to")),
    rate_basis: s(g("rate_basis")),
    arrangement_fee: n(g("arrangement_fee")),
    exit_fee: n(g("exit_fee")),
    proc_fee: n(g("proc_fee")),
    interest_options: arr(g("interest_options")),
    works: p.works ? [s(g("works_funding")), s(g("works_max_pct")) ? `to ${s(g("works_max_pct"))}% of cost` : ""].filter(Boolean).join(", ") : "",
    rollover,
    rollover_offered: hasRollover(p) ? ro : "",
    rollover_detail: rd,
    notes: s(g("notes")),
    extra
  };
}
var tolRows = (rows2, prefix, a) => rows2.map((r) => ({ key: r.key, label: r.label, group: r.group, value: s(a[`${prefix}${r.key}`]), note: s(a[`${prefix}${r.key}_note`]) }));
function formValueAt(a, path2) {
  const [id, r, c] = path2.split(".");
  const v = a[id];
  if (r && c) return s(v?.[r]?.[c]);
  if (Array.isArray(v)) return v.join(", ");
  return s(v);
}
function gapCheck(a) {
  const ex = a.sheet_extraction ?? { status: a.guide_file ? "queued" : "none", items: [] };
  const exBy = new Map(ex.items.map((i) => [i.path, i]));
  const items = [];
  const add = (path2, label, step, section2) => {
    const form = formValueAt(a, path2);
    const g = exBy.get(path2);
    const norm2 = (x) => x.replace(/[£,%\s]/g, "").toLowerCase();
    let status = form ? "ok" : "missing";
    if (g && !form) status = "from_guide";
    else if (g && form && norm2(g.value) !== norm2(form)) status = "conflict";
    items.push({ path: path2, label, step, section: section2, status, form: form || void 0, guide: g?.value, page: g?.page });
  };
  for (const p of pickedProducts(a)) {
    const k = (f) => `p_${p.key}_${f}`;
    const step = `prod_${p.key}`;
    add(k("min_loan"), p.equity ? "Minimum ticket" : "Minimum loan", step, p.label);
    add(k("max_loan"), p.equity ? "Maximum ticket" : "Maximum loan", step, p.label);
    const firstRow = p.ltvRows[0];
    const firstCol = p.equity ? "LTV" : p.subordinate ? "Total LTV" : p.dev ? "LTGDV" : "1st charge";
    add(`${k("ltv")}.${firstRow}.${firstCol}`, `Max ${firstCol} \u2014 ${firstRow}`, step, p.label);
    add(k("term_max"), "Maximum term", step, p.label);
    if (!p.equity) {
      add(k("rate_from"), "Rate from", step, p.label);
      add(k("arrangement_fee"), "Arrangement fee", step, p.label);
      add(k("min_interest_type"), "Minimum interest period", step, p.label);
      add(k("interest_options"), "Interest options", step, p.label);
    }
    if (p.works) add(k("works_funding"), "Works funding", step, p.label);
    if (hasRollover(p)) add(k("roll_offered"), "Rollovers & extensions", step, p.label);
  }
  add("regions", "Regions", "reach", "Profile");
  add("val_types", "Valuation types", "valuation", "Valuation");
  add("appetite_style", "Asset appetite", "assets", "Appetite");
  add("hair_lookback", "Credit look-back", "hair1", "Risk tolerance");
  add("legal_dd", "Legal due diligence approach", "legals", "Legals");
  add("representation", "Representation", "legals", "Legals");
  for (const it of ex.items) if (!items.some((i) => i.path === it.path)) {
    const pk = PRODUCTS.find((p) => it.path.startsWith(`p_${p.key}_`));
    add(it.path, it.label.replace(/^[^:]+:\s*/, "").replace(/^./, (c) => c.toUpperCase()), pk ? `prod_${pk.key}` : "guide", pk ? pk.label : "Product guide");
  }
  const answeredHair = HAIR.filter((h) => s(a[`hair_${h.key}`])).length;
  if (answeredHair < HAIR.length) items.push({ path: "hair_*", label: `Risk tolerance: ${HAIR.length - answeredHair} of ${HAIR.length} not answered`, step: answeredHair < 18 ? "hair1" : "hair2", section: "Risk tolerance", status: "missing" });
  const answeredAssets = ASSETS.filter((x) => s(a[`asset_${x.key}`])).length;
  if (answeredAssets < ASSETS.length) items.push({ path: "asset_*", label: `Asset types: ${ASSETS.length - answeredAssets} of ${ASSETS.length} not answered`, step: "assets", section: "Appetite", status: "missing" });
  return {
    items,
    missing: items.filter((i) => i.status === "missing").length,
    conflicts: items.filter((i) => i.status === "conflict").length,
    fromGuide: items.filter((i) => i.status === "from_guide").length,
    ok: items.filter((i) => i.status === "ok").length,
    extraction: ex
  };
}
function buildLender(a) {
  const products = pickedProducts(a).map((p) => productSummary(p, a));
  const assets = tolRows(ASSETS, "asset_", a);
  const hair = tolRows(HAIR, "hair_", a);
  const cases = CASE_STUDIES.map((c) => ({ key: c.key, title: c.title, tag: c.tag, facts: c.facts, signals: c.signals, answer: s(a[`cs_${c.key}`]), reason: s(a[`cs_${c.key}_note`]) }));
  const gaps = gapCheck(a);
  const count = (rows2, v) => rows2.filter((r) => r.value === v).length;
  const minLoan = products.map((p) => p.min_loan).filter((x) => x !== null);
  const maxLoan = products.map((p) => p.max_loan).filter((x) => x !== null);
  const firsts = products.map((p) => p.max_ltv_first).filter((x) => x !== null);
  const seconds = products.map((p) => p.max_ltv_second).filter((x) => x !== null);
  const ltgdv = products.map((p) => p.max_ltgdv).filter((x) => x !== null);
  return {
    profile: {
      lender: s(a.lender_name),
      type: s(a.lender_type),
      website: s(a.website),
      nacfb: { yes: "Yes", no: "No", unsure: "Not sure" }[s(a.nacfb_patron)] ?? "",
      regulated_lending: s(a.fca_regulated) === "yes" ? "Yes" : s(a.fca_regulated) === "no" ? "No" : "",
      contact: [s(a.contact_name), s(a.contact_role)].filter(Boolean).join(", "),
      email: s(a.contact_email),
      phone: s(a.contact_phone),
      bdm: s(a.bdm_same) === "no" ? [s(a.bdm_name), s(a.bdm_region)].filter(Boolean).join(", ") : s(a.bdm_same) === "yes" ? "Same as contact" : "",
      bdm_email: s(a.bdm_email),
      regions: arr(a.regions),
      exclusions: s(a.postcode_exclusions),
      borrower_types: arr(a.borrower_types),
      min_property_value: money(a.min_property_value),
      max_exposure: money(a.max_exposure),
      regulated_scope: s(a.regulated_scope),
      charge_positions: arr(a.charge_positions),
      subordinate: s(a.subordinate_appetite),
      sweet_loan: money(a.sweet_loan),
      sweet_ltv: n(a.sweet_ltv),
      products_other: s(a.products_other),
      guide: a.guide_file?.name ?? "",
      guide_date: s(a.guide_date),
      guide_link: s(a.guide_link)
    },
    products,
    headline: {
      products: products.length,
      loan_range: minLoan.length || maxLoan.length ? `${gbpShort(minLoan.length ? Math.min(...minLoan) : null)}\u2013${gbpShort(maxLoan.length ? Math.max(...maxLoan) : null)}` : "",
      max_ltv_first: firsts.length ? Math.max(...firsts) : null,
      max_ltv_second: seconds.length ? Math.max(...seconds) : null,
      max_ltgdv: ltgdv.length ? Math.max(...ltgdv) : null
    },
    valuation: {
      types: arr(a.val_types),
      avm: [money(a.avm_max_loan), n(a.avm_max_ltv)],
      desktop: [money(a.desktop_max_loan), n(a.desktop_max_ltv)],
      driveby: [money(a.driveby_max_loan), n(a.driveby_max_ltv)],
      conditions: s(a.val_conditions),
      panel: s(a.val_panel),
      turnaround: s(a.val_turnaround)
    },
    appetite: { style: s(a.appetite_style), residential_only: s(a.residential_only) === "yes" ? "Yes" : s(a.residential_only) === "no" ? "No" : "", assets, accept: count(assets, "Accept"), cbc: count(assets, "Case by case"), decline: count(assets, "Decline") },
    hair: { lookback: s(a.hair_lookback), rows: hair, accept: count(hair, "Accept"), cbc: count(hair, "Case by case"), decline: count(hair, "Decline"), auto_declines: s(a.hair_auto_declines) },
    legals: {
      dd: arr(a.legal_dd),
      representation: s(a.representation),
      solicitor: s(a.borrower_solicitor),
      min_partners: s(a.min_partners),
      ple_rounds: s(a.ple_rounds),
      val_instruction: s(a.val_instruction),
      time_offer: s(a.time_offer),
      time_complete: s(a.time_complete)
    },
    cases,
    case_counts: { yes: cases.filter((c) => c.answer === "Yes").length, maybe: cases.filter((c) => c.answer === "Maybe").length, no: cases.filter((c) => c.answer === "No").length },
    gaps,
    partnership: {
      mezz: s(a.pt_mezz),
      ticket: s(a.pt_ticket),
      min_deal: s(a.pt_min_deal),
      loan_notes: { appetite: s(a.ln_appetite), ticket: s(a.ln_ticket), term: s(a.ln_term), coupon: s(a.ln_coupon), security: arr(a.ln_security) },
      pref_shares: { response: s(a.pt_route2), splits: arr(a.pt_split), pref: s(a.pt_pref), variation: s(a.pt_variation), illustrative: "2% pa management fee \u2192 10% pa preferred return paid monthly \u2192 75/25 split above hurdle; partner ~88% cash, managing partner ~12% via waived broker fee; protected preferred shares, limited voting" },
      situations: arr(a.pt_assets),
      notes: s(a.pt_notes),
      meet: s(a.pt_meet)
    },
    feedback: { rating: s(a.fb_rating), minutes: s(a.fb_minutes), clear: s(a.fb_clear), missing: s(a.fb_missing), confusing: s(a.fb_confusing), send_deals: s(a.fb_send_deals), call: s(a.fb_call) }
  };
}
var UNKNOWN = "Unknown / not established in reviewed sources";
var yn = (b) => b === null ? UNKNOWN : b ? "Y" : "N";
function placedProductRows(st, meta2) {
  const vt = st.valuation.types;
  return st.products.map((p, i) => ({
    research_lender_id: meta2.lender_id,
    canonical_merged_id: "PENDING merged list",
    lender: st.profile.lender,
    product: p.label,
    segment: p.segment,
    security: p.family === "capital_stack" && p.charges.some((c) => /Equity|Unsecured/.test(c)) ? "Subordinated / equity" : "Secured",
    first_charge: yn(p.charges.length ? p.charges.includes("1st charge") : null),
    second_charge: yn(p.charges.length ? p.charges.some((c) => /2nd/.test(c)) : null),
    max_ltv_first: p.max_ltv_first !== null ? `${p.max_ltv_first}%` : UNKNOWN,
    max_ltv_second: p.max_ltv_second !== null ? `${p.max_ltv_second}%` : p.charges.some((c) => /2nd/.test(c)) ? UNKNOWN : "N/A",
    advertised_ltv_unspecified_charge: "N/A (lender-declared by charge)",
    ltv_basis: p.ltv_basis || UNKNOWN,
    regulated: p.key === "bridge_reg" ? "Y" : "N",
    unregulated: p.key === "bridge_reg" ? "N" : "Y",
    business_purpose: p.key === "bridge_reg" ? "N" : "Y",
    development: yn(["development"].includes(p.family) || p.key === "refurb_heavy"),
    max_ltgdv: p.max_ltgdv !== null ? `${p.max_ltgdv}%` : UNKNOWN,
    max_ltc: p.max_ltc !== null ? `${p.max_ltc}%` : UNKNOWN,
    build_cost_funding: p.works || UNKNOWN,
    avm_allowed: yn(vt.length ? vt.includes("AVM") : null),
    avm_max_ltv: st.valuation.avm[1] !== null ? `${st.valuation.avm[1]}%` : UNKNOWN,
    avm_conditions: st.valuation.conditions || UNKNOWN,
    desktop_allowed: yn(vt.length ? vt.includes("Desktop") : null),
    desktop_max_ltv: st.valuation.desktop[1] !== null ? `${st.valuation.desktop[1]}%` : UNKNOWN,
    desktop_conditions: st.valuation.conditions || UNKNOWN,
    in_house_valuer: yn(vt.length ? vt.includes("In-house valuer") : null),
    dual_rep: st.legals.representation ? st.legals.representation.startsWith("Dual") ? "Y" : st.legals.representation.startsWith("Separate") ? "N" : "Case by case" : UNKNOWN,
    min_loan_gbp: p.min_loan ?? UNKNOWN,
    max_loan_gbp: p.max_loan ?? UNKNOWN,
    min_term_months: p.term_min ?? UNKNOWN,
    max_term_months: p.term_max ?? UNKNOWN,
    geography: st.profile.regions.join("; ") || UNKNOWN,
    promotes: [p.interest_options.join("/"), p.min_interest && `min interest ${p.min_interest}`, p.exit_after_months !== null && `exit any time after ${p.exit_after_months}m`, p.interest_time_used === "Yes" && "interest for time used", p.rollover && p.rollover !== "n/a" && `rollover: ${p.rollover}`].filter(Boolean).join("; "),
    quirks: [p.notes, ...Object.entries(p.extra).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join("; "),
    evidence_status: "lender_declared_unverified",
    source_ids: "smartlink_lender_criteria",
    source_urls: st.profile.guide_link || "",
    source_pdf_pages: "",
    checked_date: meta2.checked_date,
    guide_edition: st.profile.guide_date || "",
    freshness: "Lender-declared via SmartLink; verify against written guide or BDM before matching",
    field_provenance: "SmartLink lender intake",
    review_notes: "Not approved for automatic matching until a Posfin reviewer approves",
    research_product_id: `${meta2.lender_id}-${String(i + 1).padStart(2, "0")}`,
    // extra structured terms (beyond the research workbook) — BROKA capture columns
    rate_from: p.rate_from,
    rate_to: p.rate_to,
    rate_type: p.rate_basis,
    arrangement_fee_pct: p.arrangement_fee,
    exit_fee_pct: p.exit_fee,
    proc_fee_pct: p.proc_fee,
    interest_options: p.interest_options.join("; "),
    min_interest: p.min_interest,
    exit_after_months: p.exit_after_months,
    interest_time_used: p.interest_time_used,
    erc: p.erc,
    rollover: p.rollover,
    rollover_detail: p.rollover_detail,
    ltv_grid: p.ltv
  }));
}
var READBACK_STEP = LENDER_STEP_IDS.readback;

// lib/api.ts
var FORMS = ["al", "remortgage", "works", "lender"];
var MAX_BODY = 512 * 1024;
async function resolve(req, { params }) {
  const { form, token } = await params;
  if (!FORMS.includes(form)) return { error: Response.json({ error: "unknown form" }, { status: 404 }) };
  const c = await getCase(token);
  if (!c) return { error: Response.json({ error: "link not found or expired" }, { status: 404 }) };
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  return { form, token, c, sp };
}
async function readJson(req) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const j = JSON.parse(text);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}
function derivedFor(form, a) {
  if (form === "al") return { totals: computeALTotals(a) };
  if (form === "works") return { totals: computeWorksTotals(a) };
  if (form === "lender") {
    const st = buildLender(a);
    return { totals: { products: st.headline.products, max_ltv_first: st.headline.max_ltv_first, max_ltv_second: st.headline.max_ltv_second, max_ltgdv: st.headline.max_ltgdv, gaps_missing: st.gaps.missing, gaps_conflicts: st.gaps.conflicts, cases_yes: st.case_counts.yes, cases_maybe: st.case_counts.maybe, cases_no: st.case_counts.no } };
  }
  return {};
}
function crmExport(form, c, brand, ctx, draft) {
  const schema = getSchema(form, brand.id, Object.keys(c.prefill));
  const answers = flattenAnswers(schema, draft.answers, ctx);
  const derived = derivedFor(form, draft.answers);
  const totals = Object.fromEntries(Object.entries(derived.totals ?? {}).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [`total_${k}`, v]));
  return {
    schema: `posfin.smartlink.${form}.v001`,
    case_token: c.token,
    case_ref: form === "lender" ? c.ref.replace(/^PC-/, "LC-") : c.ref,
    form,
    brand: brand.id,
    flags: ctx.flags,
    status: draft.status,
    updated_at: draft.updated_at ?? null,
    submitted_at: draft.submitted_at ?? null,
    ...form === "remortgage" ? { staff_only_fields: Object.fromEntries(STAFF_ONLY_FIELDS.map((k) => [k, null])) } : {},
    answers: { ...answers, ...totals },
    ...form === "lender" ? { placed: placedExport(c, draft) } : {}
  };
}
function placedExport(c, draft) {
  const st = buildLender(draft.answers);
  const lender_id = `SL-${c.token}`;
  const checked = (draft.submitted_at ?? draft.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
  return {
    target: "PLACED lender_criteria / lender_products / lender_case_study_answers",
    verification_status: "unverified",
    matching_enabled: false,
    lender: { lender_id, name: st.profile.lender, type: st.profile.type, nacfb_patron: st.profile.nacfb, regions: st.profile.regions, borrower_types: st.profile.borrower_types, regulated_scope: st.profile.regulated_scope, charge_positions: st.profile.charge_positions, subordinate_appetite: st.profile.subordinate, contact_email: st.profile.email },
    products: placedProductRows(st, { lender_id, checked_date: checked }),
    valuation: st.valuation,
    asset_appetite: Object.fromEntries(st.appetite.assets.filter((r) => r.value).map((r) => [r.key, { value: r.value, note: r.note || null }])),
    hair_tolerance: Object.fromEntries(st.hair.rows.filter((r) => r.value).map((r) => [r.key, { value: r.value, note: r.note || null }])),
    legals: st.legals,
    case_study_signals: st.cases.filter((x) => x.answer).map((x) => ({ case_key: x.key, tag: x.tag, answer: x.answer, reason: x.reason || null, signals: x.signals, weight: x.answer === "Yes" ? 1 : x.answer === "Maybe" ? 0.5 : -1 })),
    partnership: st.partnership,
    gap_check: { missing: st.gaps.missing, conflicts: st.gaps.conflicts, from_guide: st.gaps.fromGuide, extraction_status: st.gaps.extraction.status, items: st.gaps.items.filter((i) => i.status !== "ok") },
    pilot_feedback: st.feedback
  };
}
async function currentAnswers(form, c, brand) {
  const saved = await storage().getDraft(form, c.token);
  return { saved, answers: saved?.answers ?? initialAnswers(form, c, brand) };
}
function ctxFrom(c, sp, bodyFlags) {
  const flags = flagsFor(c, sp);
  if (c.demo && bodyFlags && typeof bodyFlags === "object" && "titleInsurance" in bodyFlags) flags.titleInsurance = Boolean(bodyFlags.titleInsurance);
  return { flags };
}
function submitValidate(form, brand, c, ctx, answers) {
  const schema = getSchema(form, brand.id, Object.keys(c.prefill));
  return validateForm(schema, answers, ctx, { requireDeclaration: true });
}
function meta(c, saved) {
  const d = saved?.submitted_at ?? saved?.updated_at ?? (/* @__PURE__ */ new Date()).toISOString();
  return { date: new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }), ref: c.ref };
}
function lenderMeta(c, saved) {
  const m = meta(c, saved);
  return { ...m, ref: c.ref.replace(/^PC-/, "LC-") };
}

// lib/export/pdf.ts
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
var hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
var T = (s2) => String(s2 ?? "").replace(/\u2212/g, "-").replace(/→/g, "->").replace(/[^\x00-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u20AC]/g, "");
var M = (n2) => T(gbp(n2 ?? null, { dp: 0, blank: "" }));
function header(c, title2, right) {
  const { doc, brand, m, W } = c;
  if (brand.kind === "neutral") {
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...c.ink).text(T(title2.toUpperCase()), m, 16);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(15).setCharSpace(1.6).setTextColor(...hex("#0A1A33")).text("POSFIN", m, 15);
    const w = doc.getTextWidth("POSFIN") + 6 * 1.6 + 2.5;
    doc.setTextColor(...hex("#01BAB5")).text("CAPITAL", m + w, 15);
    doc.setCharSpace(0);
    doc.setFont("times", "bold").setFontSize(12).setTextColor(...c.ink).text(T(title2), m, 22);
  }
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90, 105, 125);
  right.forEach((r, i) => doc.text(T(r), W - m, 11 + i * 4.6, { align: "right" }));
  doc.setDrawColor(...c.accent).setLineWidth(0.8).line(m, 26, W - m, 26);
}
function footer(c, note) {
  const { doc, brand, m, W, H: H2 } = c;
  const n2 = doc.getNumberOfPages();
  for (let i = 1; i <= n2; i++) {
    doc.setPage(i);
    doc.setDrawColor(221, 227, 235).setLineWidth(0.2).line(m, H2 - 12, W - m, H2 - 12);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(110, 120, 135);
    doc.text(T(note), m, H2 - 8);
    if (brand.kind !== "neutral") doc.text(T(POSFIN_FOOTER), m, H2 - 4.5);
    doc.text(`Page ${i} of ${n2}`, W - m, H2 - 8, { align: "right" });
  }
}
function kpis(c, y, tiles) {
  const { doc, m, W } = c;
  const gap = 3;
  const w = (W - 2 * m - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value, neg], i) => {
    const x = m + i * (w + gap);
    doc.setFillColor(...i === 0 ? c.ink : [244, 246, 249]).roundedRect(x, y, w, 17, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...i === 0 ? [180, 195, 215] : [100, 115, 135]).text(T(label.toUpperCase()), x + 4, y + 5.5);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...neg ? [180, 35, 24] : i === 0 ? [255, 255, 255] : c.ink).text(T(value), x + 4, y + 13);
  });
  return y + 17;
}
function table(c, y, title2, head2, body, foot, numericCols, opts = {}) {
  const { doc, m } = c;
  doc.setFont("times", "bold").setFontSize(11).setTextColor(...c.ink).text(T(title2), opts.x ?? m, y + 4);
  const styles = {};
  numericCols.forEach((i) => styles[i] = { halign: "right" });
  Object.entries(opts.colWidths ?? {}).forEach(([k, v]) => styles[+k] = { ...styles[+k] ?? {}, cellWidth: v });
  autoTable(doc, {
    startY: y + 6,
    margin: { left: opts.x ?? m, right: opts.width ? c.W - (opts.x ?? m) - opts.width : m, bottom: 16, top: 14 },
    tableWidth: opts.width ?? "auto",
    head: [head2.map(T)],
    body: body.length ? body : [[{ content: "None declared", colSpan: head2.length, styles: { textColor: [120, 130, 145], fontStyle: "italic" } }]],
    foot: foot ? Array.isArray(foot[0]) ? foot : [foot] : void 0,
    theme: "plain",
    styles: { font: "helvetica", fontSize: opts.fontSize ?? 7.6, cellPadding: { top: opts.fontSize ? 0.9 : 1.25, bottom: opts.fontSize ? 0.9 : 1.25, left: 1.6, right: 1.6 }, textColor: c.ink, lineColor: [230, 234, 240], lineWidth: { bottom: 0.2 }, overflow: "linebreak" },
    headStyles: { fillColor: c.ink, textColor: 255, fontStyle: "bold", fontSize: 6.8 },
    footStyles: { fillColor: [230, 247, 246], textColor: c.ink, fontStyle: "bold", lineWidth: { top: 0.5 }, lineColor: c.ink },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: styles,
    didParseCell: (d) => {
      if ((d.section === "head" || d.section === "foot") && numericCols.includes(d.column.index)) d.cell.styles.halign = "right";
      opts.cellHook?.(d);
    }
  });
  return doc.lastAutoTable.finalY;
}
function ctxFor(brand) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: "Statement", creator: brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink" });
  return { doc, brand, ink: hex(brand.kind === "neutral" ? brand.colours.ink : "#0A1A33"), accent: hex(brand.kind === "neutral" ? "#9CA3AF" : "#01BAB5"), W: 297, H: 210, m: 12 };
}
function alPdf(s2, brand, meta2) {
  const c = ctxFor(brand);
  const t = s2.totals;
  header(c, "Assets & Liabilities Statement", [`Applicant: ${[s2.applicant, s2.joint].filter(Boolean).join(" & ")}`, s2.company ? `Company: ${s2.company}` : "", `Date completed: ${meta2.date}`, `Ref: ${meta2.ref}`].filter(Boolean));
  let y = kpis(c, 30, [
    ["Net worth", M(s2.summary.net), s2.summary.net < 0],
    ["Total assets", M(t.total_assets)],
    ["Total liabilities", M(t.total_liabilities)],
    ["Property equity", M(t.equity)],
    ["Portfolio LTV", T(pct(t.portfolio_ltv))],
    ["Rent / month", M(t.rent_monthly)],
    ["Commitments / month", M(t.monthly_commitments)]
  ]);
  y = table(
    c,
    y + 4,
    `Assets \u2014 Property (${s2.property.length})`,
    ["Registered owner", "Property address", "Type", "Purchased", "Value", "Rent / m", "Mortgage / m", "Lender", "Charge", "Balance", "LTV", "Equity"],
    s2.property.map((p) => [T(p.owner), T(`${p.address}${p.postcode ? ", " + p.postcode : ""}`), T(p.type), T(p.purchase_date), M(p.value), M(p.rent_monthly), M(p.mortgage_payment), T(p.lender), T(p.charge), M(p.balance), T(p.ltv === null ? "" : pct(p.ltv)), M(p.equity)]),
    ["", "Totals", "", "", M(t.property_value), M(t.property_rent), M(t.property_payments), "", "", M(t.mortgages), T(pct(t.portfolio_ltv)), M(t.equity)],
    [4, 5, 6, 9, 10, 11],
    { colWidths: { 0: 30, 1: 62 } }
  );
  if (y > 150) {
    c.doc.addPage();
    y = 14;
  }
  const half = (c.W - 2 * c.m - 6) / 2;
  const startY = y + 4;
  const startPage = c.doc.getCurrentPageInfo().pageNumber;
  const y1 = table(
    c,
    startY,
    "Assets \u2014 Other",
    ["Registered name", "Description", "Purchased", "Lender", "Value", "Owed"],
    s2.other.map((o) => [T(o.owner), T(o.description), T(o.purchase_date), T(o.lender), M(o.value), M(o.owed)]),
    ["", "Totals", "", "", M(t.other_value), M(t.other_owed)],
    [4, 5],
    { width: half, colWidths: { 0: 26, 1: 44 } }
  );
  const leftEnd = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(startPage);
  const y2 = table(
    c,
    startY,
    "Liabilities (excluding mortgages above)",
    ["Registered name", "Description", "Lender", "Rate", "Owed", "Monthly"],
    s2.liab.map((l) => [T(l.owner), T(l.description), T(l.lender), T(l.rate), M(l.balance), M(l.monthly)]),
    ["", "Totals", "", "", M(t.liab_balance), M(t.liab_monthly)],
    [4, 5],
    { x: c.m + half + 6, width: half, colWidths: { 0: 26, 1: 44 } }
  );
  const rightEnd = c.doc.getCurrentPageInfo().pageNumber;
  if (leftEnd > rightEnd) {
    c.doc.setPage(leftEnd);
    y = y1;
  } else if (rightEnd > leftEnd) {
    c.doc.setPage(rightEnd);
    y = y2;
  } else y = Math.max(y1, y2);
  if (y > 182) {
    c.doc.addPage();
    y = 14;
  }
  const sy = y + 4, sw = c.W - 2 * c.m;
  c.doc.setFillColor(244, 246, 249).roundedRect(c.m, sy, sw, 11, 2, 2, "F");
  const cells = [["Property (net of mortgages)", s2.summary.property_net], ["Other assets (net of finance)", s2.summary.other_net], ["Less liabilities", -s2.summary.liabilities], ["Net worth", s2.summary.net, true]];
  const cw = sw / cells.length;
  cells.forEach(([k, v, bold], i) => {
    const x = c.m + i * cw + 4;
    c.doc.setFont("helvetica", "bold").setFontSize(6.3).setTextColor(100, 115, 135).text(T(k.toUpperCase()), x, sy + 4.2);
    c.doc.setFont("helvetica", "bold").setFontSize(bold ? 10.5 : 9.5).setTextColor(...bold && v < 0 ? [180, 35, 24] : c.ink).text(M(v), x, sy + 9);
  });
  footer(c, "Prepared from information supplied by the applicant via SmartLink. Not verified. For lender use in assessing the application.");
  return Buffer.from(c.doc.output("arraybuffer"));
}
function worksPdf(s2, brand, meta2) {
  const c = ctxFor(brand);
  const borrower = s2.facts.find(([k]) => k === "Borrower")?.[1] ?? "";
  header(c, "Schedule of Works", [`Borrower: ${borrower}`, `Date: ${meta2.date}`, `Ref: ${meta2.ref}`]);
  let y = kpis(c, 30, [
    ["Total inc. contingency", M(s2.t.total)],
    ["Works subtotal", M(s2.t.subtotal)],
    [`Contingency ${s2.t.contingency_pct}%`, M(s2.t.contingency)],
    ["Programme", s2.t.programme_weeks ? `${s2.t.programme_weeks} weeks` : "-"],
    ["GDV", s2.t.gdv ? M(s2.t.gdv) : "-"],
    ["Works / GDV", T(pct(s2.t.cost_to_gdv))]
  ]);
  const facts = s2.facts.filter(([k]) => k !== "Borrower");
  autoTable(c.doc, {
    startY: y + 4,
    margin: { left: c.m, right: c.m },
    theme: "plain",
    body: chunkPairs(facts).map(([a, b]) => [T(a?.[0]), T(a?.[1]), T(b?.[0]), T(b?.[1])]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.05, textColor: c.ink },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 34, textColor: [90, 105, 125] }, 2: { fontStyle: "bold", cellWidth: 34, textColor: [90, 105, 125] } }
  });
  y = c.doc.lastAutoTable.finalY;
  if (s2.summary) {
    c.doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...c.ink);
    const lines = c.doc.splitTextToSize(T(s2.summary), c.W - 2 * c.m);
    c.doc.text(lines, c.m, y + 5);
    y += 3 + lines.length * 4;
  }
  y = table(
    c,
    y + 2,
    `Works (${s2.lines.length} lines)`,
    ["#", "Trade", "Description of works", "Weeks", "Cost (inc. VAT)", "% of works"],
    s2.lines.map((l) => [String(l.n), T(l.category), T(l.description), l.weeks === null ? "" : String(l.weeks), M(l.cost), T(pct(l.share))]),
    [["", "", "Works subtotal", "", M(s2.t.subtotal), "100%"], ["", "", `Contingency (${s2.t.contingency_pct}%)`, "", M(s2.t.contingency), ""], ["", "", "Total cost of works (inc. contingency)", "", M(s2.t.total), ""]],
    [3, 4, 5],
    { colWidths: { 0: 8, 1: 42, 3: 16, 4: 30, 5: 22 } }
  );
  footer(c, "Costs as supplied by the borrower, including labour and VAT. A high-level schedule for lender and valuer review; not a priced bill of quantities. Not verified.");
  return Buffer.from(c.doc.output("arraybuffer"));
}
function chunkPairs(xs) {
  const out = [];
  const half = Math.ceil(xs.length / 2);
  for (let i = 0; i < half; i++) out.push([xs[i], xs[i + half]]);
  return out;
}

// lib/export/lender-pdf.ts
var P = (x) => x === null ? "" : `${x}%`;
var range = (a, b) => a === null && b === null ? "" : `${gbpShort(a) || "?"}\u2013${gbpShort(b) || "?"}`;
function ltvCell(p) {
  if (!p.ltv_cols.some((c) => /charge/.test(c))) {
    const parts = [p.max_day1 !== null && `D1 ${p.max_day1}%`, p.max_ltgdv !== null && `GDV ${p.max_ltgdv}%`, p.max_ltc !== null && `LTC ${p.max_ltc}%`, p.key === "mezz" && p.max_ltv_first !== null && `Total ${p.max_ltv_first}%`].filter(Boolean);
    return parts.join(" \xB7 ");
  }
  return [p.max_ltv_first !== null && `1st ${p.max_ltv_first}%`, p.max_ltv_second !== null && `2nd ${p.max_ltv_second}%`].filter(Boolean).join(" \xB7 ");
}
var termCell = (p) => p.term_min === null && p.term_max === null ? "" : `${p.term_min ?? "?"}\u2013${p.term_max ?? "?"}m`;
var rateCell = (p) => p.rate_from === null ? "" : `${p.rate_from}${p.rate_to !== null ? `\u2013${p.rate_to}` : ""}%${p.rate_basis === "Per annum" ? " pa" : " pm"}`;
var exitCell = (p) => [p.exit_after_months !== null ? `after ${p.exit_after_months}m` : "", p.interest_time_used === "Yes" ? "time used" : "", p.erc && p.erc !== "None" ? `ERC: ${p.erc}` : ""].filter(Boolean).join(", ");
function tolTable(rows2) {
  const groups = [...new Set(rows2.map((r) => r.group))];
  return groups.map((g) => {
    const rs = rows2.filter((r) => r.group === g);
    const list2 = (v) => rs.filter((r) => r.value === v).map((r) => r.label + (r.note ? ` (${r.note})` : "")).join("; ");
    return [T(g), T(list2("Accept")), T(list2("Case by case")), T(list2("Decline"))];
  });
}
function tolColour(c) {
  void c;
  return (d) => {
    if (d.section !== "body") return;
    if (d.column.index === 1) d.cell.styles.textColor = [22, 97, 63];
    if (d.column.index === 2) d.cell.styles.textColor = [122, 86, 0];
    if (d.column.index === 3) d.cell.styles.textColor = [155, 28, 28];
  };
}
function lenderPdf(s2, brand, meta2) {
  const c = ctxFor(brand);
  const pr = s2.profile;
  header(c, "Lender Criteria Summary", [`Lender: ${pr.lender || "\u2014"}`, [pr.type, pr.nacfb === "Yes" ? "NACFB patron" : ""].filter(Boolean).join(" \xB7 "), `Date: ${meta2.date}`, `Ref: ${meta2.ref}`].filter(Boolean));
  let y = kpis(c, 30, [
    ["Products", String(s2.headline.products)],
    ["Loan range", s2.headline.loan_range || "\u2014"],
    ["Max LTV 1st", P(s2.headline.max_ltv_first) || "\u2014"],
    ["Max LTV 2nd", P(s2.headline.max_ltv_second) || "\u2014"],
    ["Max LTGDV", P(s2.headline.max_ltgdv) || "\u2014"],
    ["Case studies Y/M/N", `${s2.case_counts.yes} / ${s2.case_counts.maybe} / ${s2.case_counts.no}`],
    ["Open gaps", String(s2.gaps.missing + s2.gaps.conflicts), s2.gaps.missing + s2.gaps.conflicts > 0]
  ]);
  const strip = [
    ["Regions", pr.regions.join(", ")],
    ["Borrowers", pr.borrower_types.join(", ")],
    ["Scope", pr.regulated_scope],
    ["Charges", pr.charge_positions.join(", ")],
    ["Behind senior debt", pr.subordinate],
    ["Sweet spot", [gbpShort(pr.sweet_loan), pr.sweet_ltv !== null ? `${pr.sweet_ltv}% LTV` : ""].filter(Boolean).join(" at ")]
  ].filter(([, v2]) => v2);
  c.doc.setFontSize(7.4);
  let x = c.m;
  y += 5;
  for (const [k, v2] of strip) {
    const kw = c.doc.setFont("helvetica", "bold").getTextWidth(T(k + ": "));
    const vw = c.doc.setFont("helvetica", "normal").getTextWidth(T(v2));
    if (x + kw + vw > c.W - c.m) {
      x = c.m;
      y += 4.2;
    }
    c.doc.setFont("helvetica", "bold").setTextColor(100, 115, 135).text(T(k + ": "), x, y);
    c.doc.setFont("helvetica", "normal").setTextColor(...c.ink).text(T(v2), x + kw, y);
    x += kw + vw + 6;
  }
  y = table(
    c,
    y + 2,
    `Products (${s2.products.length})`,
    ["Product", "Loan", "Max leverage", "Basis", "Term", "Min interest", "Early exit", "Rate", "Arr. fee", "Interest", "Rollover / extension"],
    s2.products.map((p) => [T(p.label), T(range(p.min_loan, p.max_loan)), T(ltvCell(p)), T(p.ltv_basis), T(termCell(p)), T(p.min_interest), T(exitCell(p)), T(rateCell(p)), T(p.arrangement_fee !== null ? `${p.arrangement_fee}%` : ""), T(p.interest_options.join(", ")), T(p.rollover === "n/a" ? "" : p.rollover)]),
    null,
    [],
    { fontSize: 7, colWidths: { 9: 26, 0: 46, 1: 22, 2: 30, 3: 12, 4: 14, 5: 22, 6: 26, 7: 22, 8: 13 } }
  );
  if (y > 150) {
    c.doc.addPage();
    y = 14;
  }
  const half = (c.W - 2 * c.m - 6) / 2;
  const startY = y + 1.5;
  const startPage = c.doc.getCurrentPageInfo().pageNumber;
  const lw = (c.W - 2 * c.m - 6) * 0.42, rw = c.W - 2 * c.m - 6 - lw;
  const y1 = tableTol(c, startY, `Asset appetite \xB7 ${s2.appetite.style || "\u2014"}`, tolTable(s2.appetite.assets), { x: c.m, width: lw, colWidths: { 0: 19 } });
  const leftEnd = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(startPage);
  const y2 = tableTol(c, startY, `Hair on the deal \xB7 look-back ${s2.hair.lookback || "\u2014"}`, tolTable(s2.hair.rows), { x: c.m + lw + 6, width: rw, colWidths: { 0: 19 } });
  const rightEnd = c.doc.getCurrentPageInfo().pageNumber;
  if (leftEnd > rightEnd) {
    c.doc.setPage(leftEnd);
    y = y1;
  } else if (rightEnd > leftEnd) {
    c.doc.setPage(rightEnd);
    y = y2;
  } else y = Math.max(y1, y2);
  if (y > 110) {
    c.doc.addPage();
    y = 14;
  } else y += 6;
  const ltvRows = [];
  for (const p of s2.products) for (const [row, cells] of Object.entries(p.ltv)) {
    const vals = p.ltv_cols.filter((col) => cells?.[col]).map((col) => `${col} ${cells[col]}%`);
    if (vals.length) ltvRows.push([T(p.short), T(row), T(vals.join(" \xB7 "))]);
  }
  const s1 = c.doc.getCurrentPageInfo().pageNumber;
  const ya = table(c, y, "Leverage grid by asset (lender-declared maxima)", ["Product", "Asset / scheme", "Max leverage"], ltvRows, null, [], { width: half, colWidths: { 0: 26, 1: 40 } });
  const e1 = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(s1);
  const v = s2.valuation;
  const valRows = [
    ["Valuation types", T(v.types.join(", "))],
    v.avm[0] !== null || v.avm[1] !== null ? ["AVM", T(`to ${gbpShort(v.avm[0])} / ${P(v.avm[1])} LTV`)] : null,
    v.desktop[0] !== null || v.desktop[1] !== null ? ["Desktop", T(`to ${gbpShort(v.desktop[0])} / ${P(v.desktop[1])} LTV`)] : null,
    v.driveby[0] !== null || v.driveby[1] !== null ? ["Drive-by", T(`to ${gbpShort(v.driveby[0])} / ${P(v.driveby[1])} LTV`)] : null,
    v.conditions ? ["Conditions", T(v.conditions)] : null,
    v.panel ? ["Panel", T(v.panel)] : null,
    v.turnaround ? ["Turnaround", T(v.turnaround)] : null,
    ["Legal due diligence", T(s2.legals.dd.join("; "))],
    ["Representation", T(s2.legals.representation)],
    ["Borrower's solicitor", T(s2.legals.solicitor)],
    ["Pre-legal rounds", T(s2.legals.ple_rounds)],
    ["Valuation instructed", T(s2.legals.val_instruction)],
    ["Offer / completion", T([s2.legals.time_offer, s2.legals.time_complete].filter(Boolean).join(" / "))]
  ].filter((r) => Boolean(r && r[1]));
  const yb = table(c, y, "Valuation & legals", ["Item", "Detail"], valRows, null, [], { x: c.m + half + 6, width: half, colWidths: { 0: 38 } });
  const e2 = c.doc.getCurrentPageInfo().pageNumber;
  if (e1 > e2) {
    c.doc.setPage(e1);
    y = ya;
  } else if (e2 > e1) {
    c.doc.setPage(e2);
    y = yb;
  } else y = Math.max(ya, yb);
  if (y > 150) {
    c.doc.addPage();
    y = 14;
  }
  y = table(
    c,
    y + 4,
    `Case studies \xB7 ${s2.case_counts.yes} yes, ${s2.case_counts.maybe} maybe, ${s2.case_counts.no} no`,
    ["Scenario", "Type", "Key facts", "Answer", "Reason"],
    s2.cases.map((k) => [T(k.title), T(k.tag), T(k.facts.slice(0, 4).map(([a, b]) => `${a} ${b}`).join(" \xB7 ")), { content: T(k.answer || "\u2014"), styles: { fontStyle: "bold", textColor: k.answer === "Yes" ? [22, 97, 63] : k.answer === "No" ? [155, 28, 28] : [122, 86, 0] } }, T(k.reason)]),
    null,
    [],
    { colWidths: { 0: 62, 1: 30, 2: 82, 3: 16 } }
  );
  const rb = s2.products.filter((p) => Object.keys(p.rollover_detail).length);
  if (rb.length) {
    if (y > 170) {
      c.doc.addPage();
      y = 14;
    }
    y = table(
      c,
      y + 4,
      "Rollovers & extensions",
      ["Product", "Offered", "Max LTV", "Capital paydown", "Re-retain interest", "Fee", "Revaluation", "Max rollovers"],
      rb.map((p) => [T(p.label), T(p.rollover_offered), T(p.rollover_detail["Max LTV"] ?? ""), T(p.rollover_detail["Capital paydown"] ?? ""), T(p.rollover_detail["Re-retain interest"] ?? ""), T(p.rollover_detail["Fee"] ?? ""), T(p.rollover_detail["Revaluation"] ?? ""), T(p.rollover_detail["Max rollovers"] ?? "")]),
      null,
      [],
      { colWidths: { 0: 60 } }
    );
  }
  const pt = s2.partnership;
  if (pt.mezz || pt.loan_notes.appetite || pt.pref_shares.response || pt.meet) {
    if (y > 165) {
      c.doc.addPage();
      y = 14;
    }
    const ln = pt.loan_notes, ps = pt.pref_shares;
    y = table(c, y + 4, "Partnership & mezzanine appetite (conversation starter, not terms)", ["Topic", "Response", "Detail"], [
      ["Mezz / 2nd behind developer senior", T(pt.mezz), T([pt.ticket && `ticket ${pt.ticket}`, pt.min_deal && `min ${pt.min_deal}`].filter(Boolean).join(" \xB7 "))],
      ["Route 1 \xB7 Loan notes", T(ln.appetite), T([ln.ticket, ln.term, ln.coupon, ln.security.join(" / ")].filter(Boolean).join(" \xB7 "))],
      ["Route 2 \xB7 Preferred shares + profit share", T(ps.response), T([ps.splits.length ? `splits ${ps.splits.join(", ")}` : "", ps.pref, ps.variation].filter(Boolean).join(" \xB7 "))],
      ["Situations", T(pt.situations.join(", ")), ""],
      ["Sit-down", T(pt.meet), T(pt.notes)]
    ].filter((r) => r[1] || r[2]), null, [], { colWidths: { 0: 62, 1: 52 } });
    c.doc.setFont("helvetica", "italic").setFontSize(6.6).setTextColor(100, 115, 135).text(T(`Route 2 illustrative example shown to the lender (not an offer): ${ps.illustrative}.`), c.m, y + 4, { maxWidth: c.W - 2 * c.m });
    y += 7;
  }
  const open = s2.gaps.items.filter((i) => i.status !== "ok");
  if (open.length) {
    if (y > 170) {
      c.doc.addPage();
      y = 14;
    }
    y = table(
      c,
      y + 4,
      `Read-back & gaps \xB7 guide: ${s2.gaps.extraction.file ?? "none"} (${s2.gaps.extraction.status})`,
      ["Section", "Item", "Status", "Form", "Guide", "Page"],
      open.map((i) => [T(i.section), T(i.label), { content: T(i.status === "missing" ? "Missing" : i.status === "conflict" ? "Conflict" : "From guide"), styles: { fontStyle: "bold", textColor: i.status === "conflict" ? [155, 28, 28] : i.status === "missing" ? [122, 86, 0] : [0, 124, 120] } }, T(i.form ?? ""), T(i.guide ?? ""), T(i.page ?? "")]),
      null,
      [],
      { colWidths: { 0: 50, 1: 80, 2: 22 } }
    );
  }
  footer(c, "Lender-declared criteria via SmartLink. Unverified until checked against the written guide or a confirmed BDM response and approved by a reviewer. Not a commitment to lend.");
  return Buffer.from(c.doc.output("arraybuffer"));
}
function tableTol(c, y, title2, body, opts) {
  const start = y;
  const end = table(c, start, title2, ["Group", "Accept", "Case by case", "Decline"], body, null, [], { ...opts, fontSize: 6.1, cellHook: tolColour(c) });
  return end;
}

// lib/export/lender-xlsx.ts
import ExcelJS from "exceljs";
var NAVY = "FF0A1A33";
var TEAL = "FF007C78";
var TONE = { Accept: "FFE7F7EF", "Case by case": "FFFFF4DC", Decline: "FFFDECEA", Yes: "FFE7F7EF", Maybe: "FFFFF4DC", No: "FFFDECEA" };
var page = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
function sheet(wb, name, widths) {
  const ws = wb.addWorksheet(name, { pageSetup: page, views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  ws.columns = [{ width: 2 }, ...widths.map((w) => ({ width: w }))];
  return ws;
}
function title(ws, brand, t, sub) {
  ws.getCell("B1").value = brand.kind === "neutral" ? t.toUpperCase() : "POSFIN CAPITAL";
  ws.getCell("B1").font = { bold: true, size: 15, color: { argb: NAVY } };
  ws.getCell("B2").value = brand.kind === "neutral" ? sub : `${t} \xB7 ${sub}`;
  ws.getCell("B2").font = { size: 11, color: { argb: TEAL } };
}
function head(ws, row, cols) {
  cols.forEach((c, i) => {
    const cell = ws.getCell(row, 2 + i);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 28;
}
function rows(ws, start, data, toneCol) {
  data.forEach((r, i) => {
    const row = ws.getRow(start + i);
    r.forEach((v, j) => {
      const cell = row.getCell(2 + j);
      cell.value = v === null ? "" : v;
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFDDE3EB" } } };
    });
    if (toneCol !== void 0) {
      const v = String(r[toneCol] ?? "");
      if (TONE[v]) row.getCell(2 + toneCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONE[v] } };
    }
  });
  return start + data.length;
}
async function lenderXlsx(s2, brand, meta2) {
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink";
  const sub = `${s2.profile.lender || "Lender"} \xB7 ${meta2.date} \xB7 ${meta2.ref}`;
  let ws = sheet(wb, "Summary", [30, 22, 26, 12, 12, 18, 24, 18, 10, 24, 34]);
  title(ws, brand, "Lender Criteria Summary", sub);
  const pr = s2.profile;
  const facts = [
    ["Lender", pr.lender],
    ["Type", pr.type],
    ["NACFB patron", pr.nacfb],
    ["Regulated lending", pr.regulated_lending],
    ["Contact", pr.contact],
    ["Email", pr.email],
    ["BDM", pr.bdm],
    ["Regions", pr.regions.join(", ")],
    ["Exclusions", pr.exclusions],
    ["Borrower types", pr.borrower_types.join(", ")],
    ["Scope", pr.regulated_scope],
    ["Charge positions", pr.charge_positions.join(", ")],
    ["Behind senior debt", pr.subordinate],
    ["Product guide", [pr.guide, pr.guide_date].filter(Boolean).join(" \xB7 ")],
    ["Verification", "Lender-declared, unverified"]
  ];
  let r = 4;
  for (const [k, v2] of facts.filter(([, v3]) => v3)) {
    ws.getCell(r, 2).value = k;
    ws.getCell(r, 2).font = { bold: true, color: { argb: "FF5B6B82" } };
    ws.getCell(r, 3).value = v2;
    ws.mergeCells(r, 3, r, 8);
    r++;
  }
  r += 1;
  head(ws, r, ["Product", "Loan", "Max leverage", "Basis", "Term", "Min interest", "Early exit", "Rate", "Arr. fee", "Interest", "Rollover"]);
  rows(ws, r + 1, s2.products.map((p) => [p.label, `${p.min_loan ?? ""}\u2013${p.max_loan ?? ""}`, ltvCell(p), p.ltv_basis, termCell(p), p.min_interest, exitCell(p), rateCell(p), p.arrangement_fee !== null ? `${p.arrangement_fee}%` : "", p.interest_options.join(", "), p.rollover === "n/a" ? "" : p.rollover]));
  ws = sheet(wb, "Leverage grid", [34, 30, 14, 14, 14, 12]);
  title(ws, brand, "Leverage by asset", sub);
  head(ws, 4, ["Product", "Asset / scheme", "Col A", "Col B", "Col C", "Basis"]);
  const lg = [];
  for (const p of s2.products) {
    lg.push([p.label, "Columns \u2192", ...p.ltv_cols.concat(["", "", ""]).slice(0, 3), p.ltv_basis]);
    for (const [row, cells] of Object.entries(p.ltv)) lg.push(["", row, ...p.ltv_cols.concat(["", "", ""]).slice(0, 3).map((c) => c && cells?.[c] ? Number(cells[c]) / 100 : null), ""]);
  }
  const end = rows(ws, 5, lg);
  for (let i = 5; i < end; i++) for (const col of [4, 5, 6]) {
    const cell = ws.getCell(i, col);
    if (typeof cell.value === "number") cell.numFmt = "0%";
  }
  ws = sheet(wb, "Product terms", [34, 14, 14, 10, 10, 22, 12, 14, 10, 10, 10, 10, 10, 26, 30, 40]);
  title(ws, brand, "Product terms", sub);
  head(ws, 4, ["Product", "Min loan", "Max loan", "Term min", "Term max", "Min interest", "Exit after (m)", "Time used only", "ERC", "Rate from", "Rate to", "Arr. fee %", "Proc fee %", "Works funding", "Rollover detail", "Other"]);
  rows(ws, 5, s2.products.map((p) => [p.label, p.min_loan, p.max_loan, p.term_min, p.term_max, p.min_interest, p.exit_after_months, p.interest_time_used, p.erc, p.rate_from, p.rate_to, p.arrangement_fee, p.proc_fee, p.works, Object.entries(p.rollover_detail).map(([k, v2]) => `${k}: ${v2}`).join("; "), [p.notes, ...Object.entries(p.extra).map(([k, v2]) => `${k}: ${v2}`)].filter(Boolean).join("; ")]));
  ws = sheet(wb, "Appetite & hair", [24, 52, 16, 44]);
  title(ws, brand, "Asset appetite & hair on the deal", sub);
  ws.getCell("B3").value = `Overall: ${s2.appetite.style || "\u2014"} \xB7 Credit look-back: ${s2.hair.lookback || "\u2014"}`;
  head(ws, 4, ["Group", "Item", "Appetite", "Note"]);
  r = rows(ws, 5, s2.appetite.assets.map((a) => [a.group, a.label, a.value, a.note]), 2);
  r = rows(ws, r + 1, s2.hair.rows.map((a) => [a.group, a.label, a.value, a.note]), 2);
  if (s2.hair.auto_declines) {
    ws.getCell(r + 1, 2).value = "Automatic declines";
    ws.getCell(r + 1, 2).font = { bold: true };
    ws.getCell(r + 1, 3).value = s2.hair.auto_declines;
  }
  ws = sheet(wb, "Valuation & legals", [30, 70]);
  title(ws, brand, "Valuation & legals", sub);
  head(ws, 4, ["Item", "Detail"]);
  const v = s2.valuation;
  rows(ws, 5, [
    ["Valuation types", v.types.join(", ")],
    ["AVM max loan / LTV", `${v.avm[0] ?? ""} / ${v.avm[1] ?? ""}%`],
    ["Desktop max loan / LTV", `${v.desktop[0] ?? ""} / ${v.desktop[1] ?? ""}%`],
    ["Drive-by max loan / LTV", `${v.driveby[0] ?? ""} / ${v.driveby[1] ?? ""}%`],
    ["Conditions", v.conditions],
    ["Panel", v.panel],
    ["Turnaround", v.turnaround],
    ["Legal due diligence", s2.legals.dd.join("; ")],
    ["Representation", s2.legals.representation],
    ["Borrower's solicitor", s2.legals.solicitor],
    ["Min partners", s2.legals.min_partners],
    ["Pre-legal rounds", s2.legals.ple_rounds],
    ["Valuation instructed", s2.legals.val_instruction],
    ["Time to offer", s2.legals.time_offer],
    ["Time to complete", s2.legals.time_complete]
  ].filter(([, x]) => x && x !== " / %"));
  ws = sheet(wb, "Case studies", [36, 18, 70, 10, 40, 30]);
  title(ws, brand, "Case studies", sub);
  head(ws, 4, ["Scenario", "Type", "Key facts", "Answer", "Reason", "Signals"]);
  rows(ws, 5, s2.cases.map((k) => [k.title, k.tag, k.facts.map(([a, b]) => `${a}: ${b}`).join(" \xB7 "), k.answer, k.reason, k.signals.join(", ")]), 3);
  ws = sheet(wb, "Partnership & feedback", [36, 70]);
  title(ws, brand, "Partnership & pilot feedback", sub);
  head(ws, 4, ["Question", "Answer"]);
  const pt = s2.partnership, fb = s2.feedback;
  rows(ws, 5, [
    ["Mezz / 2nd behind developer senior debt", pt.mezz],
    ["Typical ticket", pt.ticket],
    ["Minimum deal", pt.min_deal],
    ["Route 1 \xB7 Loan notes: appetite", pt.loan_notes.appetite],
    ["Loan notes: ticket", pt.loan_notes.ticket],
    ["Loan notes: term", pt.loan_notes.term],
    ["Loan notes: target coupon", pt.loan_notes.coupon],
    ["Loan notes: security", pt.loan_notes.security.join("; ")],
    ["Route 2 \xB7 Preferred shares: response", pt.pref_shares.response],
    ["Splits (illustrative)", pt.pref_shares.splits.join(", ")],
    ["Preferred return sought", pt.pref_shares.pref],
    ["Variation", pt.pref_shares.variation],
    ["Illustrative example shown", pt.pref_shares.illustrative],
    ["Situations", pt.situations.join(", ")],
    ["How they'd like it to work", pt.notes],
    ["Sit-down", pt.meet],
    ["\u2014 Pilot feedback \u2014", ""],
    ["Overall", fb.rating],
    ["Time taken", fb.minutes],
    ["What made sense", fb.clear],
    ["What we missed", fb.missing],
    ["Confusing / too long", fb.confusing],
    ["Send deals?", fb.send_deals],
    ["Call to go through?", fb.call]
  ].filter(([k, x]) => x || k.startsWith("\u2014")));
  ws = sheet(wb, "Read-back & gaps", [30, 46, 14, 20, 20, 8]);
  title(ws, brand, "Read-back & gaps", `${sub} \xB7 guide ${s2.gaps.extraction.file ?? "none"} (${s2.gaps.extraction.status})`);
  head(ws, 4, ["Section", "Item", "Status", "Form", "Guide", "Page"]);
  rows(ws, 5, s2.gaps.items.map((i) => [i.section, i.label, i.status, i.form ?? "", i.guide ?? "", i.page ?? ""]));
  ws = wb.addWorksheet("PLACED products", { views: [{ state: "frozen", ySplit: 1 }] });
  const pl = placedProductRows(s2, { lender_id: `SL-${meta2.token}`, checked_date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) });
  if (pl.length) {
    const cols = Object.keys(pl[0]).filter((k) => !["ltv_grid", "rollover_detail"].includes(k));
    ws.columns = cols.map((k) => ({ header: k, key: k, width: Math.min(Math.max(k.length + 2, 14), 40) }));
    pl.forEach((p) => ws.addRow(Object.fromEntries(cols.map((k) => [k, p[k]]))));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// lib/export/xlsx.ts
import ExcelJS2 from "exceljs";
var NAVY2 = "FF0A1A33";
var TEAL_SOFT = "FFE6F7F6";
var GBP = '"\xA3"#,##0;[Red]-"\xA3"#,##0';
var PCT = "0.0%";
function hdr(ws, row, cols, startCol = 2, fill = NAVY2) {
  cols.forEach((c, i) => {
    const cell = ws.getCell(row, startCol + i);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 30;
}
function section(ws, row, title2, note) {
  const c = ws.getCell(row, 2);
  c.value = title2;
  c.font = { bold: true, size: 13, color: { argb: NAVY2 } };
  if (note) {
    const n2 = ws.getCell(row + 1, 2);
    n2.value = note;
    n2.font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  }
}
function totalRow(ws, row, from, to) {
  ws.getRow(row).eachCell({ includeEmpty: false }, (c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } };
    c.border = { top: { style: "medium", color: { argb: NAVY2 } } };
  });
  void from;
  void to;
}
function brandTitle(ws, brand, title2) {
  ws.getCell("B2").value = brand.kind === "neutral" ? title2.toUpperCase() : "POSFIN CAPITAL";
  ws.getCell("B2").font = { bold: true, size: 16, color: { argb: NAVY2 } };
  ws.getCell("B3").value = brand.kind === "neutral" ? "" : title2;
  ws.getCell("B3").font = { size: 12, color: { argb: "FF007C78" } };
}
async function alXlsx(s2, brand, meta2) {
  const wb = new ExcelJS2.Workbook();
  wb.creator = brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink";
  const ws = wb.addWorksheet("A&L", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 2 }, { width: 24 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 18 }, { width: 10 }];
  brandTitle(ws, brand, "Assets and Liabilities");
  ws.getCell("F5").value = "Applicant:";
  ws.getCell("G5").value = [s2.applicant, s2.joint].filter(Boolean).join(" & ");
  ws.getCell("I5").value = "Date completed:";
  ws.getCell("J5").value = meta2.date;
  ws.getCell("F6").value = "Reference:";
  ws.getCell("G6").value = meta2.ref;
  ["F5", "I5", "F6"].forEach((k) => ws.getCell(k).font = { bold: true });
  let r = 8;
  section(ws, r, "Assets \u2014 Property");
  r += 1;
  hdr(ws, r, AL_PROPERTY_COLS);
  r += 1;
  const pStart = r;
  for (const p of s2.property) {
    const row = ws.getRow(r);
    row.values = [null, p.owner, `${p.address}${p.postcode ? ", " + p.postcode : ""}`, p.type, p.purchase_date, p.value, p.rent_monthly, p.mortgage_payment, p.lender, p.charge, p.balance];
    ws.getCell(r, 12).value = { formula: `IF(K${r},K${r}/F${r},0)`, result: p.ltv ?? 0 };
    r++;
  }
  const pEnd = Math.max(r - 1, pStart);
  if (!s2.property.length) {
    ws.getCell(r, 3).value = "No property owned";
    r++;
  }
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${pStart}:F${pEnd})`, result: s2.totals.property_value };
  ws.getCell(r, 7).value = { formula: `SUM(G${pStart}:G${pEnd})`, result: s2.totals.property_rent };
  ws.getCell(r, 8).value = { formula: `SUM(H${pStart}:H${pEnd})`, result: s2.totals.property_payments };
  ws.getCell(r, 11).value = { formula: `SUM(K${pStart}:K${pEnd})`, result: s2.totals.mortgages };
  ws.getCell(r, 12).value = { formula: `IF(F${r},K${r}/F${r},0)`, result: s2.totals.portfolio_ltv ?? 0 };
  totalRow(ws, r, pStart, pEnd);
  const pTot = r;
  for (let i = pStart; i <= r; i++) {
    [6, 7, 8, 11].forEach((c) => ws.getCell(i, c).numFmt = GBP);
    ws.getCell(i, 12).numFmt = PCT;
  }
  r += 2;
  section(ws, r, "Assets \u2014 Other", "Current and savings accounts, investments, pensions, vehicles, art, collectables, business interests");
  r += 2;
  hdr(ws, r, AL_OTHER_COLS);
  r += 1;
  const oStart = r;
  for (const o of s2.other) {
    ws.getRow(r).values = [null, o.owner, o.description, o.purchase_date, o.lender, o.value, o.owed];
    r++;
  }
  const oEnd = Math.max(r - 1, oStart);
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${oStart}:F${oEnd})`, result: s2.totals.other_value };
  ws.getCell(r, 7).value = { formula: `SUM(G${oStart}:G${oEnd})`, result: s2.totals.other_owed };
  totalRow(ws, r, oStart, oEnd);
  const oTot = r;
  for (let i = oStart; i <= r; i++) [6, 7].forEach((c) => ws.getCell(i, c).numFmt = GBP);
  r += 2;
  section(ws, r, "Liabilities", "Credit cards, personal loans, bridges, director\u2019s loans, tax and other debts (mortgages shown above). Each debt over \xA310,000 itemised.");
  r += 2;
  hdr(ws, r, AL_LIAB_COLS);
  r += 1;
  const lStart = r;
  for (const l of s2.liab) {
    ws.getRow(r).values = [null, l.owner, l.description, l.lender, l.rate, l.balance, l.monthly];
    r++;
  }
  const lEnd = Math.max(r - 1, lStart);
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${lStart}:F${lEnd})`, result: s2.totals.liab_balance };
  ws.getCell(r, 7).value = { formula: `SUM(G${lStart}:G${lEnd})`, result: s2.totals.liab_monthly };
  totalRow(ws, r, lStart, lEnd);
  const lTot = r;
  for (let i = lStart; i <= r; i++) [6, 7].forEach((c) => ws.getCell(i, c).numFmt = GBP);
  r += 2;
  section(ws, r, "Summary");
  r += 1;
  const sumRows = [
    ["Total assets \u2014 property (net of mortgages)", `F${pTot}-K${pTot}`, s2.summary.property_net],
    ["Total assets \u2014 other (net of finance)", `F${oTot}-G${oTot}`, s2.summary.other_net],
    ["Total liabilities", `F${lTot}`, s2.summary.liabilities]
  ];
  const first = r;
  for (const [label, f, v] of sumRows) {
    ws.getCell(r, 9).value = label;
    ws.getCell(r, 11).value = { formula: f, result: v };
    ws.getCell(r, 11).numFmt = GBP;
    r++;
  }
  ws.getCell(r, 9).value = "Net worth";
  ws.getCell(r, 11).value = { formula: `K${first}+K${first + 1}-K${first + 2}`, result: s2.summary.net };
  ws.getCell(r, 11).numFmt = GBP;
  [9, 11].forEach((c) => {
    ws.getCell(r, c).font = { bold: true, size: 12 };
    ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } };
  });
  r += 2;
  ws.getCell(r, 2).value = "Prepared from information supplied by the applicant. Not verified.";
  ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  if (brand.kind !== "neutral") {
    ws.getCell(r + 1, 2).value = POSFIN_FOOTER;
    ws.getCell(r + 1, 2).font = { size: 9, color: { argb: "FF5B6B82" } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function worksXlsx(s2, brand, meta2) {
  const wb = new ExcelJS2.Workbook();
  const ws = wb.addWorksheet("Schedule of works", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 2 }, { width: 6 }, { width: 26 }, { width: 60 }, { width: 10 }, { width: 18 }, { width: 12 }];
  brandTitle(ws, brand, "Schedule of works");
  let r = 5;
  for (const [k, v] of s2.facts) {
    ws.getCell(r, 2).value = k;
    ws.getCell(r, 2).font = { bold: true };
    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 4).value = v;
    r++;
  }
  if (s2.summary) {
    ws.getCell(r, 2).value = "Summary";
    ws.getCell(r, 2).font = { bold: true };
    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 4).value = s2.summary;
    ws.getCell(r, 4).alignment = { wrapText: true };
    r++;
  }
  r++;
  hdr(ws, r, WORKS_COLS);
  r++;
  const start = r;
  for (const l of s2.lines) {
    ws.getRow(r).values = [null, l.n, l.category, l.description, l.weeks, l.cost];
    ws.getCell(r, 7).value = { formula: `IF($F$${start + s2.lines.length},F${r}/$F$${start + s2.lines.length},0)`, result: l.share };
    r++;
  }
  const end = Math.max(r - 1, start);
  ws.getCell(r, 4).value = "Works subtotal";
  ws.getCell(r, 6).value = { formula: `SUM(F${start}:F${end})`, result: s2.t.subtotal };
  totalRow(ws, r, start, end);
  const sub = r;
  r++;
  ws.getCell(r, 4).value = `Contingency`;
  ws.getCell(r, 5).value = s2.t.contingency_pct / 100;
  ws.getCell(r, 5).numFmt = PCT;
  ws.getCell(r, 6).value = { formula: `F${sub}*E${r}`, result: s2.t.contingency };
  r++;
  ws.getCell(r, 4).value = "Total cost of works (inc. contingency)";
  ws.getCell(r, 6).value = { formula: `F${sub}+F${r - 1}`, result: s2.t.total };
  totalRow(ws, r, start, end);
  for (let i = start; i <= r; i++) {
    ws.getCell(i, 6).numFmt = GBP;
    ws.getCell(i, 7).numFmt = PCT;
    ws.getCell(i, 4).alignment = { wrapText: true };
  }
  r += 2;
  const vals = [["Value today", s2.t.current_value], ["Value after works (GDV)", s2.t.gdv], ["Uplift", s2.t.uplift]];
  for (const [k, v] of vals) if (v !== null) {
    ws.getCell(r, 4).value = k;
    ws.getCell(r, 6).value = v;
    ws.getCell(r, 6).numFmt = GBP;
    r++;
  }
  if (s2.t.cost_to_gdv !== null) {
    ws.getCell(r, 4).value = "Total works / GDV";
    ws.getCell(r, 6).value = s2.t.cost_to_gdv;
    ws.getCell(r, 6).numFmt = PCT;
    r++;
  }
  r++;
  ws.getCell(r, 2).value = `Prepared ${meta2.date} \xB7 Ref ${meta2.ref} \xB7 Costs as supplied by the borrower, including labour and VAT. Not verified.`;
  ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  if (brand.kind !== "neutral") {
    ws.getCell(r + 1, 2).value = POSFIN_FOOTER;
    ws.getCell(r + 1, 2).font = { size: 9, color: { argb: "FF5B6B82" } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// lib/notify.ts
async function notifySubmission(info) {
  console.info(`[smartlink] submitted form=${info.form}`);
  return { status: "todo" };
}

// server/dispatch.ts
var JSON_HEADERS = { "cache-control": "no-store" };
function resultFor(form, token, brandId, sp) {
  const q = new URLSearchParams({ brand: brandId });
  const ti = sp.titleInsurance;
  if (ti !== void 0) q.set("titleInsurance", String(Array.isArray(ti) ? ti[0] : ti));
  if (form === "al") return { href: `/al/${token}/statement?${q}`, label: "View your A&L statement" };
  if (form === "works") return { href: `/works/${token}/statement?${q}`, label: "View the schedule" };
  if (form === "lender") return { href: `/lender/${token}/summary?${q}`, label: "View your criteria summary" };
  return { href: `/remortgage/${token}/summary?${q}`, label: "View a summary of your answers" };
}
async function getDraft(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const sp = r.sp;
  const loaded = await loadForm(r.form, r.token, sp);
  if (!loaded) return Response.json({ error: "link not found or expired" }, { status: 404 });
  let step = loaded.draft.step;
  const stepParam = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  if (loaded.c.demo && stepParam) {
    const idx = stepParam === "review" ? loaded.schema.steps.length : loaded.schema.steps.findIndex((s2) => s2.id === stepParam);
    if (idx >= 0) step = idx;
  }
  const result = resultFor(r.form, r.token, loaded.brand.id, sp);
  const ref = r.form === "lender" ? loaded.c.ref.replace(/^PC-/, "LC-") : loaded.c.ref;
  const boot = {
    case: { ref, demo: loaded.c.demo, flags: loaded.c.flags },
    draft: loaded.saved ? { answers: loaded.saved.answers, step: loaded.saved.step, status: loaded.saved.status, version: loaded.saved.version, updated_at: loaded.saved.updated_at, submitted_at: loaded.saved.submitted_at ?? null } : null,
    brandId: loaded.brand.id,
    flags: loaded.flags,
    prefillSources: loaded.prefillSources,
    initial: { answers: loaded.draft.answers, step, status: loaded.draft.status },
    resultHref: result.href,
    resultLabel: result.label
  };
  return Response.json(
    { case: { ref: r.c.ref, demo: r.c.demo, flags: r.c.flags }, draft: loaded.saved, boot },
    { headers: JSON_HEADERS }
  );
}
async function putDraft(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "invalid body" }, { status: 400 });
  const prev = await storage().getDraft(r.form, r.token);
  if (prev?.status === "submitted") return Response.json({ error: "already submitted" }, { status: 409 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const answers = body.answers;
  const step = Number.isFinite(Number(body.step)) ? Number(body.step) : 0;
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step, derived: derivedFor(r.form, answers), export: crmExport(r.form, r.c, brand, c2, { answers, status: "draft" }) });
    return Response.json({ ok: true, version: saved.version, updated_at: saved.updated_at }, { headers: JSON_HEADERS });
  } catch (e) {
    console.error(`[smartlink] save failed form=${r.form}: ${e.message}`);
    if (isStorageUnavailable(e)) return Response.json({ error: "storage unavailable" }, { status: 503, headers: JSON_HEADERS });
    return Response.json({ error: "save failed" }, { status: 500 });
  }
}
async function postSubmit(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return Response.json({ error: "invalid body" }, { status: 400 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  const answers = { ...body.answers, declaration_at: (/* @__PURE__ */ new Date()).toISOString() };
  if (r.form === "remortgage") answers.answers_accurate = answers.declaration_accepted === true;
  const issues = submitValidate(r.form, brand, r.c, c2, answers);
  if (hasErrors(issues)) return Response.json({ ok: false, issues: issues.filter((i) => i.level === "error").slice(0, 50) }, { status: 422 });
  const exp = crmExport(r.form, r.c, brand, c2, { answers, status: "submitted", submitted_at: answers.declaration_at });
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step: 0, status: "submitted", derived: derivedFor(r.form, answers), export: exp });
    try {
      await notifySubmission({ form: r.form });
    } catch (e) {
      console.error(`[smartlink] notify failed form=${r.form}: ${e.message}`);
    }
    return Response.json({ ok: true, submitted_at: saved.submitted_at });
  } catch (e) {
    console.error(`[smartlink] submit failed form=${r.form}: ${e.message}`);
    if (isStorageUnavailable(e)) return Response.json({ error: "storage unavailable" }, { status: 503, headers: JSON_HEADERS });
    return Response.json({ error: "submit failed" }, { status: 500 });
  }
}
async function getExport(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const body = crmExport(r.form, r.c, brand, ctxFrom(r.c, r.sp), { answers, status: saved?.status ?? "draft", updated_at: saved?.updated_at, submitted_at: saved?.submitted_at });
  return Response.json(body, { headers: { "cache-control": "no-store", "content-disposition": `inline; filename="${r.form}_${r.token}_crm.json"` } });
}
async function getPdf(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.form === "remortgage") return Response.json({ error: "not available" }, { status: 404 });
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const m = r.form === "lender" ? lenderMeta(r.c, saved) : meta(r.c, saved);
  const buf = r.form === "al" ? alPdf(buildAL(answers), brand, m) : r.form === "lender" ? lenderPdf(buildLender(answers), brand, m) : worksPdf(buildWorks(answers), brand, m);
  const name = r.form === "al" ? "Assets_and_Liabilities" : r.form === "lender" ? "Lender_Criteria" : "Schedule_of_Works";
  const disp = r.sp.inline ? "inline" : "attachment";
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `${disp}; filename="${name}_${m.ref}.pdf"`, "cache-control": "no-store" } });
}
async function getXlsx(req, ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  if (r.form === "remortgage") return Response.json({ error: "not available" }, { status: 404 });
  const brand = resolveBrand(r.sp.brand, r.form, r.c.brand?.[r.form]);
  const { saved, answers } = await currentAnswers(r.form, r.c, brand);
  const m = r.form === "lender" ? lenderMeta(r.c, saved) : meta(r.c, saved);
  const buf = r.form === "al" ? await alXlsx(buildAL(answers), brand, m) : r.form === "lender" ? await lenderXlsx(buildLender(answers), brand, { ...m, token: r.token }) : await worksXlsx(buildWorks(answers), brand, m);
  const name = r.form === "al" ? "Assets_and_Liabilities" : r.form === "lender" ? "Lender_Criteria" : "Schedule_of_Works";
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}_${m.ref}.xlsx"`, "cache-control": "no-store" } });
}
function routeOf(url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.indexOf("forms");
  if (at >= 0 && parts.length >= at + 3 && parts.length <= at + 4) {
    return { form: parts[at + 1], token: decodeURIComponent(parts[at + 2]), action: parts[at + 3] ?? "" };
  }
  const form = url.searchParams.get("form") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!form || !token) return null;
  return { form, token: decodeURIComponent(token), action: url.searchParams.get("action") ?? "" };
}
async function dispatch(req) {
  const url = new URL(req.url);
  const route = routeOf(url);
  if (!route) return Response.json({ error: "not found" }, { status: 404 });
  const { form, token, action } = route;
  const ctx = { params: Promise.resolve({ form, token }) };
  if (!action && req.method === "GET") return getDraft(req, ctx);
  if (!action && req.method === "PUT") return putDraft(req, ctx);
  if (action === "submit" && req.method === "POST") return postSubmit(req, ctx);
  if (action === "export" && req.method === "GET") return getExport(req, ctx);
  if (action === "pdf" && req.method === "GET") return getPdf(req, ctx);
  if (action === "xlsx" && req.method === "GET") return getXlsx(req, ctx);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  return Response.json({ error: "method not allowed" }, { status: 405 });
}

// server/vercel.ts
var config = { maxDuration: 30 };
async function handler(req, res) {
  try {
    const host = header2(req, "x-forwarded-host") || header2(req, "host") || "localhost";
    const proto = header2(req, "x-forwarded-proto") || "https";
    const url = new URL(req.url || "/", `${proto}://${host}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
      else headers.set(k, v);
    }
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (chunks.length) body = Buffer.concat(chunks);
    }
    const request = new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : void 0 });
    const response = await dispatch(request);
    const buf = Buffer.from(await response.arrayBuffer());
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key === "transfer-encoding" || key === "content-length") return;
      res.setHeader(key, value);
    });
    res.setHeader("content-length", buf.length);
    res.end(buf);
  } catch (e) {
    console.error(`[smartlink] unhandled: ${e.message}`);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: "server error" }));
  }
}
function header2(req, name) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
export {
  config,
  handler as default
};

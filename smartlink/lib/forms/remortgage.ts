/**
 * Remortgage questionnaire — built at runtime from the Byron-approved spec JSON (v001, 18 Nov 2026).
 * The spec is the source of truth; this adapter only maps types, groups repeatables, applies brand
 * wording and removes internal notes from borrower-facing help text.
 */
import spec from "./remortgage.spec.json";
import type { Brand } from "@/lib/brands";
import type { Answers, Cond, Field, FieldType, FormSchema, Node, Repeater, Step } from "@/lib/engine/types";

interface SpecField {
  id: string; section: string; label: string; type: string; required: boolean;
  options: string[] | null; repeatable_group: string | null; conditional: Cond | null;
  help: string | null; placeholder: string | null; staff_only: boolean; visible_to_borrower: boolean;
  prefill: { possible: boolean; source: string | null } | null;
  addition_group?: string; source?: string; pdf?: unknown;
}
interface SpecSection { id: string; title: string; borrower_title: string; description?: string | null; conditional?: Cond }

const FIELDS: SpecField[] = [...(spec.fields as unknown as SpecField[]), ...(spec.additional_fields_not_on_questionnaire_pdf as unknown as SpecField[])];
const SECTIONS = spec.sections as unknown as SpecSection[];

/** PLE additions moved into the "Title insurance" section (shown when the case flag titleInsurance is on). */
export const TITLE_INSURANCE_GROUPS = ["A", "H", "I", "J"];
export const TITLE_INSURANCE_FLAG = "titleInsurance";
export const STAFF_ONLY_FIELDS = FIELDS.filter((f) => f.staff_only).map((f) => f.id);

const TYPE_MAP: Record<string, FieldType> = {
  text: "text", textarea: "textarea", yes_no: "yes_no", yes_no_unsure: "yes_no_unsure", file_upload: "file",
  single_choice: "choice", currency_gbp: "money", tel: "tel", checkbox: "checkbox", date: "date",
  multi_choice: "multi", yes_no_not_applicable: "yes_no_na", single_choice_with_other: "choice_other",
  number: "number", sort_code: "sort_code", bank_account_number: "account_number", email: "email",
};

/** Help overrides where the spec help is an internal note rather than borrower copy. */
const HELP_OVERRIDE: Record<string, string | null> = {
  borrower_email: "So we can send your forms for e-signature.",
  borrower_date_of_birth: "The solicitor needs this to open your file.",
  borrower_ni_number: "Optional — the solicitor may ask for it later.",
  heard_about_firm: null,
  occupiers_17_plus: "Include every occupier aged 17 or over, even if they are a family member.",
  new_lender_account_number: null,
};

/** Checkboxes whose dependants test for "no" become explicit Yes/No questions. */
const CHECKBOX_AS_YESNO = new Set(
  FIELDS.filter((f) => f.conditional && "field" in f.conditional && "equals" in f.conditional && (f.conditional as { equals: unknown }).equals === "no")
    .map((f) => (f.conditional as { field: string }).field)
    .filter((id) => FIELDS.find((x) => x.id === id)?.type === "checkbox"),
);

const REPEATERS: Record<string, { id: string; label: string; itemLabel: string; addLabel: string; min?: number; max: number }> = {
  borrower: { id: "borrowers", label: "Borrowers", itemLabel: "Borrower", addLabel: "Add another borrower", min: 1, max: 4 },
  further_charge: { id: "further_charges", label: "Other charges", itemLabel: "Charge", addLabel: "Add another charge", min: 1, max: 6 },
  occupier: { id: "occupiers", label: "Occupiers", itemLabel: "Occupier", addLabel: "Add another occupier", min: 1, max: 8 },
};

function toField(f: SpecField, brand: Brand, prefillSources: Set<string>): Field {
  let type: FieldType = TYPE_MAP[f.type] ?? "text";
  if (CHECKBOX_AS_YESNO.has(f.id)) type = "yes_no";
  if (f.id === "property_postcode") type = "postcode";
  const help = f.id in HELP_OVERRIDE ? HELP_OVERRIDE[f.id] : f.help;
  const field: Field = {
    id: f.id, label: f.label, type, required: f.required,
    help: help ?? undefined, placeholder: f.placeholder ?? undefined,
    options: f.options ?? undefined, when: f.conditional ?? undefined,
    advanced: ["borrower_phone_fax", "borrower_phone_work"].includes(f.id) || undefined,
    half: ["borrower_forenames", "borrower_surname", "first_lender_amount_owing", "first_lender_payment_date"].includes(f.id) || undefined,
    prefilled: Boolean(f.prefill?.possible && f.prefill.source && prefillSources.has(f.prefill.source)),
    meta: { pdf: f.pdf ?? null, source: f.source ?? null, addition_group: f.addition_group ?? null },
  };
  if (f.id === "heard_about_firm") {
    field.label = brand.howHeard.label;
    field.options = brand.howHeard.options;
  }
  if (f.id === "net_advance_account_in_all_borrowers_names") field.label = "Is this account in the name of all borrowers?";
  return field;
}

function nodesFor(fields: SpecField[], brand: Brand, prefill: Set<string>): Node[] {
  const out: Node[] = [];
  const seen = new Map<string, Repeater>();
  for (const f of fields) {
    const g = f.repeatable_group && REPEATERS[f.repeatable_group];
    if (g) {
      let r = seen.get(g.id);
      if (!r) {
        r = { kind: "repeater", id: g.id, label: g.label, itemLabel: g.itemLabel, addLabel: g.addLabel, min: g.min, max: g.max, fields: [], when: f.conditional ?? undefined, emptyItem: () => ({}) };
        if (g.id === "borrowers") r.summary = (it) => [it.borrower_forenames, it.borrower_surname].filter(Boolean).join(" ") || "Borrower";
        if (g.id === "occupiers") r.summary = (it) => String(it.occupier_name || "Occupier");
        if (g.id === "further_charges") r.summary = (it) => String(it.further_lender_name || "Charge");
        seen.set(g.id, r);
        out.push(r);
      }
      const fld = toField(f, brand, prefill);
      // repeater-level condition already gates the group
      if (JSON.stringify(fld.when) === JSON.stringify(r.when)) fld.when = undefined;
      r.fields.push(fld);
    } else out.push(toField(f, brand, prefill));
  }
  return out;
}

export interface RemortgageOptions { brand: Brand; prefillSources?: string[] }

export function buildRemortgageSchema({ brand, prefillSources = [] }: RemortgageOptions): FormSchema {
  const pre = new Set(prefillSources);
  const visible = FIELDS.filter((f) => !f.staff_only && f.visible_to_borrower !== false && f.id !== "answers_accurate");
  const isTI = (f: SpecField) => !!f.addition_group && TITLE_INSURANCE_GROUPS.includes(f.addition_group);
  const bySection = (id: string) => visible.filter((f) => (f.section === id || (id === "about_you" && f.section === "about_you_extras" && f.repeatable_group === "borrower")) && !isTI(f));

  const steps: Step[] = [];
  const sec = (id: string) => SECTIONS.find((s) => s.id === id)!;
  const order = ["about_you", "the_property", "current_mortgages", "the_new_loan", "who_lives_there", "about_the_property", "building_works", "rights_and_neighbours", "leasehold", "company", "purchase"];
  for (const id of order) {
    const s = sec(id);
    const nodes = nodesFor(bySection(id), brand, pre);
    if (id === "about_you") {
      // correspondence address + protocol consent ride with the borrower details
      nodes.push(...nodesFor(visible.filter((f) => f.section === "about_you_extras" && !f.repeatable_group && f.id !== "anything_else"), brand, pre));
    }
    steps.push({
      id, title: s.borrower_title, description: s.description ?? undefined, nodes,
      when: s.conditional ?? undefined,
      badge: s.id === "company" ? "Company" : s.id === "purchase" ? "Purchase" : s.id === "leasehold" ? "Leasehold" : undefined,
    });
  }
  // Title insurance (SoMo / SM1 title-indemnity additions A, H, I, J + nominated account C)
  steps.push({
    id: "title_insurance", title: "Title insurance: a few extra checks", badge: "Title insurance",
    description: "Your new loan uses title insurance instead of full legal searches. These answers let the solicitor confirm the lender’s checks in one go, without a second round of questions.",
    when: { flag: TITLE_INSURANCE_FLAG },
    nodes: nodesFor(visible.filter(isTI), brand, pre),
  });
  const na = sec("nominated_account");
  steps.push({ id: "nominated_account", title: na.borrower_title, description: na.description ?? undefined, badge: "Title insurance", when: { flag: TITLE_INSURANCE_FLAG }, nodes: nodesFor(bySection("nominated_account"), brand, pre) });
  const hf = sec("how_you_found_us");
  steps.push({ id: "how_you_found_us", title: hf.borrower_title, nodes: [...nodesFor(bySection("how_you_found_us"), brand, pre), ...nodesFor(visible.filter((f) => f.id === "anything_else"), brand, pre)] });
  const ad = sec("authority_and_declaration");
  steps.push({ id: "authority", title: ad.borrower_title, description: "We’ll prepare the solicitor’s questionnaire and a form of authority for e-signature. You will not need to print anything.", nodes: nodesFor(bySection("authority_and_declaration"), brand, pre) });

  steps.forEach((s, i) => (s.kicker = `Section ${i + 1}`));
  return {
    id: "remortgage",
    title: "Remortgage questionnaire",
    steps,
    declaration: { text: "I confirm that the answers I have given are complete and accurate, as far as I know.", nameLabel: "Type your full name" },
  };
}

/** Map a case's CRM prefill dictionary (keyed by spec prefill.source) to initial answers. */
export function remortgagePrefill(prefill: Record<string, unknown>, brand: Brand): Answers {
  const a: Answers = {};
  const borrower: Record<string, unknown> = {};
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

export const REMORTGAGE_SPEC_VERSION = spec.version;
export const REMORTGAGE_FIELDS = FIELDS;

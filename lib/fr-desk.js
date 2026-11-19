import { buildWhatsApp, luhnOk, publicSiteOrigin, whatsappMessage } from "./fr-factfind.js";

export const STATEMENT_MONTHS = 6;

export const STAGES = [
  { id: "nouveau", fr: "Nouveau lead", en: "New lead" },
  { id: "envoye", fr: "Fact find envoyé", en: "Fact find sent" },
  { id: "releves", fr: "Relevés bancaires reçus", en: "Bank statements received" },
  { id: "complet", fr: "Dossier complet", en: "File complete" },
  { id: "preteur", fr: "Envoyé au prêteur", en: "Sent to the lender" },
  { id: "offre", fr: "Offre", en: "Offer" },
  { id: "finance", fr: "Financé", en: "Funded" },
];

export const OUICAP_FIELDS = [
  { key: "company_name", fr: "Nom légal", en: "Legal name" },
  { key: "fr.siren", fr: "SIREN", en: "SIREN" },
  { key: "fr.legal_form", fr: "Forme juridique", en: "Legal form" },
  { key: "business_phone", fr: "Téléphone professionnel", en: "Business phone" },
  { key: "business_street", fr: "Rue de l'entreprise", en: "Business street" },
  { key: "business_town", fr: "Ville", en: "Town" },
  { key: "business_postcode", fr: "Code postal", en: "Postcode" },
  { key: "ownership_start_date", fr: "Date de prise de contrôle", en: "Ownership date" },
  { key: "purpose", fr: "Objectif des fonds", en: "Purpose of funds" },
  { key: "monthly_revenue_eur", fr: "Revenu mensuel moyen", en: "Average monthly revenue" },
  { key: "loan_amount", fr: "Montant demandé", en: "Amount requested" },
  { key: "role", fr: "Poste", en: "Job title" },
  { key: "ownership_pct", fr: "% de propriété", en: "Ownership %" },
  { key: "date_of_birth", fr: "Date de naissance", en: "Date of birth" },
  { key: "home_street", fr: "Rue du domicile", en: "Home street" },
  { key: "home_town", fr: "Ville de résidence", en: "City of residence" },
  { key: "home_postcode", fr: "Code postal du domicile", en: "Home postcode" },
  { key: "phone_landline", fr: "Téléphone fixe", en: "Landline" },
];

export const ULEND_FIELDS = [
  { key: "advance_amount", fr: "Montant de l'avance", en: "Advance amount", tbc: true },
  { key: "factor_rate", fr: "Coefficient (factor rate)", en: "Factor rate", tbc: true },
  { key: "total_repayable", fr: "Total à rembourser", en: "Total repayable", tbc: true },
  { key: "monthly_turnover", fr: "Chiffre d'affaires cartes / ventes mensuel", en: "Estimated monthly card or sales turnover", tbc: true },
  { key: "holdback_pct", fr: "Retenue (%)", en: "Holdback %", tbc: true },
];

const FLEURS = {
  company_name: "Fleurs Imaginaires SCI",
  "fr.siren": "300000007",
  "fr.legal_form": "SCI",
  business_phone: "+33472000003",
  business_street: "3 Rue des Fictions",
  business_town: "Bordeaux",
  business_postcode: "33000",
  ownership_start_date: "2019-06-01",
  purpose: "Trésorerie",
  monthly_revenue_eur: 18000,
  loan_amount: 40000,
  role: "Gérant",
  ownership_pct: 100,
  date_of_birth: "1984-02-02",
  home_street: "8 Allée Imaginaire",
  home_town: "Bordeaux",
  phone_landline: "+33556000003",
};

export const TRAINING_CASES = [
  {
    id: "fr-nuages",
    token: "aa11aa11aa11aa11aa11aa11aa11aa11",
    firstName: "Camille",
    lastName: "Nuage",
    email: "camille.nuage@example.invalid",
    placeholderPhone: "+33600000001",
    company: "Boulangerie des Nuages SAS",
    siren: "100000009",
    town: "Lyon",
    lender: "ouicap",
    stage: "nouveau",
    statementMonths: [],
    answers: {},
  },
  {
    id: "fr-lune",
    token: "bb22bb22bb22bb22bb22bb22bb22bb22",
    firstName: "Hugo",
    lastName: "Lune",
    email: "hugo.lune@example.invalid",
    placeholderPhone: "+33600000002",
    company: "Atelier de la Lune SARL",
    siren: "200000008",
    town: "Nantes",
    lender: "ouicap",
    stage: "envoye",
    statementMonths: [],
    answers: { "fr.siren": "200000008", "fr.legal_form": "SARL", business_town: "Nantes" },
  },
  {
    id: "fr-fleurs",
    token: "cc33cc33cc33cc33cc33cc33cc33cc33",
    firstName: "Inès",
    lastName: "Fleur",
    email: "ines.fleur@example.invalid",
    placeholderPhone: "+33600000003",
    company: "Fleurs Imaginaires SCI",
    siren: "300000007",
    town: "Bordeaux",
    lender: "ouicap",
    stage: "releves",
    statementMonths: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    answers: FLEURS,
  },
  {
    id: "fr-cartes",
    token: "dd44dd44dd44dd44dd44dd44dd44dd44",
    firstName: "Léa",
    lastName: "Carte",
    email: "lea.carte@example.invalid",
    placeholderPhone: "+33600000004",
    company: "Cartes Fictives SASU",
    siren: "400000006",
    town: "Lille",
    lender: "ulend",
    stage: "offre",
    statementMonths: ["2026-09", "2026-10"],
    answers: { advance_amount: 20000, monthly_turnover: 15000 },
  },
];

export function stageLabel(id, lang) {
  const found = STAGES.find((stage) => stage.id === id);
  return found ? found[lang === "en" ? "en" : "fr"] : id;
}

export function productFields(lender) {
  return lender === "ulend" ? ULEND_FIELDS : OUICAP_FIELDS;
}

export function trainingById(id) {
  return TRAINING_CASES.find((item) => item.id === id) || null;
}

export function trainingByToken(token) {
  return TRAINING_CASES.find((item) => item.token === token) || null;
}

export function isTrainingToken(token) {
  return !!trainingByToken(String(token || ""));
}

function filled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function caseAnswers(item) {
  return { company_name: item.company, ...(item.answers || {}) };
}

export function missingFields(item) {
  const answers = caseAnswers(item);
  return productFields(item.lender).filter((field) => !filled(answers[field.key]));
}

export function statementStatus(item) {
  const months = Array.isArray(item.statementMonths) ? item.statementMonths : [];
  return { count: months.length, needed: STATEMENT_MONTHS, months, complete: months.length >= STATEMENT_MONTHS };
}

export function borrowerPhone(item, env = process.env) {
  const configured = String(env.TEST_BORROWER_WHATSAPP || "").trim();
  return configured || item.placeholderPhone;
}

export function agentPhone(env = process.env) {
  return String(env.FR_AGENT_WHATSAPP || "").trim();
}

export function deskOrigin(env = process.env, requestOrigin = "") {
  return publicSiteOrigin(env, requestOrigin);
}

export function caseLinks(item, origin, env = process.env) {
  const smartUrl = `${origin}/fr/fact-find?k=${encodeURIComponent(item.token)}`;
  const wa = buildWhatsApp({ phone: borrowerPhone(item, env), firstName: item.firstName, smartUrl });
  return {
    smartUrl,
    whatsappUrl: wa.ok ? wa.url : "",
    whatsappText: wa.ok ? wa.text : whatsappMessage(item.firstName, smartUrl),
    whatsappOk: wa.ok === true,
  };
}

export function presentCase(item, lang, origin, env = process.env) {
  const missing = missingFields(item);
  const statements = statementStatus(item);
  const links = caseLinks(item, origin, env);
  return {
    ...item,
    lang: lang === "en" ? "en" : "fr",
    stageLabel: stageLabel(item.stage, lang),
    lenderLabel: item.lender === "ulend" ? "ULend" : "OuiCap",
    answers: caseAnswers(item),
    fields: productFields(item.lender).map((field) => ({ ...field, value: caseAnswers(item)[field.key] ?? "", missing: !filled(caseAnswers(item)[field.key]) })),
    missing,
    gapCount: missing.length,
    statements,
    ...links,
    placeholderPhone: item.placeholderPhone,
    phoneUsed: borrowerPhone(item, env),
    agentPhone: agentPhone(env),
    training: true,
  };
}

export function trainingLoad(token) {
  const item = trainingByToken(token);
  if (!item) return null;
  const statements = statementStatus(item);
  return {
    ok: true,
    training: true,
    lead_id: item.id,
    is_test: true,
    reference: `TEST-FR-${item.id.slice(3, 7).toUpperCase()}`,
    step: statements.count ? 2 : 1,
    lang: null,
    locked: {
      first_name: item.firstName,
      last_name: item.lastName,
      email: item.email,
      mobile: item.placeholderPhone,
      company_name: item.company,
    },
    answers: caseAnswers(item),
    files: statements.months.map((month) => ({ file_name: `releve-${month}.pdf`, doc_type: "bank_statements", size_bytes: 1200 })),
  };
}

export function sirensAreValid() {
  return TRAINING_CASES.every((item) => luhnOk(item.siren));
}

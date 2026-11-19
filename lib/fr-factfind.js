// French OuiCap fact find. Shared by the browser and /api/fr-factfind.
// No Node built-ins: this file is imported by the public form.

export const CONSENT_VERSION = "fr-consent-v1-2026-11-19";
export const LANG_STORAGE_PREFIX = "posfin_fr_lang:";

export function langStorageKey(token) {
  return `${LANG_STORAGE_PREFIX}${token || "anon"}`;
}

export function toggleLang(current) {
  return current === "en" ? "fr" : "en";
}

export function resolveLang({ stored, saved } = {}) {
  if (saved === "en" || saved === "fr") return saved;
  if (stored === "en" || stored === "fr") return stored;
  return "fr";
}

export function langSwitchState(lang) {
  const en = lang === "en";
  return {
    lang: en ? "en" : "fr",
    ariaChecked: en,
    active: en ? "EN" : "FR",
    label: en ? "Language: English. Switch to French" : "Langue : français. Passer en anglais",
  };
}
export const LEGAL_FORMS = ["SAS", "SARL", "SASU", "EURL", "SCI", "SA", "EI", "micro-entrepreneur", "association"];
export const ROLES = ["Président", "Gérant", "Directeur général", "Associé", "Micro-entrepreneur", "Autre"];
export const LOCKED_KEYS = ["first_name", "last_name", "email", "mobile", "company_name"];
export const DOC_TYPES = ["bank_statements", "id", "proof_of_address"];
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_UPLOAD_BYTES = 3500000;

export const CONSENT = {
  fr: "J'autorise Posfin Capital Limited à utiliser ces informations, y compris ma date de naissance et mon adresse, pour préparer une demande de financement avec ses partenaires (dont OuiCap). Rien n'est envoyé à un prêteur depuis ce formulaire. Je peux demander l'accès ou l'effacement de mes données à enquiries@posfincapital.com.",
  en: "I authorise Posfin Capital Limited to use this information, including my date of birth and address, to prepare a finance request with its partners (including OuiCap). Nothing is sent to a lender from this form. I can ask for access or deletion at enquiries@posfincapital.com.",
};

const L = (fr, en) => ({ fr, en });

export const FIELDS = [
  { key: "company_name", stage: 2, type: "text", required: true, locked: true, max: 160, label: L("Nom légal de l'entreprise", "Company legal name") },
  { key: "trading_name", stage: 2, type: "text", required: false, max: 160, label: L("Nom commercial (facultatif)", "Trading name (optional)") },
  { key: "registration", stage: 2, type: "text", required: true, inputmode: "numeric", max: 20, label: L("SIREN (9 chiffres) ou SIRET (14 chiffres)", "SIREN (9 digits) or SIRET (14 digits)") },
  { key: "business_phone", stage: 2, type: "tel", required: true, max: 24, label: L("Téléphone professionnel", "Business phone") },
  { key: "business_street", stage: 2, type: "text", required: true, max: 160, label: L("Rue de l'entreprise", "Business street") },
  { key: "business_town", stage: 2, type: "text", required: true, max: 80, label: L("Ville", "Town / city") },
  { key: "business_postcode", stage: 2, type: "text", required: true, inputmode: "numeric", max: 5, label: L("Code postal", "Postcode") },
  { key: "legal_form", stage: 2, type: "select", required: true, options: LEGAL_FORMS, label: L("Forme juridique", "Legal form") },
  { key: "ownership_start_date", stage: 2, type: "date", required: true, label: L("Date de prise de contrôle", "Date you took ownership") },
  { key: "purpose", stage: 2, type: "textarea", required: true, max: 400, label: L("Objectif des fonds", "Purpose of funds") },
  { key: "monthly_revenue_eur", stage: 2, type: "money", required: true, label: L("Revenu mensuel moyen (€)", "Average monthly revenue (€)") },
  { key: "loan_amount", stage: 2, type: "money", required: true, label: L("Montant demandé (€)", "Amount requested (€)") },
  { key: "role", stage: 3, type: "select", required: true, options: ROLES, label: L("Poste", "Job title") },
  { key: "ownership_pct", stage: 3, type: "pct", required: true, label: L("% de propriété", "Ownership %") },
  { key: "date_of_birth", stage: 3, type: "date", required: true, dob: true, label: L("Date de naissance", "Date of birth") },
  { key: "home_street", stage: 3, type: "text", required: true, max: 160, label: L("Adresse du domicile — rue", "Home street") },
  { key: "home_town", stage: 3, type: "text", required: true, max: 80, label: L("Ville de résidence", "City of residence") },
  { key: "home_postcode", stage: 3, type: "text", required: true, inputmode: "numeric", max: 5, label: L("Code postal du domicile", "Home postcode") },
  { key: "phone_landline", stage: 3, type: "tel", required: true, max: 24, label: L("Téléphone fixe", "Landline phone") },
  { key: "consent", stage: 3, type: "bool", required: true, label: CONSENT },
];

export const COPY = {
  fr: {
    htmlLang: "fr",
    brand: "POSFIN FRANCE",
    title: "Demande de financement",
    intro: "Un lien personnel, en trois étapes. Les informations déjà connues ne sont pas redemandées.",
    stage: ["Relevés", "Entreprise", "Dirigeant"],
    stageTitle: ["Vos relevés bancaires", "Votre entreprise", "Le dirigeant"],
    stageBody: [
      "Envoyez les 6 derniers mois de relevés bancaires professionnels. PDF ou photo, rien d'autre sur cet écran.",
      "Confirmez l'entreprise et le financement. Les montants sont en euros.",
      "Ces éléments servent au dossier. Rien n'est transmis à un prêteur depuis ce formulaire.",
    ],
    hello: "Bonjour",
    known: "Déjà connu — non redemandé",
    photo: "Prendre une photo",
    file: "Choisir un PDF ou une photo",
    uploaded: "Fichiers reçus",
    noneYet: "Aucun relevé pour le moment.",
    needFile: "Ajoutez au moins un relevé pour continuer.",
    continue: "Continuer",
    back: "Retour",
    draft: "Enregistrer le brouillon",
    finish: "Enregistrer le dossier",
    saving: "Enregistrement…",
    saved: "Brouillon enregistré sur ce lien.",
    doneTitle: "C'est enregistré",
    doneBody: "Posfin France va examiner votre dossier. Rien n'a été transmis à un prêteur.",
    noToken: "Ce formulaire s'ouvre avec le lien personnel envoyé par Posfin France. Il ne crée pas de nouvelle demande.",
    test: "TEST — Vanessa Test. Données fictives. Ne pas contacter. Rien n'est envoyé à un prêteur.",
    lang: "English",
    select: "Choisir",
    optional: "facultatif",
    extra: "Pièces complémentaires (facultatif)",
    idDoc: "Pièce d'identité",
    poa: "Justificatif de domicile",
    consentNote: "Le texte enregistré est la version française.",
    err: {
      req: "Champ obligatoire",
      siren: "SIREN (9) ou SIRET (14) invalide. Retirez les espaces.",
      phone: "Numéro français attendu, par exemple 06 12 34 56 78",
      postcode: "Code postal français à 5 chiffres",
      date: "Date invalide",
      dob: "Vous devez avoir au moins 18 ans",
      pct: "Pourcentage entre 0 et 100 (utilisez une virgule ou un point)",
      money: "Montant en euros, par exemple 12 000 ou 12000,50",
      select: "Choisissez une option",
      consent: "L'autorisation est nécessaire pour enregistrer le dossier",
      statements: "Les relevés sont nécessaires avant cette étape",
      type: "PDF ou photo uniquement",
      large: "Fichier trop lourd (3,5 Mo maximum). Envoyez un relevé à la fois.",
      upload: "Envoi impossible pour le moment. Réessayez.",
      save: "Enregistrement impossible pour le moment. Réessayez.",
    },
  },
  en: {
    htmlLang: "en",
    brand: "POSFIN FRANCE",
    title: "Financing request",
    intro: "One personal link, in three stages. Details we already hold are not asked again.",
    stage: ["Statements", "Business", "Owner"],
    stageTitle: ["Your bank statements", "Your business", "The owner"],
    stageBody: [
      "Upload the last 6 months of business bank statements. PDF or photo. Nothing else on this screen.",
      "Confirm the business and the finance request. Amounts are in euros.",
      "These details complete the file. Nothing is sent to a lender from this form.",
    ],
    hello: "Hello",
    known: "Already held — not asked again",
    photo: "Take a photo",
    file: "Choose a PDF or photo",
    uploaded: "Files received",
    noneYet: "No statements yet.",
    needFile: "Add at least one statement to continue.",
    continue: "Continue",
    back: "Back",
    draft: "Save draft",
    finish: "Save the file",
    saving: "Saving…",
    saved: "Draft saved on this link.",
    doneTitle: "Saved",
    doneBody: "Posfin France will review your file. Nothing has been sent to a lender.",
    noToken: "This form opens from the personal link sent by Posfin France. It does not start a new enquiry.",
    test: "TEST — Vanessa Test. Made-up details. Do not contact. Nothing is sent to a lender.",
    lang: "Français",
    select: "Choose",
    optional: "optional",
    extra: "Extra documents (optional)",
    idDoc: "Photo ID",
    poa: "Proof of address",
    consentNote: "The recorded consent is this English text.",
    err: {
      req: "Required",
      siren: "Enter a valid SIREN (9) or SIRET (14). Spaces are removed.",
      phone: "A French number is required, for example 06 12 34 56 78",
      postcode: "French postcode, 5 digits",
      date: "Enter a valid date",
      dob: "You must be at least 18",
      pct: "A percentage from 0 to 100 (comma or dot)",
      money: "An amount in euros, for example 12000 or 12000.50",
      select: "Please choose an option",
      consent: "Authorisation is required to save the file",
      statements: "Statements are required before this stage",
      type: "PDF or photo only",
      large: "File is too large (3.5 MB maximum). Send one statement at a time.",
      upload: "Upload failed. Please try again.",
      save: "Could not save just now. Please try again.",
    },
  },
};

export function luhnOk(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function parseRegistration(raw) {
  const digits = String(raw ?? "").replace(/[\s.\u00a0-]/g, "");
  if (!/^\d{9}$|^\d{14}$/.test(digits)) return { ok: false, error: "siren" };
  const siren = digits.slice(0, 9);
  if (!luhnOk(siren)) return { ok: false, error: "siren" };
  if (digits.length === 14 && !luhnOk(digits)) return { ok: false, error: "siren" };
  return { ok: true, siren, siret: digits.length === 14 ? digits : null };
}

export function normaliseFrPhone(raw) {
  let s = String(raw ?? "").trim().replace(/[.\s()\u00a0-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(s)) s = `+33${s.slice(1)}`;
  if (/^33[1-9]\d{8}$/.test(s)) s = `+${s}`;
  if (/^\+330[1-9]\d{8}$/.test(s)) s = `+33${s.slice(4)}`;
  if (!/^\+33[1-9]\d{8}$/.test(s)) return null;
  return s;
}

export function whatsappDigits(phone) {
  const e164 = normaliseFrPhone(phone);
  if (!e164 || !/^\+33[67]\d{8}$/.test(e164)) return null;
  return e164.slice(1);
}

export function parsePostcode(raw) {
  const s = String(raw ?? "").trim().replace(/\s/g, "");
  return /^\d{5}$/.test(s) ? s : null;
}

export function parseDate(raw) {
  const s = String(raw ?? "").trim();
  let iso = s;
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) iso = `${fr[3]}-${fr[2]}-${fr[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return iso;
}

export function ageOn(iso, now = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  let age = now.getUTCFullYear() - y;
  const md = now.getUTCMonth() + 1 - m;
  if (md < 0 || (md === 0 && now.getUTCDate() < d)) age -= 1;
  return age;
}

export function parseFrAmount(raw) {
  let s = String(raw ?? "").trim().replace(/\u00a0/g, "").replace(/\s/g, "").replace(/€/g, "").replace(/eur/ig, "");
  if (!s || (s.includes(",") && s.includes("."))) return null;
  s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function splitName(first, last, full) {
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  if (f && l) return { first_name: f.slice(0, 80), last_name: l.slice(0, 80) };
  const fullS = String(full || "").trim().replace(/\s+/g, " ");
  if (!fullS) return { first_name: f.slice(0, 80), last_name: l.slice(0, 80) };
  const i = fullS.indexOf(" ");
  if (i < 0) return { first_name: (f || fullS).slice(0, 80), last_name: l.slice(0, 80) };
  return {
    first_name: (f || fullS.slice(0, i)).slice(0, 80),
    last_name: (l || fullS.slice(i + 1)).slice(0, 80),
  };
}

export function isTestLead(row) {
  const raw = row?.raw_answers || row?.answers || {};
  return raw._is_test === true || raw._is_test === "true" || row?.is_test === true || row?.source === "fr_factfind_test";
}

export function prefillFromLead(row) {
  const raw = row?.raw_answers || row?.answers || {};
  const name = splitName(raw.first_name || row?.first_name, raw.last_name || row?.last_name, row?.full_name);
  const mobile = normaliseFrPhone(raw.mobile || row?.phone || row?.mobile) || "";
  const company = String(row?.company_name || raw.company_name || "").trim();
  return {
    locked: {
      first_name: name.first_name,
      last_name: name.last_name,
      email: String(row?.email || "").trim(),
      mobile,
      company_name: company,
    },
    is_test: isTestLead(row),
  };
}

export function questionsFor(locked) {
  return FIELDS.filter((field) => !(field.locked && locked && String(locked.company_name || "").trim()));
}

export function formAnswers(raw) {
  const src = raw || {};
  return {
    company_name: src.company_name || "",
    trading_name: src.trading_name || "",
    registration: src["fr.siret"] || src["fr.siren"] || "",
    business_phone: src.business_phone || "",
    business_street: src.business_street || "",
    business_town: src.business_town || "",
    business_postcode: src.business_postcode || "",
    legal_form: src["fr.legal_form"] || "",
    ownership_start_date: src.ownership_start_date || "",
    purpose: src.purpose || "",
    monthly_revenue_eur: src.monthly_revenue_eur ?? "",
    loan_amount: src.loan_amount ?? "",
    role: src.role || "",
    ownership_pct: src.ownership_pct ?? "",
    date_of_birth: src.date_of_birth || "",
    home_street: src.home_street || "",
    home_town: src.home_town || "",
    home_postcode: src.home_postcode || "",
    phone_landline: src.phone_landline || "",
    consent: src.consent === true,
  };
}

function clip(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

export function validateStage(stage, input, ctx = {}) {
  const strict = !!ctx.strict;
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  const locked = ctx.locked || {};
  const errors = {};
  const clean = {};
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const fields = FIELDS.filter((field) => field.stage === stage && !(field.locked && String(locked.company_name || "").trim()));
  if (stage === 2 && strict && !ctx.hasStatements) errors.statements = "statements";

  for (const field of fields) {
    const raw = source[field.key];
    if (field.type === "bool") {
      if (raw === true) clean.consent = true;
      else if (strict && field.required) errors[field.key] = "consent";
      continue;
    }
    const blank = raw === undefined || raw === null || String(raw).trim() === "";
    if (blank) {
      if (strict && field.required) errors[field.key] = "req";
      continue;
    }
    if (field.key === "registration") {
      const reg = parseRegistration(raw);
      if (!reg.ok) errors[field.key] = "siren";
      else {
        clean["fr.siren"] = reg.siren;
        if (reg.siret) clean["fr.siret"] = reg.siret;
      }
      continue;
    }
    if (field.type === "tel") {
      const phone = normaliseFrPhone(raw);
      if (!phone) errors[field.key] = "phone";
      else clean[field.key] = phone;
      continue;
    }
    if (field.key === "business_postcode" || field.key === "home_postcode") {
      const pc = parsePostcode(raw);
      if (!pc) errors[field.key] = "postcode";
      else clean[field.key] = pc;
      continue;
    }
    if (field.type === "date") {
      const iso = parseDate(raw);
      if (!iso) errors[field.key] = "date";
      else if (field.dob && (ageOn(iso, now) < 18 || ageOn(iso, now) > 110)) errors[field.key] = "dob";
      else if (!field.dob && (iso > now.toISOString().slice(0, 10) || iso < "1900-01-01")) errors[field.key] = "date";
      else clean[field.key] = iso;
      continue;
    }
    if (field.type === "select") {
      const value = String(raw).trim();
      if (!field.options.includes(value)) errors[field.key] = "select";
      else if (field.key === "legal_form") clean["fr.legal_form"] = value;
      else clean[field.key] = value;
      continue;
    }
    if (field.type === "money") {
      const n = parseFrAmount(raw);
      if (n === null || n <= 0 || n > 100000000) errors[field.key] = "money";
      else clean[field.key] = n;
      continue;
    }
    if (field.type === "pct") {
      const n = parseFrAmount(raw);
      if (n === null || n < 0 || n > 100) errors[field.key] = "pct";
      else clean[field.key] = n;
      continue;
    }
    const text = clip(raw, field.max || 160);
    if (!text) {
      if (strict && field.required) errors[field.key] = "req";
    } else clean[field.key] = text;
  }

  if (stage === 2 && (clean["fr.siren"] || clean.business_phone || clean.loan_amount)) clean.currency = "EUR";
  if (Object.keys(clean).length && stage >= 2) clean.referrer = "OuiCap";
  return { clean: applyLocked(clean, locked), errors };
}

export function applyLocked(clean, locked) {
  const out = { ...clean };
  if (locked && String(locked.company_name || "").trim()) delete out.company_name;
  for (const key of ["first_name", "last_name", "email", "mobile", "_is_test", "market"]) delete out[key];
  return out;
}

export function businessReady(answers, locked) {
  const merged = { ...formAnswers(answers), company_name: locked?.company_name || answers?.company_name || "" };
  return validateStage(2, merged, { strict: true, hasStatements: true, locked }).errors;
}

export function whatsappMessage(firstName, smartUrl) {
  const name = String(firstName || "").trim();
  if (!name) return null;
  return `Bonjour ${name}, bienvenue chez Posfin France ! Pour avancer sur votre demande, merci de nous envoyer vos 6 derniers relevés bancaires professionnels via ce lien sécurisé : ${smartUrl}`;
}

export function buildWhatsApp({ phone, firstName, smartUrl }) {
  const digits = whatsappDigits(phone);
  if (!digits) return { ok: false, error: "bad_phone" };
  let url;
  try { url = new URL(smartUrl); } catch { return { ok: false, error: "bad_link" }; }
  if (url.protocol !== "https:" || !url.pathname.endsWith("/fr/fact-find")) return { ok: false, error: "bad_link" };
  const text = whatsappMessage(firstName, url.toString());
  if (!text) return { ok: false, error: "bad_name" };
  return {
    ok: true,
    phone: `+${digits}`,
    text,
    url: `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
  };
}

export function buildStaffView({ firstName, phone, token, origin }) {
  const base = String(origin || "").replace(/\/+$/, "");
  if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(base)) return { ok: false, error: "bad_origin" };
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(String(token || ""))) return { ok: false, error: "bad_token" };
  const smartUrl = `${base}/fr/fact-find?k=${encodeURIComponent(token)}`;
  const wa = buildWhatsApp({ phone, firstName, smartUrl });
  if (!wa.ok) return wa;
  return { ok: true, smart_url: smartUrl, whatsapp_url: wa.url, whatsapp_text: wa.text, phone: wa.phone };
}

export function safeFileName(name) {
  const base = String(name || "releve").split(/[/\\]/).pop();
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/_+/g, "_").slice(-80);
  return clean || "releve";
}

export function sniffUpload(bytes, claimed) {
  if (!bytes || bytes.length < 12 || bytes.length > MAX_UPLOAD_BYTES) return null;
  const b = bytes;
  const pdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  const heic = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  if (pdf && claimed === "application/pdf") return "application/pdf";
  if (jpeg && claimed === "image/jpeg") return "image/jpeg";
  if (png && claimed === "image/png") return "image/png";
  if (webp && claimed === "image/webp") return "image/webp";
  if (heic && (claimed === "image/heic" || claimed === "image/heif")) return claimed;
  return null;
}

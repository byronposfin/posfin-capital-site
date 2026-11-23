import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from "../lib/case-http.js";
import { staffList, staffLogin, staffLogout } from "../lib/case-store.js";
import { establishSession, sessionAllows } from "../lib/cockpit-store.js";
import { staffAuthMode, supabaseAccessToken } from "../lib/staff-auth.js";
import { deskOrigin, presentCase, TRAINING_CASES, trainingById } from "../lib/fr-desk.js";
import { renderFranceCase, renderFranceList, renderFranceLogin } from "../lib/fr-desk-html.js";
import { requestOrigin } from "./fr-factfind.js";

function langOf(req, posted) {
  const query = String(req.query?.lang || "");
  const raw = String(posted || query || readCookie(req, "pf_desk_lang") || "fr");
  return raw === "en" ? "en" : "fr";
}

function rememberLang(res, lang) {
  const bits = [`pf_desk_lang=${lang}`, "Path=/staff", "SameSite=Lax", "Max-Age=31536000"];
  const existing = res.getHeader("Set-Cookie");
  if (existing) res.setHeader("Set-Cookie", [].concat(existing, bits.join("; ")));
  else res.setHeader("Set-Cookie", bits.join("; "));
}

export default async function handler(req, res) {
  setPrivate(res);
  const caseId = String(req.query?.caseId || "");
  try {
    if (req.method === "POST") {
      const fields = await readFields(req);
      const lang = langOf(req, fields.lang);
      const session = readCookie(req, "pf_staff");
      if (fields.action === "logout") {
        await staffLogout(session);
        writeStaffCookie(res, req, "", 0);
        return redirect(res, "/staff/france");
      }
      const login = staffAuthMode(process.env) === "supabase"
        ? await establishSession({ email: fields.email, password: fields.password }, { env: process.env })
        : await staffLogin(String(fields.password || ""));
      if (!login || login.ok !== true || !login.session) return sendHtml(res, 401, renderFranceLogin(lang === "en" ? "That staff password was not recognised." : "Ce mot de passe staff n'est pas reconnu.", lang));
      writeStaffCookie(res, req, login.session);
      rememberLang(res, lang);
      return redirect(res, `/staff/france${caseId ? `/${encodeURIComponent(caseId)}` : ""}`);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return sendHtml(res, 405, renderFranceLogin("", "fr"));
    const lang = langOf(req);
    if (req.query?.lang === "en" || req.query?.lang === "fr") {
      rememberLang(res, lang);
      const clean = caseId ? `/staff/france/${encodeURIComponent(caseId)}` : "/staff/france";
      return redirect(res, clean);
    }
    const session = readCookie(req, "pf_staff");
    if (!session) return sendHtml(res, 401, renderFranceLogin("", lang));
    if (supabaseAccessToken(session)) {
      if (!await sessionAllows(session, { env: process.env })) return sendHtml(res, 401, renderFranceLogin(lang === "en" ? "Please sign in again." : "Merci de vous reconnecter.", lang));
    } else {
      const rows = await staffList(session);
      if (!rows) return sendHtml(res, 401, renderFranceLogin(lang === "en" ? "Please sign in again." : "Merci de vous reconnecter.", lang));
    }
    const origin = deskOrigin(process.env, requestOrigin(req));
    if (caseId) {
      const item = trainingById(caseId);
      if (!item) return sendHtml(res, 404, renderFranceLogin(lang === "en" ? "That training case is not on this desk." : "Ce dossier de formation n'est pas sur ce bureau.", lang));
      return sendHtml(res, 200, renderFranceCase(presentCase(item, lang, origin, process.env), lang));
    }
    const cases = TRAINING_CASES.map((item) => presentCase(item, lang, origin, process.env));
    return sendHtml(res, 200, renderFranceList(cases, lang));
  } catch (error) {
    console.error("[fr-desk]", error.code || "desk_failed");
    return sendHtml(res, 503, renderFranceLogin("The France desk is temporarily unavailable.", "en"));
  }
}

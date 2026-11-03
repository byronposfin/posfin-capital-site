import { renderScorecard } from "../lib/ff-finance.js?v=20261104-lender-gate";
// Staff dashboard for pipeline.web_leads. Uses ONLY the Supabase publishable key + the signed-in staff user's session.
// All data access goes through SECURITY INVOKER RPCs (public.staff_*), so Row Level Security decides what each user sees.
// No keys are stored in this file: the URL and publishable key come from GET /api/factfind?client=admin (env vars).
const $ = s => document.querySelector(s);
const STATUSES = ["new","contacted","qualified","fact_find_complete","referred","closed_won","closed_lost","spam"];
const LABEL = { new:"New", contacted:"Contacted", qualified:"Qualified", fact_find_complete:"Fact find complete", referred:"Referred", closed_won:"Closed won", closed_lost:"Closed lost", spam:"Spam" };
const SKEY = "posfin_staff_session_v1";
let CFG = null, SESSION = null, ME = null, LIST = [], CUR = null, statusFilter = "";
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const uk = d => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "";
const money = n => n == null ? "" : Number(n).toLocaleString("en-GB");
const msg = (t, k = "") => { const m = $("#lmsg"); m.textContent = t; m.className = "msg " + k; };

async function loadCfg() {
  const r = await fetch("/api/factfind?client=admin", { cache: "no-store" }); const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error("The dashboard is not configured on this deployment yet (FF_BACKEND=leads + Supabase env vars).");
  CFG = j;
}
async function auth(path, body) {
  const r = await fetch(`${CFG.supabaseUrl}/auth/v1/${path}`, { method: "POST", headers: { apikey: CFG.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || j.message || `Sign-in failed (${r.status})`); return j;
}
function saveSession(j) { SESSION = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user && j.user.email }; sessionStorage.setItem(SKEY, JSON.stringify(SESSION)); }
async function token() {
  if (SESSION && Date.now() > SESSION.expires_at - 60000) { try { saveSession(await auth("token?grant_type=refresh_token", { refresh_token: SESSION.refresh_token })); } catch { signOut(); throw new Error("Session expired. Please sign in again."); } }
  return SESSION.access_token;
}
async function rpc(fn, args = {}) {
  const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: CFG.publishableKey, Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Request failed (${r.status})`); return j;
}
function signOut() { sessionStorage.removeItem(SKEY); SESSION = null; ME = null; $("#app").classList.add("hide"); $("#login").classList.remove("hide"); $("#out").classList.add("hide"); $("#who").textContent = ""; }

async function enter() {
  ME = await rpc("staff_whoami");
  if (!ME || !ME.role) { signOut(); msg("You are signed in, but your account is not listed as active staff. Ask Byron to add you to pipeline.staff.", "bad"); return; }
  $("#login").classList.add("hide"); $("#app").classList.remove("hide"); $("#out").classList.remove("hide");
  $("#who").textContent = `${SESSION.email || ""} · ${ME.role}`;
  await Promise.all([counts(), list()]);
}
const canWrite = () => ME && ["principal","crm_operator","case_owner"].includes(ME.role);
function filters(limit = 500) {
  const v = id => $(id).value.trim() || null;
  return { p_status: statusFilter || v("#fStatus"), p_source: v("#fSource"), p_from: v("#fFrom"), p_to: v("#fTo"), p_include_test: $("#fTest").checked, p_q: v("#fQ"), p_limit: limit, p_offset: 0 };
}
async function counts() {
  const rows = await rpc("staff_web_lead_counts", { p_include_test: $("#fTest").checked }); const total = rows.reduce((a, r) => a + Number(r.n), 0);
  $("#counts").innerHTML = `<div class="cnt ${statusFilter ? "" : "on"}" data-s=""><b>${total}</b><span>All</span></div>` + rows.map(r => `<div class="cnt ${statusFilter === r.status ? "on" : ""}" data-s="${r.status}"><b>${r.n}</b><span>${LABEL[r.status]}</span></div>`).join("");
  document.querySelectorAll(".cnt").forEach(c => c.onclick = () => { statusFilter = c.dataset.s; $("#fStatus").value = statusFilter; refresh(); });
}
async function list() {
  LIST = await rpc("staff_web_leads", filters());
  $("#lcount").textContent = `${LIST.length} lead${LIST.length === 1 ? "" : "s"}${LIST.length >= 500 ? " (first 500, narrow the filters or export)" : ""}`;
  $("#rows").innerHTML = LIST.map(l => `<tr class="row ${CUR === l.id ? "sel" : ""}" data-id="${l.id}"><td>${uk(l.created_at)}</td><td>${esc(l.reference)}${l.is_test ? '<span class="tag">TEST</span>' : ""}${l.form_stage === "partial" ? '<span class="tag">partial</span>' : ""}${l.possible_duplicate_of ? '<span class="tag">dup?</span>' : ""}</td>
    <td><span class="pill ${l.status}">${LABEL[l.status]}</span></td><td>${esc(l.full_name)}</td><td>${esc(l.phone)}</td><td>${esc(l.purpose)}</td><td>${esc(l.security_postcode)}</td>
    <td class="num">${money(l.loan_amount)}</td><td class="num">Await lender terms</td><td>${esc([l.broker_tag, l.utm_source].filter(Boolean).join(" · ") || l.source)}</td><td>${l.notes_count || ""}</td></tr>`).join("") || `<tr><td colspan="11" class="muted">No leads match these filters.</td></tr>`;
  document.querySelectorAll("tr.row").forEach(tr => tr.onclick = () => detail(tr.dataset.id));
}
async function refresh() { try { await Promise.all([counts(), list()]); if (CUR) await detail(CUR); } catch (e) { alert(e.message); } }

async function detail(id) {
  CUR = id; document.querySelectorAll("tr.row").forEach(tr => tr.classList.toggle("sel", tr.dataset.id === id));
  const d = await rpc("staff_web_lead_detail", { p_id: id }); if (!d) return; const l = d.lead, a = d.answers || {};
  const F = [["Status", `<span class="pill ${l.status}">${LABEL[l.status]}</span> · form ${esc(l.form_stage)}`], ["Created", uk(l.created_at)], ["Submitted", uk(l.submitted_at)], ["Contacted", uk(l.contacted_at)],
    ["Name", esc(l.full_name)], ["Phone", l.phone ? `<a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : ""], ["Email", l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ""], ["Best time", esc(l.best_time_to_contact)],
    ["Borrower", esc(l.borrower_type)], ["Purpose", esc(l.purpose)], ["Property", esc(l.property_type)], ["Postcode", esc(l.security_postcode)],
    ["Loan / value", `£${money(l.loan_amount)} / £${money(l.property_value)} · lender terms pending`], ["Urgency", esc(l.urgency)], ["Charge", esc(l.charge_position)], ["Credit", esc(l.credit_profile)], ["Exit", esc(l.exit_strategy)],
    ["Consent", l.contact_consent ? `Yes · ${uk(l.contact_consent_at)} · ${esc(l.consent_text_version)}` : "No"],
    ["Source", esc([l.source, l.broker_tag && "broker " + l.broker_tag, l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" · "))],
    ["Duplicate?", l.possible_duplicate_of ? "Same email or phone as an earlier lead (last 90 days)" : "No"]];
  const other = Object.entries(a).filter(([k]) => !["full_name","phone","email","contact_consent","ai_call_consent","test_mode_ack"].includes(k)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("#detail").innerHTML = `<h2>${esc(l.reference)} ${l.is_test ? '<span class="tag">TEST</span>' : ""}</h2><dl>${F.map(([k, v]) => `<dt>${k}</dt><dd>${v || '<span class="muted">–</span>'}</dd>`).join("")}</dl>
    ${canWrite() ? `<div class="sec"><b>Update</b><div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><select id="dStatus">${STATUSES.map(s => `<option value="${s}" ${s === l.status ? "selected" : ""}>${LABEL[s]}</option>`).join("")}</select>
      <button class="pri" id="dSave">Save status</button><button id="dMine">${l.assigned_to === ME.user_id ? "Assigned to me" : "Assign to me"}</button></div></div>
    <div class="sec"><b>Add note</b><textarea id="dNote" maxlength="4000" placeholder="Call notes, next steps…"></textarea><button class="pri" id="dAdd" style="margin-top:6px">Add note</button></div>` : `<p class="muted sec">Read-only access.</p>`}
    <div class="sec"><b>Notes</b>${d.notes.map(n => `<div class="note">${esc(n.body).replace(/\n/g, "<br>")}<br><small>${uk(n.created_at)}</small></div>`).join("") || '<p class="muted">No notes yet.</p>'}</div>
    ${renderScorecard(a)}<div class="sec"><b>All answers</b><dl>${other}</dl></div>
    <div class="sec"><b>History</b>${d.events.map(e => `<div class="ev">${esc(e.type.replace(/_/g, " "))}${e.to ? `: ${esc(e.from ? LABEL[e.from] + " → " : "")}${esc(LABEL[e.to])}` : ""} <small>${uk(e.at)}${e.actor_role ? " · " + esc(e.actor_role) : ""}</small></div>`).join("")}</div>`;
  if (canWrite()) {
    $("#dSave").onclick = async () => { try { await rpc("staff_web_lead_update", { p_id: id, p_status: $("#dStatus").value }); await refresh(); } catch (e) { alert(e.message); } };
    $("#dMine").onclick = async () => { try { await rpc("staff_web_lead_update", { p_id: id, p_assigned_to: ME.user_id }); await refresh(); } catch (e) { alert(e.message); } };
    $("#dAdd").onclick = async () => { const b = $("#dNote").value.trim(); if (!b) return; try { await rpc("staff_web_lead_add_note", { p_id: id, p_body: b }); await refresh(); } catch (e) { alert(e.message); } };
  }
}

async function exportCsv() {
  const rows = await rpc("staff_web_leads", filters(2000));
  const cols = ["reference","status","form_stage","is_test","created_at","submitted_at","contacted_at","full_name","email","phone","best_time_to_contact","source","broker_tag","utm_source","utm_medium","utm_campaign",
    "purpose","property_type","borrower_type","security_postcode","loan_amount","property_value","urgency","charge_position","credit_profile","exit_strategy","contact_consent","contact_consent_at","consent_text_version","notes_count","possible_duplicate_of"];
  // Prefix formula-looking cells so spreadsheets do not execute them (CSV injection guard).
  const cell = v => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `posfin-web-leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$("#fStatus").innerHTML += STATUSES.map(s => `<option value="${s}">${LABEL[s]}</option>`).join("");
$("#fStatus").onchange = () => { statusFilter = $("#fStatus").value; };
$("#apply").onclick = refresh; $("#fTest").onchange = refresh; $("#csv").onclick = () => exportCsv().catch(e => alert(e.message)); $("#out").onclick = signOut;
$("#fQ").onkeydown = e => { if (e.key === "Enter") refresh(); };
$("#lf").onsubmit = async e => { e.preventDefault(); msg("Signing in…");
  try { if (!$("#pw").value) throw new Error("Enter your password, or use the sign-in link."); saveSession(await auth("token?grant_type=password", { email: $("#em").value.trim(), password: $("#pw").value })); $("#pw").value = ""; msg(""); await enter(); }
  catch (err) { msg(err.message, "bad"); } };
$("#magic").onclick = async () => { const em = $("#em").value.trim(); if (!em) return msg("Enter your email first.", "bad");
  try { await auth("otp?redirect_to=" + encodeURIComponent(location.origin + "/admin/leads"), { email: em, create_user: false }); msg("If that email belongs to a staff account, a sign-in link is on its way.", "ok"); } catch (err) { msg(err.message, "bad"); } };

(async () => {
  try { await loadCfg(); } catch (e) { msg(e.message, "bad"); $("#lf").querySelectorAll("button,input").forEach(x => x.disabled = true); return; }
  // Magic-link return: tokens arrive in the URL fragment.
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("access_token")) { saveSession({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_in: Number(h.get("expires_in")) || 3600 }); history.replaceState(null, "", location.pathname); }
  else { try { SESSION = JSON.parse(sessionStorage.getItem(SKEY) || "null"); } catch { SESSION = null; } }
  if (SESSION) enter().catch(e => { signOut(); msg(e.message, "bad"); });
})();

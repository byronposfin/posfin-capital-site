(function () {
  const DATA = "/staff/command/data";
  const $ = (sel) => document.querySelector(sel);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const seatName = { byron: "Byron", chris: "Chris", jess: "Jess", aadi: "Aadi", cai: "Cai", vanessa: "Vanessa", lizzy: "Lizzy", all: "Everyone", april: "April", social: "Social" };

  function readHash() {
    let raw = "overview";
    try {
      raw = decodeURIComponent((location.hash || "#overview").replace(/^#/, "")) || "overview";
    } catch {
      raw = "overview";
    }
    const slash = raw.indexOf("/");
    if (slash === -1) return { tab: raw, id: "" };
    return { tab: raw.slice(0, slash), id: raw.slice(slash + 1) };
  }

  const opening = readHash();
  const state = {
    tab: opening.tab,
    meetingId: opening.tab === "meetings" ? opening.id : "",
    caseId: opening.tab === "pipeline" ? opening.id : "",
    data: null,
    meetings: null,
    meetingsRequest: null,
    saveNote: "",
    noteTimer: 0,
    noteMeetingId: "",
    saveTail: Promise.resolve(),
    mode: document.body.dataset.seat === "cai" ? "cai" : document.body.dataset.seat === "jess" ? "jess" : "all",
    stage: "",
    lender: "",
    q: "",
    taskSeat: "",
    taskUrgency: "",
    taskQ: "",
    timer: 0,
  };

  function money(value) {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return esc(value);
    const sign = number < 0 ? "−" : "";
    return sign + "£" + Math.abs(number).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function count(value) {
    if (value == null || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return esc(value);
    return number.toLocaleString("en-GB");
  }

  function when(value) {
    if (!value) return "Not in this snapshot yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(value);
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(date) + " UK";
    } catch {
      return esc(value);
    }
  }

  function dayCount(value) {
    if (value == null || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return esc(value);
    const rounded = Math.round(number);
    return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  }

  function labelSeat(value) {
    const raw = String(value || "");
    if (!raw) return "—";
    return raw.split("+").map((part) => seatName[part] || part).join(" + ");
  }

  function pipelineSeatMatch(c, seat) {
    return Array.isArray(c.assigned_seats) ? c.assigned_seats.includes(seat) : String(c.assigned_seat || "").split("+").includes(seat);
  }

  function taskSeatMatch(item, seat) {
    return String(item.assigned_seat || "").split("+").includes(seat);
  }

  function isOpen(item) {
    const stage = String(item.stage || "");
    const lane = String(item.lane || "");
    if (/^(lost|completed)$/i.test(stage)) return false;
    if (/historic/i.test(lane)) return false;
    return true;
  }

  function isLive(item) {
    return /live/i.test(String(item.lane || ""));
  }

  function isUrgent(value) {
    return /^(urgent|emergency)$/i.test(String(value || ""));
  }

  function financeAllowed(data) {
    return document.body.dataset.finance === "1" && data && data.canViewFinance === true && data.seat === "byron" && data.finance;
  }

  function casesOf(data) {
    const rows = (data.pipeline && data.pipeline.cases) || [];
    if (data.seat !== "byron" || !Array.isArray(data.privateCases)) return rows.map((item) => ({ ...item, private: false }));
    const seen = new Set(rows.map((item) => item.id));
    const extra = data.privateCases.filter((item) => item && !seen.has(item.id)).map((item) => ({ ...item, private: true }));
    return rows.map((item) => ({ ...item, private: false })).concat(extra);
  }

  function lenderMap(data) {
    const map = new Map();
    const rows = (data.lenders && data.lenders.active_case_lenders) || [];
    for (const row of rows) {
      for (const id of row.case_ids || []) {
        const list = map.get(id) || [];
        if (row.lender) list.push(row.lender);
        map.set(id, list);
      }
    }
    return map;
  }

  function filteredCases(data) {
    const map = lenderMap(data);
    const query = state.q.trim().toLowerCase();
    return casesOf(data).filter((item) => {
      if (!isOpen(item)) return false;
      if (state.mode === "live" && !isLive(item)) return false;
      if (state.mode === "urgent" && !isUrgent(item.urgent)) return false;
      if (state.mode === "emergency" && String(item.urgent || "").toUpperCase() !== "EMERGENCY") return false;
      if (state.mode === "urgent-only" && String(item.urgent || "").toUpperCase() !== "URGENT") return false;
      if ((state.mode === "cai" || state.mode === "jess") && !(isLive(item) && item.whatsapp_assigned === true && pipelineSeatMatch(item, state.mode))) return false;
      if (state.stage && item.stage !== state.stage) return false;
      if (state.lender && !(map.get(item.id) || []).includes(state.lender)) return false;
      if (!query) return true;
      const hay = [item.id, item.name, item.stage, item.owner, item.product, item.next_action, item.assigned_seat, (item.assigned_seats || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function table(columns, rows, rowAttr) {
    const head = columns.map((col) => `<th scope="col">${esc(col[0])}</th>`).join("");
    const body = rows.length
      ? rows.map((row) => `<tr${rowAttr ? rowAttr(row) : ""}>${columns.map((col) => `<td>${col[1](row)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${columns.length}">None in this snapshot.</td></tr>`;
    return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function statusPill(status) {
    const value = String(status || "").replace(/_/g, " ");
    const bridge = /bridge/i.test(value);
    return `<span class="pill${bridge ? " bridge" : ""}">${esc(bridge ? "Bridge pending" : (value || "On the team"))}</span>`;
  }

  function urgentCell(value) {
    const text = value || "—";
    return `<span class="u-${esc(String(value || "").toUpperCase())}">${esc(text)}</span>`;
  }

  function threadHtml(messages) {
    if (!messages || !messages.length) return "<p class=\"empty\">No messages yet.</p>";
    return messages.map((item) => `<article class="msg"><b>${esc(seatName[item.from_agent] || item.from_agent)}</b> → ${esc(seatName[item.to_agent] || item.to_agent)} <i>${esc(when(item.created_at))}</i><br>${esc(item.message)}</article>`).join("");
  }

  function urgencyCounts(data) {
    const rows = casesOf(data).filter(isOpen);
    return {
      emergency: rows.filter((item) => String(item.urgent || "").toUpperCase() === "EMERGENCY").length,
      urgent: rows.filter((item) => String(item.urgent || "").toUpperCase() === "URGENT").length,
    };
  }

  function countButton(label, mode, value) {
    return `<article class="card"><button type="button" class="count-link" data-mode="${esc(mode)}">${esc(label)}<b>${count(value)}</b></button></article>`;
  }

  function kpiCards(data) {
    const kpis = (data.overview && data.overview.kpis) || {};
    const levels = urgencyCounts(data);
    const cards = [
      ["Open cases", count(kpis.total_open_non_private), "Non-private"],
      ["Live deals", count(kpis.live_deals), ""],
      ["Cai's assigned live deals", count(kpis.cai_assigned_live), "WhatsApp assignment"],
      ["Jess's assigned live deals", count(kpis.jess_assigned_live), "WhatsApp assignment"],
      ["Tasks", count(kpis.tasks_total), ""],
      ["Open Byron decisions", count(kpis.open_decisions), ""],
      ["Active lenders", count(kpis.active_lenders), ""],
      ["Lender timing", kpis.lender_timing_metrics_available === true ? "Live" : "Awaiting", "Deep dive"],
    ];
    const grid = cards.map(([label, value, note]) => `<article class="card">${esc(label)}<b>${value}</b>${note ? `<span>${esc(note)}</span>` : ""}</article>`).join("");
    return `<div class="grid">${grid}${countButton("Emergency", "emergency", levels.emergency)}${countButton("Urgent", "urgent-only", levels.urgent)}</div>`;
  }

  function rulesHtml(rules) {
    const list = Array.isArray(rules) ? rules : [];
    if (!list.length) return `<article class="note rule"><b>Standing rule R-001</b><p>The standing rule is not in this snapshot yet.</p></article>`;
    return list.map((rule) => {
      const emphasis = String(rule.id || "").toUpperCase() === "R-001" ? " rule" : "";
      return `<article class="note${emphasis}"><b>${esc(rule.id || "Rule")}${rule.title ? " · " + esc(rule.title) : ""}</b><p>${esc(rule.text || "")}</p>${rule.applied ? `<p>${esc(rule.applied)}</p>` : ""}<span>${esc([rule.set_by, rule.set_at].filter(Boolean).join(" · "))}</span></article>`;
    }).join("");
  }

  function overview(data) {
    const highlights = (data.overview && data.overview.highlights) || [];
    const list = highlights.length ? `<ul>${highlights.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
    return `${kpiCards(data)}${rulesHtml(data.overview && data.overview.standing_rules)}${list}<p class="meta">Snapshot ${esc(when(data.overview && data.overview.generated_at || data.freshness && data.freshness.overview))}. Signed in as ${esc(data.displayName)}.</p>`;
  }

  function hub(data) {
    const roster = data.roster || { agents: [] };
    const agents = roster.agents || [];
    const options = ["all", "lizzy", "byron", "chris", "jess", "aadi", "cai", "vanessa", "april", "social"]
      .map((id) => `<option value="${esc(id)}">${esc(seatName[id] || id)}</option>`).join("");
    return `<div class="two"><section><h2>Agents</h2>${roster.note ? `<p class="note">${esc(roster.note)}</p>` : ""}<p class="meta">Private staff Lizzys marked bridge pending are not on a live bridge.</p>${table([["Agent", (row) => esc(row.name)], ["Lane", (row) => esc(row.lane)], ["Status", (row) => statusPill(row.status)]], agents)}<h2>Ask Lizzy</h2><p class="meta">Answers use this seat's dashboard data only.</p><label for="q-ask">Question</label><textarea id="q-ask" rows="3" maxlength="2000" placeholder="For example: which live deals are waiting on Byron?"></textarea><div class="row"><button class="send" type="button" id="ask">Ask Lizzy</button><span id="ask-status" role="status"></span></div><pre class="answer" id="answer" hidden></pre></section><section><h2>Shared team thread</h2><div class="thread" id="thread">${threadHtml(data.thread)}</div><form id="composer"><label for="to-agent">To</label><select id="to-agent">${options}</select><label for="thread-text">Message</label><textarea id="thread-text" maxlength="2000" placeholder="Message the team" required></textarea><div class="row"><button class="send" type="submit" id="post">Post as ${esc(data.displayName)}</button><span id="post-status" role="status"></span></div></form></section></div>`;
  }

  const CASE_FILE = /^[A-Za-z0-9-]{6,48}$/;

  function caseFileHref(id) {
    const caseId = String(id || "");
    return CASE_FILE.test(caseId) ? `/staff/cases/${encodeURIComponent(caseId)}` : "";
  }

  function pipelineDetail(item) {
    const href = caseFileHref(item.id);
    const file = href
      ? `<p><a href="${esc(href)}">Open the case file</a></p>`
      : `<p class="meta">No staff case file for this row.</p>`;
    return `<p><button type="button" class="back" data-pipeline-back>All cases</button></p><article class="card" data-case-detail="${esc(item.id)}"><h2>${esc(item.id)} ${esc(item.name || "")}</h2><ul class="lines"><li><strong>Stage</strong> ${esc(item.stage || "—")}${item.lane ? ` · ${esc(item.lane)}` : ""}</li><li><strong>Urgency</strong> ${urgentCell(item.urgent)}</li><li><strong>Seat</strong> ${esc(labelSeat(item.assigned_seat || (item.assigned_seats || []).join("+")))}</li><li><strong>Next action</strong> ${esc(item.next_action || "—")}</li><li><strong>Owner</strong> ${esc(item.owner || item.next_action_owner || "—")}</li><li><strong>Last message</strong> ${esc(item.last_message_date || "—")} ${dayCount(item.days_since_last_message)}</li><li><strong>Loan</strong> ${esc(item.loan || "—")}</li><li><strong>Fee</strong> ${esc(item.fee || "—")}</li></ul>${file}</article>`;
  }

  function pipeline(data) {
    if (state.caseId) {
      const item = casesOf(data).find((row) => row.id === state.caseId);
      if (!item) return `<p><button type="button" class="back" data-pipeline-back>All cases</button></p><article class="note">That case is not in this snapshot.</article>`;
      return pipelineDetail(item);
    }
    const rule = (data.pipeline && data.pipeline.rule_r001) || {};
    const kpis = (data.overview && data.overview.kpis) || {};
    const levels = urgencyCounts(data);
    const caiCount = rule.cai_count != null ? rule.cai_count : kpis.cai_assigned_live;
    const jessCount = rule.jess_count != null ? rule.jess_count : kpis.jess_assigned_live;
    const modes = [
      ["all", "All open"],
      ["live", "Live deals"],
      ["urgent", "Urgent / emergency"],
      ["emergency", `Emergency (${count(levels.emergency)})`],
      ["urgent-only", `Urgent (${count(levels.urgent)})`],
      ["cai", `Cai's deals (${count(caiCount)} live)`],
      ["jess", `Jess's deals (${count(jessCount)} live)`],
    ];
    const rows = casesOf(data).filter(isOpen);
    const stages = [...new Set(rows.map((item) => item.stage).filter(Boolean))].sort();
    const lenders = ((data.lenders && data.lenders.active_case_lenders) || []).map((item) => item.lender).filter(Boolean);
    const visible = filteredCases(data);
    const pills = modes.map(([id, label]) => `<button type="button" class="mode${state.mode === id ? " on" : ""}" data-mode="${esc(id)}" aria-pressed="${state.mode === id ? "true" : "false"}">${esc(label)}</button>`).join("");
    const stageOptions = [`<option value="">All stages</option>`].concat(stages.map((stage) => `<option value="${esc(stage)}"${stage === state.stage ? " selected" : ""}>${esc(stage)}</option>`)).join("");
    const lenderOptions = [`<option value="">All lenders</option>`].concat(lenders.map((lender) => `<option value="${esc(lender)}"${lender === state.lender ? " selected" : ""}>${esc(lender)}</option>`)).join("");
    const ruleNote = rule.rule_text ? `<article class="note rule"><b>Standing rule R-001</b><p>${esc(rule.rule_text)}</p>${rule.applied ? `<p>${esc(rule.applied)}</p>` : ""}</article>` : "";
    const seatNote = state.mode === "cai" || state.mode === "jess"
      ? `<p class="meta">${esc(labelSeat(state.mode))}'s live WhatsApp deals, including deals shared with the other processing seat. Choose All open to see the whole register.</p>`
      : "";
    return `${ruleNote}<div class="row" role="group" aria-label="Pipeline view">${pills}</div>${seatNote}<div class="filters"><label for="case-search">Search cases</label><input id="case-search" type="search" value="${esc(state.q)}" placeholder="Case, owner, product or next action"><div class="row"><div><label for="stage">Stage</label><select id="stage">${stageOptions}</select></div><div><label for="lender">Lender</label><select id="lender">${lenderOptions}</select></div></div></div><p class="meta">${visible.length} shown</p>${table([
      ["Case", (row) => `<b>${esc(row.id)}</b> ${esc(row.name)}${row.private && data.seat === "byron" ? ' <span class="pill private">Private</span>' : ""}${row.whatsapp_assigned ? ' <span class="pill live">WhatsApp</span>' : ""}${row.needs_byron ? ' <span class="pill">Byron review</span>' : ""}`],
      ["Lane / stage", (row) => `${esc(row.lane || "—")}<br><span>${esc(row.stage || "—")}</span>`],
      ["Urgency", (row) => urgentCell(row.urgent)],
      ["Assigned", (row) => esc(labelSeat(row.assigned_seat || (row.assigned_seats || []).join("+")))],
      ["Product", (row) => esc(row.product || "—")],
      ["Next action", (row) => `${esc(row.next_action || "—")}<br><span>${esc(row.next_action_owner || row.owner || "")}</span>`],
      ["Last message", (row) => `${esc(row.last_message_date || "—")}<br><span>${dayCount(row.days_since_last_message)}</span>`],
      ["Loan / fee", (row) => `${esc(row.loan || "—")}<br><span>${esc(row.fee || "")}</span>`],
    ], visible, (row) => row.id ? ` class="case-row" data-case-id="${esc(row.id)}"` : "")}`;
  }

  function tasks(data) {
    const block = data.tasks || { cards: [], byron_decisions: [], byron_next_move_deals: [] };
    const seats = ["", "cai", "jess", "byron", "chris", "aadi", "vanessa"];
    const urgencies = [...new Set((block.cards || []).map((card) => card.urgency).filter(Boolean))];
    const query = state.taskQ.trim().toLowerCase();
    const cards = (block.cards || []).filter((card) => {
      if (state.taskSeat && !taskSeatMatch(card, state.taskSeat)) return false;
      if (state.taskUrgency && card.urgency !== state.taskUrgency) return false;
      if (!query) return true;
      return [card.case, card.need, card.context, card.action, card.case_id, card.assigned_seat].join(" ").toLowerCase().includes(query);
    });
    const moves = (block.byron_next_move_deals || []).filter((item) => !state.taskSeat || taskSeatMatch(item, state.taskSeat));
    const withheld = block.private_cards_withheld > 0 ? `<p class="note">Some private task cards are withheld from this view.</p>` : "";
    const seatOptions = seats.map((seat) => `<option value="${esc(seat)}"${seat === state.taskSeat ? " selected" : ""}>${esc(seat ? labelSeat(seat) : "All seats")}</option>`).join("");
    const urgencyOptions = [`<option value="">All priorities</option>`].concat(urgencies.map((item) => `<option value="${esc(item)}"${item === state.taskUrgency ? " selected" : ""}>${esc(item)}</option>`)).join("");
    const decisions = (block.byron_decisions || []).map((item) => `<details class="card"><summary><b>${esc(item.title || "Decision")}</b></summary><p>${esc(item.detail || "")}</p></details>`).join("") || `<p class="empty">No open decisions in this snapshot.</p>`;
    return `<h2>${esc(block.sheet_title || "Task cards")}</h2>${withheld}<div class="row"><label for="task-seat">Seat</label><select id="task-seat">${seatOptions}</select><label for="task-urgency">Priority</label><select id="task-urgency">${urgencyOptions}</select></div><label for="task-search">Search tasks</label><input id="task-search" type="search" value="${esc(state.taskQ)}" placeholder="Case, need or action">${table([
      ["#", (row) => esc(row.n ?? "—")],
      ["Case", (row) => `<b>${esc(row.case || row.case_id || "—")}</b>`],
      ["Needed", (row) => esc(row.need || "—")],
      ["Context", (row) => esc(row.context || "—")],
      ["Action", (row) => esc(row.action || "—")],
      ["Priority", (row) => urgentCell(row.urgency)],
      ["Assigned", (row) => esc(labelSeat(row.assigned_seat))],
    ], cards)}<h2>Open Byron decisions</h2>${decisions}<h2>Live deals where the next move is Byron's</h2>${table([
      ["Case", (row) => `<b>${esc(row.id)}</b> ${esc(row.name)}`],
      ["Urgency", (row) => urgentCell(row.urgent)],
      ["Next action", (row) => esc(row.next_action || "—")],
      ["Assigned", (row) => esc(labelSeat(row.assigned_seat))],
    ], moves)}`;
  }

  function looseList(title, rows) {
    if (!rows || !rows.length) return "";
    return `<h2>${esc(title)}</h2><ul>${rows.map((row) => `<li><b>${esc(row.name)}</b>${row.status ? " · " + esc(row.status) : ""}${row.note ? " — " + esc(row.note) : ""}</li>`).join("")}</ul>`;
  }

  function metricText(value) {
    if (value == null || value === "") return "—";
    if (Array.isArray(value)) return esc(value.join(", "));
    return esc(value);
  }

  function lenders(data) {
    const block = data.lenders || { active_case_lenders: [], source_status: {}, deep_dive_metrics: null };
    const dive = block.deep_dive_metrics;
    const status = block.source_status || {};
    let diveHtml = `<article class="note"><b>Lender timing metrics are not in this snapshot yet.</b> No figures are estimated here.</article>`;
    if (dive && Array.isArray(dive.lenders) && dive.lenders.length) {
      diveHtml = `<p class="meta">${esc(when(dive.as_of))}${dive.timezone ? " · " + esc(dive.timezone) : ""}${dive.internal_only ? " · Internal" : ""}</p>${dive.method ? `<p class="note">${esc(dive.method)}</p>` : ""}${table([
        ["Lender", (row) => `<b>${esc(row.name)}</b>${row.legal_entity ? `<br><span>${esc(row.legal_entity)}</span>` : ""}${row.domain ? `<br><span>${esc(row.domain)}</span>` : ""}`],
        ["Status", (row) => esc(row.status || "—")],
        ["Group", (row) => esc(row.group || "—")],
        ["Response", (row) => metricText(row.response)],
        ["Median hours", (row) => metricText(row.broka_median_h)],
        ["Days to offer", (row) => metricText(row.days_to_offer)],
        ["Offer to completion", (row) => metricText(row.offer_to_completion)],
        ["Dead air", (row) => metricText(row.dead_air)],
        ["Live cases", (row) => count(row.live_cases)],
        ["Open items", (row) => metricText(row.open_items)],
        ["Contact", (row) => metricText(row.contacts || row.role)],
      ], dive.lenders)}${looseList("Other active", dive.other_active)}${looseList("Prospects not active", dive.prospects_not_active)}${looseList("Declined recently", dive.declined_recent)}`;
    }
    return `<h2>Lender timing</h2>${status.note ? `<p class="note">${esc(status.note)}</p>` : ""}${diveHtml}<h2>Lenders on open cases</h2>${table([
      ["Lender", (row) => `<b>${esc(row.lender)}</b>`],
      ["Open cases", (row) => count(row.open_cases)],
      ["Median days since last case message", (row) => count(row.median_days_since_last_case_message)],
      ["Longest", (row) => count(row.max_days_since_last_case_message)],
      ["Cases", (row) => esc((row.case_ids || []).join(" · ") || "—")],
    ], block.active_case_lenders || [])}`;
  }

  function cashBlock(title, row, extra) {
    if (!row) return "";
    return `<article class="card">${esc(title)}<b>${money(row.fee_receipts_cash)}</b><span>Fee receipts (cash)${extra ? " · " + esc(extra) : ""}</span><p class="meta">Operating costs ${money(row.business_operating_costs)} · Introducer, case and client payments ${money(row.introducer_case_client_payments)} · Operating cash after pay ${money(row.operating_cash_after_pay)}</p></article>`;
  }

  function finance(data) {
    if (!financeAllowed(data)) return `<article class="note">The P&amp;L and cash flow view is limited to Byron.</article>`;
    const block = data.finance;
    const months = block.months || [];
    const partial = block.november_2026_to_22nd && block.november_2026_to_22nd.partial ? "Partial, to 22 November" : "To 22 November";
    const excluded = (block.not_included || []).map((item) => `<li>${esc(item)}</li>`).join("");
    const sources = (block.sources || []).map((item) => `<span class="pill">${esc(item)}</span>`).join(" ");
    return `<article class="note">${esc(block.excluded_notice || "")}</article>${block.basis ? `<p>${esc(block.basis)}</p>` : ""}<div class="grid"><article class="card">Fee receipts, last 12 months<b>${money(block.last_12_months && block.last_12_months.fee_receipts_cash)}</b><span>${esc(block.last_12_months && block.last_12_months.period || "")}</span></article>${cashBlock("October 2026", block.october_2026, "")}${cashBlock("November 2026", block.november_2026_to_22nd, partial)}<article class="card">Main GBP balance, 22 November 2026<b>${money(block.balances && block.balances.main_gbp_22_nov_2026)}</b><span>Card declines for insufficient balance, October–November 2026: ${count(block.balances && block.balances.card_declines_insufficient_balance_oct_nov_2026)}</span></article></div><h2>Monthly cash</h2>${table([
      ["Month", (row) => esc(row.month || "—")],
      ["Fee receipts (cash)", (row) => money(row.fee_receipts_cash)],
      ["Fee paid by the lender", (row) => money(row.fee_lender_paid)],
      ["Fee via solicitors", (row) => money(row.fee_via_solicitors)],
      ["Fee paid by the client", (row) => money(row.fee_client_direct)],
      ["Business operating costs", (row) => money(row.business_operating_costs)],
      ["Introducer, case and client payments", (row) => money(row.introducer_case_client_payments)],
      ["Advertising", (row) => money(row.cost_advertising)],
      ["Software", (row) => money(row.cost_software)],
      ["Staff", (row) => money(row.cost_staff)],
      ["Professional", (row) => money(row.cost_professional)],
      ["Telecoms", (row) => money(row.cost_telecoms)],
      ["Operating cash after pay", (row) => `<span class="${Number(row.operating_cash_after_pay) < 0 ? "neg" : ""}">${money(row.operating_cash_after_pay)}</span>`],
    ], months)}${excluded ? `<h2>Not included</h2><ul>${excluded}</ul>` : ""}${sources ? `<p>${sources}</p>` : ""}<p class="meta">Read only. ${esc(when(block.generated_at))}</p>`;
  }

  function files(data) {
    const block = data.files || { key_sheets: [], recent_outputs: [] };
    return `<h2>Key sheets</h2>${table([
      ["Sheet", (row) => `<b>${esc(row.label || row.name)}</b><br><span>${esc(row.description || "")}</span>`],
      ["File", (row) => esc(row.name || "—")],
      ["Folder", (row) => esc(row.folder || "—")],
      ["On the snapshot", (row) => row.present === false ? "Not yet" : "Yes"],
      ["Updated", (row) => esc(when(row.updated_at))],
    ], block.key_sheets || [])}<h2>Recent outputs</h2><p class="meta">Names and dates only. Secure, raw and credential paths are left off.</p>${table([
      ["File", (row) => esc(row.name)],
      ["Folder", (row) => esc(row.folder || "—")],
      ["Category", (row) => esc(row.category || "—")],
      ["Updated", (row) => esc(when(row.updated_at))],
      ["Size", (row) => row.size_kb == null ? "—" : esc(String(row.size_kb)) + " KB"],
    ], block.recent_outputs || [])}`;
  }

  const LOCAL_KEY = "posfin-meeting-progress-v1";
  const STATUS_LABEL = { open: "Open", discussed: "Discussed", actioned: "Actioned", parked: "Parked" };

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeLocal(id, progress) {
    const all = readLocal();
    all[id] = progress;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  }

  function clearLocal(id) {
    const all = readLocal();
    delete all[id];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  }

  function meetingRecord(id) {
    const rows = (state.meetings && state.meetings.meetings) || [];
    return rows.find((item) => item.id === id) || null;
  }

  function liveMeeting() {
    return meetingRecord(state.meetingId);
  }

  function progressFrom(meeting) {
    const items = {};
    for (const section of meeting.sections || []) {
      for (const item of section.items || []) items[item.id] = { status: item.status || "open", notes: item.notes || "" };
    }
    const actions = {};
    const extra = [];
    for (const action of meeting.actions || []) {
      if (action.extra) extra.push({ id: action.id, text: action.text, owner: action.owner, done: action.done === true });
      else actions[action.id] = { done: action.done === true };
    }
    return { items, actions, extra_actions: extra };
  }

  function replaceMeeting(meeting) {
    if (!state.meetings || !meeting) return;
    state.meetings.meetings = (state.meetings.meetings || []).map((item) => item.id === meeting.id ? meeting : item);
  }

  function setSave(text) {
    state.saveNote = text;
    const el = $("#meet-save");
    if (el) el.textContent = text;
  }

  function badges(meeting) {
    const bits = [];
    if (meeting.tentative) bits.push('<span class="pill tentative">Tentative</span>');
    if (meeting.purpose_tbc) bits.push('<span class="pill tbc">Purpose TBC</span>');
    return bits.length ? `<span class="badges">${bits.join("")}</span>` : "";
  }

  function scheduleLine(meeting) {
    const bits = [meeting.when_label];
    if (meeting.next_label && meeting.next_label !== meeting.when_label) bits.push(meeting.next_label);
    if (meeting.duration_label) bits.push(meeting.duration_label);
    return bits.filter(Boolean).join(" · ");
  }

  function tally(meeting) {
    let itemCount = 0;
    let actioned = 0;
    for (const section of meeting.sections || []) {
      for (const item of section.items || []) {
        itemCount += 1;
        if (item.status === "actioned") actioned += 1;
      }
    }
    const openActions = (meeting.actions || []).filter((action) => action.done !== true).length;
    return { itemCount, actioned, openActions };
  }

  function purposeLine(meeting) {
    if (meeting.purpose_tbc) return "Purpose TBC.";
    return meeting.purpose || "";
  }

  function meetingsList() {
    const pack = state.meetings;
    if (!pack) return `<p>Loading meetings…</p>`;
    if (state.meetingsError) return `<article class="note">${esc(state.meetingsError)}</article>`;
    const rows = pack.meetings || [];
    const cards = rows.map((meeting) => {
      const counts = tally(meeting);
      return `<button type="button" class="card meet-card" data-open-meeting="${esc(meeting.id)}"><span class="meet-top"><span><span class="meet-title">${esc(meeting.title)}</span><span class="meta line">${esc(meeting.party)}</span></span>${badges(meeting)}</span><span class="line">${esc(scheduleLine(meeting))}</span><span class="line">${esc(purposeLine(meeting))}</span>${meeting.when_note ? `<span class="meta line">${esc(meeting.when_note)}</span>` : ""}<span class="meta line">${counts.actioned} of ${counts.itemCount} items actioned · ${counts.openActions} open ${counts.openActions === 1 ? "action" : "actions"}</span></button>`;
    }).join("");
    const missing = state.meetingId && !rows.some((item) => item.id === state.meetingId) ? `<article class="note">That meeting is not on the agenda.</article>` : "";
    const tone = pack.storage === "browser" ? "note" : "note rule";
    return `<h2>Meetings</h2><p class="meta">Upcoming first. Add a meeting or edit an agenda in the meetings seed. Checking an item off does not change that file.</p><article class="${tone}">${esc(pack.note || "")}</article>${missing}<div class="meet-list">${cards || `<p class="empty">No meetings in the seed yet.</p>`}</div>`;
  }

  function statusButtons(item) {
    return ["open", "discussed", "actioned", "parked"].map((status) => `<button type="button" class="status${item.status === status ? " on" : ""}" data-item="${esc(item.id)}" data-status="${status}" aria-pressed="${item.status === status ? "true" : "false"}">${STATUS_LABEL[status]}</button>`).join("");
  }

  function meetingDetail(meeting) {
    const sections = (meeting.sections || []).map((section, index) => {
      const items = (section.items || []).map((item) => `<li class="item s-${esc(item.status)}"><div class="item-top"><label class="tick"><input id="check-${esc(item.id)}" type="checkbox" data-item-check="${esc(item.id)}"${item.status === "actioned" ? " checked" : ""} aria-label="Mark ${esc(item.title)} actioned"></label><div class="item-copy"><strong>${esc(item.title)}</strong><br><span class="meta">Owner · ${esc(item.owner)}</span>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}</div></div><div class="statuses" role="group" aria-label="Status for ${esc(item.title)}">${statusButtons(item)}</div><label for="notes-${esc(item.id)}">Notes</label><textarea id="notes-${esc(item.id)}" data-item-notes="${esc(item.id)}" maxlength="500" rows="2">${esc(item.notes || "")}</textarea></li>`).join("");
      const box = section.minutes ? `${section.minutes} min` : "Time box not set";
      return `<li class="card"><div class="section-head"><h3>${index + 1}. ${esc(section.title)}</h3><span class="timebox">${esc(box)}</span></div><ul>${items}</ul></li>`;
    }).join("");
    const actions = (meeting.actions || []).map((action) => `<li class="action-line${action.done ? " done" : ""}"><label class="tick"><input type="checkbox" data-action-check="${esc(action.id)}"${action.done ? " checked" : ""} aria-label="Mark action done: ${esc(action.text)}"></label><div><strong>${esc(action.text)}</strong><br><span class="meta">Owner · ${esc(action.owner)}</span></div></li>`).join("");
    const who = document.body.dataset.name || "";
    const tone = state.meetings && state.meetings.storage === "browser" ? "note" : "note rule";
    const counts = tally(meeting);
    return `<p><button type="button" class="back" data-meetings-back>All meetings</button></p><header class="meet-head"><div class="meet-top"><h2>${esc(meeting.title)}</h2>${badges(meeting)}</div><p>${esc(meeting.party)}</p><p class="meta">${esc(scheduleLine(meeting))}</p>${meeting.when_note ? `<p class="meta">${esc(meeting.when_note)}</p>` : ""}<p>${esc(purposeLine(meeting))}</p>${(meeting.attendees || []).length ? `<p class="meta">${esc(meeting.attendees.join(" · "))}</p>` : ""}<p class="meta" data-actioned-count>${counts.actioned} of ${counts.itemCount} items actioned</p><p id="meet-save" role="status">${esc(state.saveNote)}</p></header><article class="${tone}">${esc((state.meetings && state.meetings.note) || "")}</article><ol class="agenda">${sections}</ol><section class="card"><h3>Actions arising</h3>${actions ? `<ul class="actions">${actions}</ul>` : `<p class="empty">No actions yet. Add one as it comes up.</p>`}<form id="add-action" class="action-add"><div><label for="action-text">Action</label><input id="action-text" maxlength="240" required></div><div><label for="action-owner">Owner</label><input id="action-owner" maxlength="80" value="${esc(who)}" required></div><button class="send" type="submit">Add action</button></form></section>`;
  }

  function meetingsView() {
    const meeting = liveMeeting();
    if (state.meetingId && meeting) return meetingDetail(meeting);
    return meetingsList();
  }

  function enqueueSave(meeting) {
    if (!meeting || !meeting.id) return;
    const id = meeting.id;
    state.saveTail = state.saveTail.then(() => persistMeeting(id)).catch(() => {});
  }

  async function persistMeeting(id) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const meeting = meetingRecord(id);
      if (!meeting || !state.meetings) return;
      const progress = progressFrom(meeting);
      const sent = JSON.stringify(progress);
      if (state.meetings.storage === "browser") writeLocal(id, progress);
      const viewing = () => state.tab === "meetings" && state.meetingId === id;
      if (viewing()) setSave("Saving…");
      let response;
      let body = {};
      try {
        response = await fetch(`${DATA}?action=meetings`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id, progress }),
        });
        body = await response.json().catch(() => ({}));
      } catch {
        if (viewing()) setSave("That change was not saved.");
        return;
      }
      const latest = meetingRecord(id);
      const newer = !latest || JSON.stringify(progressFrom(latest)) !== sent;
      if (response.status === 401) {
        if (viewing()) setSave("Your sign-in has expired.");
        return;
      }
      if (!response.ok || !body.meeting) {
        if (!newer) {
          if (viewing()) setSave(body.error || "That change was not saved.");
          return;
        }
        continue;
      }
      if (newer) continue;
      replaceMeeting(body.meeting);
      if (body.persisted) {
        clearLocal(id);
        state.meetings.storage = "supabase";
        if (viewing()) setSave("Saved for the team.");
      } else {
        writeLocal(id, progress);
        state.meetings.storage = body.storage || "browser";
        if (body.note) state.meetings.note = body.note;
        if (viewing()) setSave("Saved in this browser only.");
      }
      return;
    }
  }

  function flushNoteSave() {
    if (!state.noteTimer) return;
    clearTimeout(state.noteTimer);
    state.noteTimer = 0;
    const id = state.noteMeetingId;
    state.noteMeetingId = "";
    const meeting = meetingRecord(id);
    if (meeting) enqueueSave(meeting);
  }

  async function restoreLocal() {
    if (!state.meetings || state.meetings.storage !== "browser") return;
    const saved = readLocal();
    const ids = Object.keys(saved).filter((id) => (state.meetings.meetings || []).some((item) => item.id === id));
    for (const id of ids) {
      const response = await fetch(`${DATA}?action=meetings`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, progress: saved[id] }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.meeting) replaceMeeting(body.meeting);
    }
  }

  function ensureMeetings() {
    if (state.meetingsRequest) return state.meetingsRequest;
    state.meetingsRequest = (async () => {
      const response = await fetch(`${DATA}?action=meetings`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (response.status === 401) {
        state.meetingsError = "Your sign-in has expired.";
        state.meetings = { meetings: [], note: "" };
        state.meetingsRequest = null;
        if (state.tab === "meetings") paint();
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        state.meetingsError = body.error || "Meetings could not be loaded.";
        state.meetings = { meetings: [], note: "" };
        state.meetingsRequest = null;
        if (state.tab === "meetings") paint();
        return;
      }
      state.meetingsError = "";
      state.meetings = body;
      await restoreLocal();
      if (state.tab === "meetings") paint();
    })();
    return state.meetingsRequest;
  }

  const VIEWS = { overview, hub, pipeline, tasks, lenders, finance, files, meetings: meetingsView };

  function keepFocus(paint) {
    const active = document.activeElement;
    const id = active && active.id;
    const pos = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    paint();
    if (!id) return;
    const next = document.getElementById(id);
    if (!next) return;
    next.focus();
    if (pos != null && next.setSelectionRange) next.setSelectionRange(pos, pos);
  }

  function selectTab(id, meetingId) {
    const nextMeeting = id === "meetings" ? (meetingId || "") : "";
    if (state.noteTimer && (id !== "meetings" || nextMeeting !== state.meetingId)) flushNoteSave();
    if (id === "finance" && document.body.dataset.finance !== "1") id = "overview";
    if (!VIEWS[id]) id = "overview";
    state.tab = id;
    state.meetingId = id === "meetings" ? (meetingId || "") : "";
    state.caseId = id === "pipeline" ? (meetingId || "") : "";
    let hash = `#${state.tab}`;
    if (state.tab === "meetings" && state.meetingId) hash = `#meetings/${encodeURIComponent(state.meetingId)}`;
    else if (state.tab === "pipeline" && state.caseId) hash = `#pipeline/${encodeURIComponent(state.caseId)}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    document.querySelectorAll(".tab").forEach((button) => {
      const on = button.dataset.tab === id;
      button.classList.toggle("on", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const panel = $("#panel");
    const tab = document.getElementById(`tab-${id}`);
    if (panel && tab) panel.setAttribute("aria-labelledby", tab.id);
    if (state.timer) clearInterval(state.timer);
    state.timer = 0;
    if (id === "hub") state.timer = setInterval(refreshThread, 12000);
    if (id === "meetings") ensureMeetings();
  }

  function paint() {
    const data = state.data;
    const panel = $("#panel");
    if (!panel) return;
    if (state.tab === "meetings") {
      panel.innerHTML = meetingsView();
      const fresh = $("#fresh");
      if (fresh) fresh.textContent = "Meetings";
      return;
    }
    if (!data) return;
    const view = VIEWS[state.tab] || overview;
    panel.innerHTML = view(data);
    const fresh = $("#fresh");
    if (fresh) fresh.textContent = `Snapshot ${when(data.overview && data.overview.generated_at || data.freshness && data.freshness.overview)} · ${data.displayName}`;
    const badge = $("#seat-badge");
    if (badge) badge.textContent = data.displayName;
  }

  async function refreshThread() {
    if (state.tab !== "hub" || document.hidden) return;
    const response = await fetch(`${DATA}?action=thread`, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const body = await response.json();
    const box = $("#thread");
    if (box) {
      box.innerHTML = threadHtml(body.thread || []);
      box.scrollTop = box.scrollHeight;
    }
  }

  async function load() {
    const response = await fetch(DATA, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (response.status === 401) {
      $("#panel").innerHTML = `<article class="card"><p>Your sign-in has expired.</p><p><a href="/staff/command">Sign in again</a></p></article>`;
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (state.tab === "meetings") {
        selectTab("meetings", state.meetingId);
        return;
      }
      $("#panel").innerHTML = `<article class="note">${esc(body.error || "The dashboard could not be loaded.")}</article>`;
      return;
    }
    state.data = await response.json();
    if (!financeAllowed(state.data)) {
      document.querySelectorAll('[data-tab="finance"]').forEach((button) => button.remove());
      if (state.tab === "finance") state.tab = "overview";
    }
    const detail = state.tab === "meetings" ? state.meetingId : state.caseId;
    selectTab(state.tab, detail);
    paint();
  }

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest && event.target.closest(".tab");
    if (tab && tab.dataset.tab) {
      selectTab(tab.dataset.tab, "");
      paint();
      return;
    }
    const openMeeting = event.target.closest && event.target.closest("[data-open-meeting]");
    if (openMeeting) {
      state.saveNote = "";
      selectTab("meetings", openMeeting.dataset.openMeeting);
      paint();
      return;
    }
    if (event.target.closest && event.target.closest("[data-meetings-back]")) {
      state.saveNote = "";
      selectTab("meetings", "");
      paint();
      return;
    }
    const caseRow = event.target.closest && event.target.closest("[data-case-id]");
    if (caseRow && caseRow.dataset.caseId) {
      selectTab("pipeline", caseRow.dataset.caseId);
      paint();
      return;
    }
    if (event.target.closest && event.target.closest("[data-pipeline-back]")) {
      selectTab("pipeline", "");
      paint();
      return;
    }
    const status = event.target.closest && event.target.closest("[data-status][data-item]");
    if (status && state.tab === "meetings") {
      const meeting = liveMeeting();
      if (!meeting) return;
      for (const section of meeting.sections || []) {
        for (const item of section.items || []) {
          if (item.id === status.dataset.item) item.status = status.dataset.status;
        }
      }
      keepFocus(() => paint());
      enqueueSave(meeting);
      return;
    }
    const mode = event.target.closest && event.target.closest("[data-mode]");
    if (mode) {
      state.mode = mode.dataset.mode;
      if (state.tab !== "pipeline" || state.caseId) {
        selectTab("pipeline", "");
        paint();
        return;
      }
      keepFocus(paint);
      return;
    }
    if (event.target.id === "ask") {
      const question = ($("#q-ask") && $("#q-ask").value || "").trim();
      const status = $("#ask-status");
      if (!question) {
        if (status) status.textContent = "Ask a question first.";
        return;
      }
      if (status) status.textContent = "Thinking…";
      const response = await fetch(`${DATA}?action=ask`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await response.json().catch(() => ({}));
      if (status) status.textContent = response.ok ? "Answered" : (body.error || "Ask Lizzy could not answer just now.");
      const answer = $("#answer");
      if (answer) {
        answer.hidden = false;
        answer.textContent = body.answer || body.error || "";
      }
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form && form.id === "add-action") {
      event.preventDefault();
      const meeting = liveMeeting();
      if (!meeting) return;
      const text = ($("#action-text") && $("#action-text").value || "").trim();
      const owner = ($("#action-owner") && $("#action-owner").value || "").trim();
      if (!text) {
        setSave("Write the action before adding it.");
        return;
      }
      if (!owner) {
        setSave("Name an owner for the action.");
        return;
      }
      const id = `extra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      meeting.actions = (meeting.actions || []).concat([{ id, text, owner, done: false, extra: true }]);
      state.saveNote = "";
      paint();
      enqueueSave(meeting);
      return;
    }
    if (!form || form.id !== "composer") return;
    event.preventDefault();
    const status = $("#post-status");
    const message = ($("#thread-text") && $("#thread-text").value || "").trim();
    const toAgent = $("#to-agent") && $("#to-agent").value;
    const response = await fetch(`${DATA}?action=thread`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ message, to_agent: toAgent }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (status) status.textContent = body.error || "That message was not posted.";
      return;
    }
    if ($("#thread-text")) $("#thread-text").value = "";
    if (status) status.textContent = "Posted.";
    await refreshThread();
  });

  document.addEventListener("input", (event) => {
    const notes = event.target.closest && event.target.closest("[data-item-notes]");
    if (notes && state.tab === "meetings") {
      const meeting = liveMeeting();
      if (!meeting) return;
      for (const section of meeting.sections || []) {
        for (const item of section.items || []) {
          if (item.id === notes.dataset.itemNotes) item.notes = notes.value;
        }
      }
      if (state.noteTimer) clearTimeout(state.noteTimer);
      state.noteMeetingId = meeting.id;
      state.noteTimer = setTimeout(() => {
        state.noteTimer = 0;
        const id = state.noteMeetingId;
        state.noteMeetingId = "";
        const current = meetingRecord(id);
        if (current) enqueueSave(current);
      }, 400);
      return;
    }
    const id = event.target.id;
    if (id === "case-search") state.q = event.target.value;
    else if (id === "task-search") state.taskQ = event.target.value;
    else return;
    keepFocus(paint);
  });

  document.addEventListener("change", (event) => {
    const itemCheck = event.target.closest && event.target.closest("[data-item-check]");
    const actionCheck = event.target.closest && event.target.closest("[data-action-check]");
    if ((itemCheck || actionCheck) && state.tab === "meetings") {
      const meeting = liveMeeting();
      if (!meeting) return;
      if (itemCheck) {
        for (const section of meeting.sections || []) {
          for (const item of section.items || []) {
            if (item.id === itemCheck.dataset.itemCheck) item.status = itemCheck.checked ? "actioned" : "open";
          }
        }
      }
      if (actionCheck) {
        for (const action of meeting.actions || []) {
          if (action.id === actionCheck.dataset.actionCheck) action.done = actionCheck.checked;
        }
      }
      keepFocus(() => paint());
      enqueueSave(meeting);
      return;
    }
    const id = event.target.id;
    if (id === "stage") state.stage = event.target.value;
    else if (id === "lender") state.lender = event.target.value;
    else if (id === "task-seat") state.taskSeat = event.target.value;
    else if (id === "task-urgency") state.taskUrgency = event.target.value;
    else return;
    paint();
  });

  window.addEventListener("hashchange", () => {
    const hash = readHash();
    selectTab(hash.tab, hash.id);
    paint();
  });

  load();
}());

(function () {
  const DATA = "/staff/command/data";
  const $ = (sel) => document.querySelector(sel);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const seatName = { byron: "Byron", chris: "Chris", jess: "Jess", aadi: "Aadi", cai: "Cai", vanessa: "Vanessa", lizzy: "Lizzy", all: "Everyone", april: "April", social: "Social" };

  const state = {
    tab: (location.hash || "#overview").slice(1) || "overview",
    data: null,
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
      if ((state.mode === "cai" || state.mode === "jess") && !(isLive(item) && item.whatsapp_assigned === true && pipelineSeatMatch(item, state.mode))) return false;
      if (state.stage && item.stage !== state.stage) return false;
      if (state.lender && !(map.get(item.id) || []).includes(state.lender)) return false;
      if (!query) return true;
      const hay = [item.id, item.name, item.stage, item.owner, item.product, item.next_action, item.assigned_seat, (item.assigned_seats || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }

  function table(columns, rows) {
    const head = columns.map((col) => `<th scope="col">${esc(col[0])}</th>`).join("");
    const body = rows.length
      ? rows.map((row) => `<tr>${columns.map((col) => `<td>${col[1](row)}</td>`).join("")}</tr>`).join("")
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

  function kpiCards(data) {
    const kpis = (data.overview && data.overview.kpis) || {};
    const cards = [
      ["Open cases", count(kpis.total_open_non_private), "Non-private"],
      ["Live deals", count(kpis.live_deals), ""],
      ["Urgent / emergency", count(kpis.urgent_emergency), ""],
      ["Cai's assigned live deals", count(kpis.cai_assigned_live), "WhatsApp assignment"],
      ["Jess's assigned live deals", count(kpis.jess_assigned_live), "WhatsApp assignment"],
      ["Tasks", count(kpis.tasks_total), ""],
      ["Open Byron decisions", count(kpis.open_decisions), ""],
      ["Active lenders", count(kpis.active_lenders), ""],
      ["Lender timing", kpis.lender_timing_metrics_available === true ? "Live" : "Awaiting", "Deep dive"],
    ];
    return `<div class="grid">${cards.map(([label, value, note]) => `<article class="card">${esc(label)}<b>${value}</b>${note ? `<span>${esc(note)}</span>` : ""}</article>`).join("")}</div>`;
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

  function pipeline(data) {
    const rule = (data.pipeline && data.pipeline.rule_r001) || {};
    const kpis = (data.overview && data.overview.kpis) || {};
    const caiCount = rule.cai_count != null ? rule.cai_count : kpis.cai_assigned_live;
    const jessCount = rule.jess_count != null ? rule.jess_count : kpis.jess_assigned_live;
    const modes = [
      ["all", "All open"],
      ["live", "Live deals"],
      ["urgent", "Urgent / emergency"],
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
    ], visible)}`;
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

  const VIEWS = { overview, hub, pipeline, tasks, lenders, finance, files };

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

  function selectTab(id) {
    if (id === "finance" && document.body.dataset.finance !== "1") id = "overview";
    if (!VIEWS[id]) id = "overview";
    state.tab = id;
    if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
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
  }

  function paint() {
    const data = state.data;
    const panel = $("#panel");
    if (!data || !panel) return;
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
      $("#panel").innerHTML = `<article class="note">${esc(body.error || "The dashboard could not be loaded.")}</article>`;
      return;
    }
    state.data = await response.json();
    if (!financeAllowed(state.data)) {
      document.querySelectorAll('[data-tab="finance"]').forEach((button) => button.remove());
      if (state.tab === "finance") state.tab = "overview";
    }
    selectTab(state.tab);
    paint();
  }

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest && event.target.closest(".tab");
    if (tab && tab.dataset.tab) {
      selectTab(tab.dataset.tab);
      paint();
      return;
    }
    const mode = event.target.closest && event.target.closest("[data-mode]");
    if (mode) {
      state.mode = mode.dataset.mode;
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
    const id = event.target.id;
    if (id === "case-search") state.q = event.target.value;
    else if (id === "task-search") state.taskQ = event.target.value;
    else return;
    keepFocus(paint);
  });

  document.addEventListener("change", (event) => {
    const id = event.target.id;
    if (id === "stage") state.stage = event.target.value;
    else if (id === "lender") state.lender = event.target.value;
    else if (id === "task-seat") state.taskSeat = event.target.value;
    else if (id === "task-urgency") state.taskUrgency = event.target.value;
    else return;
    paint();
  });

  window.addEventListener("hashchange", () => {
    selectTab((location.hash || "#overview").slice(1));
    if (state.data) paint();
  });

  load();
}());

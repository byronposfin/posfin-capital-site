import { readFileSync } from 'node:fs';

export const WINDOW_DAYS_DEFAULT = 60;
export const TEST_SOURCES = new Set(['fr_factfind_test', 'web_factfind_test']);

export const COLUMNS = [
  { id: 'raw_lead', title: 'Raw lead', move: 'Moves when Byron sends the opener' },
  { id: 'opener_sent', title: 'Opener sent', move: 'Moves when handed to Lizzy' },
  { id: 'new_triage', title: 'New triage', move: 'Moves on the first contact attempt' },
  { id: 'contacting', title: 'Lizzy contacting', move: 'Moves when the fact find is submitted' },
  { id: 'fact_find', title: 'Fact find done / pre-LOR', move: 'Moves when the LOR is sent to a lender' },
  { id: 'lor_requested', title: 'LOR requested', move: 'Moves when the lender issues terms or an EL' },
  { id: 'el_issued', title: 'EL issued', move: 'Moves when the EL is sent to the client for signature' },
  { id: 'el_sent', title: 'EL sent for signature', move: 'Moves when the signed EL comes back' },
  { id: 'el_signed', title: 'EL signed', move: 'Real money stage', highlight: true },
];

export const PARKED = { id: 'parked', title: 'Parked / Declined' };
export const COMPLETED = { id: 'completed', title: 'Completed' };

const OWNERS = new Set(['Byron', 'Lizzy', 'Jess', 'Aadi', 'Cai', 'Chris', 'Tom']);

export function windowDays(env = process.env) {
  const raw = Number(env.PIPELINE_LEAD_WINDOW_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : WINDOW_DAYS_DEFAULT;
}

export function digits(phone) {
  const value = String(phone || '').replace(/\D/g, '');
  return value || '';
}

export function contactKey(row) {
  const email = String(row.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = digits(row.phone);
  if (phone) return `phone:${phone}`;
  return `lead:${row.id || ''}`;
}

export function leadInWindow(row, now, days) {
  const arrived = new Date(row.fb_created_time || row.created_at || 0).getTime();
  if (!Number.isFinite(arrived)) return false;
  return now - arrived <= days * 86400000;
}

export function leadSelected(row, now, days = WINDOW_DAYS_DEFAULT) {
  const source = String(row.source || '');
  if (TEST_SOURCES.has(source)) return false;
  if (source === 'facebook_archived' && row.status === 'new') return false;
  if (leadInWindow(row, now, days)) return true;
  return row.status !== 'new';
}

export function stageFromLeadStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'declined') return { stage: 'parked', reason: 'Lead status declined' };
  if (value === 'statements_received' || value === 'statements_reviewed') return { stage: 'fact_find', substatus: value };
  if (value === 'contacted') return { stage: 'contacting' };
  if (value === 'call_slot_selected') return { stage: 'new_triage', substatus: 'Call slot selected' };
  return { stage: 'raw_lead' };
}

export function stageFromPipelineStatus(status) {
  const value = String(status || '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (!value) return { stage: 'raw_lead' };
  if (value.includes('COMPLETED')) return { stage: 'completed', substatus: status };
  if (value.startsWith('DEAD') || value.includes('NO LONGER') || value.includes('GHOST') || value.includes('DNQ')) {
    return { stage: 'parked', reason: status };
  }
  if (value.startsWith('PARKED') || value.startsWith('ON HOLD') || value.includes('DUPLICATE') || value.includes('STALLED') || value.includes('NEEDS BYRON')) {
    return { stage: 'parked', reason: status };
  }
  if (value.includes('EL SENT')) return { stage: 'el_sent', substatus: status };
  if (value.includes('EL SIGNED') || value.includes('LEGALS') || value.includes('COMPLETING') || value.includes('VALUATION/LEGALS')) {
    return { stage: 'el_signed', substatus: status };
  }
  if (value.includes('OFFER RECEIVED') || value === 'OFFER' || value.startsWith('OFFER')) return { stage: 'el_issued', substatus: status };
  if (value.includes('TERMS REQUESTED') || value.includes('LOR SENT') || value.includes('TERMS IN')) return { stage: 'lor_requested', substatus: status };
  if (value.includes('ROUTER COMPLETE')) return { stage: 'fact_find', substatus: status };
  if (value.includes('RAW_ROUTER') || value.includes('BORROWER ENGAGED') || value.includes('NEEDS QUALIFICATION') || value.includes('TRIAGE') || value.includes('QUALIFY')) {
    return { stage: 'new_triage', substatus: status };
  }
  if (value === 'NEW') return { stage: 'raw_lead' };
  return { stage: 'raw_lead', substatus: status, unmapped: true };
}

export function stageFromIndex(stage) {
  const value = String(stage || '').trim();
  if (value === 'Qualified Opportunity') return { stage: 'fact_find', substatus: value };
  if (value === 'Terms in / LOR sent') return { stage: 'lor_requested', substatus: value };
  if (value === 'Offer' || value === 'EL presented') return { stage: 'el_issued', substatus: value };
  if (value === 'EL signed') return { stage: 'el_signed', substatus: value };
  if (value === 'Valuation/Legals (processing)') return { stage: 'el_signed', substatus: 'Valuation/Legals' };
  if (value === 'Stalled' || value === 'Needs Byron review') return { stage: 'parked', reason: value };
  return { stage: 'raw_lead', substatus: value, unmapped: true };
}

export function selectLeads(rows, now = Date.now(), days = WINDOW_DAYS_DEFAULT) {
  const picked = rows.filter((row) => leadSelected(row, now, days));
  const groups = new Map();
  for (const row of picked) {
    const key = contactKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const cards = [];
  for (const [key, list] of groups) {
    const ordered = list.slice().sort((a, b) => {
      const at = new Date(a.fb_created_time || a.created_at || 0).getTime();
      const bt = new Date(b.fb_created_time || b.created_at || 0).getTime();
      return bt - at;
    });
    const winner = ordered[0];
    const mapped = stageFromLeadStatus(winner.status);
    cards.push({
      id: `lead:${winner.id}`,
      caseRef: '',
      name: winner.full_name || '',
      stage: mapped.stage,
      substatus: mapped.substatus || '',
      reason: mapped.reason || '',
      owner: ownerOrBlank(winner.assigned_to),
      lender: '',
      loan: null,
      loanLabel: winner.loan_amount_band || '',
      feeVerified: null,
      feeAssumed: null,
      nextAction: '',
      driveUrl: '',
      flags: [],
      source: 'supabase-leads',
      linked: ordered.slice(1).map((row) => String(row.id)),
      contactKey: key.startsWith('lead:') ? '' : 'matched',
      history: [{ source: 'public.leads', stage: mapped.stage, note: `Lead status ${winner.status || 'blank'}` }],
    });
  }
  return cards;
}

function ownerOrBlank(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === 'Chris Shipton') return 'Chris';
  return OWNERS.has(text) ? text : text;
}

function money(value) {
  return Number.isFinite(value) ? value : null;
}

export function assumedFee(loan, stage) {
  if (stage !== 'lor_requested' || !Number.isFinite(loan)) return null;
  return Math.round(loan * 0.05);
}

export function parseMasterIndex(csv) {
  const rows = parseCsv(csv).slice(1).filter((row) => row[0] && row[0].startsWith('PC-'));
  return rows.map((row) => {
    const mapped = stageFromIndex(row[4]);
    const tier = row[1] || '';
    const flags = [];
    if (tier.startsWith('D')) flags.push('Byron/Chris to confirm');
    return {
      caseRef: row[0],
      name: row[2] || '',
      owner: ownerOrBlank(row[3]),
      indexStage: row[4] || '',
      stage: mapped.stage,
      substatus: mapped.substatus || '',
      reason: mapped.reason || '',
      driveUrl: safeDrive(row[6]),
      tier,
      flags,
      lastActivity: row[14] || '',
    };
  });
}

export function safeDrive(url) {
  const value = String(url || '').trim();
  return value.startsWith('https://drive.google.com/') ? value : '';
}

function cardFromIndex(row) {
  return {
    id: `case:${row.caseRef}`,
    caseRef: row.caseRef,
    name: row.name,
    stage: row.stage,
    substatus: row.substatus,
    reason: row.reason,
    owner: row.owner,
    lender: '',
    loan: null,
    loanLabel: '',
    feeVerified: null,
    feeAssumed: null,
    nextAction: '',
    driveUrl: row.driveUrl,
    flags: row.flags.slice(),
    source: 'master-index-14-nov',
    linked: [],
    history: [{ source: 'master-index-14-nov', stage: row.stage, note: row.indexStage }],
  };
}

export function applyNov20(card, overlay) {
  const next = { ...card, flags: card.flags.slice(), history: card.history.slice() };
  next.history.push({ source: 'pipeline-20-nov', stage: overlay.stage, note: overlay.note });
  next.stage = overlay.stage;
  next.substatus = overlay.substatus || '';
  next.reason = overlay.reason || '';
  if (overlay.loan != null) next.loan = overlay.loan;
  if (overlay.feeVerified != null) next.feeVerified = overlay.feeVerified;
  if (overlay.lender) next.lender = overlay.lender;
  if (overlay.owner) next.owner = overlay.owner;
  if (overlay.nextAction) next.nextAction = overlay.nextAction;
  if (overlay.flag) next.flags.push(overlay.flag);
  next.feeAssumed = assumedFee(next.loan, next.stage);
  next.source = 'pipeline-20-nov';
  return next;
}

export function nov20Overlays() {
  return JSON.parse(readFileSync(new URL('../data/nov20-pipeline.json', import.meta.url), 'utf8'));
}

export function buildCases(indexRows, overlays = nov20Overlays()) {
  const cards = indexRows.map(cardFromIndex);
  const byRef = new Map(cards.map((card) => [card.caseRef, card]));
  const extras = [];
  for (const overlay of overlays) {
    const ref = overlay.match.ref;
    let card = ref ? byRef.get(ref) : null;
    if (!card && overlay.match.name) {
      card = cards.find((item) => item.name.toLowerCase().includes(overlay.match.name.toLowerCase()));
    }
    if (!card) {
      extras.push(applyNov20({
        id: `case:${overlay.match.ref || overlay.match.name}`,
        caseRef: overlay.match.ref || '',
        name: overlay.name || overlay.match.name || '',
        stage: 'raw_lead',
        substatus: '',
        reason: '',
        owner: '',
        lender: '',
        loan: null,
        loanLabel: '',
        feeVerified: null,
        feeAssumed: null,
        nextAction: '',
        driveUrl: '',
        flags: [],
        source: 'pipeline-20-nov',
        linked: [],
        history: [],
      }, overlay));
      continue;
    }
    const updated = applyNov20(card, overlay);
    if (overlay.name) updated.name = overlay.name;
    const index = cards.indexOf(card);
    cards[index] = updated;
    if (updated.caseRef) byRef.set(updated.caseRef, updated);
  }
  return cards.concat(extras).map((card) => ({ ...card, feeAssumed: assumedFee(card.loan, card.stage) }));
}

export function parsePipelineCsv(csv) {
  const table = parseCsv(csv);
  if (!table.length) return [];
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const id = col('case_id');
  const name = col('borrower_name');
  const status = col('status');
  const sales = col('owner_sales');
  const next = col('next_step');
  if (id < 0 || status < 0) return [];
  return table.slice(1).filter((row) => row[id]).map((row) => {
    const mapped = stageFromPipelineStatus(row[status]);
    return {
      id: `pipeline:${row[id]}`,
      caseRef: row[id],
      name: name >= 0 ? row[name] : '',
      stage: mapped.stage,
      substatus: mapped.substatus || '',
      reason: mapped.reason || '',
      owner: sales >= 0 ? ownerOrBlank(row[sales]) : '',
      lender: '',
      loan: null,
      loanLabel: '',
      feeVerified: null,
      feeAssumed: null,
      nextAction: next >= 0 ? row[next] : '',
      driveUrl: '',
      flags: mapped.unmapped ? ['Status not in the map'] : [],
      source: 'crm-pipeline',
      linked: [],
      history: [{ source: 'crm-pipeline', stage: mapped.stage, note: row[status] }],
    };
  });
}

export function mergePipeline(pipelineRows, cases) {
  const refs = new Set(cases.map((card) => card.caseRef).filter(Boolean));
  const extra = pipelineRows.filter((row) => row.caseRef && !refs.has(row.caseRef));
  return cases.concat(extra);
}

export function caseIdsIn(text) {
  const re = /\b(PC-\d+|POSFIN(?:[.\-][A-Z0-9]+)+|META-\d+|PIPELINE-R\d+|POS-\d{4}-\d+|MS\d+)\b/gi;
  return [...new Set(String(text || '').match(re) || [])];
}

export function stageFromCallNote(note) {
  const value = String(note || '');
  if (/router complete|fact find (done|submitted)|statements received/i.test(value) && !/further questions/i.test(value)) {
    return 'fact_find';
  }
  return 'contacting';
}

export function parseCallCsv(csv, owner) {
  const table = parseCsv(csv);
  if (!table.length) return [];
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const at = (names) => header.findIndex((cell) => names.includes(cell));
  let date = at(['date']);
  if (date < 0) date = 0;
  const lead = at(['lead']);
  const phone = at(['phone']);
  const email = at(['email']);
  const notes = at(['broker notes']);
  const source = at(['source row']);
  return table.slice(1).filter((row) => lead >= 0 && String(row[lead] || '').trim()).map((row) => ({
    date: date >= 0 ? row[date] : '',
    name: row[lead].trim(),
    phone: phone >= 0 ? digits(row[phone]) : '',
    email: email >= 0 ? String(row[email] || '').trim().toLowerCase() : '',
    note: notes >= 0 ? String(row[notes] || '').replace(/\s+/g, ' ').trim() : '',
    sourceRow: source >= 0 ? String(row[source] || '').trim() : '',
    owner,
  }));
}

function looseName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function namesMatch(left, right) {
  const words = (value) => new Set(looseName(value).split(' ').filter((word) => word.length >= 3));
  const a = words(left);
  const b = words(right);
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  if (shared >= 2) return true;
  return a.size === 1 && shared === 1 && [...a][0].length >= 4;
}

export function attachCalls(cards, calls) {
  const next = cards.map((card) => ({ ...card, flags: (card.flags || []).slice(), history: (card.history || []).slice(), callNotes: (card.callNotes || []).slice() }));
  const byRef = new Map();
  for (const card of next) {
    if (card.caseRef) byRef.set(card.caseRef.toUpperCase(), card);
    for (const id of caseIdsIn(card.caseRef)) byRef.set(id.toUpperCase(), card);
  }
  for (const call of calls) {
    const ids = caseIdsIn(`${call.sourceRow} ${call.note}`);
    let card = ids.map((id) => byRef.get(id.toUpperCase())).find(Boolean);
    if (!card && call.email) {
      card = next.find((item) => item.email && item.email === call.email);
    }
    if (!card && call.phone) {
      card = next.find((item) => item.phone && item.phone === call.phone);
    }
    if (!card) {
      card = next.find((item) => namesMatch(item.name, call.name));
    }
    const entry = { owner: call.owner, date: call.date, sourceRow: call.sourceRow, note: call.note.slice(0, 500) };
    if (card) {
      card.callNotes.push(entry);
      card.history.push({ source: `${call.owner} calls`, stage: card.stage, note: call.sourceRow || call.name });
      continue;
    }
    const stage = stageFromCallNote(call.note);
    const made = {
      id: `call:${call.owner}:${looseName(call.name)}`,
      caseRef: ids[0] || '',
      name: call.name,
      stage,
      substatus: '',
      reason: '',
      owner: call.owner,
      lender: '',
      loan: null,
      loanLabel: '',
      feeVerified: null,
      feeAssumed: null,
      nextAction: '',
      driveUrl: '',
      flags: ['Not on the Pipeline tab'],
      source: `${call.owner.toLowerCase()}-calls`,
      linked: [],
      email: call.email,
      phone: call.phone,
      callNotes: [entry],
      history: [{ source: `${call.owner} calls`, stage, note: call.note.slice(0, 240) }],
    };
    next.push(made);
    if (made.caseRef) byRef.set(made.caseRef.toUpperCase(), made);
  }
  return next;
}

export function groupColumns(cards) {
  const columns = COLUMNS.map((column) => ({ ...column, cards: cards.filter((card) => card.stage === column.id) }));
  return {
    columns,
    parked: cards.filter((card) => card.stage === 'parked'),
    completed: cards.filter((card) => card.stage === 'completed'),
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((item) => item.some((value) => value !== ''));
}

export function loadMasterIndex(path = new URL('../data/master-index-14nov.csv', import.meta.url)) {
  return parseMasterIndex(readFileSync(path, 'utf8'));
}

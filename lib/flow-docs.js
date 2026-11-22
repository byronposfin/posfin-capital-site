import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { lenderAlias, knownRates, matchLenders } from './placed-match.js';
import {
  chargePhrase, existingBalance, feeAmounts, fundingStack, lenderSlug, netHeadline, pounds, versionLabel,
} from './flow-cases.js';

const GROSS_LINE = 'Gross: indicative, to follow on receipt of lender terms (subject to status).';
const PROCURATION = 'The procuration fee does not substitute, offset or reduce any broker fee.';
const BROKER_LINE = 'Subject to status. Posfin Capital Ltd is a credit broker, not a lender.';
const EMAIL = /[A-Z0-9._%+-]+@(?!example\.invalid\b)[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+44[\s().-]{0,3}|0)(?:7\d{9}|\d{2,4}[\s().-]\d{3,4}[\s().-]?\d{3,4})\b/;

const NAVY = [11, 31, 58];
const TEAL = [19, 138, 158];
const LOR_TEAL = [10, 115, 131];
const GOLD_INK = [138, 90, 0];
const MUTED = [79, 95, 120];
const RED = [180, 35, 24];

export function britishDate(iso) {
  const date = new Date(iso || Date.now());
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function contactViolations(text) {
  const found = [];
  if (EMAIL.test(String(text || ''))) found.push('email');
  if (PHONE.test(String(text || ''))) found.push('phone');
  return found;
}

export function headlineProblems(flowCase, headline) {
  const problems = [];
  if (!String(headline).includes(`Looking for ${pounds(flowCase.net_ask)} net`)) problems.push('missing net headline');
  if (/gross/i.test(headline)) problems.push('gross word in headline');
  const gross = pounds(flowCase.indicative_gross);
  if (gross && String(headline).includes(gross)) problems.push('gross figure in headline');
  if (!/subject to status/i.test(headline)) problems.push('headline missing subject to status');
  return problems;
}

function rateLine(match, audience) {
  const known = knownRates(match.rows);
  if (!known.length) return 'Lowest rate on our panel for these criteria: not known, subject to status.';
  const low = known.reduce((best, row) => (row.rate_pcm < best.rate_pcm ? row : best));
  const high = known.reduce((best, row) => (row.rate_pcm > best.rate_pcm ? row : best));
  const index = match.rows.findIndex((row) => row.id === low.id);
  const name = audience === 'staff' ? low.name : lenderAlias(Math.max(index, 0));
  return `Lowest rate on our panel for these criteria: ${low.rate_pcm.toFixed(2)}% pcm (${name}), highest ${high.rate_pcm.toFixed(2)}% pcm, subject to status.`;
}

function chooseLender(match, query) {
  const wanted = String(query || '').trim().toLowerCase();
  if (wanted) {
    const found = match.rows.find((row) => row.id.toLowerCase() === wanted || lenderSlug(row.name) === wanted);
    if (found) return found;
  }
  return match.rows.find((row) => row.tier === 'eligible') || match.rows[0];
}

function plainOf(parts) {
  return parts.filter((part) => part != null && part !== '').join('\n');
}

function finish(model) {
  model.plain = plainOf([
    model.title,
    model.ref,
    model.version,
    model.date,
    model.contact,
    model.headline,
    model.pills,
    model.grossLine,
    ...model.blocks.flatMap((block) => [
      block.text,
      block.caption,
      block.title,
      ...(block.items || []).map((item) => `${item.label} ${item.value} subject to status`),
      ...(block.rows || []).map((row) => row.join(' | ')),
    ]),
    'TEST',
    'Posfin Capital',
    'Demo document · TEST data · not for issue',
    BROKER_LINE,
  ]);
  const violations = contactViolations(model.plain);
  if (violations.length) {
    return { ok: false, error: 'This demo document was stopped because it contained a contact detail that is not allowed.' };
  }
  const money = model.blocks.filter((block) => block.money);
  if (money.some((block) => !/subject to status/i.test(plainOf([
    block.text, block.caption, ...(block.items || []).map((item) => item.note), ...(block.rows || []).flat(),
  ])))) {
    return { ok: false, error: 'A money section is missing the words subject to status.' };
  }
  return { ok: true, model };
}

export function buildEl(flowCase, options = {}) {
  const fees = feeAmounts(flowCase);
  const version = versionLabel(flowCase);
  const date = britishDate(options.now);
  const regulated = flowCase.regulated ? 'Regulated' : 'Unregulated';
  const blocks = [
    {
      type: 'tiles',
      money: true,
      caption: 'Figures on this engagement letter, subject to status.',
      items: [
        { label: 'Facility (gross, indicative)', value: pounds(fees.gross), note: 'subject to status' },
        { label: 'Net release', value: pounds(flowCase.net_ask), note: 'subject to status' },
        { label: 'Broker fee', value: pounds(fees.broker), note: 'subject to status' },
        { label: 'Posfin success fee', value: pounds(fees.success), note: 'subject to status' },
        { label: 'Lender procuration fee', value: pounds(fees.procuration), note: 'subject to status' },
      ],
    },
    {
      type: 'h',
      text: '1 Parties and scope',
    },
    {
      type: 'p',
      text: `Posfin Capital Limited, a credit broker (FCA FRN 913022, NACFB member), and ${flowCase.borrower_name} of ${flowCase.address}. Posfin will introduce this enquiry. Posfin does not lend, approve or offer a loan.`,
    },
    {
      type: 'h',
      text: '2 The facility being sought',
    },
    {
      type: 'p',
      money: true,
      text: `${chargePhrase(flowCase)}, ${flowCase.term}, ${regulated.toLowerCase()}, ${flowCase.occupancy}. Net release ${pounds(flowCase.net_ask)}. Indicative gross facility ${pounds(fees.gross)}. Exit: ${flowCase.exit}. Subject to status.`,
    },
    {
      type: 'h',
      text: '3 Fees',
    },
    {
      type: 'table',
      money: true,
      caption: `Fee table, subject to status. ${PROCURATION}`,
      head: ['Item', 'Basis', 'Amount', 'Who pays'],
      rows: [
        ['Broker fee', `${flowCase.broker_fee_pct}% of indicative gross, on completion. No upfront fee.`, pounds(fees.broker), 'Borrower'],
        ['Posfin success fee', `${flowCase.success_fee_pct}% of indicative gross, on completion.`, pounds(fees.success), 'Borrower'],
        ['Lender procuration fee', `${flowCase.procuration_fee_pct}% of indicative gross. Paid by the lender and kept separate from the broker fee.`, pounds(fees.procuration), 'Lender'],
      ],
    },
    {
      type: 'p',
      text: PROCURATION,
    },
    {
      type: 'h',
      text: '4 What we will do',
    },
    {
      type: 'p',
      text: 'We will prepare this engagement letter, match the enquiry to lenders on the panel, and prepare a lender offer request. We do not lend, approve or offer a loan.',
    },
    {
      type: 'h',
      text: '5 What we need from you',
    },
    {
      type: 'p',
      text: 'Identification, the security address, the existing charges, and the exit plan. On this demo those details are fixtures.',
    },
    {
      type: 'h',
      text: '6 Fees and payment',
    },
    {
      type: 'p',
      money: true,
      text: `No upfront fee on this fixture. The broker fee and the Posfin success fee are payable on completion. The lender procuration fee is separate. Subject to status. ${PROCURATION}`,
    },
    {
      type: 'h',
      text: 'Terms of Business summary',
    },
    {
      type: 'p',
      text: 'Posfin Capital Ltd is a credit broker, not a lender. Fees are as set out above. Nothing in this demo is an offer of finance. Subject to status.',
    },
    { type: 'sign', title: 'Acknowledgement of the engagement letter figures' },
    { type: 'sign', title: 'Acknowledgement of the Terms of Business' },
  ];
  return finish({
    kind: 'el',
    pageTitle: 'Engagement letter',
    title: 'Engagement Letter',
    ref: flowCase.ref,
    version,
    date,
    filename: `EL_${flowCase.ref}_${version}.pdf`,
    pdfHref: `/staff/flow/doc/${encodeURIComponent(flowCase.ref)}/el.pdf`,
    contact: '',
    headline: '',
    pills: '',
    grossLine: '',
    blocks,
  });
}

export function buildLor(flowCase, lenders, options = {}) {
  if (flowCase.residential) {
    const count = (flowCase.comparables || []).length;
    if (count !== 5) {
      return { ok: false, error: `A residential lender offer request needs exactly five sold comparables. This case has ${count}.` };
    }
    if (!flowCase.avm || !Number(flowCase.avm.value)) {
      return { ok: false, error: 'A residential lender offer request needs an AVM figure. This case has none.' };
    }
  }
  const audience = options.audience === 'investor' || options.audience === 'introducer' ? options.audience : 'staff';
  const match = options.match || matchLenders({
    property_value: flowCase.property_value,
    existing_charges: flowCase.existing_charges,
    net_ask: flowCase.net_ask,
    charge_type: flowCase.charge_type,
    regulated: flowCase.regulated === true,
    product_type: flowCase.product_type,
  }, lenders);
  const problems = headlineProblems(flowCase, netHeadline(flowCase));
  if (problems.length) return { ok: false, error: `The lender offer request headline failed a check: ${problems.join(', ')}.` };
  const lender = chooseLender(match, options.lender);
  const version = versionLabel(flowCase);
  const stack = fundingStack(flowCase);
  const existing = existingBalance(flowCase);
  const limit = lender && lender.limit != null ? Number(lender.limit) : null;
  const maxGross = limit == null ? null : Math.round((Number(flowCase.property_value) * limit) / 100);
  const headroom = maxGross == null ? null : maxGross - existing - Number(flowCase.net_ask);
  const displayName = audience === 'staff' || !lender ? (lender ? lender.name : 'Lender') : lenderAlias(Math.max(match.rows.findIndex((row) => row.id === lender.id), 0));
  const blocks = [
    { type: 'p', text: flowCase.summary },
  ];
  if (flowCase.regulated) {
    blocks.push({
      type: 'callout',
      text: 'Regulated — FCA second-charge mortgage. This request is a regulated second-charge enquiry. Posfin does not approve or offer the loan. Subject to status.',
    });
  }
  blocks.push(
    { type: 'p', money: true, text: rateLine(match, audience) },
    {
      type: 'tiles',
      money: true,
      caption: `Capacity working, subject to status. Cumulative LTV ${match.ltv}% labelled ${match.basis}.`,
      items: [
        { label: flowCase.property_label || 'Stated value', value: pounds(flowCase.property_value), note: 'subject to status' },
        { label: "Max gross at lender's LTV", value: maxGross == null ? 'Not known' : pounds(maxGross), note: 'subject to status' },
        { label: 'Existing charges', value: pounds(existing), note: 'subject to status' },
        { label: 'Headroom', value: headroom == null ? 'Not known' : pounds(headroom), note: 'subject to status' },
      ],
    },
    {
      type: 'table',
      money: true,
      caption: 'Funding stack, subject to status.',
      head: ['Item', 'Amount'],
      rows: [
        ['Net ask', pounds(flowCase.net_ask)],
        ...stack.redemptions.map((item) => [`Mandatory redemption — ${item.holder}`, pounds(item.balance)]),
        ['Subtotal', pounds(stack.subtotal)],
        ['Legals', pounds(stack.legals)],
        ['Buffer / contingency', pounds(stack.buffer)],
        ['Net required', pounds(stack.netRequired)],
      ],
    },
    { type: 'p', money: true, text: GROSS_LINE },
  );
  if (flowCase.residential) {
    const avm = flowCase.avm;
    blocks.push({
      type: 'p',
      money: true,
      text: `AVM ${pounds(avm.value)} (range ${pounds(avm.low)}–${pounds(avm.high)}, ${avm.confidence} confidence), subject to status.`,
    });
    blocks.push({
      type: 'table',
      money: true,
      caption: 'Sold comparables, subject to status. Exactly five.',
      head: ['Address', 'Sold', 'Price', '£/sq ft', 'Distance', 'Type'],
      rows: flowCase.comparables.map((item) => [
        item.address,
        item.sold_date,
        pounds(item.price),
        pounds(item.psf),
        item.distance,
        item.type,
      ]),
    });
  }
  const valuation = lender && lender.valuation ? lender.valuation : 'No extra valuation note on this fixture.';
  blocks.push({
    type: 'note',
    text: `Lender note for ${displayName}: ${valuation} Source ${lender ? lender.source : 'fixture'}${lender && lender.source_date ? `, ${lender.source_date}` : ''}, grade ${lender ? lender.grade : ''}. Research / interpreted, not lender-confirmed.`,
  });
  if (match.note) blocks.push({ type: 'p', text: match.note });
  const model = {
    kind: 'lor',
    pageTitle: 'Lender offer request',
    title: 'Lender Offer Request',
    kicker: 'LOR',
    ref: flowCase.ref,
    version,
    date: britishDate(options.now),
    filename: `LOR_${flowCase.ref}_${lenderSlug(lender ? lender.name : 'lender')}_${version}.pdf`,
    pdfHref: `/staff/flow/doc/${encodeURIComponent(flowCase.ref)}/lor.pdf${lender ? `?lender=${encodeURIComponent(lender.id)}` : ''}`,
    contact: 'Byron Hill, Principal, Posfin Capital Limited · posfincapital.com',
    headline: netHeadline(flowCase),
    pills: `${chargePhrase(flowCase)} · ${flowCase.regulated ? 'Regulated' : 'Unregulated'} · ${flowCase.occupancy}`,
    grossLine: GROSS_LINE,
    lenderName: displayName,
    blocks,
  };
  return finish(model);
}

export function renderPdf(model) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  const width = () => doc.internal.pageSize.getWidth();
  const height = () => doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 48;
  const contentWidth = () => width() - margin * 2;

  function ensure(space) {
    if (y + space > height() - 48) {
      doc.addPage();
      y = 48;
    }
  }
  function write(value, size = 11, font = 'helvetica', style = 'normal', color = NAVY, gap = 8) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value), contentWidth());
    const used = lines.length * (size + 3);
    if (y + used > height() - 48) {
      doc.addPage();
      y = 48;
    }
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(lines, margin, y);
    y += used + gap;
  }
  function table(head, body) {
    ensure(36);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 50 },
      head: [head],
      body,
      styles: { font: 'helvetica', fontSize: 8, textColor: NAVY, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: model.kind === 'lor' ? LOR_TEAL : TEAL, textColor: 255 },
      theme: 'grid',
    });
    y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 12;
  }

  if (model.kind === 'el') {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(0, 0, width(), 58, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Posfin', margin, 26);
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text('Capital', margin + 58, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('FCA FRN 913022 · NACFB member · Credit broker, not a lender', margin, 44);
    y = 78;
  } else {
    doc.setFillColor(255, 248, 230);
    doc.rect(margin, 28, contentWidth(), 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(GOLD_INK[0], GOLD_INK[1], GOLD_INK[2]);
    doc.text('LENDER OFFER REQUEST — DEMO, NOT SENT', margin + 8, 40);
    y = 62;
    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(LOR_TEAL[0], LOR_TEAL[1], LOR_TEAL[2]);
    doc.text('LOR', width() - margin - 70, 58);
  }

  write(model.title, 20, 'times', 'bold', NAVY, 4);
  write(`${model.ref} · ${model.version} · ${model.date}`, 10, 'helvetica', 'normal', MUTED, 4);
  if (model.kind === 'lor') {
    write('DEMO — NOT SENT', 10, 'helvetica', 'bold', GOLD_INK, 4);
    write(model.contact, 10, 'helvetica', 'normal', NAVY, 6);
    write(model.headline, 13, 'times', 'bold', NAVY, 4);
    write(model.pills, 10, 'helvetica', 'bold', LOR_TEAL, 8);
  }

  for (const block of model.blocks) {
    ensure(20);
    if (block.type === 'h') write(block.text, 13, 'times', 'bold', NAVY, 4);
    else if (block.type === 'callout') write(block.text, 11, 'helvetica', 'bold', RED, 8);
    else if (block.type === 'p' || block.type === 'note') write(block.text, 10, 'helvetica', 'normal', NAVY, 8);
    else if (block.type === 'tiles') {
      if (block.caption) write(block.caption, 10, 'helvetica', 'bold', NAVY, 4);
      table(['Figure', 'Amount'], block.items.map((item) => [item.label, `${item.value} — subject to status`]));
    } else if (block.type === 'table') {
      if (block.caption) write(block.caption, 10, 'helvetica', 'bold', NAVY, 4);
      table(block.head, block.rows);
    } else if (block.type === 'sign') {
      write(block.title, 12, 'times', 'bold', NAVY, 2);
      write('Signature (placeholder)', 10, 'helvetica', 'normal', MUTED, 2);
      write('Name', 10, 'helvetica', 'normal', MUTED, 2);
      write('Date', 10, 'helvetica', 'normal', MUTED, 8);
    }
  }
  write(BROKER_LINE, 9, 'helvetica', 'normal', MUTED, 4);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.14 }));
    doc.setFont('times', 'bold');
    doc.setFontSize(90);
    doc.setTextColor(150, 150, 150);
    doc.text('TEST', width() / 2, height() / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Demo document · TEST data · not for issue · page ${page} of ${pages}`, width() / 2, height() - 22, { align: 'center' });
  }
  return Buffer.from(doc.output('arraybuffer'));
}

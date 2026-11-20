import { jsPDF } from "jspdf";
import { autoTable, type RowInput } from "jspdf-autotable";
import type { Brand } from "@/lib/brands";
import { POSFIN_FOOTER } from "@/lib/brands";
import { gbp, pct } from "@/lib/engine/money";
import type { ALStatement } from "./al-rows";
import type { WorksStatement } from "./works-rows";

export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Standard PDF fonts are WinAnsi: map the few glyphs they lack. */
export const T = (s: unknown) => String(s ?? "").replace(/\u2212/g, "-").replace(/→/g, "->").replace(/[^\x00-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u20AC]/g, "");
export const M = (n: number | null | undefined) => T(gbp(n ?? null, { dp: 0, blank: "" }));

export interface Ctx { doc: jsPDF; brand: Brand; ink: RGB; accent: RGB; W: number; H: number; m: number }

export function header(c: Ctx, title: string, right: string[]) {
  const { doc, brand, m, W } = c;
  if (brand.kind === "neutral") {
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...c.ink).text(T(title.toUpperCase()), m, 16);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(15).setCharSpace(1.6).setTextColor(...hex("#0A1A33")).text("POSFIN", m, 15);
    const w = doc.getTextWidth("POSFIN") + 6 * 1.6 + 2.5;
    doc.setTextColor(...hex("#01BAB5")).text("CAPITAL", m + w, 15);
    doc.setCharSpace(0);
    doc.setFont("times", "bold").setFontSize(12).setTextColor(...c.ink).text(T(title), m, 22);
  }
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90, 105, 125);
  right.forEach((r, i) => doc.text(T(r), W - m, 11 + i * 4.6, { align: "right" }));
  doc.setDrawColor(...c.accent).setLineWidth(0.8).line(m, 26, W - m, 26);
}

export function footer(c: Ctx, note: string) {
  const { doc, brand, m, W, H } = c;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(221, 227, 235).setLineWidth(0.2).line(m, H - 12, W - m, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(110, 120, 135);
    doc.text(T(note), m, H - 8);
    if (brand.kind !== "neutral") doc.text(T(POSFIN_FOOTER), m, H - 4.5);
    doc.text(`Page ${i} of ${n}`, W - m, H - 8, { align: "right" });
  }
}

export function kpis(c: Ctx, y: number, tiles: [string, string, boolean?][]) {
  const { doc, m, W } = c;
  const gap = 3;
  const w = (W - 2 * m - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value, neg], i) => {
    const x = m + i * (w + gap);
    doc.setFillColor(...(i === 0 ? c.ink : ([244, 246, 249] as RGB))).roundedRect(x, y, w, 17, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...((i === 0 ? [180, 195, 215] : [100, 115, 135]) as RGB)).text(T(label.toUpperCase()), x + 4, y + 5.5);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...((neg ? [180, 35, 24] : i === 0 ? [255, 255, 255] : c.ink) as RGB)).text(T(value), x + 4, y + 13);
  });
  return y + 17;
}

export function table(c: Ctx, y: number, title: string, head: string[], body: RowInput[], foot: RowInput | RowInput[] | null, numericCols: number[], opts: { x?: number; width?: number; colWidths?: Record<number, number>; fontSize?: number; cellHook?: (d: { section: string; column: { index: number }; cell: { styles: { textColor: unknown } } }) => void } = {}) {
  const { doc, m } = c;
  doc.setFont("times", "bold").setFontSize(11).setTextColor(...c.ink).text(T(title), opts.x ?? m, y + 4);
  const styles: Record<number, { halign: "right"; cellWidth?: number }> = {};
  numericCols.forEach((i) => (styles[i] = { halign: "right" }));
  Object.entries(opts.colWidths ?? {}).forEach(([k, v]) => ((styles[+k] = { ...(styles[+k] ?? {}), cellWidth: v } as never)));
  autoTable(doc, {
    startY: y + 6,
    margin: { left: opts.x ?? m, right: opts.width ? c.W - (opts.x ?? m) - opts.width : m, bottom: 16, top: 14 },
    tableWidth: opts.width ?? "auto",
    head: [head.map(T)],
    body: body.length ? body : [[{ content: "None declared", colSpan: head.length, styles: { textColor: [120, 130, 145], fontStyle: "italic" } }]],
    foot: foot ? (Array.isArray((foot as unknown[])[0]) ? (foot as RowInput[]) : [foot as RowInput]) : undefined,
    theme: "plain",
    styles: { font: "helvetica", fontSize: opts.fontSize ?? 7.6, cellPadding: { top: opts.fontSize ? 0.9 : 1.25, bottom: opts.fontSize ? 0.9 : 1.25, left: 1.6, right: 1.6 }, textColor: c.ink, lineColor: [230, 234, 240], lineWidth: { bottom: 0.2 } as never, overflow: "linebreak" },
    headStyles: { fillColor: c.ink, textColor: 255, fontStyle: "bold", fontSize: 6.8 },
    footStyles: { fillColor: [230, 247, 246], textColor: c.ink, fontStyle: "bold", lineWidth: { top: 0.5 } as never, lineColor: c.ink },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: styles,
    didParseCell: (d) => { if ((d.section === "head" || d.section === "foot") && numericCols.includes(d.column.index)) d.cell.styles.halign = "right"; opts.cellHook?.(d as never); },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function ctxFor(brand: Brand): Ctx {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: "Statement", creator: brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink" });
  return { doc, brand, ink: hex(brand.kind === "neutral" ? brand.colours.ink : "#0A1A33"), accent: hex(brand.kind === "neutral" ? "#9CA3AF" : "#01BAB5"), W: 297, H: 210, m: 12 };
}

export function alPdf(s: ALStatement, brand: Brand, meta: { date: string; ref: string }): Buffer {
  const c = ctxFor(brand);
  const t = s.totals;
  header(c, "Assets & Liabilities Statement", [`Applicant: ${[s.applicant, s.joint].filter(Boolean).join(" & ")}`, s.company ? `Company: ${s.company}` : "", `Date completed: ${meta.date}`, `Ref: ${meta.ref}`].filter(Boolean));
  let y = kpis(c, 30, [
    ["Net worth", M(s.summary.net), s.summary.net < 0],
    ["Total assets", M(t.total_assets)],
    ["Total liabilities", M(t.total_liabilities)],
    ["Property equity", M(t.equity)],
    ["Portfolio LTV", T(pct(t.portfolio_ltv))],
    ["Rent / month", M(t.rent_monthly)],
    ["Commitments / month", M(t.monthly_commitments)],
  ]);
  y = table(c, y + 4, `Assets — Property (${s.property.length})`,
    ["Registered owner", "Property address", "Type", "Purchased", "Value", "Rent / m", "Mortgage / m", "Lender", "Charge", "Balance", "LTV", "Equity"],
    s.property.map((p) => [T(p.owner), T(`${p.address}${p.postcode ? ", " + p.postcode : ""}`), T(p.type), T(p.purchase_date), M(p.value), M(p.rent_monthly), M(p.mortgage_payment), T(p.lender), T(p.charge), M(p.balance), T(p.ltv === null ? "" : pct(p.ltv)), M(p.equity)]),
    ["", "Totals", "", "", M(t.property_value), M(t.property_rent), M(t.property_payments), "", "", M(t.mortgages), T(pct(t.portfolio_ltv)), M(t.equity)],
    [4, 5, 6, 9, 10, 11], { colWidths: { 0: 30, 1: 62 } });
  if (y > 150) { c.doc.addPage(); y = 14; }
  const half = (c.W - 2 * c.m - 6) / 2;
  const startY = y + 4;
  const startPage = c.doc.getCurrentPageInfo().pageNumber;
  const y1 = table(c, startY, "Assets — Other", ["Registered name", "Description", "Purchased", "Lender", "Value", "Owed"],
    s.other.map((o) => [T(o.owner), T(o.description), T(o.purchase_date), T(o.lender), M(o.value), M(o.owed)]),
    ["", "Totals", "", "", M(t.other_value), M(t.other_owed)], [4, 5], { width: half, colWidths: { 0: 26, 1: 44 } });
  const leftEnd = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(startPage);
  const y2 = table(c, startY, "Liabilities (excluding mortgages above)", ["Registered name", "Description", "Lender", "Rate", "Owed", "Monthly"],
    s.liab.map((l) => [T(l.owner), T(l.description), T(l.lender), T(l.rate), M(l.balance), M(l.monthly)]),
    ["", "Totals", "", "", M(t.liab_balance), M(t.liab_monthly)], [4, 5], { x: c.m + half + 6, width: half, colWidths: { 0: 26, 1: 44 } });
  const rightEnd = c.doc.getCurrentPageInfo().pageNumber;
  if (leftEnd > rightEnd) { c.doc.setPage(leftEnd); y = y1; }
  else if (rightEnd > leftEnd) { c.doc.setPage(rightEnd); y = y2; }
  else y = Math.max(y1, y2);
  if (y > 182) { c.doc.addPage(); y = 14; }
  // summary strip (Albatross summary block, reconciled)
  const sy = y + 4, sw = c.W - 2 * c.m;
  c.doc.setFillColor(244, 246, 249).roundedRect(c.m, sy, sw, 11, 2, 2, "F");
  const cells: [string, number, boolean?][] = [["Property (net of mortgages)", s.summary.property_net], ["Other assets (net of finance)", s.summary.other_net], ["Less liabilities", -s.summary.liabilities], ["Net worth", s.summary.net, true]];
  const cw = sw / cells.length;
  cells.forEach(([k, v, bold], i) => {
    const x = c.m + i * cw + 4;
    c.doc.setFont("helvetica", "bold").setFontSize(6.3).setTextColor(100, 115, 135).text(T(k.toUpperCase()), x, sy + 4.2);
    c.doc.setFont("helvetica", "bold").setFontSize(bold ? 10.5 : 9.5).setTextColor(...((bold && v < 0 ? [180, 35, 24] : c.ink) as RGB)).text(M(v), x, sy + 9);
  });
  footer(c, "Prepared from information supplied by the applicant via SmartLink. Not verified. For lender use in assessing the application.");
  return Buffer.from(c.doc.output("arraybuffer"));
}

export function worksPdf(s: WorksStatement, brand: Brand, meta: { date: string; ref: string }): Buffer {
  const c = ctxFor(brand);
  const borrower = s.facts.find(([k]) => k === "Borrower")?.[1] ?? "";
  header(c, "Schedule of Works", [`Borrower: ${borrower}`, `Date: ${meta.date}`, `Ref: ${meta.ref}`]);
  let y = kpis(c, 30, [
    ["Total inc. contingency", M(s.t.total)],
    ["Works subtotal", M(s.t.subtotal)],
    [`Contingency ${s.t.contingency_pct}%`, M(s.t.contingency)],
    ["Programme", s.t.programme_weeks ? `${s.t.programme_weeks} weeks` : "-"],
    ["GDV", s.t.gdv ? M(s.t.gdv) : "-"],
    ["Works / GDV", T(pct(s.t.cost_to_gdv))],
  ]);
  // facts block (two columns)
  const facts = s.facts.filter(([k]) => k !== "Borrower");
  autoTable(c.doc, {
    startY: y + 4, margin: { left: c.m, right: c.m }, theme: "plain",
    body: chunkPairs(facts).map(([a, b]) => [T(a?.[0]), T(a?.[1]), T(b?.[0]), T(b?.[1])]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.05, textColor: c.ink },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 34, textColor: [90, 105, 125] }, 2: { fontStyle: "bold", cellWidth: 34, textColor: [90, 105, 125] } },
  });
  y = (c.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  if (s.summary) { c.doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...c.ink); const lines = c.doc.splitTextToSize(T(s.summary), c.W - 2 * c.m); c.doc.text(lines, c.m, y + 5); y += 3 + lines.length * 4; }
  y = table(c, y + 2, `Works (${s.lines.length} lines)`, ["#", "Trade", "Description of works", "Weeks", "Cost (inc. VAT)", "% of works"],
    s.lines.map((l) => [String(l.n), T(l.category), T(l.description), l.weeks === null ? "" : String(l.weeks), M(l.cost), T(pct(l.share))]),
    [["", "", "Works subtotal", "", M(s.t.subtotal), "100%"], ["", "", `Contingency (${s.t.contingency_pct}%)`, "", M(s.t.contingency), ""], ["", "", "Total cost of works (inc. contingency)", "", M(s.t.total), ""]],
    [3, 4, 5], { colWidths: { 0: 8, 1: 42, 3: 16, 4: 30, 5: 22 } });
  footer(c, "Costs as supplied by the borrower, including labour and VAT. A high-level schedule for lender and valuer review; not a priced bill of quantities. Not verified.");
  return Buffer.from(c.doc.output("arraybuffer"));
}

function chunkPairs<T>(xs: T[]): [T | undefined, T | undefined][] {
  const out: [T | undefined, T | undefined][] = [];
  const half = Math.ceil(xs.length / 2);
  for (let i = 0; i < half; i++) out.push([xs[i], xs[i + half]]);
  return out;
}

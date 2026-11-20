import ExcelJS from "exceljs";
import type { Brand } from "@/lib/brands";
import { POSFIN_FOOTER } from "@/lib/brands";
import { AL_LIAB_COLS, AL_OTHER_COLS, AL_PROPERTY_COLS, type ALStatement } from "./al-rows";
import { WORKS_COLS, type WorksStatement } from "./works-rows";

const NAVY = "FF0A1A33";
const TEAL_SOFT = "FFE6F7F6";
const GBP = '"£"#,##0;[Red]-"£"#,##0';
const PCT = "0.0%";

function hdr(ws: ExcelJS.Worksheet, row: number, cols: readonly string[], startCol = 2, fill = NAVY) {
  cols.forEach((c, i) => {
    const cell = ws.getCell(row, startCol + i);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 30;
}

function section(ws: ExcelJS.Worksheet, row: number, title: string, note?: string) {
  const c = ws.getCell(row, 2);
  c.value = title;
  c.font = { bold: true, size: 13, color: { argb: NAVY } };
  if (note) {
    const n = ws.getCell(row + 1, 2);
    n.value = note;
    n.font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  }
}

function totalRow(ws: ExcelJS.Worksheet, row: number, from: number, to: number) {
  ws.getRow(row).eachCell({ includeEmpty: false }, (c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } };
    c.border = { top: { style: "medium", color: { argb: NAVY } } };
  });
  void from; void to;
}

function brandTitle(ws: ExcelJS.Worksheet, brand: Brand, title: string) {
  ws.getCell("B2").value = brand.kind === "neutral" ? title.toUpperCase() : "POSFIN CAPITAL";
  ws.getCell("B2").font = { bold: true, size: 16, color: { argb: NAVY } };
  ws.getCell("B3").value = brand.kind === "neutral" ? "" : title;
  ws.getCell("B3").font = { size: 12, color: { argb: "FF007C78" } };
}

export async function alXlsx(s: ALStatement, brand: Brand, meta: { date: string; ref: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink";
  const ws = wb.addWorksheet("A&L", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 2 }, { width: 24 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 18 }, { width: 10 }];
  brandTitle(ws, brand, "Assets and Liabilities");
  ws.getCell("F5").value = "Applicant:"; ws.getCell("G5").value = [s.applicant, s.joint].filter(Boolean).join(" & ");
  ws.getCell("I5").value = "Date completed:"; ws.getCell("J5").value = meta.date;
  ws.getCell("F6").value = "Reference:"; ws.getCell("G6").value = meta.ref;
  ["F5", "I5", "F6"].forEach((k) => (ws.getCell(k).font = { bold: true }));

  let r = 8;
  section(ws, r, "Assets — Property"); r += 1;
  hdr(ws, r, AL_PROPERTY_COLS); r += 1;
  const pStart = r;
  for (const p of s.property) {
    const row = ws.getRow(r);
    row.values = [null, p.owner, `${p.address}${p.postcode ? ", " + p.postcode : ""}`, p.type, p.purchase_date, p.value, p.rent_monthly, p.mortgage_payment, p.lender, p.charge, p.balance];
    ws.getCell(r, 12).value = { formula: `IF(K${r},K${r}/F${r},0)`, result: p.ltv ?? 0 };
    r++;
  }
  const pEnd = Math.max(r - 1, pStart);
  if (!s.property.length) { ws.getCell(r, 3).value = "No property owned"; r++; }
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${pStart}:F${pEnd})`, result: s.totals.property_value };
  ws.getCell(r, 7).value = { formula: `SUM(G${pStart}:G${pEnd})`, result: s.totals.property_rent };
  ws.getCell(r, 8).value = { formula: `SUM(H${pStart}:H${pEnd})`, result: s.totals.property_payments };
  ws.getCell(r, 11).value = { formula: `SUM(K${pStart}:K${pEnd})`, result: s.totals.mortgages };
  ws.getCell(r, 12).value = { formula: `IF(F${r},K${r}/F${r},0)`, result: s.totals.portfolio_ltv ?? 0 };
  totalRow(ws, r, pStart, pEnd);
  const pTot = r;
  for (let i = pStart; i <= r; i++) { [6, 7, 8, 11].forEach((c) => (ws.getCell(i, c).numFmt = GBP)); ws.getCell(i, 12).numFmt = PCT; }
  r += 2;

  section(ws, r, "Assets — Other", "Current and savings accounts, investments, pensions, vehicles, art, collectables, business interests"); r += 2;
  hdr(ws, r, AL_OTHER_COLS); r += 1;
  const oStart = r;
  for (const o of s.other) { ws.getRow(r).values = [null, o.owner, o.description, o.purchase_date, o.lender, o.value, o.owed]; r++; }
  const oEnd = Math.max(r - 1, oStart);
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${oStart}:F${oEnd})`, result: s.totals.other_value };
  ws.getCell(r, 7).value = { formula: `SUM(G${oStart}:G${oEnd})`, result: s.totals.other_owed };
  totalRow(ws, r, oStart, oEnd);
  const oTot = r;
  for (let i = oStart; i <= r; i++) [6, 7].forEach((c) => (ws.getCell(i, c).numFmt = GBP));
  r += 2;

  section(ws, r, "Liabilities", "Credit cards, personal loans, bridges, director’s loans, tax and other debts (mortgages shown above). Each debt over £10,000 itemised."); r += 2;
  hdr(ws, r, AL_LIAB_COLS); r += 1;
  const lStart = r;
  for (const l of s.liab) { ws.getRow(r).values = [null, l.owner, l.description, l.lender, l.rate, l.balance, l.monthly]; r++; }
  const lEnd = Math.max(r - 1, lStart);
  ws.getCell(r, 5).value = "Totals";
  ws.getCell(r, 6).value = { formula: `SUM(F${lStart}:F${lEnd})`, result: s.totals.liab_balance };
  ws.getCell(r, 7).value = { formula: `SUM(G${lStart}:G${lEnd})`, result: s.totals.liab_monthly };
  totalRow(ws, r, lStart, lEnd);
  const lTot = r;
  for (let i = lStart; i <= r; i++) [6, 7].forEach((c) => (ws.getCell(i, c).numFmt = GBP));
  r += 2;

  section(ws, r, "Summary"); r += 1;
  const sumRows: [string, string, number][] = [
    ["Total assets — property (net of mortgages)", `F${pTot}-K${pTot}`, s.summary.property_net],
    ["Total assets — other (net of finance)", `F${oTot}-G${oTot}`, s.summary.other_net],
    ["Total liabilities", `F${lTot}`, s.summary.liabilities],
  ];
  const first = r;
  for (const [label, f, v] of sumRows) { ws.getCell(r, 9).value = label; ws.getCell(r, 11).value = { formula: f, result: v }; ws.getCell(r, 11).numFmt = GBP; r++; }
  ws.getCell(r, 9).value = "Net worth";
  ws.getCell(r, 11).value = { formula: `K${first}+K${first + 1}-K${first + 2}`, result: s.summary.net };
  ws.getCell(r, 11).numFmt = GBP;
  [9, 11].forEach((c) => { ws.getCell(r, c).font = { bold: true, size: 12 }; ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } }; });
  r += 2;
  ws.getCell(r, 2).value = "Prepared from information supplied by the applicant. Not verified.";
  ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  if (brand.kind !== "neutral") { ws.getCell(r + 1, 2).value = POSFIN_FOOTER; ws.getCell(r + 1, 2).font = { size: 9, color: { argb: "FF5B6B82" } }; }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function worksXlsx(s: WorksStatement, brand: Brand, meta: { date: string; ref: string }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Schedule of works", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 2 }, { width: 6 }, { width: 26 }, { width: 60 }, { width: 10 }, { width: 18 }, { width: 12 }];
  brandTitle(ws, brand, "Schedule of works");
  let r = 5;
  for (const [k, v] of s.facts) { ws.getCell(r, 2).value = k; ws.getCell(r, 2).font = { bold: true }; ws.mergeCells(r, 2, r, 3); ws.getCell(r, 4).value = v; r++; }
  if (s.summary) { ws.getCell(r, 2).value = "Summary"; ws.getCell(r, 2).font = { bold: true }; ws.mergeCells(r, 2, r, 3); ws.getCell(r, 4).value = s.summary; ws.getCell(r, 4).alignment = { wrapText: true }; r++; }
  r++;
  hdr(ws, r, WORKS_COLS); r++;
  const start = r;
  for (const l of s.lines) {
    ws.getRow(r).values = [null, l.n, l.category, l.description, l.weeks, l.cost];
    ws.getCell(r, 7).value = { formula: `IF($F$${start + s.lines.length},F${r}/$F$${start + s.lines.length},0)`, result: l.share };
    r++;
  }
  const end = Math.max(r - 1, start);
  ws.getCell(r, 4).value = "Works subtotal"; ws.getCell(r, 6).value = { formula: `SUM(F${start}:F${end})`, result: s.t.subtotal }; totalRow(ws, r, start, end);
  const sub = r; r++;
  ws.getCell(r, 4).value = `Contingency`; ws.getCell(r, 5).value = s.t.contingency_pct / 100; ws.getCell(r, 5).numFmt = PCT;
  ws.getCell(r, 6).value = { formula: `F${sub}*E${r}`, result: s.t.contingency }; r++;
  ws.getCell(r, 4).value = "Total cost of works (inc. contingency)"; ws.getCell(r, 6).value = { formula: `F${sub}+F${r - 1}`, result: s.t.total }; totalRow(ws, r, start, end);
  for (let i = start; i <= r; i++) { ws.getCell(i, 6).numFmt = GBP; ws.getCell(i, 7).numFmt = PCT; ws.getCell(i, 4).alignment = { wrapText: true }; }
  r += 2;
  const vals: [string, number | null][] = [["Value today", s.t.current_value], ["Value after works (GDV)", s.t.gdv], ["Uplift", s.t.uplift]];
  for (const [k, v] of vals) if (v !== null) { ws.getCell(r, 4).value = k; ws.getCell(r, 6).value = v; ws.getCell(r, 6).numFmt = GBP; r++; }
  if (s.t.cost_to_gdv !== null) { ws.getCell(r, 4).value = "Total works / GDV"; ws.getCell(r, 6).value = s.t.cost_to_gdv; ws.getCell(r, 6).numFmt = PCT; r++; }
  r++;
  ws.getCell(r, 2).value = `Prepared ${meta.date} · Ref ${meta.ref} · Costs as supplied by the borrower, including labour and VAT. Not verified.`;
  ws.getCell(r, 2).font = { italic: true, size: 9, color: { argb: "FF5B6B82" } };
  if (brand.kind !== "neutral") { ws.getCell(r + 1, 2).value = POSFIN_FOOTER; ws.getCell(r + 1, 2).font = { size: 9, color: { argb: "FF5B6B82" } }; }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

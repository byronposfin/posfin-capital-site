import ExcelJS from "exceljs";
import type { Brand } from "@/lib/brands";
import type { LenderStatement } from "@/lib/lender/summary";
import { placedProductRows } from "@/lib/lender/summary";
import { exitCell, ltvCell, rateCell, termCell } from "./lender-pdf";

const NAVY = "FF0A1A33";
const TEAL = "FF007C78";
const TONE: Record<string, string> = { Accept: "FFE7F7EF", "Case by case": "FFFFF4DC", Decline: "FFFDECEA", Yes: "FFE7F7EF", Maybe: "FFFFF4DC", No: "FFFDECEA" };
const page = { orientation: "landscape" as const, paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

function sheet(wb: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = wb.addWorksheet(name, { pageSetup: page, views: [{ showGridLines: false, state: "frozen", ySplit: 4 }] });
  ws.columns = [{ width: 2 }, ...widths.map((w) => ({ width: w }))];
  return ws;
}
function title(ws: ExcelJS.Worksheet, brand: Brand, t: string, sub: string) {
  ws.getCell("B1").value = brand.kind === "neutral" ? t.toUpperCase() : "POSFIN CAPITAL";
  ws.getCell("B1").font = { bold: true, size: 15, color: { argb: NAVY } };
  ws.getCell("B2").value = brand.kind === "neutral" ? sub : `${t} · ${sub}`;
  ws.getCell("B2").font = { size: 11, color: { argb: TEAL } };
}
function head(ws: ExcelJS.Worksheet, row: number, cols: string[]) {
  cols.forEach((c, i) => {
    const cell = ws.getCell(row, 2 + i);
    cell.value = c;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 28;
}
function rows(ws: ExcelJS.Worksheet, start: number, data: (string | number | null)[][], toneCol?: number) {
  data.forEach((r, i) => {
    const row = ws.getRow(start + i);
    r.forEach((v, j) => {
      const cell = row.getCell(2 + j);
      cell.value = v === null ? "" : v;
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFDDE3EB" } } };
    });
    if (toneCol !== undefined) {
      const v = String(r[toneCol] ?? "");
      if (TONE[v]) row.getCell(2 + toneCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONE[v] } };
    }
  });
  return start + data.length;
}

export async function lenderXlsx(s: LenderStatement, brand: Brand, meta: { date: string; ref: string; token: string }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = brand.kind === "neutral" ? "SmartLink" : "Posfin Capital SmartLink";
  const sub = `${s.profile.lender || "Lender"} · ${meta.date} · ${meta.ref}`;

  // 1 Summary
  let ws = sheet(wb, "Summary", [30, 22, 26, 12, 12, 18, 24, 18, 10, 24, 34]);
  title(ws, brand, "Lender Criteria Summary", sub);
  const pr = s.profile;
  const facts: [string, string][] = [
    ["Lender", pr.lender], ["Type", pr.type], ["NACFB patron", pr.nacfb], ["Regulated lending", pr.regulated_lending], ["Contact", pr.contact], ["Email", pr.email], ["BDM", pr.bdm],
    ["Regions", pr.regions.join(", ")], ["Exclusions", pr.exclusions], ["Borrower types", pr.borrower_types.join(", ")], ["Scope", pr.regulated_scope], ["Charge positions", pr.charge_positions.join(", ")],
    ["Behind senior debt", pr.subordinate], ["Product guide", [pr.guide, pr.guide_date].filter(Boolean).join(" · ")], ["Verification", "Lender-declared, unverified"],
  ];
  let r = 4;
  for (const [k, v] of facts.filter(([, v]) => v)) { ws.getCell(r, 2).value = k; ws.getCell(r, 2).font = { bold: true, color: { argb: "FF5B6B82" } }; ws.getCell(r, 3).value = v; ws.mergeCells(r, 3, r, 8); r++; }
  r += 1;
  head(ws, r, ["Product", "Loan", "Max leverage", "Basis", "Term", "Min interest", "Early exit", "Rate", "Arr. fee", "Interest", "Rollover"]);
  rows(ws, r + 1, s.products.map((p) => [p.label, `${p.min_loan ?? ""}–${p.max_loan ?? ""}`, ltvCell(p), p.ltv_basis, termCell(p), p.min_interest, exitCell(p), rateCell(p), p.arrangement_fee !== null ? `${p.arrangement_fee}%` : "", p.interest_options.join(", "), p.rollover === "n/a" ? "" : p.rollover]));

  // 2 Leverage grid
  ws = sheet(wb, "Leverage grid", [34, 30, 14, 14, 14, 12]);
  title(ws, brand, "Leverage by asset", sub);
  head(ws, 4, ["Product", "Asset / scheme", "Col A", "Col B", "Col C", "Basis"]);
  const lg: (string | number | null)[][] = [];
  for (const p of s.products) {
    lg.push([p.label, "Columns →", ...p.ltv_cols.concat(["", "", ""]).slice(0, 3), p.ltv_basis]);
    for (const [row, cells] of Object.entries(p.ltv)) lg.push(["", row, ...p.ltv_cols.concat(["", "", ""]).slice(0, 3).map((c) => (c && cells?.[c] ? Number(cells[c]) / 100 : null)), ""]);
  }
  const end = rows(ws, 5, lg);
  for (let i = 5; i < end; i++) for (const col of [4, 5, 6]) { const cell = ws.getCell(i, col); if (typeof cell.value === "number") cell.numFmt = "0%"; }

  // 3 Product terms (full detail)
  ws = sheet(wb, "Product terms", [34, 14, 14, 10, 10, 22, 12, 14, 10, 10, 10, 10, 10, 26, 30, 40]);
  title(ws, brand, "Product terms", sub);
  head(ws, 4, ["Product", "Min loan", "Max loan", "Term min", "Term max", "Min interest", "Exit after (m)", "Time used only", "ERC", "Rate from", "Rate to", "Arr. fee %", "Proc fee %", "Works funding", "Rollover detail", "Other"]);
  rows(ws, 5, s.products.map((p) => [p.label, p.min_loan, p.max_loan, p.term_min, p.term_max, p.min_interest, p.exit_after_months, p.interest_time_used, p.erc, p.rate_from, p.rate_to, p.arrangement_fee, p.proc_fee, p.works, Object.entries(p.rollover_detail).map(([k, v]) => `${k}: ${v}`).join("; "), [p.notes, ...Object.entries(p.extra).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join("; ")]));

  // 4 Appetite & tolerance
  ws = sheet(wb, "Appetite & hair", [24, 52, 16, 44]);
  title(ws, brand, "Asset appetite & hair on the deal", sub);
  ws.getCell("B3").value = `Overall: ${s.appetite.style || "—"} · Credit look-back: ${s.hair.lookback || "—"}`;
  head(ws, 4, ["Group", "Item", "Appetite", "Note"]);
  r = rows(ws, 5, s.appetite.assets.map((a) => [a.group, a.label, a.value, a.note]), 2);
  r = rows(ws, r + 1, s.hair.rows.map((a) => [a.group, a.label, a.value, a.note]), 2);
  if (s.hair.auto_declines) { ws.getCell(r + 1, 2).value = "Automatic declines"; ws.getCell(r + 1, 2).font = { bold: true }; ws.getCell(r + 1, 3).value = s.hair.auto_declines; }

  // 5 Valuation & legals
  ws = sheet(wb, "Valuation & legals", [30, 70]);
  title(ws, brand, "Valuation & legals", sub);
  head(ws, 4, ["Item", "Detail"]);
  const v = s.valuation;
  rows(ws, 5, ([
    ["Valuation types", v.types.join(", ")], ["AVM max loan / LTV", `${v.avm[0] ?? ""} / ${v.avm[1] ?? ""}%`], ["Desktop max loan / LTV", `${v.desktop[0] ?? ""} / ${v.desktop[1] ?? ""}%`], ["Drive-by max loan / LTV", `${v.driveby[0] ?? ""} / ${v.driveby[1] ?? ""}%`],
    ["Conditions", v.conditions], ["Panel", v.panel], ["Turnaround", v.turnaround],
    ["Legal due diligence", s.legals.dd.join("; ")], ["Representation", s.legals.representation], ["Borrower's solicitor", s.legals.solicitor], ["Min partners", s.legals.min_partners],
    ["Pre-legal rounds", s.legals.ple_rounds], ["Valuation instructed", s.legals.val_instruction], ["Time to offer", s.legals.time_offer], ["Time to complete", s.legals.time_complete],
  ] as [string, string][]).filter(([, x]) => x && x !== " / %"));

  // 6 Case studies
  ws = sheet(wb, "Case studies", [36, 18, 70, 10, 40, 30]);
  title(ws, brand, "Case studies", sub);
  head(ws, 4, ["Scenario", "Type", "Key facts", "Answer", "Reason", "Signals"]);
  rows(ws, 5, s.cases.map((k) => [k.title, k.tag, k.facts.map(([a, b]) => `${a}: ${b}`).join(" · "), k.answer, k.reason, k.signals.join(", ")]), 3);

  // 7 Partnership & feedback
  ws = sheet(wb, "Partnership & feedback", [36, 70]);
  title(ws, brand, "Partnership & pilot feedback", sub);
  head(ws, 4, ["Question", "Answer"]);
  const pt = s.partnership, fb = s.feedback;
  rows(ws, 5, ([
    ["Mezz / 2nd behind developer senior debt", pt.mezz], ["Typical ticket", pt.ticket], ["Minimum deal", pt.min_deal],
    ["Route 1 · Loan notes: appetite", pt.loan_notes.appetite], ["Loan notes: ticket", pt.loan_notes.ticket], ["Loan notes: term", pt.loan_notes.term], ["Loan notes: target coupon", pt.loan_notes.coupon], ["Loan notes: security", pt.loan_notes.security.join("; ")],
    ["Route 2 · Preferred shares: response", pt.pref_shares.response], ["Splits (illustrative)", pt.pref_shares.splits.join(", ")], ["Preferred return sought", pt.pref_shares.pref], ["Variation", pt.pref_shares.variation], ["Illustrative example shown", pt.pref_shares.illustrative],
    ["Situations", pt.situations.join(", ")], ["How they'd like it to work", pt.notes], ["Sit-down", pt.meet],
    ["— Pilot feedback —", ""], ["Overall", fb.rating], ["Time taken", fb.minutes], ["What made sense", fb.clear], ["What we missed", fb.missing], ["Confusing / too long", fb.confusing], ["Send deals?", fb.send_deals], ["Call to go through?", fb.call],
  ] as [string, string][]).filter(([k, x]) => x || k.startsWith("—")));

  // 8 Gaps
  ws = sheet(wb, "Read-back & gaps", [30, 46, 14, 20, 20, 8]);
  title(ws, brand, "Read-back & gaps", `${sub} · guide ${s.gaps.extraction.file ?? "none"} (${s.gaps.extraction.status})`);
  head(ws, 4, ["Section", "Item", "Status", "Form", "Guide", "Page"]);
  rows(ws, 5, s.gaps.items.map((i) => [i.section, i.label, i.status, i.form ?? "", i.guide ?? "", i.page ?? ""]));

  // 9 PLACED rows (research workbook column order)
  ws = wb.addWorksheet("PLACED products", { views: [{ state: "frozen", ySplit: 1 }] });
  const pl = placedProductRows(s, { lender_id: `SL-${meta.token}`, checked_date: new Date().toISOString().slice(0, 10) });
  if (pl.length) {
    const cols = Object.keys(pl[0]).filter((k) => !["ltv_grid", "rollover_detail"].includes(k));
    ws.columns = cols.map((k) => ({ header: k, key: k, width: Math.min(Math.max(k.length + 2, 14), 40) }));
    pl.forEach((p) => ws.addRow(Object.fromEntries(cols.map((k) => [k, (p as Record<string, unknown>)[k] as never]))));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

import type { RowInput } from "jspdf-autotable";
import type { Brand } from "@/lib/brands";
import type { LenderStatement, ProductSummary, TolRow } from "@/lib/lender/summary";
import { gbpShort } from "@/lib/lender/summary";
import { ctxFor, footer, header, kpis, T, table, type Ctx } from "./pdf";

const P = (x: number | null) => (x === null ? "" : `${x}%`);
export const range = (a: number | null, b: number | null) => (a === null && b === null ? "" : `${gbpShort(a) || "?"}–${gbpShort(b) || "?"}`);
export function ltvCell(p: ProductSummary) {
  if (!p.ltv_cols.some((c) => /charge/.test(c))) {
    const parts = [p.max_day1 !== null && `D1 ${p.max_day1}%`, p.max_ltgdv !== null && `GDV ${p.max_ltgdv}%`, p.max_ltc !== null && `LTC ${p.max_ltc}%`, p.key === "mezz" && p.max_ltv_first !== null && `Total ${p.max_ltv_first}%`].filter(Boolean);
    return parts.join(" · ");
  }
  return [p.max_ltv_first !== null && `1st ${p.max_ltv_first}%`, p.max_ltv_second !== null && `2nd ${p.max_ltv_second}%`].filter(Boolean).join(" · ");
}
export const termCell = (p: ProductSummary) => (p.term_min === null && p.term_max === null ? "" : `${p.term_min ?? "?"}–${p.term_max ?? "?"}m`);
export const rateCell = (p: ProductSummary) => (p.rate_from === null ? "" : `${p.rate_from}${p.rate_to !== null ? `–${p.rate_to}` : ""}%${p.rate_basis === "Per annum" ? " pa" : " pm"}`);
export const exitCell = (p: ProductSummary) => [p.exit_after_months !== null ? `after ${p.exit_after_months}m` : "", p.interest_time_used === "Yes" ? "time used" : "", p.erc && p.erc !== "None" ? `ERC: ${p.erc}` : ""].filter(Boolean).join(", ");

function tolTable(rows: TolRow[]): RowInput[] {
  const groups = [...new Set(rows.map((r) => r.group))];
  return groups.map((g) => {
    const rs = rows.filter((r) => r.group === g);
    const list = (v: string) => rs.filter((r) => r.value === v).map((r) => r.label + (r.note ? ` (${r.note})` : "")).join("; ");
    return [T(g), T(list("Accept")), T(list("Case by case")), T(list("Decline"))];
  });
}

function tolColour(c: Ctx) {
  void c;
  return (d: { section: string; column: { index: number }; cell: { styles: { textColor: unknown } } }) => {
    if (d.section !== "body") return;
    if (d.column.index === 1) d.cell.styles.textColor = [22, 97, 63];
    if (d.column.index === 2) d.cell.styles.textColor = [122, 86, 0];
    if (d.column.index === 3) d.cell.styles.textColor = [155, 28, 28];
  };
}

export function lenderPdf(s: LenderStatement, brand: Brand, meta: { date: string; ref: string }): Buffer {
  const c = ctxFor(brand);
  const pr = s.profile;
  header(c, "Lender Criteria Summary", [`Lender: ${pr.lender || "—"}`, [pr.type, pr.nacfb === "Yes" ? "NACFB patron" : ""].filter(Boolean).join(" · "), `Date: ${meta.date}`, `Ref: ${meta.ref}`].filter(Boolean));
  let y = kpis(c, 30, [
    ["Products", String(s.headline.products)],
    ["Loan range", s.headline.loan_range || "—"],
    ["Max LTV 1st", P(s.headline.max_ltv_first) || "—"],
    ["Max LTV 2nd", P(s.headline.max_ltv_second) || "—"],
    ["Max LTGDV", P(s.headline.max_ltgdv) || "—"],
    ["Case studies Y/M/N", `${s.case_counts.yes} / ${s.case_counts.maybe} / ${s.case_counts.no}`],
    ["Open gaps", String(s.gaps.missing + s.gaps.conflicts), s.gaps.missing + s.gaps.conflicts > 0],
  ]);
  // profile strip
  const strip = [
    ["Regions", pr.regions.join(", ")], ["Borrowers", pr.borrower_types.join(", ")], ["Scope", pr.regulated_scope],
    ["Charges", pr.charge_positions.join(", ")], ["Behind senior debt", pr.subordinate], ["Sweet spot", [gbpShort(pr.sweet_loan), pr.sweet_ltv !== null ? `${pr.sweet_ltv}% LTV` : ""].filter(Boolean).join(" at ")],
  ].filter(([, v]) => v);
  c.doc.setFontSize(7.4);
  let x = c.m; y += 5;
  for (const [k, v] of strip) {
    const kw = c.doc.setFont("helvetica", "bold").getTextWidth(T(k + ": "));
    const vw = c.doc.setFont("helvetica", "normal").getTextWidth(T(v));
    if (x + kw + vw > c.W - c.m) { x = c.m; y += 4.2; }
    c.doc.setFont("helvetica", "bold").setTextColor(100, 115, 135).text(T(k + ": "), x, y);
    c.doc.setFont("helvetica", "normal").setTextColor(...c.ink).text(T(v), x + kw, y);
    x += kw + vw + 6;
  }
  y = table(c, y + 2, `Products (${s.products.length})`,
    ["Product", "Loan", "Max leverage", "Basis", "Term", "Min interest", "Early exit", "Rate", "Arr. fee", "Interest", "Rollover / extension"],
    s.products.map((p) => [T(p.label), T(range(p.min_loan, p.max_loan)), T(ltvCell(p)), T(p.ltv_basis), T(termCell(p)), T(p.min_interest), T(exitCell(p)), T(rateCell(p)), T(p.arrangement_fee !== null ? `${p.arrangement_fee}%` : ""), T(p.interest_options.join(", ")), T(p.rollover === "n/a" ? "" : p.rollover)]),
    null, [], { fontSize: 7, colWidths: { 9: 26, 0: 46, 1: 22, 2: 30, 3: 12, 4: 14, 5: 22, 6: 26, 7: 22, 8: 13 } });
  if (y > 150) { c.doc.addPage(); y = 14; }
  const half = (c.W - 2 * c.m - 6) / 2;
  const startY = y + 1.5;
  const startPage = c.doc.getCurrentPageInfo().pageNumber;
  const lw = (c.W - 2 * c.m - 6) * 0.42, rw = (c.W - 2 * c.m - 6) - lw;
  const y1 = tableTol(c, startY, `Asset appetite · ${s.appetite.style || "—"}`, tolTable(s.appetite.assets), { x: c.m, width: lw, colWidths: { 0: 19 } });
  const leftEnd = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(startPage);
  const y2 = tableTol(c, startY, `Hair on the deal · look-back ${s.hair.lookback || "—"}`, tolTable(s.hair.rows), { x: c.m + lw + 6, width: rw, colWidths: { 0: 19 } });
  const rightEnd = c.doc.getCurrentPageInfo().pageNumber;
  if (leftEnd > rightEnd) { c.doc.setPage(leftEnd); y = y1; } else if (rightEnd > leftEnd) { c.doc.setPage(rightEnd); y = y2; } else y = Math.max(y1, y2);

  // detail
  if (y > 110) { c.doc.addPage(); y = 14; } else y += 6;
  const ltvRows: RowInput[] = [];
  for (const p of s.products) for (const [row, cells] of Object.entries(p.ltv)) {
    const vals = p.ltv_cols.filter((col) => cells?.[col]).map((col) => `${col} ${cells[col]}%`);
    if (vals.length) ltvRows.push([T(p.short), T(row), T(vals.join(" · "))]);
  }
  const s1 = c.doc.getCurrentPageInfo().pageNumber;
  const ya = table(c, y, "Leverage grid by asset (lender-declared maxima)", ["Product", "Asset / scheme", "Max leverage"], ltvRows, null, [], { width: half, colWidths: { 0: 26, 1: 40 } });
  const e1 = c.doc.getCurrentPageInfo().pageNumber;
  c.doc.setPage(s1);
  const v = s.valuation;
  const valRows: RowInput[] = [
    ["Valuation types", T(v.types.join(", "))],
    v.avm[0] !== null || v.avm[1] !== null ? ["AVM", T(`to ${gbpShort(v.avm[0])} / ${P(v.avm[1])} LTV`)] : null,
    v.desktop[0] !== null || v.desktop[1] !== null ? ["Desktop", T(`to ${gbpShort(v.desktop[0])} / ${P(v.desktop[1])} LTV`)] : null,
    v.driveby[0] !== null || v.driveby[1] !== null ? ["Drive-by", T(`to ${gbpShort(v.driveby[0])} / ${P(v.driveby[1])} LTV`)] : null,
    v.conditions ? ["Conditions", T(v.conditions)] : null, v.panel ? ["Panel", T(v.panel)] : null, v.turnaround ? ["Turnaround", T(v.turnaround)] : null,
    ["Legal due diligence", T(s.legals.dd.join("; "))], ["Representation", T(s.legals.representation)], ["Borrower's solicitor", T(s.legals.solicitor)],
    ["Pre-legal rounds", T(s.legals.ple_rounds)], ["Valuation instructed", T(s.legals.val_instruction)], ["Offer / completion", T([s.legals.time_offer, s.legals.time_complete].filter(Boolean).join(" / "))],
  ].filter((r): r is string[] => Boolean(r && r[1]));
  const yb = table(c, y, "Valuation & legals", ["Item", "Detail"], valRows, null, [], { x: c.m + half + 6, width: half, colWidths: { 0: 38 } });
  const e2 = c.doc.getCurrentPageInfo().pageNumber;
  if (e1 > e2) { c.doc.setPage(e1); y = ya; } else if (e2 > e1) { c.doc.setPage(e2); y = yb; } else y = Math.max(ya, yb);
  if (y > 150) { c.doc.addPage(); y = 14; }
  y = table(c, y + 4, `Case studies · ${s.case_counts.yes} yes, ${s.case_counts.maybe} maybe, ${s.case_counts.no} no`, ["Scenario", "Type", "Key facts", "Answer", "Reason"],
    s.cases.map((k) => [T(k.title), T(k.tag), T(k.facts.slice(0, 4).map(([a, b]) => `${a} ${b}`).join(" · ")), { content: T(k.answer || "—"), styles: { fontStyle: "bold", textColor: k.answer === "Yes" ? [22, 97, 63] : k.answer === "No" ? [155, 28, 28] : [122, 86, 0] } }, T(k.reason)]),
    null, [], { colWidths: { 0: 62, 1: 30, 2: 82, 3: 16 } });
  const rb = s.products.filter((p) => Object.keys(p.rollover_detail).length);
  if (rb.length) {
    if (y > 170) { c.doc.addPage(); y = 14; }
    y = table(c, y + 4, "Rollovers & extensions", ["Product", "Offered", "Max LTV", "Capital paydown", "Re-retain interest", "Fee", "Revaluation", "Max rollovers"],
      rb.map((p) => [T(p.label), T(p.rollover_offered), T(p.rollover_detail["Max LTV"] ?? ""), T(p.rollover_detail["Capital paydown"] ?? ""), T(p.rollover_detail["Re-retain interest"] ?? ""), T(p.rollover_detail["Fee"] ?? ""), T(p.rollover_detail["Revaluation"] ?? ""), T(p.rollover_detail["Max rollovers"] ?? "")]), null, [], { colWidths: { 0: 60 } });
  }
  const pt = s.partnership;
  if (pt.mezz || pt.loan_notes.appetite || pt.pref_shares.response || pt.meet) {
    if (y > 165) { c.doc.addPage(); y = 14; }
    const ln = pt.loan_notes, ps = pt.pref_shares;
    y = table(c, y + 4, "Partnership & mezzanine appetite (conversation starter, not terms)", ["Topic", "Response", "Detail"], [
      ["Mezz / 2nd behind developer senior", T(pt.mezz), T([pt.ticket && `ticket ${pt.ticket}`, pt.min_deal && `min ${pt.min_deal}`].filter(Boolean).join(" · "))],
      ["Route 1 · Loan notes", T(ln.appetite), T([ln.ticket, ln.term, ln.coupon, ln.security.join(" / ")].filter(Boolean).join(" · "))],
      ["Route 2 · Preferred shares + profit share", T(ps.response), T([ps.splits.length ? `splits ${ps.splits.join(", ")}` : "", ps.pref, ps.variation].filter(Boolean).join(" · "))],
      ["Situations", T(pt.situations.join(", ")), ""],
      ["Sit-down", T(pt.meet), T(pt.notes)],
    ].filter((r) => r[1] || r[2]) as RowInput[], null, [], { colWidths: { 0: 62, 1: 52 } });
    c.doc.setFont("helvetica", "italic").setFontSize(6.6).setTextColor(100, 115, 135).text(T(`Route 2 illustrative example shown to the lender (not an offer): ${ps.illustrative}.`), c.m, y + 4, { maxWidth: c.W - 2 * c.m });
    y += 7;
  }
  const open = s.gaps.items.filter((i) => i.status !== "ok");
  if (open.length) {
    if (y > 170) { c.doc.addPage(); y = 14; }
    y = table(c, y + 4, `Read-back & gaps · guide: ${s.gaps.extraction.file ?? "none"} (${s.gaps.extraction.status})`, ["Section", "Item", "Status", "Form", "Guide", "Page"],
      open.map((i) => [T(i.section), T(i.label), { content: T(i.status === "missing" ? "Missing" : i.status === "conflict" ? "Conflict" : "From guide"), styles: { fontStyle: "bold", textColor: i.status === "conflict" ? [155, 28, 28] : i.status === "missing" ? [122, 86, 0] : [0, 124, 120] } }, T(i.form ?? ""), T(i.guide ?? ""), T(i.page ?? "")]), null, [], { colWidths: { 0: 50, 1: 80, 2: 22 } });
  }
  footer(c, "Lender-declared criteria via SmartLink. Unverified until checked against the written guide or a confirmed BDM response and approved by a reviewer. Not a commitment to lend.");
  return Buffer.from(c.doc.output("arraybuffer"));
}

function tableTol(c: Ctx, y: number, title: string, body: RowInput[], opts: { x: number; width: number; colWidths: Record<number, number> }) {
  // same as table() but with tone colours per column
  const start = y;
  const end = table(c, start, title, ["Group", "Accept", "Case by case", "Decline"], body, null, [], { ...opts, fontSize: 6.1, cellHook: tolColour(c) });
  return end;
}
export { tolColour };

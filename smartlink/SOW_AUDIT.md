# Schedule of Works — audit and format research (v001, 18 Nov 2026)

## 1. What is on file (searched all of /workspace)

Search: `rg -i 'schedule of works|works schedule|cost of works|refurb'` across every case folder (mazza, wirral, wirral_waters, newey, kurdi, lawal, stilwell, cosmo, adam_vers, somo, ackroyds, action sheets, EL templates).

| Where | What it says | Takeaway |
|---|---|---|
| `somo/JOE_CASH_CALL_SHEET_20261118_v001.md` (SOMO case, 17 Nov) | Lender told us **no valuer will quote until a Schedule of Works is provided**; confirmed it is **only the outstanding works**, not historic works. | SoW is a valuation blocker, so it must be quick to produce. Scope = works still to do. |
| Same file (27 Oct underwriting ask) | Lender asked for "use of funds / schedule of works, quotes or invoices for the refurb". Jess sent UOF + A&L; works/cost evidence still outstanding. | Pair the SoW with quotes. A single headline cost is not enough. |
| `wirral/TermsByronHill.txt`, `wirral/section_3B.md`, `wirral_waters/*`, `el_template/*` | Lender terms carry a standard **"Cost of Works (Construction costs & fees)"** line (£0 on those cases). | Our total should map to that line: **works + professional fees + contingency**. |
| `adam_vers/ADAM_VERS_EL_*` | Purpose of funds: "towards refurbishment works to buy-to-let investment property". | Refurb purpose shows up on ordinary bridges as well as development cases. |
| `tom_forms_brief/REMORTGAGE_QUESTIONNAIRE_SPEC_*` (building_works section) | Asks whether works are underway or planned, with details and consents. | The SoW link is the follow-up when the answer is yes. |

**I found no existing SoW template or completed schedule on file.** There was no xlsx, pdf or docx anywhere in /workspace. v001 is a new Posfin standard.

## 2. UK bridging / refurb lender formats researched (public PDFs, Nov 2026)

| Lender form | Fields |
|---|---|
| Hampshire Trust Bank, *Bridging Schedule of Works* | Borrower, security address, **type of work light / medium / heavy**, planning required; lines of *description, est. timeframe, cost inc. VAT*; total timeframe + total cost; declaration with print name and date; "attach quotes / FPCs / contracts". |
| United Trust Bank, *Bridging Schedule of Works* | Applicant, address, property type (main residence / BTL / commercial / semi-commercial); **light / heavy / structural**; planning required, granted, reference; **permitted development**; lines of *description, timescale, cost inc. VAT*; **contingency**; overall timeframe; total; recent experience on 2 similar projects or a qualified third party. |
| Redwood Bank, *Bridging Loan Schedule of Works* | Project type and scope, timescale, the third party doing the works; PD / planning required / granted / reference; lines of *description, timeframe, cost inc. VAT*; overall timeframe; total; contingency; 2 previous projects (budget against actual). |
| Precise Mortgages, *Schedule of Works (Bridging)* | Applicant, address; energy-efficiency improvements (checklist); lines of *description, time frame, total cost inc. labour and VAT*; **"labour costs must be included even if the applicant does the works themselves"**. |
| ScopeWise (SoW builder used by brokers) | Group by trade (strip-out, structural, roofing, electrics, plumbing, plastering, joinery, kitchen, bathrooms, decoration, externals); **10–15% contingency** (warn below 10%); programme; light / medium / heavy cost bands per m². |

## 3. What v001 captures (deliberately light, ≤ 20 lines)

- **Project:** borrower, property address and postcode, property type, project type (light refurb / heavy refurb / conversion / extension / ground-up), one-line summary, and units before and after (optional).
- **Consents and timing:** planning status (not required / PD / applied / granted / not yet applied) with a reference, building regs status, start date, duration in weeks, who does the works (main contractor + name / self-managed / myself), price basis (fixed / quoted / own estimate), and experience (optional).
- **Lines (1–20, hard cap):** trade from a preset list of 17 (strip-out & demolition, structural, roofing, windows & doors, electrics, plumbing & heating, kitchen, bathrooms, plastering & drylining, flooring, joinery, decoration, damp & timber, fire safety & compliance, external & landscaping, professional fees, other), plus a description, a cost **including labour and VAT**, and weeks (optional). The copy says "trades, not materials".
- **Contingency %** defaults to 10. There is a soft warning below 10%. Totals include contingency.
- **Values (optional):** value today, GDV and its basis. The app derives uplift and works/GDV.
- Declaration with a typed name.
- **Output:** a lender-ready A4 landscape statement (HTML print, PDF, XLSX with formulas, CRM JSON), in a Posfin-branded version and an unbranded "no-name" master.

Left out on purpose for v001: material/labour split, phased drawdown schedule, and room-by-room view. Those belong to monitoring-surveyor development cases. Add them only if Byron wants a "heavy" variant.

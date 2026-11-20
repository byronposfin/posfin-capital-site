# SmartLink · Lender Criteria intake (v001, 19 Nov 2026)

The fourth SmartLink section. A white-label, mobile-first link a friendly lender opens to give us their lending criteria once, in a structured shape that BROKA can capture against and PLACED can match on **after human verification**. It runs on the same schema engine, autosave/"Save & finish later", storage adapter, brands and PDF/XLSX/JSON exports as the A&L, Remortgage and Schedule of Works forms.

Status: local build only (`next start -p 3100`). Not deployed, nothing sent to any lender, no real client or lender data. The demo lender "Northgate Example Capital" is fictional.

## Routes

| Route | What |
|---|---|
| `/lender/demo` | Filled demo (all sections, simulated guide extraction with conflicts) |
| `/lender/demo-blank` | Blank form, as a lender would first see it |
| `/lender/demo?brand=unbranded` | White-label version (`lib/brands.ts`) |
| `/lender/[token]/summary` | Staff summary: KPIs, leverage grids, rollovers, appetite, case studies, partnership, gaps |
| `/api/forms/lender/[token]/pdf` | Landscape PDF (page 1 = one-page criteria sheet) |
| `/api/forms/lender/[token]/xlsx` | Workbook: Summary, Leverage grid, Product terms, Appetite & hair, Valuation & legals, Case studies, Partnership & feedback, Read-back & gaps, PLACED products |
| `/api/forms/lender/[token]/export` | Flat JSON for CRM + `placed` block (case_ref `LC-…`) |

## Sections (step order)

1. **About you** – lender name, type, contact, regulated scope.
2. **Reach** – regions, borrower types, sweet spot.
3. **Product guide (Recommended, primary path)** – upload the current guide, edition date, how often it changes. Fastest route: we read it back and only ask what's missing.
4. **Core products** – picker from an extensible catalog (`lib/lender/catalog.ts`, 15 products in 7 families: bridging, refurb, development, commercial, specialist incl. care homes/hotels and distressed/inventory stock, capital stack incl. mezzanine and equity/JV, term). Charge positions and appetite to sit second/behind senior debt.
5. **One product card per pick** – loan min/max; LTV grid by asset × charge (1st/2nd, or mezz/equity columns, LTGDV/LTC for development); LTV and valuation basis; works funding; term min/max; **minimum interest period** (months or % of term); **exit any time after X months**; **interest charged only for time used**; ERCs; rates and basis; fees; interest options (retained/serviced/rolled); **Rollovers & extensions** block on every bridging-type card (offered yes/case by case/no, max LTV to qualify, capital paydown accepted, interest re-retained, extension or new arrangement fee, fresh valuation, max number of rollovers).
6. **Valuation** – AVM / desktop / drive-by / full: allowed, max LTV, max loan, conditions, panel managers.
7. **Asset appetite** – 22 asset types, Accept / Case by case / Decline + note.
8. **"Hair on the deal"** – 36 factors in groups (credit, people, property, structure, exit), same 3-way control + note.
9. **Legals & process** – neutral: due-diligence route is a 5-option multi where title insurance is option 3 and not highlighted; dual/separate representation; borrower solicitor; PLE rounds; valuation instruction; times to offer/completion.
10. **Read-back & gap check** – staff-side panel comparing guide extraction vs form: complete / to check / missing, "Use guide" and "Fill in" actions; lender confirms.
11. **Case studies** – 11 fictional deals (incl. the rollover with capital paydown, cs11), Yes / Maybe / No + reason → appetite signals (1 / 0.5 / −1).
12. **Partnership & mezzanine appetite** – warm invitation, not a grid (see below).
13. **Feedback on this form** – for the friendly-lender pilot.
14. Review (lender snapshot) and declaration ("lender-declared, unverified, not a commitment to lend").

### Partnership section: two investment routes (steering 5)

Kept as an invitation ("An invitation · Let's talk"), with the notice: *nothing here is an offer or a commitment; any figures are an illustrative example, not an offer.*

- **Mezzanine**: would they sit behind a developer's senior debt; typical ticket; minimum deal (starts at £250k, so no tiny tickets).
- **Route 1 · Loan notes**: appetite, ticket size, term, target coupon, security preference (debenture over the lending vehicle / assignment of the underlying charges / unsecured with covenants / open).
- **Route 2 · Preferred shares with a profit share**: navy card titled **"Illustrative example, not an offer"**. The capital partner funds about 88% of each loan in cash. The managing partner's ~12% comes from its waived broker fee (sweat equity). The partner holds protected preferred shares with a preference on return of capital and limited voting, and control stays with the managing partner. Waterfall: 1) 2% a year management fee, 2) 10% a year preferred return paid monthly (0.833%), 3) 75/25 split above the hurdle (partner/managing partner). The question is "as illustrated / with a variation / a different split / not for us". On a variation: the splits they'd consider (75/25, 70/30, 60/40, 50/50, open), the preferred return they'd look for, and what they'd change.
- Situations they find interesting (distressed/stalled, unsold/inventory stock, value-add, ground-up, specialist), how they'd like it to work (free text), and **"Happy to sit down and discuss"**.
- No real people, funds or investors are named. The figures come from the internal structure workings but are shown only as an example.

## Data model

- `payload` = engine answers. Product fields are `p_<productKey>_<field>`. LTV grids are stored `{row:{col:"75"}}` and flatten to `<id>__row__col`. Tolerance notes are stored at `<id>_note`.
- `sheet_extraction` = `{status: none|queued|extracted|reviewed, file, extracted_at, method: manual|ai_assisted|simulated, reviewed_by, items:[{path,label,value,page}]}`. Gap check statuses: `missing`, `conflict` (guide ≠ form), `from_guide` (guide only, awaiting confirmation), `ok`.
- Migration (NOT run): `supabase/migrations/20261119_lender_criteria.sql` creates `lender_criteria`, `lender_products`, `lender_case_study_answers` and `lender_rule_proposals`, with RLS on and service role only. A CHECK constraint makes `approved/active` impossible without evidence, source, date, a reviewer and a different second approver.

## Mapping to BROKA / PLACED

Sources used:
- `/workspace/broka_placed/BROKA_PLACED_BRIEF_20261118_v001.md` §(e) "Lender intake form": field list, unverified until reviewer approval, uploads kept private.
- `/workspace/tom_handover_v003/BROKA_PLACED_OPERATING_HANDOVER_v003.md` (line 50, §D): criteria corrections stay proposals until written criteria / confirmed BDM response, then reviewer + second human approval, with old versions kept.
- `/workspace/jackie_ebanks/PLACED_Lender_Research_14Nov2026_v001.xlsx` (Products sheet): the column schema used for `placed.products` and the XLSX "PLACED products" sheet: research_lender_id, canonical_merged_id, lender, product, segment, security, first_charge, second_charge, max_ltv_first, max_ltv_second, advertised_ltv_unspecified_charge, ltv_basis, regulated, unregulated, business_purpose, development, max_ltgdv, max_ltc, build_cost_funding, avm_*/desktop_*, in_house_valuer, dual_rep, min/max_loan_gbp, min/max_term_months, geography, promotes, quirks, evidence_status, source_*, checked_date, guide_edition, freshness, field_provenance, review_notes, plus rate_from etc.
- `/workspace/tom_handover_v002/CASE_CAPTURE_TEMPLATE.csv`: the broka_* capture columns. Lender asset/hair tolerances line up with the case facts BROKA captures (asset type, LTV, charge, adverse, exit), so a case can be checked against declared appetite.

Every exported row has `evidence_status = lender_declared_unverified` and `matching_enabled = false`. Case-study answers go out as weighted appetite signals, not rules.

## Decline-feedback loop (`lib/lender/rules.ts`)

1. A decline is logged with the lender's own words, the reason keys and the case facts.
2. `proposalsFromDecline` drafts **PROPOSED** rule changes (LTV, asset, hair, location, loan size, term, or a manual review). Capacity declines create none.
3. `attachEvidence` records the written criteria or confirmed BDM response, with source ref, date and who captured it.
4. `approvalBlockers`/`approve` refuse approval without evidence, source, date and a named reviewer, plus (default policy) a *different* second approver. Approved rules get a version and effective date, and old versions are superseded but kept.
5. Only then does PLACED change. Guide/form conflicts from the read-back can feed the same queue (`trigger.kind = sheet_conflict`).

## White-label

All copy that names the firm comes from `lib/brands.ts` (`intro.lender`). `?brand=unbranded` gives a neutral version. Lender-facing copy names no lenders, no internal systems, no fraud databases and no people.

## Tests

`tests/lender.test.ts` covers gap-check conflicts and from-guide items, the `includes` condition, grid flattening, decline→proposal (capacity none), approval blockers and the second approver, PLACED columns and both partnership routes. `npm test` runs 40 tests, all passing; `tsc` and `next build` are clean.

## Open questions for Byron

1. Should the second approver be mandatory for every rule change, or only for LTV/loan-size changes? (Default: every change.)
2. Are the 11 case studies the right set? Should any reflect the ~50% LTV distressed/inventory-stock book more strongly?
3. Partnership wording: are you happy for Route 2's illustrative figures (88/12, 2% fee, 10% pref paid monthly, 75/25) to be shown to friendly lenders at all, or only after a first call?
4. Loan notes: which vehicle issues them, and should security options be narrowed?
5. Minimum mezz ticket: is £250k the right floor?
6. PLACED target tables: should verified products write into `lender_rules`/`lender_profiles` (both empty today) or new tables?
7. Pilot order: run your own lending profile through it first, then 3–5 friendly lenders?
8. Should the lender intake merge into the live SmartLink case record (Tom's request) or stay a separate link type?

## Known limits

- No real product guides were on the box (the requested sheets are not there; only a narrative mention), so extraction is **simulated** in the demo. The data model and read-back flow are real.
- Upload stores file metadata only. Private storage and an extraction worker are still to be built.
- No auth or staff review UI for proposals yet (logic and tests only). Tokens are demo tokens.
- Migration written, not run. Not deployed.

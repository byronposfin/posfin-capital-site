# Decisions, spec gaps and open questions (v001)

## Decisions made

**A&L**
- Required fields follow SPEC_AL_v001 exactly: name and email; per property, address, postcode, value and mortgage yes/no (+ lender and balance if yes); declaration and typed name. Everything else is optional or sits under "More detail".
- **£10k rule:** a grouped total over £10,000 blocks Continue live. A one-tap **"List it individually"** moves the amount into a new itemised card with the type prefilled. Itemised debts need type, creditor, balance and monthly payment.
- Vague lenders ("family", "TBC", "don't know") and a balance above the value get **soft warnings**, not blocks, per the spec.
- Rent is entered monthly *or* annually. Both are stored and shown converted.
- The statement keeps the Albatross three tables in Albatross column order. On top it adds an equity column, KPI tiles, a reconciled summary (property net + other net − liabilities = net worth, identical to the live net worth), applicant/date/ref and a basis note. The XLSX keeps live SUM/LTV formulas like the Albatross sheet.
- Added "Total monthly payments" for small grouped debts, so monthly commitments aren't understated.
- Wordmark is the text "POSFIN CAPITAL" (no dolphin logo). Teal is **#01BAB5**, the Posfin brand teal from the questionnaire handoff, rather than the brief's approximate #14B8A6.

**Remortgage**
- The spec JSON is loaded as-is (`lib/forms/remortgage.spec.json`) and adapted at runtime. A unit test checks that all 144 borrower-visible fields (142 questionnaire + 6 instruction-form extras, less 3 staff-only and `answers_accurate`) appear exactly once and that staff-only fields never render.
- **Title insurance section:** the approved spec already folded the SoMo/SM1 additions A–J into the general flow. As briefed, A (balance funds), H (business purpose), I (exit), J (insolvency) and C (nominated account) now sit in two steps badged **"Title insurance"**, shown when `titleInsurance` is on. **The default is ON** when a case doesn't say otherwise, which keeps the approved spec's "always asked". `?titleInsurance=0` or the case flag hides them. D and E (insurance and occupier tightening) stay inline because they refine existing questions. B (company) and G (purchase) keep their own gates.
- `answers_accurate` (Q-declaration) is captured by the shared declaration step. On submit it's set from that tick, with no duplicate checkbox.
- The `net_advance_account_in_all_borrowers_names` checkbox renders as Yes/No, because the spec has a dependant on "no".
- Internal help notes in the spec were replaced with borrower copy for email, DOB, NI and Q21, e.g. "On Ackroyds' Client Instruction Form…". A test blocks SM1 / SOMO / Charles Rose / Westcor / CIFAS / "Instruction Form" anywhere in borrower copy, and "Ackroyd" on the general brand.
- Fax and work phone sit under "More detail". Q21 wording, options and default come from the brand. Ackroyds defaults to "Introduced by Posfin Capital".
- The Ackroyds footer shows "Prepared by Posfin Capital, a broker not a lender, for Ackroyd Legal." **and** the FCA line.

**Schedule of Works**
- There is a hard cap of 20 lines, with trades from a preset list. Costs include labour and VAT, following Precise and HTB practice. Contingency defaults to 10%, with a warning below 10%. The total is works plus contingency. Professional fees are a trade line, so the total maps to lenders' "Cost of Works (construction costs & fees)".
- The unbranded master has no Posfin name, wordmark, colours or footer anywhere: form, statement, PDF or XLSX.

**Shared**
- Autosave (700 ms debounce), "Save & finish later", and resume at the last step. A submitted form re-opens on the thank-you screen and can't be overwritten by autosave (409).
- Uploads are metadata-only in v001 (see PORTING.md §5).

## Byron to decide
1. **Title insurance default:** keep ON for every case (matches the approved spec), or only when the case is flagged as title insurance?
2. **A&L joint applicants:** one shared statement with a joint name (current), or a separate statement per applicant?
3. **A&L max properties:** set to 25. OK?
4. **£10k threshold per item:** confirmed as per item (assumed in the spec).
5. **SoW heavy variant:** add a materials/labour split and drawdown phases for development cases, or keep v001 light?
6. **Statement visibility:** should borrowers see the A&L or SoW statement and download links after submitting (current), or staff only?
7. Should the A&L and SoW also get an Ackroyds or other co-brand? Currently they're Posfin, or unbranded for SoW (and A&L).

## Known limits (v001)
- The Supabase adapter is written against the migration but untested here, because there are no credentials on the box.
- The PDF uses standard Helvetica/Times. Inter and Playfair are on the HTML statement only.
- A very long A&L (many properties) paginates correctly, but the side-by-side "other assets / liabilities" tables are tuned for one page.

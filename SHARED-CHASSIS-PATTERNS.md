# Posfin Shared Product Chassis Patterns

Extracted from the confirmed `/speed-loan` journey for reuse across Bank Bridge, Development Finance, Dev Exit, Back-to-Back and future product pages.

## Locked UX Pattern

1. **Hero promise**
   - Product-specific headline + one clear speed/benefit claim.
   - Four proof stats directly under hero.
   - One primary CTA into the form.

2. **Pain / why-now section**
   - Three numbered reasons the normal route fails.
   - Direct, borrower-language copy.
   - Avoid lender jargon unless needed.

3. **Qualification section**
   - Positive criteria first.
   - “Not for us” exclusions second.
   - Make hard-stop LTV / product limits explicit.

4. **How it works**
   - Four concrete steps from form to completion.
   - Timing labels on every step.
   - No abstract process language.

5. **Three-step form**
   - Step 1: borrower/contact details + consent.
   - Step 2: property/security position.
   - Step 3: facility requirements + exit.
   - Show progress rail and plain-English step label.

6. **Reference handling**
   - Generate product-specific `POSFIN-[PREFIX]-XXXXXX` at form load.
   - Submit the same value to `/api/lead` as `deal_ref`.
   - Show the same reference in the confirmation scorecard.

7. **Confirmation scorecard**
   - Mirror key borrower inputs back immediately.
   - Show estimated LTV / feasibility where relevant.
   - Include clear “what happens next” steps.

## Product Prefixes

- Speed Loan: `POSFIN-SL-XXXXXX`
- Bank Bridge: `POSFIN-BB-XXXXXX`
- Development Finance: `POSFIN-DF-XXXXXX`
- Development Exit: `POSFIN-DE-XXXXXX`
- Back-to-Back: `POSFIN-B2B-XXXXXX`
- Purchase & Refurb: `POSFIN-PR-XXXXXX`

## Engineering Rules

- Do not fork core form behaviour per page unless the product genuinely needs different fields.
- Reuse the existing shared modules in the compiled chassis where possible: field components, additional-security module, progress rail, success card, deal reference generation, normalised `/api/lead` payload.
- Product pages should vary copy, limits, validation thresholds and payload `product` / `page_source`, not the interaction model.
- Any future form success state must pass the generated deal reference into the confirmation component; do not rely on mutable form data containing it.

## Secured Property Form Gating Patterns

1. **Regulated-status occupancy gate**
   - Every secured-property product form should ask: “Will you or a family member live in the property at any point?”
   - If the answer creates regulated risk, show a visible note before submission: “This product is available for business/investment purposes only. We will confirm the correct regulated/unregulated route on the call.”
   - Do not leave regulated/unregulated status ambiguous until after capture; collect the fact honestly at source.

2. **USP-tied qualifying question**
   - Each product should include one qualifying question tied directly to its core advantage.
   - Equitable Charges example: “Has a lender declined consent to a second charge?” because “no consent needed” is the product’s USP.
   - Other products should use the same pattern with product-specific wording rather than generic “anything else?” fields.

## Dual-Tranche Product Patterns

1. **Dual-tranche LTV engine**
   - Where one journey structures two linked facilities, show both LTVs live against their own caps in one status box.
   - Example: “Speed loan LTV: 24% (max 50%). Main loan LTV: 45% (max 70%).”
   - This is distinct from a single product-specific LTV cap badge.

2. **Upfront Stage-2 selector**
   - For genuinely two-stage products, ask “What does Stage 2 look like for you?” in Step 1.
   - Options should be the actual product pairings: Speed + Main Bridge, Speed + Development Finance, Speed + Development Exit, Speed + BTL Refinance, Auction purchase, Not sure.
   - Keep this separate from reactive cross-sell nudges; use the selector when the product is structurally two-stage, and nudges when the second product is only a fallback/upgrade.

## Speed Loan Fix Applied

`/speed-loan` now passes `dealRef` into the confirmation scorecard so the visible Reference block matches the submitted `POSFIN-SL-XXXXXX` lead reference.

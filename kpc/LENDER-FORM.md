# KPC lender form — internal test profile

Local page at `/kpc/lender-form`. It is `noindex, nofollow`. Copy, download and print stay in the browser. The page does not call a webhook, API, inbox, CRM or database.

## Triage

- Existing debt LTV above 40% is a hard decline. 40.00% passes.
- Day-1 combined LTV or gross/exit combined LTV above 50% is a hard decline. 50.00% passes. Both ratios are shown.
- Owner-occupied security, or a missing unregulated business-purpose declaration, is a hard decline and is routed to the Posfin regulated panel.
- Net release outside £26,000–£100,000 is a hard decline. £40,000–£65,000 is flagged as the sweet spot.
- Term 3–12 months passes. 3 months is the typical quick turn. Under 3 or over 12 is a hard decline.
- A missing or unclear exit is a refer. Charging orders, restrictions, missing consent and leases under 70 years are an Ackroyds legal review. Those flags do not clear a hard stop.
- AVM must be completed before drawdown. If it is not, the verdict is blocked for drawdown even when every other rule passes. A hard decline still outranks that gate.
- Drawdown and capital-call rails are Faster Payments (same-day, typically seconds) or CHAPS (same-day, fee applies, for larger sums). BACS is a hard block. A missing rail is also a hard block. A lending hard decline still outranks the rail block.

Overall order: hard decline, then hard block (settlement rail), then blocked for drawdown, then refer, otherwise pass.

## Pricing

Three-month NHF total, matching `pricing-guide.html` from £26,000 to £100,000:

`round(1.288 × net + 134)`

The slope is the `engine/calculator.js` sub-total identity at 12% broker and 2.50% per month for 3 months (interest, plus a facility fee equal to that interest minus a fixed plug). The £134 intercept rounds to an £893 plug. Displayed lines sum to the published total; the facility-fee line holds any leftover pound.

Each later month adds `round(2.50% × net)` once. The 3-month fee stack is not charged again.

`step5b-backtoback.html` uses `net × 1.195 + £1,200`. `kpcCalc` with £1,200 legals produces `1.288 × net + £180`. Neither is the pricing-guide schedule.

The workbook comparison compounds 2.50% per month on `net + 2% arrangement + £1,200 Ackroyds + £200 title insurance`. Default stress is 3.95% per month for +3 and +6 months. A 5.0% per month post-term comparison is included. The 12% broker fee is a memo on that model because it is already inside the NHF slope. Legal costs are £0 upfront and are not added on top of the published 3-month total.

Figures above £100,000 are marked as extrapolated. They are not pricing-guide schedule rows.

## Profiles

- `synthetic_50k_pass` — fictional £50k sweet spot, pass.
- `williamson_hard_decline` — verified file `POSFIN-WEB-EYCTQ6`. Owner-occupied, existing debt above 40%, combined LTV above 50%, and £455,000 above the size cap. The 12-month term itself passes. RBS redemption and charging-order balances stay TBC. AVM is not marked complete because none was verified.
- `synthetic_26k_floor` — fictional minimum ticket, pass at 6 months and at 12 months.
- `synthetic_41pct_trap` — fictional 41% existing debt. Day-1 and gross/exit LTV stay under 50%, so the only hard decline is the 40% existing-debt rule.

Posfin Capital Limited is an authorised credit broker and not a lender (FRN 913022, company 12148846). Kensington Private Credit Ltd is company 16988655.

# Stage-2 case spine — clone blueprint

The Williamson page is one pilot. It is not the pattern for a new screen per case.

Case ref: `POSFIN-WEB-EYCTQ6`. Christopher Nicholas Williamson, 204 Cooden Drive. `PC-004` is Winslade Park / Mark Edworthy and must not be used for this borrower.

## What is already separated

- **Model** (`uk_regulated_bridging_urgent_eviction`): ordered stages, exit criteria, evidence checklist, SLA. Declared in `lib/case-spine.js` and proposed as `case_models.definition`.
- **Instance**: the eight fields for this borrower only. Header, model id, stage, owners, next actions, due time, evidence, waiting conditions.
- **Engine**: `evaluateWaiting` and `stageReadiness`. They report readiness. They do not send, release a link, or move the stage.
- **Flag**: `STAGE2_WAITING_CONDITIONS_ENABLED` defaults off. A `?waiting=preview` link exists only in fixture mode.

## Clone the next case type

1. Add a model object. Suggested ids, still empty until that type is sourced:
   - `uk_unregulated_bridging`
   - `uk_development_exit`
   - `uk_commercial_bridging`
   - `uk_second_charge`
   - `fr_ouicap`
   - `fr_ulend`
2. Give that model its own ordered stages, exit criteria, evidence checklist and SLA. Do not reuse the eviction warrant SLA unless that case has one.
3. Add one instance that points at the new `modelId`. Fill the eight fields from verified documents only. Do not copy Williamson’s figures, title number, or charges.
4. Register the instance in the fixture list, or, after Tom applies `sql/20261120_stage2_case_spine.sql`, insert a `case_models` row and a `case_spine` row. Do not apply that file until then.
5. Open it at `/staff/cockpit/spine/<CASE-REF>`. The same page renders whatever model the instance names. No new route and no new renderer.

## Clone the next live deal of this same type

1. Keep the urgent-eviction model as it is.
2. New instance, new canonical ref, new verified header, evidence and deadlines.
3. Do not invent a redemption balance. If the statement is not held, status stays `MISSING` and the amount stays “figure to follow”.
4. Leave the waiting-condition flag off until Tom turns it on. The sandbox query must not be enabled for a live Supabase source.

## Still out of this pilot

- No send control for Ackroyds, MT Finance, RBS, or a borrower.
- Tom still releases borrower links on SmartLink.
- The spine fixture is not written to Supabase by the preview.
- £511,000 is Byron’s open sizing question. The LOR amount is £455,000 gross. Do not treat £511,000 as the loan.

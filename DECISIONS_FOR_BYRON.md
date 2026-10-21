# Decisions for Byron — Section 1 build

## Open decisions

### 1. Supabase project ref
The migration file is committed but not applied to any database. To test against a live Supabase instance, I need the project ref (or approval to create a development branch). Currently all tests use mocks.

### 2. WATI configuration for WhatsApp verification codes
Verification code delivery is stubbed (logs to console). To enable actual WhatsApp delivery via WATI, I need:
- WATI API endpoint / account details
- The WATI template name for verification codes
- Whether to use the existing `mcp__claude_ai_Wati__wati_send_template_message` MCP tool or a direct API call

### 3. Email verification code delivery
No email service is configured. Options: Resend, SendGrid, SES, or another. The code generation/validation/expiry logic is implemented — only the delivery channel is stubbed.

### 4. SmartLink URL in Pipeline Clean scorecard column
The design says to put "Open SmartLink" in the `📊 Scorecard link` column. This requires:
- Deciding the URL format: `https://posfincapital.com/smartlink?t=<token>` or `/api/case/<token>`
- Whether to generate the SmartLink token at intake time (when the case is created in Clean) or only when staff explicitly issues one

Currently the scorecard column contains the existing HMAC-based scorecard link. Adding a SmartLink link alongside or replacing it requires a decision on whether both should coexist.

### 5. Seeding case_completion from existing intake data
The first real test (Bouchon pilot) requires seeding `case_completion` from the existing Raw Leads packed state. This is a one-time data migration that should happen as part of the Bouchon pilot (Section 5), not automatically.

## Known gaps — NOT YET BUILT

### Gap A: Staff authentication (M365)
`api/case/[id]/token.js` now returns **501 Not Implemented** for all requests. The `x-staff-user` header placeholder has been removed. Token issuing and revocation are disabled until Microsoft 365 work-account sign-in is wired. The `M365_AUTH_IMPLEMENTED` constant must be flipped and `authenticateStaff` must validate an M365 bearer token before this endpoint can go live.

### Gap B: Borrower-facing client page
The SmartLink API (`GET /api/case/:token`) returns JSON. **No borrower-facing HTML page exists** to render the questionnaire UI. The existing `/api/scorecard` serves inline HTML for the Fact Find summary, but there is no equivalent page for the SmartLink gap-engine questionnaire. This page must be built before borrower delivery — it needs:
- Postcode gate UI (input, lockout message, verification code fallback)
- Gap engine batch rendering (≤ 6 questions per page, autosave on blur)
- Progress indicator and section navigation
- Mobile-first responsive layout matching the existing Posfin brand

### Gap C: Export PDF rendering
The `case_exports` table is in the migration. No PDF rendering logic exists. Deferred.

## Not blocked — continued with assumptions

- **Field map**: Used main bridging only. A&L (D-25), remortgage, PA_Land declared as stubs returning UNMAPPED.
- **MCP endpoints**: Built as standard authenticated HTTP (`GET/PATCH /api/case-completion`) with `x-service-key` header. Tom's MCP service calls these.

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

### 4. Staff authentication for token management
`api/case/[id]/token.js` uses `x-staff-user` header for staff auth. In production this should be validated against Posfin work-account sign-in. The current implementation is a placeholder that trusts the header value. What auth provider should this use?

### 5. SmartLink URL in Pipeline Clean scorecard column
The design says to put "Open SmartLink" in the `📊 Scorecard link` column. This requires:
- Deciding the URL format: `https://posfincapital.com/smartlink?t=<token>` or `/api/case/<token>`
- Whether to generate the SmartLink token at intake time (when the case is created in Clean) or only when staff explicitly issues one

Currently the scorecard column contains the existing HMAC-based scorecard link. Adding a SmartLink link alongside or replacing it requires a decision on whether both should coexist.

### 6. Seeding case_completion from existing intake data
The first real test (Bouchon pilot) requires seeding `case_completion` from the existing Raw Leads packed state. This is a one-time data migration that should happen as part of the Bouchon pilot (Section 5), not automatically.

## Not blocked — continued with assumptions

- **Field map**: Used main bridging only. A&L (D-25), remortgage, PA_Land declared as stubs returning UNMAPPED.
- **MCP endpoints**: Built as standard authenticated HTTP (`GET/PATCH /api/case-completion`) with `x-service-key` header. Tom's MCP service calls these.
- **Export PDF**: Deferred. The `case_exports` table is in the migration but no PDF rendering is built.

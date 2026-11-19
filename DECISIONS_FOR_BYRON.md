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
The borrower page is at `/s/<token>`. Decision needed:
- Whether to also write this URL to the `📊 Scorecard link` column in Pipeline Clean
- Whether to generate the SmartLink token at intake time or only when staff explicitly issues one
- Whether the existing HMAC scorecard link and the new SmartLink coexist or the new one replaces it

### 5. Seeding case_completion from existing intake data
The first real test (Bouchon pilot) requires seeding `case_completion` from the existing Raw Leads packed state. This is a one-time data migration that should happen as part of the Bouchon pilot (Section 5), not automatically.

## Known gaps — NOT YET BUILT

### Gap A: Staff authentication (M365)
`api/case/[id]/token.js` returns **501 Not Implemented** for all requests. The `x-staff-user` header code is **deleted** — the endpoint is a bare 501 stub. Token issuing and revocation are disabled until Microsoft 365 work-account sign-in is wired with a new implementation.

### Gap B: Export PDF rendering
The `case_exports` table is in the migration. No PDF rendering logic exists. Deferred.

### Gap C: Verification code delivery
Code generation/validation/expiry/lockout implemented. Delivery **STUBBED** (console log). WATI config needed for WhatsApp; email service TBD.

### Gap D: Field maps for A&L, remortgage, PA_Land
Declared as stubs returning UNMAPPED. Main bridging is the only active field map.

## Not blocked — continued with assumptions

- **Field map**: Used main bridging only. A&L (D-25), remortgage, PA_Land declared as stubs returning UNMAPPED.
- **MCP endpoints**: Built as standard authenticated HTTP (`GET/PATCH /api/case-completion`) with `x-service-key` header. Tom's MCP service calls these.

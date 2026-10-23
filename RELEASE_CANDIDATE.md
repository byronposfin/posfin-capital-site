# SmartLink Release Candidate — 23 October 2026

## Commit
`dafd686` on `section-1/case-completion`, PR #2 (draft) against `section-0/intake-alignment`.

## Test evidence — honestly separated

| Suite | Count | Level | What it proves |
|-------|-------|-------|----------------|
| Mock tests | 108 pass | In-memory mock | Application logic paths — field filtering, CAS branching, gate comparison, signing flows. Does NOT prove real SDK, Postgres, or network behaviour. |
| Staging tests | 29 pass | Real Supabase (posfin-smartlink-staging) | CAS transaction atomicity, orphan audit prevention, idempotency rollback, outbox persistence, starvation sweep, cross-case denial. Written before today's cron/claim fixes — does NOT cover those. |
| Signing tests | 31 (included in 108) | Mocked provider | Template gating, signer grants, split validation, mirror replay. No real Dropbox Sign or PDF processing. |

## What is built and verified

| Component | Mock-tested | Staging-verified | Deployed/live-tested |
|-----------|------------|-----------------|---------------------|
| case_completion schema (7 tables + RPC) | — | YES (29/29) | NO |
| Version-gated CAS writes | YES | YES (atomic RPC) | NO |
| Audit trail (no orphans on conflict) | YES | YES | NO |
| Idempotency replay | YES | YES (unique index rollback) | NO |
| Postcode gate (normalise, lockout) | YES | YES (gate_attempts table) | NO |
| Verification codes (gen/validate/expiry) | YES | NO (delivery stubbed) | NO |
| Gap engine (batch, allowlist, UNMAPPED) | YES | NO | NO |
| Borrower JSON API (GET/PATCH) | YES | NO | NO |
| Borrower HTML page (/s/:token, read-only) | YES | NO | NO |
| Staff token endpoint | YES (501 stub) | — | NO |
| MCP HTTP endpoints | YES | NO | NO |
| Notification outbox (durable, retry) | YES | YES (persistence) | NO |
| Cron worker (fail-closed) | YES (mock) | NO | NO |
| Worker atomic claim | YES (mock) | NO | NO |
| /s/:token URL rewrite | Config only | NO | NO |
| Signing integration | YES (31 tests) | NO | NO |

## Known remaining gaps — NOT FIXED

### Gap 1: Notification enqueue not in atomic transaction
`patch_case_atomic` wraps case+audit. `enqueueAlert` is a separate call after `patchCase` returns. If patchCase succeeds but enqueueAlert fails, the case is updated but no notification is queued. No compensation or re-enqueue mechanism exists.

### Gap 2: Idempotency replay skips missing enqueue
If the original write created an audit row but enqueueAlert failed, a replayed request returns `{ replayed: true }` without checking whether the notification was actually enqueued. The notification is permanently lost.

### Gap 3: No new staging tests for cron/claim fixes
The cron fail-closed guard, atomic worker claim, and stale claim reclaim are mock-tested only. The 29/29 staging suite predates these fixes.

### Gap 4: Staff M365 authentication
Endpoint returns 501. All auth code deleted. Must be built from scratch.

### Gap 5: Interactive questionnaire
Borrower page is read-only ("Incomplete borrower journey"). No autosave.

### Gap 6: Verification code delivery
Code logic complete. Delivery stubbed (WATI for WhatsApp, email TBD).

### Gap 7: Export PDF rendering
Table exists. No rendering logic.

### Gap 8: Field maps beyond main bridging
A&L, remortgage, PA_Land return UNMAPPED.

### Gap 9: Vercel cron invocation unverified
Schedule configured in vercel.json. Cannot verify without deployment.

## Hosted acceptance plan — what Byron should see before approving

### Prerequisites (before any deployment)
1. PR #1 merged to main (staging acceptance already passed per Tom's ACCEPTANCE.md)
2. PR #2 rebased on merged main
3. Staging Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) added to Vercel Preview for the PR #2 branch only
4. `SMARTLINK_TOKEN_SECRET` and `CRON_SECRET` set for Preview
5. `SIGNING_ENABLED` NOT set (signing stays disabled for initial acceptance)

### Acceptance checks (on Preview deployment)

**A. Case creation and token flow**
1. Create a test case via MCP endpoint (`POST /api/case-completion` with `x-service-key`)
2. Issue a token via direct DB insert (staff endpoint disabled)
3. Visit `/s/<token>` — should show postcode gate, no personal data

**B. Postcode gate (mobile + desktop)**
1. Wrong postcode → "Incorrect postcode" error
2. Correct postcode → "Incomplete borrower journey" page with progress
3. Session cookie persists — refresh without re-entering postcode
4. Different device/browser → requires postcode again
5. 5 wrong attempts → lockout message

**C. Borrower PATCH (via curl/API, not UI — page is read-only)**
1. PATCH with valid version → 200, version incremented
2. PATCH with stale version → 409 with current state
3. PATCH with replayed idempotency_key → 200 replayed, no double write
4. PATCH with broker-only field → rejected
5. Check notification appears in case_notifications table (pending)

**D. MCP endpoints**
1. GET without service key → 403
2. GET with key → full case including broker_only
3. PATCH with valid version → 200
4. PATCH with stale version → 409

**E. Security**
1. Token for case A cannot access case B data
2. Revoked token → 410
3. Staff endpoint → 501
4. Cron without CRON_SECRET header → 401/503
5. No personal data in page metadata, logs, or error responses

**F. Raw/Clean persistence (PR #1)**
1. Submit via /api/lead → Raw Leads row with correct column alignment
2. Qualified submission → Clean projection row
3. Resume → existing row updated, no duplicate

**G. Scorecard access**
1. Valid HMAC token → scorecard page
2. Invalid token → 403

### NOT in this acceptance (deferred)
- Interactive questionnaire (page is read-only)
- Staff token issue/revoke (501)
- Signing flow (disabled)
- Verification code delivery (stubbed)
- Export PDF
- Sustained-load testing
- Production data repair

## Constraints
- No merge without Byron's explicit approval
- No production deployment
- No live CRM writes
- No borrower sends
- Kristian/Terence and Loan Pack remain parked

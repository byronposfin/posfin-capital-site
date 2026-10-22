# SmartLink Morning Handoff — 23 October 2026

## Status
Branch `section-1/case-completion` at commit `eaa18f3`. PR #2 (draft) against `section-0/intake-alignment`.

## What was done overnight

### Migration applied to staging
- Project: `posfin-smartlink-staging` (`dxlebqovfphultrdbriz`), London, confirmed by name and project listing before SQL executed.
- 7 tables + 1 RPC function (`patch_case_atomic`) + RLS + grants applied.
- Service-role grants were missing from the original migration (tables created by migration system don't inherit service_role privileges). Fixed in migration file and applied separately.

### Staging verification: 29/29 pass
Real Supabase, synthetic data with `TEST-` prefix, all cleaned up after run.

**Three previously-unverified gaps now confirmed against real Postgres:**

1. **Atomic CAS + audit rollback:** `patch_case_atomic` RPC — winner writes case + audit atomically (returns 1). Loser with stale version gets 0, no case change, no orphan audit row. Idempotency duplicate key triggers unique constraint violation which rolls back the entire transaction (case version unchanged).

2. **Starvation prevention:** 50 exhausted entries (attempts=max_attempts, status=failed) swept to `status='exhausted'` before the main query. A newer pending alert is then processed normally — not blocked by the 50 exhausted.

3. **Notification outbox persistence:** `enqueueAlert` inserts rows that survive across request boundaries. Simulated failure increments attempts and sets `last_error`. Retry works on subsequent processOutbox runs.

### Not verified (requires deployment)
- Vercel cron invocation of `/api/cron/notifications`
- Preview HTTP routing for `/s/:token` rewrite
- Real Telegram delivery (sends intentionally disabled)
- Anon RLS rejection (can't test from service-role key)

## Test counts — separated
| Suite | Count | Level |
|-------|-------|-------|
| Mock tests (`node --test test/*.test.js`) | 77 pass, 0 fail | In-memory mock Supabase |
| Staging verification (`test/staging-verify.js`) | 29 pass, 0 fail | Real Supabase (posfin-smartlink-staging) |

## For Tom
- Rerun both test suites independently: `node --test test/*.test.js` and `env $(cat ~/.openclaw/credentials/smartlink-staging.env | xargs) node test/staging-verify.js`
- The staging script uses synthetic `TEST-STAGING-*` case IDs and cleans up after itself
- The CAS race, orphan audit, and idempotency rollback are all verifiable in the staging output — look for checks 4.1 through 4.8
- If you want to re-run your `review-cas-probe.mjs` against the staging RPC, the function is `patch_case_atomic` and the credential file is at `~/.openclaw/credentials/smartlink-staging.env`

## For Byron
Release decision still required. No merge, deployment, production migration, or borrower sends have been made. The staging project contains only the schema — no real case data.

## Remaining gaps (unchanged)
- Staff M365 auth (endpoint disabled)
- Export PDF rendering
- Verification code delivery (WATI/email)
- Field maps beyond main bridging
- Interactive questionnaire (page is read-only)
- Cron invocation verification
- Kristian/Terence and Loan Pack remain parked

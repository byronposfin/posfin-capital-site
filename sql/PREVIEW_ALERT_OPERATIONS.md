# Preview alert activation — staged, not enabled

Target is **landing-preview `imcqwhccwsuglkzaxazg` only**. Main project and production `/apply` must remain untouched.

## Before activation

1. Using authorised provider access, verify selected project ref and inspect actual `pipeline.web_leads` schema against the supplied baseline. Migration requires `id`, `reference`, `is_test`, `form_stage`, `submitted_at`.
2. Apply `20261104_preview_alert_outbox.sql` once in that project. Installation is transactional; do not rerun it blindly. No existing lead is backfilled on installation.
3. Bind `FF_ALERT_SERVICE_KEY` (valid service credential for this project), `FF_ALERT_WORKER_SECRET` (32+ random characters), and `FF_ALERT_DURABLE=true` to this branch's **Preview** environment only. Existing test project, test flag and alert destination remain unchanged. Server-only keys must never be exposed through client bootstrap.
4. Deploy that branch and exercise one synthetic form → saved record → audit event → outbox → Telegram receipt. Read back the outbox from a fresh authorised connection; replay submit and overlapping worker calls and verify one outbox row/one accepted receipt.
5. Configure an independent authenticated recurring caller (e.g. every minute) to `POST /api/factfind-alert-worker`, with `Authorization: Bearer <protected FF_ALERT_WORKER_SECRET>`. Vercel cron configuration is intentionally NOT added: the desired worker is Preview-only. A submit-time call alone is not recovery scheduling. Verify the scheduler actually invokes the endpoint, and test one explicit rejected delivery followed by later scheduled retry.

Until all five are verified, durable recovery is **staged, not live**. The existing synchronous test-only transport stays active when `FF_ALERT_DURABLE` is absent. Never enable both transports for the same submission; the handler selects only one.

## Delivery semantics

- A trigger atomically enqueues submitted synthetic test leads, one job per lead ID.
- Worker reconciliation catches submitted test rows after installation's `armed_at` cutoff, not historical tests.
- Atomic claims use `FOR UPDATE SKIP LOCKED` with a unique lease. One message per worker invocation bounds serverless runtime.
- Explicit Telegram 4xx rejection returns to pending with bounded exponential retry / provider retry-after. Five attempts exhaust the job without starving newer work.
- Timeout, 5xx, malformed response, crashed sender or failed receipt persistence becomes **unknown**. No blind resends: delivery may already have succeeded. Reconcile the reference/receipt before an operator manually resolves it. This does not claim exactly-once Telegram delivery.
- Non-test rows cannot enter this outbox; production/non-target workers fail closed. No contact details or answer payload is sent to Telegram.

## Staff acceptance gate

Authorisation to provision Byron exists (Telegram78596); his confirmed email is `byron.hill@posfincapital.com`. Actual Auth UUID and membership remain unverified. First inspect Auth and `pipeline.staff` column/role constraints via authorised provider access. Do not fabricate a UUID, auto-confirm an email, issue a shared admin token or substitute service role for staff authentication.

If existing email-confirmed identity matches, provision only that UUID with the approved principal role and current schema's active flag. If identity does not exist, establish legitimate invitation/sign-in and verified ownership before membership. A successful SQL grant does not verify normal staff sign-in.

Verify `/admin/leads` via normal user session, `staff_whoami`, include-test filter, fixture detail + actual events, and saved scorecard. The login now uses GoTrue's `redirect_to` query parameter. Provider allowlist and actual email delivery remain separate checks.

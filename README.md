# Lead pipeline

Facebook ads stay off until Byron has checked this pipeline. `sql/20261121_lead_pipeline_v1.sql` is not applied by the deploy. It changes the owner rule, the contact clock, and adds the Google Sheet queue. It does not send email by itself.

Synthetic checks use `synthetic.verify@posfincapital.com` and `07700900000`, are stored with `is_test = true` and a `TEST-WEB-` reference, and are not emailed to a person. Real applicants are excluded from that path. `is_test` rows stay in the database and are left out of the staff new-leads queue and the SLA chase. CRM rows for them use source `web_factfind_test`.

The overnight check is `GET /api/verify-forms` every 30 minutes. It alerts the existing Telegram chat only when a check fails. `npm run verify` with `VERIFY_BROWSER=1` also clicks the dropdowns.

Posfin Capital is a credit broker, not a lender. The applicant email is final. It sends on a real submission when `LEAD_AUTOREPLY=true`. Test rows are not emailed.

## What is already true

Submitted fact finds are stored in `pipeline.web_leads`. A database trigger also queues a Telegram alert in `pipeline.web_lead_alert_outbox`. That queue is drained by `/api/factfind-alert-worker` on Vercel (previously every 5 minutes, and also from the submit request when `FF_ALERT_DURABLE=true`). The worker calls the Telegram Bot API. It is not a Supabase edge function. If `FF_ALERT_DURABLE` is unset, that worker refuses to send, and any other caller of the same claim RPCs is the sender. The Telegram lease is 2 minutes; when it expires the row becomes `unknown` and is not retried. That path is unchanged.

Email uses a new outbox, `pipeline.web_lead_email_outbox`, because the Telegram columns cannot store an email address or a provider id. A failed email is retried with the same idempotency key. Resend honours that key. A Mailgun retry can send a second copy, so prefer Resend.

Partial saves do not alert. Only the transition to `submitted` does. Existing rows are not backfilled.

## Switches

`sql/20261120_lead_ops_v1.sql` is already on the production database. Do not run it again after `sql/20261121_lead_pipeline_v1.sql`, because that would put the older owner function back until 20261121 is applied again. `sql/20261121_lead_pipeline_v1.sql` has not been applied. The 20 Nov file, on a database that does not have it yet, does four safe things and leaves the mail switches off:

- Seeds the seats Byron (principal, the admin seat), Jess, Aadi, Cai, and Chris.
- After `sql/20261121_lead_pipeline_v1.sql`, new submissions are owned by Byron. Jessica is the backup if Byron's seat is inactive. The Jess / Aadi / Cai / Chris ring runs only when `round_robin_enabled` is true. A `?b=bh` or `?b=chris` link still pins that person when the seat is active.
- Links Byron and Aadi where an Auth user already exists. It does not create passwords or send invites.
- Adds Jess and Chris to `public.crm_users` so the CRM allowlist recognises them once they can sign in.

Cai's seat is `cai@posfincapital.com`, role `case_owner`, pronouns she/her. Link it after the Auth user exists:

```sql
update pipeline.staff_seats
   set email = 'cai@posfincapital.com'
 where seat_code = 'cai';
select pipeline.link_staff_seats();
```

The check constraint only accepts `@posfincapital.com`.

### 1. Staff alert email

Deploy this branch first, then set these in Vercel (production and the preview you are testing). Never put the values in git.

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the Resend API key. This selects Resend. `LEAD_EMAIL_PROVIDER` is not required |
| `LEAD_EMAIL_FROM` | a verified sender on `posfincapital.com`, for example `Posfin Capital <hello@posfincapital.com>` |
| `LEAD_AUTOREPLY` | `true` to send the applicant reply. No separate wording hold |
| `LEAD_ALERT_EMAIL` | `true` when staff alerts should also send through the same worker |
| `FF_ALERT_SERVICE_KEY` | the Supabase service-role key this worker already uses |
| `CRON_SECRET` | at least 32 characters; Vercel sends it as the cron bearer |
| `LEAD_ALERT_ONLY_EMAIL` | `byron.hill@posfincapital.com` for the test. Remove it when Jessica should receive alerts too |

Then arm the database. Until this timestamp is set, no staff email is queued:

```sql
update pipeline.lead_ops_control
   set email_alerts_armed_at = now(), updated_at = now()
 where id;
```

The cron is `* * * * *` on `/api/factfind-alert-worker`. The submit request also tries once. Delivery is within about a minute when the Vercel plan allows a one-minute cron; the Hobby plan does not. If a staff alert or an SLA email is still unsent after 2 minutes, the next run emails an alarm to the alert-copy seats (Byron and Jessica, subject to `LEAD_ALERT_ONLY_EMAIL`). To pause: set `LEAD_ALERT_EMAIL` back to `false`. Queued rows stay queued.

### 2. Applicant auto-reply

The wording is final. It is signed by Lizzy on behalf of Byron Hill. A real submission is queued when contact consent is yes, the row is not `no_chase`, and `is_test` is not true. `LEAD_AUTOREPLY=true` is the send switch. There is no draft hold and no `autoreply_armed_at` step.

`autoreply_allowlist` is currently `byron.hill@posfincapital.com`. This migration does not change it. While it is set, only that address can be queued. At go-live Byron sets it to null himself:

```sql
update pipeline.lead_ops_control set autoreply_allowlist = null, updated_at = now() where id;
```

Do not run that until real applicants should receive the reply. `is_test` and `TEST-WEB-` rows are still excluded. The reply does not quote a rate, promise an approval, or ask to stay in touch.

### Resend DNS for posfincapital.com

Add the domain in Resend, region `eu-west-1`, then copy the records from that domain's Records tab. The DKIM value is unique to the domain and is not stored here. The names are:

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey.posfincapital.com` | the `p=` value Resend shows |
| MX | `send.posfincapital.com` | priority `10`, host `feedback-smtp.eu-west-1.amazonses.com` |
| TXT | `send.posfincapital.com` | `v=spf1 include:amazonses.com ~all` |

If Resend shows CNAMEs for `send.posfincapital.com` and `rsend.posfincapital.com` instead of the MX and TXT pair, add those CNAMEs exactly and do not also put TXT or MX on the same name. Leave the root MX for the existing mailbox alone. Do not proxy the CNAMEs.

### 3. 15-minute contact clock

Every new submission stores `sla_due_at`: 15 minutes inside Monday–Friday 09:00–18:00 Europe/London. Saturday and Sunday wait until Monday 09:00. Time left at 18:00 carries to 09:00 the next weekday. The escalation email does not send until both switches are on:

- Environment: `LEAD_SLA_ENABLED=true`
- Database: `update pipeline.lead_ops_control set sla_armed_at = now(), updated_at = now() where id;`

It goes to Byron. It does not send for `no_chase`, and it does not place a call. `no_chase` and a missing `contact_consent` or `ai_call_consent` are named in the staff email so nobody chases or uses an automated caller by mistake.

### 4. New-leads lane

`/staff/new-leads` shows owner, age, and SLA state (Within SLA, Due soon, Overdue, Contacted) and can mark a lead contacted. Every active seat can read the queue. `read_only` and `analyst` cannot write. A case owner can mark contacted and cannot change the applicant's details, consent, or owner. A principal can also reassign and change status. Sign-in is a Supabase email code for an Auth user linked by `pipeline.link_staff_seats()`. Invite Jess, Chris, and Cai before they can open it. This lane is not the draft operations board in pull request 10; that branch does not merge cleanly onto `main`.

### 5. Pause assignment

```sql
update pipeline.lead_ops_control set assignment_armed_at = null, updated_at = now() where id;
```

## Sheet

New submitted fact finds can be appended to the Google Sheet `Leads` tab (`LEADS_SHEET_ID`, currently `1D75DSVCst4g5p0_Y4PiJXVsnFO5049nkfpLWt5KYx1A`). The same cron as the staff alert, `/api/factfind-alert-worker`, writes one row from row 2. It does not copy older leads. A lead id already in column B is not written again. Synthetic rows are skipped unless `sheet_include_tests` is true. Nothing is queued until:

```sql
update pipeline.lead_ops_control
   set sheet_armed_at = now(), updated_at = now()
 where id;
```

and the preview or production env has `LEADS_SHEET_ENABLED=true` and `LEADS_SHEET_ID`. The sheet is shared as Editor with `posfin-sheets@posfin-sheets.iam.gserviceaccount.com`. The worker uses `GOOGLE_SA_EMAIL` and `GOOGLE_SA_PRIVATE_KEY` when both are set. Otherwise it uses `GOOGLE_SA_B64` only when that blob's `client_email` is the same address. A different service account is not used. If a row is still unsent after 2 minutes, the worker reports it overdue and, when staff email is armed, sends the same alarm as a stuck alert.

## Test, using only Byron

The written steps are in `ops/lead-pipeline-v1/e2e.md`. `npm test` is the part that runs without sending mail.

Use Byron's own email, `byron.hill@posfincapital.com`, and his own mobile. Do not use anyone else's details. Do not turn on ads.

1. Deploy a preview with `FF_TEST_RUN=true` and the preview Supabase project, or run one production test submission that is clearly synthetic. Keep `LEAD_ALERT_ONLY_EMAIL` and `LEAD_AUTOREPLY_ONLY_EMAIL` on Byron's address.
2. Arm staff email only. Submit `/fact-find` with Byron's email and mobile, `contact_consent` ticked, AI-call consent left off. The reference should arrive in Byron's inbox within about a minute, named with the owner, and marked test if `FF_TEST_RUN` was on. Jessica should not receive it while the allowlist is set.
3. Open `/staff/new-leads`, sign in as Byron, and confirm owner, age, and a green Within SLA pill. Mark contacted. `contacted_at` should fill and the pill should say Contacted. A second SLA run must not escalate that row.
4. Leave auto-reply off and confirm the applicant inbox gets nothing.
5. With `LEAD_AUTOREPLY=true` and the allowlist still Byron's address, a real submission from `byron.hill@posfincapital.com` receives the final reply. A `TEST-WEB-` or `is_test` row does not. Do not set the allowlist to null for this check.
6. For the clock, on that same test row only, set `contacted_at` back to null and `sla_due_at` to `now()`, with `LEAD_SLA_ENABLED=true` and `sla_armed_at` set. The next worker run should email Byron an SLA escalation and must not email the applicant.
7. For the two-minute alarm, on a preview, set a bad `LEAD_EMAIL_API_KEY`, submit one more Byron-only test, wait past two minutes, restore the key, and run the worker. Byron should get an alarm for that reference. Do not do this against a real applicant.

To pause everything that sends mail, set `LEAD_ALERT_EMAIL`, `LEAD_AUTOREPLY`, and `LEAD_SLA_ENABLED` to `false`. Assignment can keep running; it only writes the owner.

# Lead pipeline v1 — three synthetic checks

Run this on a **preview** deployment, not production. Use only `byron.hill@posfincapital.com` and a phone Byron owns. Do not type anyone else's name, email, or number. Do not turn Facebook ads on. Do not apply `sql/20261121_lead_pipeline_v1.sql` until the migration has been read.

The automated half is `npm test`. It does not call Google, Supabase, or an email provider.

## Before the three submits

1. Preview env, values only in Vercel, never in git:
   - `FF_BACKEND=leads`
   - `FF_TEST_RUN=true` and the preview Supabase URL (`imcqwhccwsuglkzaxazg`), not the production project
   - `LEAD_ALERT_EMAIL=true` only if you want the inbox check
   - `LEAD_ALERT_ONLY_EMAIL=byron.hill@posfincapital.com` so Jessica does not get the test
   - `LEAD_AUTOREPLY=true` only for submission 2, and only after the database allowlist is Byron's address
   - `LEAD_AUTOREPLY_ONLY_EMAIL=byron.hill@posfincapital.com`
   - `LEADS_SHEET_ENABLED=true`
   - `LEADS_SHEET_ID=1D75DSVCst4g5p0_Y4PiJXVsnFO5049nkfpLWt5KYx1A`
   - `GOOGLE_SA_EMAIL` and `GOOGLE_SA_PRIVATE_KEY` for the account the sheet is shared with
   - `FF_ALERT_SERVICE_KEY` (service role) and `CRON_SECRET`
2. Share the sheet tab `Leads` with `GOOGLE_SA_EMAIL` as Editor. Do not share it publicly.
3. In the **preview** database only, after applying the migration there:

```sql
update pipeline.lead_ops_control
   set email_alerts_armed_at = now(),
       sheet_armed_at = now(),
       sheet_include_tests = true,
       autoreply_allowlist = 'byron.hill@posfincapital.com',
       updated_at = now()
 where id;
```

Leave `autoreply_armed_at` null until submission 2. Leave `sla_armed_at` null until submission 3. `round_robin_enabled` stays false, so Byron owns the row and Jessica is only the backup.

## 1. Ad URL, alert, owner, sheet

Open:

`/fact-find?utm_source=facebook&utm_medium=cpc&utm_campaign=nov-bridge&utm_content=video-a`

Use Byron's email and phone. Tick contact consent. Leave the AI-call box unticked. Submit.

Expect:

- Reference starts with `TEST-WEB-`
- `pipeline.web_leads` has the four UTM values, `contact_consent = true`, `ai_call_consent = false`, `consent_text_version = uk-consent-v2-2026-11-21`, `assigned_seat = byron`
- Byron's inbox gets one staff alert naming Byron as owner. It says no AI-call consent. Jessica does not get it while `LEAD_ALERT_ONLY_EMAIL` is set
- No applicant auto-reply
- One new row on the Leads tab, from row 2, lead id in column B. A second run of the worker does not add another row for the same id
- `/staff/new-leads` (signed in as Byron) shows the card, green Within SLA, owner Byron

## 2. Auto-reply draft, still no AI call

Set `LEAD_AUTOREPLY=true` and, on the preview database only:

```sql
update pipeline.lead_ops_control
   set autoreply_armed_at = now(), updated_at = now()
 where id;
```

Submit again from a new browser session (new resume code) with the same email, a different campaign `utm_campaign=nov-bridge-2`, contact consent ticked, AI-call still unticked.

Expect a second sheet row and an auto-reply only to `byron.hill@posfincapital.com`. The subject and body contain `DRAFT — not approved`, FRN 913022, NACFB, and the line that Posfin is a broker, not a lender. It must not quote a rate. Then set `LEAD_AUTOREPLY=false` and `autoreply_armed_at` back to null.

## 3. Cockpit write-back, contacted, and the 15-minute clock

On the preview lane, change owner to Jess, set next action to `Call Byron back`, and save. The card should show Jess. Set status to contacted, or use Mark contacted. `contacted_at` fills and the pill says Contacted.

To see the clock without waiting through a real evening, on that **test** row only:

```sql
update pipeline.web_leads
   set contacted_at = null, sla_due_at = now()
 where reference = 'TEST-WEB-XXXXXX';
update pipeline.lead_ops_control
   set sla_armed_at = now(), updated_at = now()
 where id;
```

Run the worker once (`GET /api/factfind-alert-worker` with the cron bearer). Byron gets an SLA email. The applicant does not. Mark the row contacted and run the worker again. There is no second escalation.

For the two-minute sheet alarm, point `GOOGLE_SA_PRIVATE_KEY` at a bad key, submit one more Byron-only test, wait past two minutes, restore the key, and run the worker. Byron gets an alarm whose subject starts `ALARM:`. Do not do this with a real applicant.

## Stop

Set `LEAD_ALERT_EMAIL`, `LEAD_AUTOREPLY`, `LEAD_SLA_ENABLED`, and `LEADS_SHEET_ENABLED` to `false` on the preview when finished. Do not copy `sheet_include_tests = true` or an empty auto-reply allowlist to production.

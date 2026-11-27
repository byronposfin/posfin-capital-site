# Posfin borrower portal

Self-contained Next.js app (App Router, TypeScript, Tailwind CSS). It is the borrower's live deal home, pinned in their WhatsApp group. The marketing site at the repository root is a separate project. Do not deploy this app from the repository root.

Posfin Capital is a credit broker, not a lender. FCA FRN 913022.

## Routes

| URL | What it is |
|---|---|
| `/posfin-capital/portal/demo` | Example Posfin Capital case. Fictional figures. |
| `/placed/portal/demo` | Example Placed case. Fictional figures. |
| `/{vertical}/portal/{token}` | Live case. `token` is unguessable (32–128 url-safe characters). |

Verticals are registered in `src/lib/verticals.ts` (`posfin-capital`, `placed`). Add a brand there.

There is no login. The server checks the token against `public.borrower_portal_links` on Supabase project `vgflcrfaudrvrdmxjdtl`. Invalid and expired tokens show a branded page with WhatsApp and `07365 587773`.

## Fee stripping

`src/lib/portal-data.ts` and `src/app/api/portal/[token]/route.ts` read with the service role and build a borrower payload by copying an allow-list. Broker fees, proc fees, commission, staff notes, `BROKA`, and charge-position jargon are removed before `JSON.stringify`. The anon key is used only to subscribe to a Realtime broadcast that says "refresh". It cannot read the table.

## Local

```bash
cd portal
npm install
npm test
npm run dev
```

Demo routes work with no environment variables. Set these for live tokens and Realtime:

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vgflcrfaudrvrdmxjdtl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key. Realtime subscribe only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never `NEXT_PUBLIC_`. |

Apply `supabase/migrations/20261126_borrower_portal.sql` in the Supabase SQL editor once. Staff create a link by storing the SHA-256 of the token, never the token itself:

```sql
insert into public.borrower_portal_links (token_hash, vertical, case_ref, borrower_name, deck_ready, source)
values (
  encode(extensions.digest('paste-the-unguessable-token', 'sha256'), 'hex'),
  'posfin-capital',
  'CASE-REF',
  'Borrower name',
  false,
  '{"property":{"address":"","postcode":"","type":"","summary":""},"loan":{"amount":0,"purpose":"","term_months":12,"regulated":false},"valuation":{"avm":0,"works":"none"}}'::jsonb
);
```

`source` may contain internal fields. The app strips them. Set `deck_ready` when the deck can go to lenders. Borrower KYC and solicitor choices are written to `borrower_state`.

## Vercel

Create a project (or a second project) from this GitHub repository.

1. **Root Directory:** `portal`
2. Framework preset: Next.js. Build command `npm run build`. Install command `npm install`.
3. Environment variables (Production and Preview):

| Name | Environments |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview. Sensitive. |

4. Deploy. Do not set the root directory to the repository root. That deploy is the static marketing site.

Open `/posfin-capital/portal/demo` on the deployment to confirm the example deck, the green deck-ready light, and the four steps.

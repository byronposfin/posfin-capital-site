# Porting into Tom's SmartLink app

Target repo: **https://github.com/byronposfin/posfin-capital-site** (Next.js on Vercel, case-token smart links, Supabase). This module was built standalone and has not been merged. Nothing here touches the repo.

## 1. What to copy

```
lib/engine/        form engine: types, conditions, validation, money, format, flatten (CRM export)
lib/forms/         al.ts, al-calc.ts, works.ts, works-calc.ts, remortgage.ts (+ remortgage.spec.json), registry.ts
lib/brands.ts      brand registry (posfin | ackroyds | unbranded, plus future firms)
lib/export/        al-rows.ts, works-rows.ts, pdf.ts (jsPDF), xlsx.ts (exceljs)
lib/storage/       adapter interface + local JSON + Supabase
lib/api.ts, lib/server.ts, lib/cases.ts (replace, see section 3)
components/        FormRunner, StepNodes, fields, Panels, AnswersSummary, StatementShell, BrandChrome, PrintButton, FormPage
app/al|remortgage|works/[token]/…   pages
app/api/forms/[form]/[token]/…      GET/PUT draft, POST submit, export, pdf, xlsx
public/brands/ackroyds/             Ackroyd Legal logos (official, from ackroydlegal.com)
supabase/migrations/20261118_smartlink_forms.sql
tests/
```

Dependencies: `exceljs jspdf jspdf-autotable @supabase/supabase-js server-only`. Dev dependencies: `vitest`, and `playwright` for screenshots. Tailwind v4 (`@import "tailwindcss"` + `@theme` in `app/globals.css`). Merge the `@theme`, `.statement`, print and animation blocks into Tom's global CSS. Fonts: `next/font/google` with Inter and Playfair Display (see `app/layout.tsx`).

`next.config.ts`: keep `serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"]`. The PDF and XLSX routes run on the `nodejs` runtime.

## 2. Routes

| Route | Purpose |
|---|---|
| `/al/[token]` | A&L conversational form |
| `/al/[token]/statement` | Lender A&L statement (print to A4 landscape, PDF, XLSX, CRM JSON) |
| `/remortgage/[token]?brand=general\|ackroyds&titleInsurance=1\|0` | Remortgage questionnaire |
| `/remortgage/[token]/summary` | Printable answers summary |
| `/works/[token]?brand=posfin\|unbranded` | Schedule of Works |
| `/works/[token]/statement` | SoW statement (print, PDF, XLSX, CRM JSON) |
| `GET/PUT /api/forms/{al\|remortgage\|works}/{token}` | Load or autosave a draft |
| `POST /api/forms/{form}/{token}/submit` | Server re-validates everything, stores status `submitted` |
| `GET /api/forms/{form}/{token}/export` | Flat CRM JSON (`posfin.smartlink.<form>.v001`) |
| `GET /api/forms/{al\|works}/{token}/pdf` and `/xlsx` | Downloads |

If Tom's smart links already use a path such as `/s/[token]/…`, mount these as sub-routes. The pages only need `token` and `searchParams`.

## 3. Wiring to real cases

1. **Case lookup:** replace `getCase()` in `lib/server.ts` (currently demo tokens from `lib/cases.ts`) with Tom's case-token lookup. Return the `CaseInfo` shape: `ref`, `applicant` (name, email, mobile, company, referred_by), `brand` default per form, `flags.titleInsurance`, and `prefill`. `prefill` is keyed by the spec's `prefill.source` strings, e.g. `crm.borrower.mobile` or `title.tenure`. Fields with a matching key show the "From your file — please check" badge.
2. **Storage:** set `SMARTLINK_STORAGE=supabase`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only). Run the migration. It creates `case_assets_liabilities`, `case_remortgage_questionnaire` and `case_schedule_of_works`, with RLS on and no client policies. Point the commented FK lines at Tom's cases table.
3. **Auth:** borrower routes are token-gated only, the same as existing smart links. Put `/export`, `/pdf`, `/xlsx` and the statement pages behind staff auth if they shouldn't be borrower-visible. Today they are open for demo review.
4. **Notifications:** `submit/route.ts` has a marked hook for the CRM webhook, case-owner alert and e-sign prep.
5. **Demo-only behaviour:** `?step=<id>` deep links and client flag overrides only work for `demo*` tokens.

## 4. Adding a solicitor firm (config only)

Add an entry to `BRANDS` in `lib/brands.ts`: name, `kind: "cobrand"`, logos (drop the files in `public/brands/<id>/`), colours, intro copy per form, Q21 `howHeard` label, options and default, disclaimers, footer lines, and allowed `forms`. Then use `?brand=<id>`. No component changes are needed.

## 5. Data and privacy

- Payloads are never logged. Error logs print only the form id and an error code.
- Tokens are regex-checked (`[A-Za-z0-9_-]{3,64}`) before any storage access, which prevents path traversal on the local adapter.
- The bodies are capped at 512 KB.
- The remortgage payload includes the nominated bank account (addition C). Treat the `case_remortgage_questionnaire.payload` column as sensitive. Summaries mask the account number.
- File uploads record **metadata only** (name, size, type) in v001. Wire them to Tom's existing upload/storage bucket before go-live.

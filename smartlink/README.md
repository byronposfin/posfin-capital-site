# Posfin SmartLink forms (v001)

These are three borrower-facing SmartLink sections. They run on one field-schema-driven form engine and are mobile-first:

1. **Assets & Liabilities**: `/al/[token]` → lender statement `/al/[token]/statement` (A4 landscape, PDF, XLSX in Albatross column order)
2. **Remortgage questionnaire**: `/remortgage/[token]?brand=general|ackroyds` (approved spec v001, plus a Title insurance section), with a summary at `/remortgage/[token]/summary`
3. **Schedule of Works**: `/works/[token]?brand=posfin|unbranded` → `/works/[token]/statement`

```
npm install
npm run build && npm start      # http://localhost:3100  (index of demo links at /)
npm test                        # calcs + validation + spec coverage
npm run screenshots             # needs the server running; writes ./screenshots
```

Demo tokens: `demo` (full FICTIONAL case), `demo-blank` (empty), `demo-noti` (title insurance off). Drafts save to `./data/` by default. Set `SMARTLINK_STORAGE=supabase` to use Supabase.

See **PORTING.md** for how to drop this into posfin-capital-site, **DECISIONS.md** for spec gaps and open questions, and **SOW_AUDIT.md** for the Schedule of Works research.

Posfin Capital is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 913022. NACFB member.

## Lender criteria intake (v002)

`/lender/demo` (filled), `/lender/demo-blank`, `/lender/demo?brand=unbranded`, summary at `/lender/[token]/summary`, exports at `/api/forms/lender/[token]/{pdf,xlsx,export}`. Migration `supabase/migrations/20261119_lender_criteria.sql` (not run). Full design, mapping to BROKA/PLACED, decline-feedback loop and open questions: see `LENDER_CRITERIA.md`.

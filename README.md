# FOMO consignor portal

Private site at consignors.fomorentals.co.uk where consignors see their kit's earnings, statements and self-billing invoices, and Sam publishes each month's payouts. Full spec: `docs/SPEC.md`.

## What's here so far

| Part | Where |
| --- | --- |
| Revenue per item per month, the way Rentman's consignment report works it out | `lib/revenue.ts` |
| A consignor's statement (share, adjustments, VAT), self-billing number, Xero dates | `lib/payout.ts` |
| The checks Sam clears before Publish | `lib/checks.ts` |
| Firestore collections (`consignor_accounts`, `consignor_months`, `consignor_audit`) | `lib/store.ts` |
| Staff sign-in (Google, Sam and Jamie only) and the month and consignor pages | `auth.ts`, `app/admin/` |

Consignor sign-in, Publish (PDFs, Xero draft bills, emails) and the nightly Rentman read come next.

## Environment variables (Vercel, production)

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs session cookies. `openssl rand -base64 32`, set without printing. |
| `AUTH_URL` | `https://consignors.fomorentals.co.uk` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client for staff sign-in (Internal). Redirect `https://consignors.fomorentals.co.uk/api/auth/callback/google`. |
| `GOOGLE_WORKSPACE_DOMAIN` | Optional, default `fomorentals.co.uk`. |
| `STAFF_EMAILS` | Optional, comma-separated. Default Sam and Jamie (`lib/staff.ts`). |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Same Firebase service account as the other FOMO apps (project `fomo-bookings-board-v2`). |

## Scripts (run on Jamie's Mac)

Need Node 24 and `gcloud auth application-default login`. `data/` is git-ignored: it holds booking data and emails.

- `npm run rebuild:pull`: reads Rentman once (about 200 GETs through the shared guard, read only; needs `RENTMAN_TOKEN`) and saves consignor bookings to `data/`.
- `node scripts/seed-accounts.ts data/consignor-accounts.csv [--write]`: adds consignor accounts that don't exist yet. Never changes an existing one. Dry run without `--write`.
- `node scripts/build-month.ts data/rebuild-pull-<time>.json 2026-10`: works out a month's draft from a saved pull and saves it to Firestore. Keeps Sam's adjustments and sign-offs; refuses a published month. No Rentman calls.

## Checks

`npm test` (node's test runner) and `npm run lint` (eslint and tsc). The Jan–Oct 2026 rebuild against the Consignment Tracker 2026 matched 163 of 172 consignor-months to within 6p, and 229 of 230 payouts; the gaps are explained in the PRs that added the rules.

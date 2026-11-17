# Consignor portal: spec

**Agreed with Jamie, 17 Nov 2026** (thread "Spec the consignor portal"). This replaces the 16 Nov scope doc (https://claude.ai/artifact/NW5bgwTeQUyXMkCxW4kJN9) wherever they differ. Nothing is built yet.

## 1. What it is

A private website at **consignors.fomorentals.co.uk** where every consignor (people and companies whose kit FOMO rents out for a share of the revenue) sees what their kit earned, gets their monthly statement and self-billing invoice, and where Sam checks and publishes each month's payouts. It replaces the **Consignment Tracker 2026** spreadsheet and the Xero bill CSV import.

- Built for **all consignors at once** (23 in the 2026 tracker), not FKF first.
- Consignors only look; they change nothing.
- Revenue comes from Rentman. Payouts go to Xero as draft bills. The portal never writes to Rentman.

## 2. Who uses it

| Who | What they can do |
|---|---|
| Consignors | Log in with an emailed magic link. See only their own account(s). |
| Sam (Operations Director) | Check each month, add deductions/manual lines, clear the safety checks, Publish. Change rates and VAT settings. |
| Jamie | Everything Sam can do (backup publisher), plus see every consignor's pages. |

- A consignor account can have **several login emails** (e.g. MG is Max Gabbay and Joe Cretney).
- One email can see **several consignor accounts** and switch between them (e.g. Taran: Apollo and F&M Media).
- FKF One (code JM): James Moore logs in with his own email.
- A login keeps working for **12 months after the consignor's last payout**, then switches off. Past statements and invoices are kept forever.

## 3. What consignors see

1. **Overview:** earnings this month (last published month), this year, and since they started; how many of their items are out on hire today ("3 of your 12 items are out today").
2. **My kit:** every item they own with earnings for the month and year, and how many days it was out ("out 14 days this month", "out 62% of the time this year").
3. **Statements:** one per published month, from **January 2026**: each item's hire revenue, their share, any adjustments with reasons, net payout, VAT, total. PDF download. For consignors on self-billing, the self-billing invoice PDF too.

**Not shown (Jamie, 17 Nov):** no job, customer or hire-date data of any kind; no purchase price, payback or investment tranche.

## 4. How the money is worked out

- **Revenue:** the hire revenue Rentman records against each item whose **Consigned** field (Rentman equipment custom field `custom_4`) holds the consignor's code, for the month, excluding VAT, after discounts. Same figure as the Rentman report pasted into the monthly tabs of the tracker today.
- **Kits:** only the parent "Kit" record carries the consignor code; its contents are deliberately blank unless rentable on their own. Revenue is taken from the tagged record. (Shared Drive `rentman-data-model.md`: do not "fix" blank constituents.)
- **Jobs spanning two months:** Jamie believes the Rentman report already splits revenue by month. **Verify during the rebuild** (section 8) and match whatever the tracker did.
- **Rate:** each consignor has a share, **default 50%**, editable by Sam or Jamie. A change takes effect from a chosen date; earlier months are untouched. Every change records who, when and from what date. (2026 tracker today: 50% for all, except Apollo and F&M Media at 100%; Dark Chamber was 70% in 2025.)
- **Adjustments:** when checking a month, Sam can add lines (deduction for money owed to FOMO, or a manual credit) with an amount and a reason. Shown on the statement.
- **VAT:** each consignor has a VAT setting (20% "VAT on Expenses" or "No VAT", as in Xero). Statement shows net, VAT and total.
- **Payment method** per consignor: Self billing / Their own invoice / Rentman credit.

## 5. Each month

1. **1st of the month:** the portal builds a **draft** for every consignor for the month just ended. Rentman is read once a night; Sam has a **Refresh now** button before signing off.
2. **Safety checks** run automatically. Each warning must be ticked off or explained by Sam before Publish is allowed:
   - total consignor revenue adds up to Rentman's own total for those items in the month;
   - kit with a Consigned code no consignor account has (typos, new consignors not set up);
   - consignor kit that has earned nothing for 3 months;
   - any consignor whose payout moved more than 50% from the month before.
3. **Nudge:** if the month isn't published by the **3rd working day**, Sam gets a Slack message.
4. **Sam (or Jamie) presses Publish.** Nothing appears to consignors before this; there are no provisional mid-month figures. Publishing:
   - puts the statements live in the portal;
   - makes a **self-billing invoice PDF** for each consignor on self-billing: consignor's name, address and VAT number (from their Xero contact), FOMO's details, the HMRC "self-billed invoice" wording, and a number that never repeats, e.g. **CONS-JM-2026-10**;
   - creates a **draft bill in Xero** for every consignor with a payout, attached PDF, account code 327, the consignor's tax type, due at the end of the following month (as today). Sam still approves each bill in Xero; nothing is paid automatically;
   - emails each consignor that their statement is ready, with a link and **no figures** in the email (replaces the sheet's own emails), from the address the sheet sends from today (accounts@ if unclear: check before build).
5. **After publishing:** for consignors who send their own invoice, Sam ticks "invoice received". For Rentman-credit consignors (Christoph Trestler), the portal shows "pay as Rentman credit" and Sam applies the credit in Rentman by hand.

## 6. Admin pages (Sam and Jamie)

- **Month view:** every consignor's revenue, share, adjustments, net, VAT, total, payment method, check warnings, Publish button; Xero bill status after publishing; CSV export.
- **Consignors:** name, Xero contact, Rentman code(s), login emails, rate history, VAT setting, payment method, active/left.
- Audit trail of every rate/VAT change, adjustment, warning sign-off and publish.

## 7. Open items

- **Apollo and F&M Media (Taran):** both on 100%, revenue from a separate sheet in round amounts, not Rentman. Jamie to settle with Sam. Until then the build assumes Sam enters them as manual lines.
- **Sender address** for consignor emails (step 5.4): confirm which address the tracker sends from today.

## 8. Getting there

1. **Rebuild January to October 2026 for every consignor** from Rentman and match the Consignment Tracker 2026 to the penny, month by month. Explain every gap before anyone outside FOMO sees anything (the FKF Investment Tracker 2026 Jan–Mar is a second check for JM).
2. **November 2026 runs in parallel** in the sheet and the portal. If they match, the portal takes over from **December 2026**; the sheet stays read-only as history.
3. Invite consignors once November matches.

## 9. Sources

- **Consignment Tracker 2026** (the reconciliation target): https://docs.google.com/spreadsheets/d/1uYYNQ0gHvXFHNBLL3ztbOvZkxUyTpLmZBKBCeuSiX4w — Summary (consignor, Xero account, RM code, email, monthly payouts), monthly tabs (raw Rentman revenue per item, split, debt, VAT, payment method, invoice received, paid), Bill_Import (Xero bill CSV).
- FKF Investment Tracker 2026: https://docs.google.com/spreadsheets/d/1uL-pLhJidUOYmt6B4cSpAea7JJ8PrhnmPf9U8t78ctI
- Monthly Consignment Payout Tracker 2025 (history): https://docs.google.com/spreadsheets/d/1abOT03g_EE_xXt_5sIUGyxsUZK_NXO0HI-IB8oO9i2Y
- Signed consignment contracts: FOMO Shared Drive, one per consignor.

## 10. Build notes (for the engineer)

- New repo in FOMORentals, Next.js on Vercel (team fomo12), auto-deploy from `main`, domain consignors.fomorentals.co.uk. Data in Firestore `fomo-bookings-board-v2` (own collections, e.g. `consignor_*`); no whole-collection reads from pages.
- **Rentman:** read only, every call through the shared guard (`fomo-rentman-core`). One nightly read plus Sam's Refresh button. Work out the API equivalent of the Rentman revenue-per-item report first; that is the main technical risk, and the Jan–Oct rebuild proves it.
- **Approvals already given by Jamie (17 Nov) under the house rules:** Xero writes (draft bills + attachments only), customer-facing email (statement-ready notice), a new nightly scheduled job and the 1st-of-month / 3rd-working-day jobs (each needs identity, timeout, lock, own minute). Anything beyond that still needs Jamie.
- Self-billing invoices: Jamie says consignors are already set up for self-billing in Xero; check the HMRC required fields against the existing setup before the first real invoice.
- New app housekeeping: add to `fomo-whats-new/lib/apps.ts`, copy the PR template and "Team note picture" check, add the repo to the What's new GitHub token, add to the status dashboard.
- Nothing fails silently: failed nightly read, Xero bill creation or email send alerts #systems-alerts with a plain-English "what to do".

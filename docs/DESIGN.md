# Consignor portal: design decisions

Jamie's decisions for this app, with who made each and when. Claude reads this file at every #app-requests
request, so keep it current: when a decision is made or changed, write it here the same day (rule 7).

## App card
Approved by Jamie, 24 Nov 2026. #app-requests uses this card to tell which app a request belongs to; a request
for something under "Must never" goes against Jamie's decision, so it goes to Jamie as a proposal. Change it
only with Jamie's OK, in the same pull request as the change.

- **What it's for:** Consignors see what their kit earned and their monthly statements; Sam checks and publishes payouts. Being built: the spec is docs/SPEC.md.
- **Who uses it:** Consignors (read only); Sam and Jamie.
- **Must never:** Show job, customer or hire-date data, purchase price or payback; write to Rentman; pay anything (Xero bills stay drafts).
- **Belongs elsewhere:** Kit-level fleet numbers (Inventory dashboard).

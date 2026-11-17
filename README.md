# FOMO consignor portal

Private site at consignors.fomorentals.co.uk where consignors see their kit's earnings, statements and self-billing invoices, and Sam publishes each month's payouts. Full spec: `docs/SPEC.md`.

## Step 1: rebuild Jan–Oct 2026 from Rentman

`npm run rebuild:pull` reads Rentman once (about 185 GETs through the shared guard, read only) and saves the consignor bookings to `data/` (git-ignored). The comparison against the Consignment Tracker 2026 runs offline on that file.

Needs: Node 24, `RENTMAN_TOKEN` in the environment, and `gcloud auth application-default login` (the guard reads the shared Rentman circuit in Firestore `fomo-bookings-board-v2`).

No tests yet: the pull script is plain I/O with no logic of its own; the month and revenue rules get tests when they are written (step 2).

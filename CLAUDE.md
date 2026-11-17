# fomo-consignor-portal

Read `../FOMO-ENGINEERING-RULES.md` (and `FOMO-ENGINEERING-GUIDELINES.md`) first. The spec is `docs/SPEC.md`.

- Rentman: read only, every call through `@fomo/rentman-core/rentman-guard` (vendored .tgz, copy of fomo-kit-onboarding's). State the call budget at the top of every file that calls Rentman.
- `data/` holds Rentman pulls and comparison output; it is git-ignored (it contains booking data).
- Never read or print `.env*` or secret values.

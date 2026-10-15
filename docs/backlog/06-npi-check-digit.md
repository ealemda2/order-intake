# Flag invalid NPIs with the check-digit rule
labels: demo-live

## What to build
`providerNpi` values that fail the NPI check digit (Luhn over the 10-digit NPI prefixed with 80840) get flag `npi_invalid`. The value is kept verbatim. RESERVED FOR THE LIVE DEMO: do not implement ahead of time.

## Acceptance criteria
- [ ] Pure validator tested at its own seam with known-good and known-bad NPIs
- [ ] Wired into `runPipeline`
- [ ] `invalidCatchRate` rises on golden orders 06 and 11; no other gate moves; eval-check table in the PR

## Blocked by
- Classify and extract an order's fields with Claude

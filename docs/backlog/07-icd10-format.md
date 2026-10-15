# Flag malformed ICD-10-CM codes
labels: demo-live

## What to build
`icd10` values that don't have the ICD-10-CM shape (letter, digit, alphanumeric, optional "." and 1 to 4 alphanumerics) get flag `icd10_invalid`. Copied verbatim, never corrected. RESERVED FOR THE LIVE DEMO (runs in the second worktree).

## Acceptance criteria
- [ ] Pure validator tested at its own seam
- [ ] Wired into `runPipeline`
- [ ] `invalidCatchRate` rises on golden orders 09 and 12; eval-check table in the PR

## Blocked by
- Classify and extract an order's fields with Claude

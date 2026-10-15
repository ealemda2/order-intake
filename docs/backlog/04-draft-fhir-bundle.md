# Map a PipelineResult to a draft FHIR R4 Bundle
labels: ready-for-agent

## What to build
`toDraftBundle(result)` returns a `fhir4.Bundle` (collection) with Patient, Practitioner (NPI identifier), ServiceRequest (`status: draft`, `intent: order`, ICD-10-CM reason, CPT or HCPCS code) and a Provenance naming the model and prompt version. Abstained fields are omitted, flags travel as extensions. See PLAN.md, "Build now" item 4.

## Acceptance criteria
- [ ] Pure function using `@types/fhir` types; unit tests against golden orders 01 and 10 (referral: no code)
- [ ] No resource field is invented when the source field abstained
- [ ] `pnpm intake <file> --fhir` prints the bundle

## Blocked by
None (can start immediately)

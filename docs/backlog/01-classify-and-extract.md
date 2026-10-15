# Classify and extract an order's fields with Claude
labels: ready-for-agent

## What to build
`runPipeline` classifies an inbound document (lab, imaging, DME, referral, not-an-order) and extracts the eight fields with a source quote each, using `claude-sonnet-5-5` with structured output generated from the zod contract. Not-an-order documents abstain on every field. `pnpm intake <file>` prints the result. See PLAN.md, "Build now" item 1.

## Acceptance criteria
- [ ] Prompt in `src/pipeline/prompts/extract.md` with an exported `PROMPT_VERSION`; `meta.model` and `meta.promptVersion` set on every result
- [ ] Model output parsed with the contract's zod schemas; a parse failure throws with a clear message
- [ ] Model client injected; unit tests use a fake and never hit the network
- [ ] `pnpm eval` runs end to end; eval-check run and its table attached to the PR (expected to escalate: first real baseline is a human decision)

## Blocked by
None (can start immediately)

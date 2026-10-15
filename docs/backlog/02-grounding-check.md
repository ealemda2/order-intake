# Flag fields whose source quote is not grounded in the document
labels: ready-for-agent

## What to build
A deterministic stage after extraction that adds flag `ungrounded` when a field's source quote is not in the document text, or when the value is not supported by its own quote. Validators flag, never mutate. See PLAN.md, "Build now" item 2.

## Acceptance criteria
- [ ] Pure function, tested at its own seam (dates, Last-First names, codes with hyphens)
- [ ] Wired into `runPipeline`
- [ ] No `ungrounded` finding in `.eval/latest.json` is left unflagged; eval-check table in the PR

## Blocked by
- Classify and extract an order's fields with Claude

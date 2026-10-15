# Trace the pipeline's model calls in LangSmith
labels: ready-for-agent

## What to build
Classify/extract calls appear in LangSmith tagged with route, model and prompt version, with the run URL in `meta.traceUrl`. Document text is masked when `LANGSMITH_HIDE_INPUTS=true`. A no-op when tracing is off. See PLAN.md, "Build now" item 3.

## Acceptance criteria
- [ ] Runs visible in the `order-intake` project after `pnpm eval`, one trace per document
- [ ] Tags: `route`, `model`, `promptVersion`
- [ ] Tests still pass with tracing off and no network

## Blocked by
- Classify and extract an order's fields with Claude

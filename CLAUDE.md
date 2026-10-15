# Order Intake: agent guide

Turns the text of an inbound medical order into a draft FHIR R4 Bundle that a human verifies before patient matching.
The model drafts; deterministic checks flag; a human signs off. Vocabulary: @GLOSSARY.md

## Commands
- Install `pnpm i` · Typecheck `pnpm typecheck` · Tests `pnpm test` (one file: `pnpm exec vitest run <path>`)
- Evals `pnpm eval` (gates vs `evals/baseline.json`; one doc: `pnpm eval --filter <doc-id>`)
- Run one order `pnpm intake evals/datasets/orders/<doc-id>.txt` · Review UI `pnpm web`

## Where things are
- `src/contract.ts`: the PipelineResult contract the evals grade. Change it only with a ticket that says so.
- `src/pipeline/index.ts`: `runPipeline`, the single seam evals and the CLI call. One module per stage under `src/pipeline/`.
- `src/pipeline/prompts/`: prompts are versioned files; bump `PROMPT_VERSION` when you change one.
- `evals/`: golden set, scorer, gates, baseline. Human-owned, write-blocked by a hook. Read freely.
- `PLAN.md`: what we are building and what is deliberately out of scope.

## Workflow
- Tickets are GitHub issues. Branch `feat/<issue>-<slug>`, conventional commits, never commit to main.
- Build test-first at agreed seams (`/tdd`). Unit tests never call a real model: inject the model client.
- Before a PR: `pnpm typecheck && pnpm test`, then the `eval-check` skill. PR body follows the `pr` skill with eval evidence.

## Gotchas
- `.env` holds API keys: never read or print it. Synthetic data only; no real PHI anywhere, including traces.
- Dates in results are ISO `YYYY-MM-DD`; documents print them many ways.
- Copy codes and identifiers verbatim, even when they look wrong. Flag them; never "correct" them.

## Escalate, don't guess
- IMPORTANT: if an eval gate fails, a hook blocks you, or you are unsure about a clinical value, stop and use the `escalate` skill.

## Compaction
- Keep: ticket number, modified files, failing test names, latest eval gate table.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage roles, label strings unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
